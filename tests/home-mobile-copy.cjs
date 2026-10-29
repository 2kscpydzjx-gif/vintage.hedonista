const assert=require('node:assert/strict');
const {fixture}=require('./cms-browser-fixture.cjs');
const base='http://127.0.0.1:8765',photo=base+'/assets/test-upload.png';
const title='SLOW FASHION - СВІДОМА МОДА ПОЗА ЧАСОМ І ТРЕНДАМИ';
const description='Надаємо новий сенс речам з історією, які доповнюють сучасний гардероб. Обирай унікальні якісні речі та створюй неповторні образи з характером.';
const record={shared:{cmsPageDraft:{existing:{
 'existing-0':{design:{photoPreset:'gradient-hero'},mapped:{'static:#heroDescription:0':'<p>Виняткові вінтажні речі з Європи, де якість зустрічається з неповторним стилем.</p>'}},
 'existing-2':{design:{layoutVersion:1,photoPreset:'framed',heightMode:'fixed',height:490,padding:21,headingSize:33,bodySize:15},layoutImages:{0:photo,1:photo}},
 'existing-3':{design:{layoutVersion:1,photoPreset:'text-top',textLayout:'heading-left',padding:8,headingWidth:45,headingAlign:'left',bodyAlign:'left',headingPosition:'center',headingInsetLeft:12,headingInsetRight:120,bodyInsetLeft:120,textColumnGap:79},mapped:{'unified:title':title,'unified:description':description},layoutImages:{0:photo}}
}}}};
const box=el=>{const r=el.getBoundingClientRect(),s=getComputedStyle(el);return {x:r.x,w:r.width,center:r.x+r.width/2,align:s.textAlign,left:parseFloat(s.paddingLeft),right:parseFloat(s.paddingRight)}};
(async()=>{const f=await fixture({reducedMotion:'reduce'});try{
 f.user(null);f.session(null);f.settings({hero_title:'VINTAGE HEDONISTA — МИСТЕЦТВО БУТИ СОБОЮ',homepage_capsules_title:'СТИЛЬ В ДЕТАЛЯХ. ГАРМОНІЯ В ПОЄДНАННЯХ',homepage_editorial_title:title,homepage_editorial_text:description});
 f.set('home','published',record);const initial=structuredClone(f.records.get('home:published'));
 const p=await f.context.newPage();
 for(const width of [320,360,390,430,600,760,768,820,1024,1366]){
  await p.setViewportSize({width,height:900});await p.goto(base+'/index.html');await p.waitForFunction(()=>window.VHCMSBoot?.state==='ready');
  const slow=p.locator('[data-cms-legacy="existing-3"]'),heading=slow.locator('.vh-cms-copy-heading'),body=slow.locator('.vh-cms-copy-body');
  const h=await heading.evaluate(box),b=await body.evaluate(box);
  if(width<=760){
   for(const selector of ['#heroTitle','.homepage-capsules .vh-cms-copy h2']){
    const node=p.locator(selector),a=await node.evaluate(box),copy=await node.evaluate(el=>{const r=el.closest('.hero-copy,.vh-cms-copy').getBoundingClientRect();return r.x+r.width/2});
    assert.equal(a.align,'center');assert.ok(Math.abs(a.center-copy)<1,'Title is off center at '+width);
   }
   assert.ok(Math.abs(h.x-b.x)<1&&Math.abs(h.w-b.w)<1,'Stacked copy has mismatched gutters at '+width);
   assert.equal(h.left,0);assert.equal(h.right,0);assert.equal(b.left,0);assert.equal(b.right,0);
   const slowCenter=await slow.evaluate(el=>{const r=el.getBoundingClientRect();return r.x+r.width/2});assert.ok(Math.abs(h.center-slowCenter)<1);
   assert.equal(await body.locator('p').evaluate(el=>getComputedStyle(el).textAlign),'left');
   const heroParagraphs=await p.locator('#heroDescription,#heroDescription > p').evaluateAll(nodes=>nodes.map(el=>{const r=el.getBoundingClientRect();return [r.x,r.width]}));
   assert.ok(heroParagraphs.every(r=>Math.abs(r[0]-heroParagraphs[0][0])<1&&Math.abs(r[1]-heroParagraphs[0][1])<1),'Nested rich description is offset');
  }else{
   assert.equal(h.left,12);assert.ok(h.right>20);assert.ok(b.left>20,'Tablet/desktop column controls changed');
   assert.equal(await p.locator('#heroTitle').evaluate(el=>getComputedStyle(el).textAlign),'start');
  }
  assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Horizontal overflow at '+width);
 }
 assert.deepEqual(f.records.get('home:published'),initial,'Responsive rendering changed the saved design');
 // Native homepage sections use the same phone alignment before any layout conversion.
 f.set('home','published',{});await p.setViewportSize({width:430,height:900});await p.reload();await p.waitForFunction(()=>window.VHCMSBoot?.state==='ready');
 for(const selector of ['#homeCapsulesTitle','#editorialTitle']){
  const node=p.locator(selector),a=await node.evaluate(box),c=await node.evaluate(el=>{const r=el.closest('.editorial-copy').getBoundingClientRect();return r.x+r.width/2});assert.equal(a.align,'center');assert.ok(Math.abs(a.center-c)<1);
 }
 assert.equal(f.calls.some(c=>c.table==='vh_page_revisions'&&c.op!=='select'),false);
 assert.deepEqual(f.errors,[]);
 console.log('PASS: mobile home title centering, matching copy gutters despite saved desktop insets, full-width rich descriptions, native/CMS layouts and untouched tablet/desktop alignment; no content writes.');
}finally{await f.browser.close()}})().catch(e=>{console.error(e);process.exit(1)});
