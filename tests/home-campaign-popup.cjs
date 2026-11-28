const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {fixture}=require('./cms-browser-fixture.cjs');
const {campaign,mockCampaignPhotos,verifyFrame}=require('./campaign-photos.cjs');
const base='http://127.0.0.1:8765',photo=base+'/assets/test-upload.png';
const root=path.resolve(__dirname,process.env.VH_TEST_BUILT==='1'?'../dist':'..');
const revision={shared:{cmsPageDraft:{existing:{'existing-0':{design:{photoPreset:'gradient-hero'},images:{image0:photo}}}}}};
(async()=>{
 const fixtures=[];
 try{
  async function page(id,width=390,height=844,extra={}){
   const f=await fixture({reducedMotion:'reduce',hasTouch:true});fixtures.push(f);
   f.user(null);f.session(null);f.settings({hero_title:'VINTAZHKA',hero_main_image:photo});f.set('home','published',revision);
   await mockCampaignPhotos(f.context,f.png);
   if(process.env.VH_CAMPAIGN_PHOTO)await f.context.route('**/assets/test-upload.png*',r=>r.fulfill({contentType:'image/png',body:fs.readFileSync(process.env.VH_CAMPAIGN_PHOTO)}));
   const p=await f.context.newPage();p.on('close',()=>{void f.browser.close()});await p.setViewportSize({width,height});
   const time=new Date('2026-11-27T06:43:34Z');await p.clock.install({time});await p.clock.pauseAt(time);
   await p.route('**/home-campaign-config*.js*',r=>r.fulfill({contentType:'text/javascript',body:fs.readFileSync(path.join(root,'home-campaign-config.js'),'utf8')+'\nwindow.VH_HOME_CAMPAIGN={...VH_HOME_CAMPAIGN,popup:{...VH_HOME_CAMPAIGN.popup,...'+JSON.stringify({id,...extra})+'}};'}));
   await p.goto(base+'/index.html');await p.locator('.vh-hero-controls').waitFor();
   // Align wall time with navigation time after installing the virtual clock.
   await p.clock.setSystemTime(new Date(time.getTime()+await p.evaluate(()=>performance.now())));return p;
  }
  async function advance(p,at=5000){await p.clock.runFor(Math.max(0,at-await p.evaluate(()=>performance.now())))}
  for(const [width,height] of [[320,568],[390,844],[1440,900],[390,480]]){
   const p=await page('layout-'+width+'-'+height,width,height);
   await advance(p,4999);assert.equal(await p.locator('.vh-campaign-popup').count(),0,'popup opened before five seconds');
   await advance(p);const dialog=p.getByRole('dialog',{name:'BLACK FRIDAY',exact:true});await dialog.waitFor();
   assert.equal(await dialog.evaluate(el=>el.matches(':modal')),true);
   const b=await dialog.boundingBox();assert.ok(b.x>=0&&b.y>=0&&b.x+b.width<=width+1&&b.y+b.height<=height+1,'popup overflows viewport');
   assert.ok(Math.abs(b.x+b.width/2-width/2)<1&&Math.abs(b.y+b.height/2-height/2)<1,'popup is not centered in the viewport: '+JSON.stringify({viewportWidth:width,viewportHeight:height,...b}));
   const button=dialog.getByRole('link',{name:'ПЕРЕГЛЯНУТИ ЗНИЖКИ'}),image=dialog.locator('picture'),copy=dialog.locator('.vh-campaign-popup__copy');
   assert.equal(new URL(await button.getAttribute('href')).searchParams.get('sale'),'1');
   const photoBox=await image.boundingBox(),copyBox=await copy.boundingBox();
   assert.ok(Math.abs(b.width/b.height-8/9)<.01,'popup proportions changed');
   if(width===1440)assert.ok(b.width>=559,'desktop popup was not enlarged');
   assert.ok(photoBox.width>=b.width-2&&photoBox.height>=b.height-2,'photo does not fill popup');
   assert.ok(copyBox.y>=photoBox.y&&copyBox.y+copyBox.height<=photoBox.y+photoBox.height+1,'copy overflows the photo');
   assert.equal(await dialog.locator('img').getAttribute('src'),new URL(campaign.popup.image,base).href);
   assert.equal(await dialog.locator('#vh-campaign-popup-description').innerText(),'ЗНИЖКИ ДО -20%');
   const countdown=dialog.getByRole('timer'),clockBox=await countdown.boundingBox(),buttonBox=await button.boundingBox();
   assert.ok(clockBox.y>=copyBox.y&&clockBox.y+clockBox.height<=buttonBox.y,'countdown overlaps the CTA');
   assert.ok(clockBox.x>=b.x&&clockBox.x+clockBox.width<=b.x+b.width,'countdown overflows popup');
   assert.equal(await countdown.getAttribute('aria-live'),'off','seconds should not interrupt screen readers');
   const theme=await button.evaluate(el=>{const s=getComputedStyle(el);return {background:s.backgroundColor,border:s.borderTopColor}});
   assert.equal(theme.background,'rgba(0, 0, 0, 0)');assert.equal(theme.border,'rgb(199, 167, 106)');
   assert.equal(await p.evaluate(()=>document.documentElement.style.overflow),'hidden');
   assert.equal(await p.getByRole('button',{name:'Закрити оголошення'}).evaluate(el=>el===document.activeElement),true);
   await p.keyboard.press('Tab');assert.equal(await button.evaluate(el=>el===document.activeElement),true);
   await p.keyboard.press('Tab');assert.equal(await p.getByRole('button',{name:'Закрити оголошення'}).evaluate(el=>el===document.activeElement),true,'focus left the modal');
   await dialog.locator('img').evaluate(el=>el.decode());
   await verifyFrame(dialog.locator('img'),campaign.popup.imageFrame);
   if(width===390&&height===844||width===1440){fs.mkdirSync('test-results/black-friday',{recursive:true});await p.screenshot({path:'test-results/black-friday/popup-'+width+'.png'})}
   await p.getByRole('button',{name:'Закрити оголошення'}).click();await dialog.waitFor({state:'hidden'});await p.clock.runFor(32);
   assert.equal(await p.evaluate(()=>document.documentElement.style.overflow),'');
   await p.reload();await p.locator('.vh-hero-controls').waitFor();await advance(p,10000);assert.equal(await p.locator('.vh-campaign-popup[open]').count(),0,'dismissed campaign reopened');await p.close();
  }
  const escape=await page('escape');await escape.locator('#heroCatalogBtn').focus();await advance(escape);await escape.locator('.vh-campaign-popup[open]').waitFor();await escape.keyboard.press('Escape');await escape.clock.runFor(32);
  await escape.locator('.vh-campaign-popup').waitFor({state:'hidden'});await escape.clock.runFor(32);assert.equal(await escape.locator('#heroCatalogBtn').evaluate(el=>el===document.activeElement),true,'Escape did not restore focus');
  assert.equal(await escape.evaluate(()=>localStorage.getItem('vh_campaign_dismissed_escape')),'1');await escape.close();
  const blocked=await page('blocked');await blocked.evaluate(()=>{const region=document.createElement('section');region.id='vh-analytics-choice';document.body.append(region)});
  await advance(blocked,8000);assert.equal(await blocked.locator('.vh-campaign-popup').count(),0,'popup covered cookie choice');
  await blocked.evaluate(()=>document.querySelector('#vh-analytics-choice').remove());await blocked.clock.runFor(1000);await blocked.locator('.vh-campaign-popup[open]').waitFor();
  await blocked.mouse.click(5,5);await blocked.locator('.vh-campaign-popup').waitFor({state:'hidden'});await blocked.close();
  const menu=await page('menu');await menu.evaluate(()=>document.body.classList.add('vh-mobile-menu-open'));await advance(menu,8000);assert.equal(await menu.locator('.vh-campaign-popup').count(),0);
  await menu.evaluate(()=>document.body.classList.remove('vh-mobile-menu-open'));await menu.clock.runFor(1000);await menu.locator('.vh-campaign-popup[open]').waitFor();await menu.close();
  const off=await page('off',390,844,{enabled:false});await advance(off,10000);assert.equal(await off.locator('.vh-campaign-popup').count(),0);await off.close();
  const disable=await page('disable-open');await advance(disable);await disable.locator('.vh-campaign-popup[open]').waitFor();
  await disable.evaluate(()=>{window.VH_HOME_CAMPAIGN={...VH_HOME_CAMPAIGN,popup:{...VH_HOME_CAMPAIGN.popup,enabled:false}};VHHomeCampaign.refresh()});
  assert.equal(await disable.locator('.vh-campaign-popup').count(),0);assert.equal(await disable.locator('.vh-hero-controls').count(),1);assert.equal(await disable.evaluate(()=>document.documentElement.style.overflow),'');await disable.close();
  const click=await page('cta');await advance(click);await click.locator('.vh-campaign-popup[open]').waitFor();
  await click.locator('.vh-campaign-popup__button').click();await click.locator('#catalogSaleOnly').waitFor();assert.equal(await click.locator('#catalogSaleOnly').isChecked(),true);assert.equal(new URL(click.url()).searchParams.get('sale'),'1');
  assert.equal(await click.evaluate(()=>localStorage.getItem('vh_campaign_dismissed_cta')),'1');await click.close();
  const preview=await page('cms-preview');await preview.goto(base+'/index.html?cms-preview=1');await advance(preview,10000);assert.equal(await preview.locator('.vh-campaign-popup,.vh-hero-controls').count(),0);await preview.close();
  // A shared absolute deadline survives navigation and differs from a per-visitor timer.
  const deadline=campaign.popup.countdownEndsAt,countdown=await page('countdown',390,844,{countdownEndsAt:deadline});
  await advance(countdown);const clock=countdown.locator('.vh-campaign-popup__countdown time');await clock.waitFor();
  assert.equal(await clock.innerText(),'06 дн · 23:59:55');await countdown.clock.runFor(1000);assert.equal(await clock.innerText(),'06 дн · 23:59:54');
  await countdown.reload();await countdown.locator('.vh-hero-controls').waitFor();await countdown.clock.runFor(5000);await clock.waitFor();
  assert.equal(await clock.innerText(),'06 дн · 23:59:49','reload restarted the seven days');
  const shared=await page('countdown-shared',390,844,{countdownEndsAt:deadline});await advance(shared,11000);await shared.getByRole('timer').waitFor();
  assert.equal(await shared.getByRole('timer').locator('time').innerText(),await clock.innerText(),'visitors have different deadlines');await shared.close();
  await countdown.clock.fastForward(86400000);assert.equal(await clock.innerText(),'05 дн · 23:59:49','returning to a throttled tab lost elapsed time');
  await countdown.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'))});
  await countdown.clock.runFor(61000);assert.equal(await clock.innerText(),'05 дн · 23:59:49','hidden timer keeps rendering');
  await countdown.evaluate(()=>{delete document.hidden;document.dispatchEvent(new Event('visibilitychange'))});
  assert.equal(await clock.innerText(),'05 дн · 23:58:48','returning to the visible tab did not catch up');
  const last=await clock.innerText();await countdown.getByRole('button',{name:'Закрити оголошення'}).click();await countdown.clock.runFor(3000);
  assert.equal(await clock.textContent(),last,'closed popup continues ticking');await countdown.close();
  const expiry=await page('expiry',390,844,{countdownEndsAt:'2026-11-27T06:43:41Z'});await advance(expiry);await expiry.getByRole('timer').waitFor();
  assert.equal(await expiry.getByRole('timer').locator('time').innerText(),'00 дн · 00:00:02');await expiry.clock.runFor(2000);
  assert.equal(await expiry.getByRole('timer').innerText(),'Акцію завершено');assert.equal(await expiry.getByRole('timer').locator('time').isVisible(),false);
  await expiry.clock.fastForward(3600000);assert.equal(await expiry.getByRole('timer').innerText(),'Акцію завершено','expired countdown restarted');await expiry.close();
  for(const countdownEndsAt of [null,'invalid']){
   const disabledClock=await page('clock-'+String(countdownEndsAt),390,844,{countdownEndsAt});await advance(disabledClock);await disabledClock.locator('.vh-campaign-popup[open]').waitFor();
   assert.equal(await disabledClock.getByRole('timer').count(),0);await disabledClock.close();
  }
  // Hero and popup share one clock, including second boundaries and late mounting.
  const synced=await page('hero-clock-sync');await synced.getByRole('button',{name:'Наступний слайд',exact:true}).click();await advance(synced,5457);await synced.locator('.vh-campaign-popup[open]').waitFor();
  const pair=()=>synced.evaluate(()=>['.vh-hero-promo__countdown time','.vh-campaign-popup__countdown time'].map(selector=>{const el=document.querySelector(selector);return {text:el.textContent,duration:el.dateTime}}));
  for(const elapsed of [0,13,431,555,900,1250]){await synced.clock.runFor(elapsed);const values=await pair();assert.deepEqual(values[0],values[1],'Hero and popup disagree between second boundaries')}
  const styles=await synced.evaluate(()=>['.vh-hero-promo__countdown','.vh-campaign-popup__countdown'].map(selector=>{const el=document.querySelector(selector),row=getComputedStyle(el),time=getComputedStyle(el.querySelector('time'));return {font:row.fontFamily,color:row.color,valueColor:time.color,numeric:time.fontVariantNumeric}}));
  assert.deepEqual(styles[0],styles[1],'countdown themes differ');
  const hidden=await pair();await synced.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'))});await synced.clock.runFor(61000);assert.deepEqual(await pair(),hidden);
  await synced.evaluate(()=>{delete document.hidden;document.dispatchEvent(new Event('visibilitychange'))});assert.deepEqual(...await pair());assert.notDeepEqual(await pair(),hidden,'both clocks failed to catch up');
  const returned=await pair();await synced.evaluate(()=>window.dispatchEvent(new PageTransitionEvent('pagehide',{persisted:true})));await synced.clock.runFor(5000);assert.deepEqual(await pair(),returned);
  await synced.evaluate(()=>window.dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true})));assert.deepEqual(...await pair());assert.notDeepEqual(await pair(),returned);
  await synced.getByRole('button',{name:'Закрити оголошення'}).click();const beforeTick=await pair();await synced.clock.runFor(1000);const afterTick=await pair();
  assert.notEqual(afterTick[0].text,beforeTick[0].text,'closing the popup stopped the Hero clock');assert.equal(afterTick[1].text,beforeTick[1].text,'closed popup is still ticking');
  const detached=await synced.locator('.vh-hero-promo__countdown time').elementHandle(),lastHero=await detached.textContent();
  await synced.evaluate(()=>{VH_HOME_CAMPAIGN={...VH_HOME_CAMPAIGN,enabled:false};VHHomeCampaign.refresh()});await synced.clock.runFor(3000);assert.equal(await detached.textContent(),lastHero,'disabled Hero clock is still ticking');await synced.close();
  for(const f of fixtures){assert.deepEqual(f.records.get('home:published').shared,revision.shared);assert.equal(f.calls.some(c=>c.op!=='select'),false);assert.deepEqual(f.errors,[])}
  console.log('PASS: popup layouts, shared deadline, exact Hero/popup synchronization and theme, hidden-tab/BFCache return, closure/disable cleanup, reload, expiry, keyboard/dismissal, sale navigation and no CMS writes.');
 }finally{await Promise.all(fixtures.map(f=>f.browser.close()))}
})().catch(e=>{console.error(e);process.exitCode=1});
