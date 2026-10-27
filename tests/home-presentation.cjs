const assert=require('node:assert/strict');const {fixture}=require('./cms-browser-fixture.cjs');
const base='http://127.0.0.1:8765',heading='SLOW FASHION - СВІДОМА МОДА ПОЗА ЧАСОМ І ТРЕНДАМИ';
const mapped={'unified:title':'&nbsp; &nbsp; <strong>SLOW FASHION</strong> - СВІДОМА МОДА <br>&nbsp; &nbsp; ПОЗА ЧАСОМ І ТРЕНДАМИ','text:div:nth-of-type(2)>div:nth-of-type(1)':'&nbsp; <br>&nbsp; VINTAGE HEDONISTA'};
const edit={mapped,design:{layoutVersion:1,photoPreset:'text-top',textLayout:'heading-left',heightMode:'auto',padding:8,headingWidth:54,maxPhotoHeight:471},fieldStyles:{'unified:title':{size:27,weight:400,lineHeight:1.6}},layoutImages:{0:base+'/assets/test-upload.png'}};
(async()=>{const f=await fixture({reducedMotion:'reduce'});try{
 f.settings({hero_title:'VINTAGE HEDONISTA — МИСТЕЦТВО БУТИ СОБОЮ',homepage_editorial_title:heading});
 f.set('home','published',{shared:{cmsPageDraft:{existing:{'existing-3':edit}}}});
 const original=structuredClone(f.records.get('home:published'));
 for(const width of [320,390,820,1366]){
  const p=await f.context.newPage();await p.setViewportSize({width,height:900});await p.goto(base+'/index.html');await p.waitForFunction(()=>window.VHCMSBoot.state==='ready');
  const section=p.locator('[data-cms-legacy="existing-3"]'),title=section.locator('.vh-cms-copy h2');
  await p.waitForFunction(expected=>document.querySelector('[data-cms-legacy="existing-3"] .vh-cms-copy h2')?.textContent===expected,heading);
  await section.scrollIntoViewIfNeeded();
  const s=await title.evaluate(el=>{const s=getComputedStyle(el);return {font:s.fontFamily,weight:s.fontWeight,align:s.textAlign,scroll:el.scrollWidth,client:el.clientWidth,breaks:el.querySelectorAll('br').length}});
  assert.match(s.font,/Prata/);assert.equal(s.weight,'400');assert.equal(s.align,'left');assert.ok(s.scroll<=s.client+2,'editorial overflow '+width);assert.equal(s.breaks,0);
  assert.equal(await p.locator('#editorialBtn').count(),0);
  await p.locator('.hero').scrollIntoViewIfNeeded();assert.equal(await p.locator('#heroAboutBtn').isVisible(),true,'Hero about CTA removed');
  const h=await p.locator('#heroTitle').evaluate(el=>{const s=getComputedStyle(el);return {font:s.fontFamily,size:parseFloat(s.fontSize),line:parseFloat(s.lineHeight),spacing:parseFloat(s.letterSpacing),word:parseFloat(s.wordSpacing),scroll:el.scrollWidth,client:el.clientWidth}});
  assert.match(h.font,/VH Prata Aligned/);assert.ok(Math.abs(h.line/h.size-(width>760?1.115:1.12))<.002,'original Hero line height');
  assert.ok(width>760?Math.abs(h.spacing/h.size-.008)<.001:Number.isNaN(h.spacing)||h.spacing===0,'original Hero tracking');assert.ok(Number.isNaN(h.word)||h.word===0,'original word spacing');assert.ok(h.scroll<=h.client+2,'Hero overflow '+width);
  const typography=await p.locator('#heroTitle').evaluate(async el=>{
   await document.fonts.ready;
   const original=new FontFace('VH Prata Reference','url(scripts/font-sources/Prata-Regular.ttf)');await original.load();document.fonts.add(original);
   const layout=()=>{const text=el.firstChild,rows=[];for(let i=0;i<text.length;i++){const r=document.createRange();r.setStart(text,i);r.setEnd(text,i+1);const b=r.getBoundingClientRect();rows.push({char:text.textContent[i],x:b.x,y:b.y,w:b.width,h:b.height})}return rows};
   const aligned=layout(),previous=el.style.getPropertyValue('font-family'),priority=el.style.getPropertyPriority('font-family');el.style.setProperty('font-family','VH Prata Reference','important');const reference=layout();
   if(previous)el.style.setProperty('font-family',previous,priority);else el.style.removeProperty('font-family');
   const canvas=document.createElement('canvas'),ctx=canvas.getContext('2d');ctx.font='1000px "VH Prata Aligned"';
   const metrics=[...new Set('VINTAGEHEDONISTAМИСТЕЦТВОБУТИСОБОЮ')].map(char=>{const m=ctx.measureText(char);return {char,top:m.actualBoundingBoxAscent,bottom:m.actualBoundingBoxDescent,width:m.width}});
   return {aligned,reference,metrics};
  });
  assert.deepEqual(typography.aligned,typography.reference,'letter positions, widths and wrapping must match original Prata at '+width);
  const capTop=typography.metrics.find(m=>m.char==='H').top;
  for(const m of typography.metrics){assert.equal(m.top,capTop,'level cap top '+m.char);assert.ok(m.char==='Ц'?m.bottom>150:Math.abs(m.bottom)<.01,'level baseline, preserving Ц descender '+m.char)}
  await p.evaluate(edit=>{const s=document.querySelector('[data-cms-legacy="existing-3"]');VHCMSModel.applyDesign(s,edit.design,'home',edit)},edit);
  await p.waitForFunction(expected=>document.querySelector('[data-cms-legacy="existing-3"] .vh-cms-copy h2')?.textContent===expected,heading);
  assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await p.close();
 }
 assert.deepEqual(f.records.get('home:published'),original);assert.equal(f.calls.filter(x=>x.table==='vh_page_revisions'&&x.op!=='select').length,0);
 const catalog=await f.context.newPage();await catalog.goto(base+'/catalog.html');await catalog.waitForFunction(()=>window.VHCMSBoot.state==='ready');
 assert.equal(await catalog.locator('.vh-static-product-links').count(),0);assert.ok(!(await catalog.locator('body').innerText()).includes('Переглянути всі товари колекції'));
 const nojs=await f.browser.newContext({javaScriptEnabled:false});await nojs.route('**/*',r=>r.request().url().startsWith(base+'/')?r.continue():r.abort());const plain=await nojs.newPage();await plain.goto(base+'/catalog.html');
 assert.equal(await plain.locator('.vh-static-product-links').isVisible(),true);assert.ok(await plain.locator('.vh-static-product-links a').count()>0);assert.equal(await plain.locator('.vh-static-product-links summary').count(),0);await nojs.close();
 assert.deepEqual(f.errors,[]);console.log('PASS: consistent home headings at four widths, CTA removal, CMS reapply/revision preservation, and catalog with/without JS.');
}finally{await f.browser.close()}})().catch(e=>{console.error(e);process.exit(1)});
