const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {fixture}=require('./cms-browser-fixture.cjs'),{mockCampaignPhotos}=require('./campaign-photos.cjs');
const root=path.resolve(__dirname,process.env.VH_TEST_BUILT==='1'?'../dist':'..'),base='http://127.0.0.1:8765';
(async()=>{const f=await fixture({reducedMotion:'no-preference'});try{
 f.user(null);f.session(null);await mockCampaignPhotos(f.context,f.png);
 f.settings({hero_title:'VINTAZHKA — МИСТЕЦТВО БУТИ СОБОЮ',hero_main_image:base+'/assets/test-upload.png'});
 f.set('home','published',{shared:{cmsPageDraft:{existing:{'existing-0':{design:{photoPreset:'gradient-hero'},images:{image0:base+'/assets/test-upload.png'}}}}}});
 await f.context.addInitScript(()=>{try{localStorage.setItem('vh_campaign_dismissed_black-friday-2026','1')}catch{}});
 await f.context.route('**/home-campaign-config*.js*',r=>r.fulfill({contentType:'text/javascript',body:fs.readFileSync(path.join(root,'home-campaign-config.js'),'utf8')+'\nwindow.VH_HOME_CAMPAIGN={...VH_HOME_CAMPAIGN,popup:{...VH_HOME_CAMPAIGN.popup,enabled:false}};'}));
 const p=await f.context.newPage();
 for(const width of [390,1366]){
  await p.setViewportSize({width,height:900});await p.goto(base+'/index.html');await p.locator('.vh-hero-controls').waitFor();await p.evaluate(()=>document.fonts.ready);
  const hero=p.locator('.hero'),before=await hero.boundingBox();await p.mouse.move(0,0);
  await p.getByRole('button',{name:'Наступний слайд',exact:true}).click();await p.waitForTimeout(140);
  const moving=await hero.evaluate(el=>({flag:el.hasAttribute('data-vh-moving'),promo:parseFloat(getComputedStyle(el.querySelector('.vh-hero-promo')).translate),original:parseFloat(getComputedStyle(el.querySelector('[data-vh-original-slide]')).translate),visibility:getComputedStyle(el.querySelector('[data-vh-original-slide]')).visibility}));
  assert.equal(moving.flag,true);assert.ok(moving.promo>0&&moving.promo<before.width);assert.ok(moving.original<0&&moving.original>-before.width);assert.equal(moving.visibility,'visible');
  fs.mkdirSync('test-results/sale-motion',{recursive:true});await p.screenshot({path:'test-results/sale-motion/slide-midpoint-'+width+'.png',clip:before,animations:'allow'});
  await p.waitForFunction(()=>!document.querySelector('.hero').hasAttribute('data-vh-moving'));const after=await hero.boundingBox();assert.ok(Math.abs(after.height-before.height)<1);
  assert.equal(await hero.getAttribute('data-vh-slide'),'1');assert.equal(await hero.evaluate(el=>el.getAnimations({subtree:true}).filter(a=>a.effect?.getKeyframes().some(k=>'translate'in k)).length),0,'finished slide animations leaked');
  await p.getByRole('button',{name:'Попередній слайд',exact:true}).click();await p.waitForTimeout(100);assert.ok(await hero.evaluate(el=>parseFloat(getComputedStyle(el.querySelector('.vh-hero-promo')).translate)>0),'previous arrow moves in wrong direction');
  await p.waitForFunction(()=>!document.querySelector('.hero').hasAttribute('data-vh-moving'));
  await p.getByRole('button',{name:'Наступний слайд',exact:true}).click();await p.evaluate(()=>{VH_HOME_CAMPAIGN={...VH_HOME_CAMPAIGN,enabled:false};VHHomeCampaign.refresh()});
  assert.equal(await p.locator('.vh-hero-promo').count(),0);assert.equal(await hero.evaluate(el=>el.getAnimations({subtree:true}).filter(a=>a.effect?.getKeyframes().some(k=>'translate'in k)).length),0,'disable left an animation running');
 }
 await p.emulateMedia({reducedMotion:'reduce'});await p.goto(base+'/index.html');await p.locator('.vh-hero-controls').waitFor();await p.getByRole('button',{name:'Наступний слайд',exact:true}).click();
 assert.equal(await p.locator('.hero').getAttribute('data-vh-moving'),null,'reduced-motion user gets a horizontal animation');
 await p.emulateMedia({reducedMotion:'no-preference'});await p.goto(base+'/index.html');await p.locator('.vh-hero-controls').waitFor();
 await p.locator('#heroCatalogBtn').click();await p.waitForURL(/catalog/);await p.goBack();await p.locator('.vh-hero-controls').waitFor();await p.mouse.move(150,250);
 const returned=await p.locator('.hero').getAttribute('data-vh-slide');await p.waitForFunction(index=>document.querySelector('.hero').dataset.vhSlide!==index,returned,{timeout:15000});
 assert.deepEqual(f.errors,[]);assert.equal(f.calls.some(c=>c.op!=='select'),false);
 console.log('PASS: complete slides travel horizontally together, previous direction, stable height, no animation leaks, mobile/desktop, reduced motion and autoplay after actual catalog/back navigation.');
}finally{await f.browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
