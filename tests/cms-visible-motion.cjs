const assert=require('node:assert/strict');const {fixture}=require('./cms-browser-fixture.cjs');const base='http://127.0.0.1:8765';
const wait=async(fn,message)=>{for(let i=0;i<150;i++){if(await fn())return;await new Promise(r=>setTimeout(r,35))}throw Error(message)};
const motionProbe=()=>{
 const heroCopy=()=>document.querySelector('.hero>.vh-cms-composition>.vh-cms-copy')||document.querySelector('.hero .hero-copy');
 const snapshot=()=>{const el=heroCopy();return {intro:document.body.classList.contains('vh-intro-active'),names:el?.getAnimations().map(a=>({name:a.animationName,state:a.playState,time:a.currentTime})),opacity:el&&getComputedStyle(el).opacity}};
 window.addEventListener('vh:cms-ready',()=>{window.__atReady=snapshot();requestAnimationFrame(()=>{window.__entryFrame=snapshot()})});
 document.addEventListener('vh:intro-finished',()=>requestAnimationFrame(()=>{window.__entryFrame=snapshot()}));
};
(async()=>{const f=await fixture();try{
 f.settings({hero_main_image:base+'/assets/test-upload.png',hero_top_image:base+'/assets/test-upload.png',hero_bottom_image:base+'/assets/test-upload.png'});f.delay(700);
 for(const [mode,edit] of Object.entries({native:{title:'ANIMATED HERO'},legacy:{title:'ANIMATED HERO',animation:'fade-right',design:{photoPreset:'gradient-hero'},mapped:{'static:#heroMain:0':base+'/assets/test-upload.png'},images:{image0:base+'/assets/test-upload.png'}},composition:{title:'ANIMATED HERO',animation:'system',design:{layoutVersion:1,photoPreset:'gradient-hero'},layoutImages:{0:base+'/assets/test-upload.png'}}})){
  f.set('home','published',{shared:{cmsPageDraft:{existing:{'existing-0':edit}}}});const p=await f.context.newPage();await p.addInitScript(motionProbe);await p.goto(base+'/index.html');await p.waitForFunction(()=>window.VHCMSBoot.state==='ready');
  assert.equal(await p.evaluate(()=>document.body.classList.contains('vh-intro-active')),true,mode+': fixture must include first-visit intro');
  if(mode==='legacy'){const paused=await p.evaluate(()=>window.__atReady.names);assert.ok(paused.length);assert.ok(paused.every(a=>a.state==='paused'&&a.time<30),'legacy Hero animation ran behind intro');}
  await p.waitForFunction(()=>window.__entryFrame&&!window.__entryFrame.intro&&window.__entryFrame.names?.length>0);const entry=await p.evaluate(()=>window.__entryFrame);assert.ok(entry.names.some(a=>a.state==='running'&&a.time>=0&&a.time<150),mode+': Hero animation was already finished after intro: '+JSON.stringify(entry));assert.ok(Number(entry.opacity)<1,mode+': visible entry had no fade');
  await p.reload();await p.waitForFunction(()=>window.__entryFrame&&!window.__entryFrame.intro&&window.__entryFrame.names?.length>0);assert.ok((await p.evaluate(()=>window.__entryFrame.names)).some(a=>a.state==='running'&&a.time<150),mode+': reload entry did not animate');await p.close();
 }
 for(const page of ['delivery','contacts'])for(const layout of ['native','composition']){
  const existing={};for(let i=0;i<(page==='delivery'?5:3);i++)existing['existing-'+i]={title:'CURRENT '+page+' '+i,animation:i===1?'none':'system',...(layout==='composition'?{design:{layoutVersion:1,photoPreset:'text-top'},layoutImages:{0:base+'/assets/test-upload.png'}}:{})};f.set(page,'published',{shared:{cmsPageDraft:{existing}}});
  const p=await f.context.newPage();await p.goto(base+'/'+page+'.html');await p.waitForFunction(()=>window.VHCMSBoot.state==='ready');const hero=p.locator('[data-cms-legacy="existing-0"]');
  await wait(()=>hero.evaluate(el=>!!el.querySelector('.vh-page-hero-enter.is-entered,.vh-cms-composition.vh-page-reveal.is-visible')),page+': hero motion was not started');
  const target=layout==='composition'?hero.locator(':scope>.vh-cms-composition'):hero.locator('.service-hero-grid>:first-child');const opacity=await target.evaluate(el=>Number(getComputedStyle(el).opacity));assert.ok(opacity<.98,page+' '+layout+': animation completed while page was masked');
  assert.equal(await p.locator('[data-cms-legacy="existing-1"] .vh-page-reveal,[data-cms-legacy="existing-1"].vh-page-reveal').count(),0,'explicit animation none received system motion');
  const later=p.locator('[data-cms-legacy="existing-2"]');await later.scrollIntoViewIfNeeded();await wait(()=>later.evaluate(el=>!!el.querySelector('.vh-page-reveal.is-visible')||el.matches('.vh-page-reveal.is-visible')),page+': lower block did not reveal on scroll');assert.ok(await later.evaluate(el=>[el,...el.querySelectorAll('*')].some(node=>node.classList.contains('vh-page-reveal'))));await p.close();
 }
 const reduced=await f.context.newPage();await reduced.emulateMedia({reducedMotion:'reduce'});await reduced.goto(base+'/contacts.html');await reduced.waitForFunction(()=>window.VHCMSBoot.state==='ready');assert.equal(await reduced.locator('.vh-page-reveal').count(),0);assert.equal(await reduced.locator('[data-cms-legacy="existing-0"] .vh-cms-copy').isVisible(),true);
 assert.deepEqual(f.errors,[]);console.log('PASS: native/legacy/new Hero motion starts after first intro and on reload; native/projected service blocks animate when visible, scroll reveals, explicit none and reduced motion respected.');
}finally{await f.browser.close()}})().catch(error=>{console.error(error);process.exit(1)});
