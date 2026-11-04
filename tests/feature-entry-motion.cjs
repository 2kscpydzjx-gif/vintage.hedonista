const assert=require('node:assert/strict');
const {fixture}=require('./cms-browser-fixture.cjs');
const base='http://127.0.0.1:8765',photo=base+'/assets/test-upload.png';
const selector=page=>page==='home'?'[data-cms-legacy="existing-3"]':'.about-hero';
const visibleFade=el=>[el,...el.querySelectorAll('*')].some(node=>{
 const r=node.getBoundingClientRect(),opacity=Number(getComputedStyle(node).opacity);
 return r.width>0&&r.height>0&&r.top<innerHeight&&r.bottom>0&&opacity<.97&&node.getAnimations().some(a=>a.playState==='running'&&a.currentTime<900);
});
(async()=>{const f=await fixture();try{
 f.user(null);f.session(null);f.delay(550);
 f.settings({homepage_editorial_title:'SLOW FASHION',homepage_editorial_text:'Свідома мода поза часом.',about_hero_image:photo});
 await f.context.addInitScript(()=>{try{sessionStorage.setItem('vh_intro_seen_v96','1')}catch{}});
 for(const width of [390,1366])for(const page of ['home','about'])for(const layout of ['native','composition'])for(const animation of ['system','fade-up','none']){
  const edit={animation,...(layout==='composition'?{design:{layoutVersion:1,photoPreset:page==='home'?'text-top':'gradient-hero',...(page==='home'?{textLayout:'heading-left',heightMode:'fixed',height:693,photoWidth:80}:{})},layoutImages:{0:photo}}:{})};
  f.set(page,'published',{shared:{cmsPageDraft:{existing:{[page==='home'?'existing-3':'existing-0']:edit}}}});
  const p=await f.context.newPage();await p.setViewportSize({width,height:640});
  await p.addInitScript(()=>{window.__featureEarlyMotion=false;function check(){if(window.VHCMSBoot?.state!=='ready'&&document.querySelector('[data-vh-page-phase=running]'))window.__featureEarlyMotion=true;requestAnimationFrame(check)}requestAnimationFrame(check)});
  await p.goto(base+'/'+(page==='home'?'index':page)+'.html');await p.waitForFunction(()=>window.VHCMSBoot?.state==='ready');
  const block=p.locator(selector(page)),label=[width,page,layout,animation].join(' ');
  if(page==='home'){
   // Deliberately wait past the configured CMS duration before visiting Slow Fashion.
   await p.waitForTimeout(1100);
   await block.evaluate(el=>{document.documentElement.style.setProperty('scroll-behavior','auto','important');scrollTo(0,el.getBoundingClientRect().top+scrollY-120)});
  }
  if(animation==='none'){
   assert.equal(await block.locator('[data-vh-page-entry]').count(),0,label+': explicit none received system motion');
   assert.equal(await block.evaluate(el=>Number(getComputedStyle(el).opacity)),1,label+': explicit none is hidden');
  }else{
   let revealed=false;for(let i=0;i<50;i++){if(await block.evaluate(visibleFade)){revealed=true;break}await p.waitForTimeout(30)}
   assert.ok(revealed,label+': no visible entry after CMS/scroll');
   await p.waitForTimeout(1500);
   assert.ok(await block.evaluate(el=>[el,...el.querySelectorAll('[data-vh-page-entry]')].every(node=>Number(getComputedStyle(node).opacity)>.99)),label+': content remained hidden');
  }
  assert.equal(await p.evaluate(()=>window.__featureEarlyMotion),false,label+': entry ran behind startup mask');
  assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,label+': horizontal overflow');
  await p.close();
 }
 for(const page of ['home','about']){
  const edit={animation:'system',design:{layoutVersion:1,photoPreset:'text-top'},layoutImages:{0:photo}};
  f.set(page,'published',{shared:{cmsPageDraft:{existing:{[page==='home'?'existing-3':'existing-0']:edit}}}});
  const p=await f.context.newPage();await p.emulateMedia({reducedMotion:'reduce'});await p.goto(base+'/'+(page==='home'?'index':page)+'.html');await p.waitForFunction(()=>VHCMSBoot.state==='ready');
  const block=p.locator(selector(page));assert.equal(await block.locator('[data-vh-page-entry]').count(),0);assert.equal(await block.evaluate(el=>Number(getComputedStyle(el).opacity)),1);await p.close();
 }
 assert.equal(f.calls.filter(call=>call.op!=='select').length,0);assert.deepEqual(f.errors,[]);
 console.log('PASS: Slow Fashion reveals after scrolling past its CMS duration; About Hero enters after final CMS content; native/projected, system/custom/none, phone/desktop, reduced motion, no writes/overflow.');
}finally{await f.browser.close()}})().catch(error=>{console.error(error);process.exitCode=1});
