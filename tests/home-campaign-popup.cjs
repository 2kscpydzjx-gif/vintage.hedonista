const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {fixture}=require('./cms-browser-fixture.cjs');
const base='http://127.0.0.1:8765',photo=base+'/assets/test-upload.png';
const root=path.resolve(__dirname,process.env.VH_TEST_BUILT==='1'?'../dist':'..');
const revision={shared:{cmsPageDraft:{existing:{'existing-0':{design:{photoPreset:'gradient-hero'},images:{image0:photo}}}}}};
(async()=>{
 const fixtures=[];
 try{
  async function page(id,width=390,height=844,extra={}){
   const f=await fixture({reducedMotion:'reduce',hasTouch:true});fixtures.push(f);
   f.user(null);f.session(null);f.settings({hero_title:'VINTAZHKA',hero_main_image:photo});f.set('home','published',revision);
   if(process.env.VH_CAMPAIGN_PHOTO)await f.context.route('**/assets/test-upload.png*',r=>r.fulfill({contentType:'image/png',body:fs.readFileSync(process.env.VH_CAMPAIGN_PHOTO)}));
   const p=await f.context.newPage();p.on('close',()=>{void f.browser.close()});await p.setViewportSize({width,height});
   const time=new Date('2026-11-26T12:00:00Z');await p.clock.install({time});await p.clock.pauseAt(time);
   await p.route('**/home-campaign-config.js*',r=>r.fulfill({contentType:'text/javascript',body:fs.readFileSync(path.join(root,'home-campaign-config.js'),'utf8')+'\nwindow.VH_HOME_CAMPAIGN={...VH_HOME_CAMPAIGN,popup:{...VH_HOME_CAMPAIGN.popup,...'+JSON.stringify({id,...extra})+'}};'}));
   await p.goto(base+'/index.html');await p.locator('.vh-hero-controls').waitFor();return p;
  }
  async function advance(p,at=5000){await p.clock.runFor(Math.max(0,at-await p.evaluate(()=>performance.now())))}
  for(const [width,height] of [[320,568],[390,844],[1440,900],[390,480]]){
   const p=await page('layout-'+width+'-'+height,width,height);
   await advance(p,4999);assert.equal(await p.locator('.vh-campaign-popup').count(),0,'popup opened before five seconds');
   await advance(p);const dialog=p.getByRole('dialog',{name:'ЧОРНА П’ЯТНИЦЯ',exact:true});await dialog.waitFor();
   assert.equal(await dialog.evaluate(el=>el.matches(':modal')),true);
   const b=await dialog.boundingBox();assert.ok(b.x>=0&&b.y>=0&&b.x+b.width<=width+1&&b.y+b.height<=height+1,'popup overflows viewport');
   const button=dialog.getByRole('link',{name:'ПЕРЕГЛЯНУТИ ЗНИЖКИ'}),image=dialog.locator('picture'),copy=dialog.locator('.vh-campaign-popup__copy');
   assert.equal(new URL(await button.getAttribute('href')).searchParams.get('sale'),'1');
   assert.ok((await copy.boundingBox()).y>=(await image.boundingBox()).y+(await image.boundingBox()).height-1,'copy must follow photo');
   assert.equal(await dialog.locator('img').getAttribute('src'),photo);
   assert.equal(await p.evaluate(()=>document.documentElement.style.overflow),'hidden');
   assert.equal(await p.getByRole('button',{name:'Закрити оголошення'}).evaluate(el=>el===document.activeElement),true);
   await p.keyboard.press('Tab');assert.equal(await button.evaluate(el=>el===document.activeElement),true);
   await p.keyboard.press('Tab');assert.equal(await p.getByRole('button',{name:'Закрити оголошення'}).evaluate(el=>el===document.activeElement),true,'focus left the modal');
   await dialog.locator('img').evaluate(el=>el.decode());
   if(width===390&&height===844||width===1440){fs.mkdirSync('test-results/black-friday',{recursive:true});await p.screenshot({path:'test-results/black-friday/popup-'+width+'.png'})}
   await p.getByRole('button',{name:'Закрити оголошення'}).click();await dialog.waitFor({state:'hidden'});await p.clock.runFor(32);
   assert.equal(await p.evaluate(()=>document.documentElement.style.overflow),'');
   await p.reload();await p.locator('.vh-hero-controls').waitFor();await advance(p,10000);assert.equal(await p.locator('.vh-campaign-popup[open]').count(),0,'dismissed campaign reopened');await p.close();
  }
  const escape=await page('escape');await escape.locator('#heroCatalogBtn').focus();await advance(escape);await escape.keyboard.press('Escape');await escape.clock.runFor(32);
  await escape.locator('.vh-campaign-popup').waitFor({state:'hidden'});assert.equal(await escape.locator('#heroCatalogBtn').evaluate(el=>el===document.activeElement),true,'Escape did not restore focus');
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
  for(const f of fixtures){assert.deepEqual(f.records.get('home:published').shared,revision.shared);assert.equal(f.calls.some(c=>c.op!=='select'),false);assert.deepEqual(f.errors,[])}
  console.log('PASS: popup opens after five seconds, photo above copy/CTA at four viewport sizes, native focus/Escape/backdrop/close, persistent dismissal, cookie/menu deferral, independent off switch and sale navigation. No CMS writes.');
 }finally{await Promise.all(fixtures.map(f=>f.browser.close()))}
})().catch(e=>{console.error(e);process.exitCode=1});
