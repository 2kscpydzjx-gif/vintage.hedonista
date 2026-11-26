const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {fixture}=require('./cms-browser-fixture.cjs');
const {mockCampaignPhotos}=require('./campaign-photos.cjs');
const root=path.resolve(__dirname,process.env.VH_TEST_BUILT==='1'?'../dist':'..');
(async()=>{
 const f=await fixture({reducedMotion:'no-preference'});
 try{
  f.user(null);f.session(null);await mockCampaignPhotos(f.context,f.png);
  f.set('home','published',{shared:{cmsPageDraft:{existing:{'existing-0':{design:{photoPreset:'gradient-hero'},images:{image0:'http://127.0.0.1:8765/assets/test-upload.png'}}}}}});
  const p=await f.context.newPage(),time=new Date('2026-11-26T12:00:00Z');await p.clock.install({time});await p.clock.pauseAt(time);
  await p.route('**/home-campaign-config.js*',r=>r.fulfill({contentType:'text/javascript',body:fs.readFileSync(path.join(root,'home-campaign-config.js'),'utf8')+'\nwindow.VH_HOME_CAMPAIGN={...VH_HOME_CAMPAIGN,popup:{...VH_HOME_CAMPAIGN.popup,enabled:false}};'}));
  await p.goto('http://127.0.0.1:8765/index.html');await p.locator('.vh-hero-controls').waitFor();await p.evaluate(()=>document.fonts.ready);await p.clock.runFor(100);
  const hero=p.locator('.hero'),index=()=>hero.getAttribute('data-vh-slide'),outside=()=>p.locator('header .brand').first().focus();
  await p.mouse.move(0,0);await p.evaluate(()=>VHHomeCampaign.refresh());
  await p.clock.runFor(6999);assert.equal(await index(),'0','rotation started early');
  await p.clock.runFor(1);assert.equal(await index(),'1','no rotation at seven seconds');
  await p.clock.runFor(7000);assert.equal(await index(),'0','rotation did not repeat');
  assert.equal(await p.locator('.vh-hero-status').textContent(),'','automatic rotation announced unsolicited updates');
  const box=await hero.boundingBox();await p.mouse.move(box.x+100,box.y+100);await p.clock.runFor(21000);assert.equal(await index(),'0','rotation continued during hover');
  await p.mouse.move(0,0);await p.clock.runFor(6999);assert.equal(await index(),'0');await p.clock.runFor(1);assert.equal(await index(),'1');
  await p.getByRole('button',{name:'Наступний слайд',exact:true}).focus();await p.clock.runFor(14000);assert.equal(await index(),'1','rotation moved keyboard focus');
  await outside();await p.clock.runFor(7000);assert.equal(await index(),'0');
  await p.evaluate(()=>{const d=document.createElement('dialog');d.id='test-campaign-modal';document.body.append(d);d.showModal()});await p.clock.runFor(14000);assert.equal(await index(),'0','rotation continued behind modal');
  await p.evaluate(()=>{const d=document.querySelector('#test-campaign-modal');d.close();d.remove()});await p.clock.runFor(7000);assert.equal(await index(),'1');
  await p.evaluate(()=>{Object.defineProperty(document,'visibilityState',{configurable:true,value:'hidden'});document.dispatchEvent(new Event('visibilitychange'))});await p.clock.runFor(14000);assert.equal(await index(),'1','rotation continued in a hidden tab');
  await p.evaluate(()=>{delete document.visibilityState;document.dispatchEvent(new Event('visibilitychange'))});await p.clock.runFor(7000);assert.equal(await index(),'0');
  await p.getByRole('button',{name:'Зупинити автоматичне листання',exact:true}).focus();await p.keyboard.press('Enter');await outside();await p.clock.runFor(14000);assert.equal(await index(),'0','explicit pause ignored');
  await p.getByRole('button',{name:'Увімкнути автоматичне листання',exact:true}).focus();await p.keyboard.press('Enter');await outside();await p.clock.runFor(7000);assert.equal(await index(),'1');
  await p.emulateMedia({reducedMotion:'reduce'});await p.clock.runFor(14000);assert.equal(await index(),'1','reduced motion ignored');
  await p.emulateMedia({reducedMotion:'no-preference'});await p.clock.runFor(7000);assert.equal(await index(),'0');
  // A manual swipe starts a fresh seven-second interval.
  await hero.dispatchEvent('pointerdown',{pointerId:9,isPrimary:true,button:0,clientX:800,clientY:200});await hero.dispatchEvent('pointerup',{pointerId:9,isPrimary:true,button:0,clientX:680,clientY:200});assert.equal(await index(),'1');
  await p.clock.runFor(6999);assert.equal(await index(),'1');await p.clock.runFor(1);assert.equal(await index(),'0');
  await p.getByRole('button',{name:'Наступний слайд',exact:true}).focus();await p.evaluate(()=>{window.VH_HOME_CAMPAIGN={...VH_HOME_CAMPAIGN,enabled:false};VHHomeCampaign.refresh()});await p.clock.runFor(21000);assert.equal(await p.locator('.vh-hero-controls').count(),0);assert.equal(await index(),null);
  assert.deepEqual(f.errors,[]);assert.equal(f.calls.some(c=>c.op!=='select'),false);
  console.log('PASS: seven-second repeating rotation, manual reset, hover/focus/modal/hidden-tab pauses, keyboard pause/resume, reduced motion and teardown. No content writes.');
 }finally{await f.browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
