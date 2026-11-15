const assert=require('node:assert/strict');
const {fixture}=require('./cms-browser-fixture.cjs');
const base='http://127.0.0.1:8765';
(async()=>{const f=await fixture({reducedMotion:'reduce'});try{
 f.user(null);f.session(null);
 f.set('capsules','published',{shared:{cmsPageDraft:{existing:{'existing-0':{design:{layoutVersion:1,photoPreset:'gradient-hero',headingSize:44},mapped:{'static:.capsule-hero-copy h1:0':'&nbsp;МИСТЕЦТВО<br>&nbsp;ПОЄДНУВАТИ','static:.capsule-hero-copy p:0':'Опис стильових капсул.'}}}}}});
 f.data('capsule_styles',[{id:'style',slug:'test-style',title:'BLACK & WHITE',page_title:'BLACK & WHITE',page_description:'Сила двох кольорів: стримана розкіш.',is_active:true}]);
 f.data('capsules',[{id:'capsule',style_id:'style',title:'Оригінальна капсула',is_active:true}]);
 const p=await f.context.newPage();
 for(const file of ['capsule','capsule-1']){
  const selector=file==='capsule'?'.capsule-hero>.vh-cms-composition>.vh-cms-copy':'#capsuleStyleHeroCopy';
  await p.goto(base+'/'+file+'.html'+(file==='capsule-1'?'?style=test-style':''));
  if(file==='capsule')await p.waitForFunction(()=>VHCMSBoot.state==='ready');else await p.locator('#capsuleStyleHeroCopy h1[data-vh-capsule-heading]').waitFor();
  const h=p.locator(selector+'>h1'),original=await h.textContent();
  for(const width of [320,360,390,430,600,760,820,1366,1920,390]){
   await p.setViewportSize({width,height:900});await p.evaluate(()=>document.fonts.ready);
   const state=await h.evaluate(el=>{const c=getComputedStyle(el),r=el.getBoundingClientRect(),parent=el.parentElement,p=parent.querySelector('p'),nodes=[],walker=document.createTreeWalker(el,NodeFilter.SHOW_TEXT);let n;while(n=walker.nextNode()){if(!n.textContent.trim())continue;const i=n.textContent.search(/\S/u),range=document.createRange();range.setStart(n,i);range.setEnd(n,i+1);const box=range.getBoundingClientRect(),ctx=document.createElement('canvas').getContext('2d');ctx.font=[c.fontStyle,c.fontWeight,c.fontSize,c.fontFamily].join(' ');nodes.push(box.x-ctx.measureText(n.textContent[i]).actualBoundingBoxLeft)}return {ink:nodes,x:r.x,paragraphX:p.getBoundingClientRect().x,font:[c.fontFamily,c.fontSize,c.fontWeight,c.lineHeight,c.color],indents:[...el.querySelectorAll('.vh-capsule-heading-indent')].map(e=>getComputedStyle(e).display)}});
   assert.equal(await h.textContent(),original,'saved text changed');
   if(width<=760){for(const x of state.ink)assert.ok(Math.abs(x-state.paragraphX)<=1.1,file+' mobile lettering is offset at '+width+': '+x+' vs '+state.paragraphX);assert.ok(state.indents.every(s=>s==='none'))}
   else{assert.ok(state.indents.every(s=>s!=='none'));assert.ok(Math.abs(state.x-state.paragraphX)<.1,'desktop heading edge changed')}
   // Disabling the alignment sheet must not alter type, colour, wrapping or height.
   const before=await h.evaluate(el=>{const c=getComputedStyle(el);return [c.fontFamily,c.fontSize,c.fontWeight,c.lineHeight,c.color,el.getBoundingClientRect().height]});
   await p.locator('link[href*="capsule-mobile-headings.css"]').evaluate(el=>el.disabled=true);
   assert.deepEqual(await h.evaluate(el=>{const c=getComputedStyle(el);return [c.fontFamily,c.fontSize,c.fontWeight,c.lineHeight,c.color,el.getBoundingClientRect().height]}),before);
   await p.locator('link[href*="capsule-mobile-headings.css"]').evaluate(el=>el.disabled=false);
  }
  if(file==='capsule'){
   await p.evaluate(()=>dispatchEvent(new Event('vh:capsules-rendered')));
   assert.equal(await p.locator(selector+' .vh-capsule-heading-indent').count(),2,'repeated render duplicated indents');
  }
 }
 assert.equal(f.calls.filter(c=>c.op!=='select').length,0);assert.deepEqual(f.errors,[]);
 console.log('PASS: both mobile hero headings align with description, both index lines corrected, desktop indents/text preserved, unchanged typography, resizing/re-rendering and no writes.');
}finally{await f.browser.close()}})().catch(error=>{console.error(error);process.exitCode=1});
