const assert=require('node:assert/strict');
const {fixture}=require('./cms-browser-fixture.cjs');
const base='http://127.0.0.1:8765';
const design={layoutVersion:1,photoPreset:'text-top',textLayout:'heading-right',headingWidth:40,heightMode:'fixed',height:720,photoWidth:45,padding:24,align:'left'};
const edit={title:'Заголовок колонки',description:'<p>Основний текст.</p><p><strong>Другий абзац.</strong></p>',design,fieldStyles:{'unified:title':{size:27,align:'center',weight:400}},layoutImages:{0:base+'/assets/test-upload.png'}};
const geometry=el=>{
 const rect=node=>{const r=node.getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom,w:r.width,h:r.height}};
 const h=el.querySelector('.vh-cms-copy-heading'),b=el.querySelector('.vh-cms-copy-body');
 const column=node=>{const s=getComputedStyle(node);return {rect:rect(node),top:parseFloat(s.paddingTop),right:parseFloat(s.paddingRight),bottom:parseFloat(s.paddingBottom),left:parseFloat(s.paddingLeft)}};
 return {heading:column(h),body:column(b),title:rect(h.querySelector('h2')),paragraph:rect(b.querySelector('p')),headingAlign:getComputedStyle(h.querySelector('h2')).textAlign,bodyAlign:getComputedStyle(b.querySelector('p')).textAlign,gap:parseFloat(getComputedStyle(el.querySelector('.vh-cms-copy')).columnGap)};
};
(async()=>{const f=await fixture({reducedMotion:'reduce'});try{
 f.set('home','draft',{shared:{cmsPageDraft:{existing:{'existing-3':edit}}}});
 const publishedBefore=structuredClone(f.records.get('home:published'));
 const p=await f.context.newPage();p.on('dialog',d=>d.accept());
 const ready=async()=>{await p.waitForFunction(()=>document.querySelectorAll('.existing-row').length>=8&&!document.querySelector('#save').disabled);await p.locator('[data-cms-id="existing-3"] .existing-select').click();await p.locator('[data-inspector-tab=design]').click()};
 await p.goto(base+'/admin/cms-builder.html?page=home');await ready();
 const section=p.frameLocator('#siteFrame').locator('[data-cms-legacy="existing-3"]');
 const choose=key=>p.locator('#existingEditor select[data-design-key="'+key+'"]');
 const number=key=>p.locator('#existingEditor input[type=number][data-design-key="'+key+'"]');
 const set=async(key,value)=>{await number(key).fill(String(value));await number(key).blur();await p.waitForTimeout(180)};
 const select=async(key,value)=>{await choose(key).selectOption(value);await p.waitForTimeout(180)};
 await section.locator('.vh-cms-copy-heading').waitFor();
 const heroBefore=await p.frameLocator('#siteFrame').locator('#heroTitle').evaluate(el=>({text:el.textContent,style:el.getAttribute('style')}));
 const imageBefore=await section.locator('.vh-cms-photo img').getAttribute('src');
 await select('headingAlign','right');await select('bodyAlign','left');
 await select('headingPosition','bottom');await select('bodyPosition','top');
 for(const [key,value] of Object.entries({headingInsetTop:18,headingInsetRight:24,headingInsetBottom:20,headingInsetLeft:12,bodyInsetTop:14,bodyInsetRight:16,bodyInsetBottom:10,bodyInsetLeft:32,textColumnGap:36}))await set(key,value);
 let g=await section.evaluate(geometry);
 assert.ok(g.body.rect.right<=g.heading.rect.x,'heading-right column order');assert.equal(g.headingAlign,'right','Slow Fashion legacy align must not block explicit column alignment');assert.equal(g.bodyAlign,'left');assert.equal(g.gap,36);
 assert.equal(g.heading.top,18);assert.equal(g.heading.bottom,20);assert.equal(g.body.left,32);assert.ok(g.title.y>g.paragraph.y+20,'independent top/bottom positioning');
 await select('headingPosition','top');await select('bodyPosition','bottom');g=await section.evaluate(geometry);assert.ok(g.paragraph.y>g.title.y+20,'vertical placement must work both ways');
 await select('align','center');g=await section.evaluate(geometry);assert.equal(g.headingAlign,'right');assert.equal(g.bodyAlign,'left','explicit column alignment must survive general alignment changes');
 await select('textLayout','heading-left');g=await section.evaluate(geometry);assert.ok(g.heading.rect.right<=g.body.rect.x);assert.equal(g.headingAlign,'right');assert.equal(g.body.left,32);
 await p.locator('#existingEditor [data-preset=stacked]').click();await p.waitForTimeout(180);assert.equal(await section.locator('.vh-cms-copy-body strong').textContent(),'Другий абзац.');
 await select('textLayout','single');assert.equal(await section.locator('.vh-cms-copy-heading').count(),0);assert.equal(await p.locator('.cms-column-controls').isVisible(),false);
 await select('textLayout','heading-right');await p.locator('#existingEditor [data-preset=text-top]').click();await p.waitForTimeout(180);
 await p.locator('#existingEditor [data-reset-column=heading]').click();await p.waitForTimeout(180);g=await section.evaluate(geometry);assert.equal(g.headingAlign,'center','reset restores existing per-field formatting');assert.equal(g.heading.left,0);assert.equal(g.heading.top,0);assert.equal(g.body.left,32,'reset must affect only its column');assert.equal(await choose('bodyPosition').inputValue(),'bottom');
 await select('headingAlign','right');await select('headingPosition','top');await set('headingInsetLeft',12);
 // Slider/number updates keep the inspector controls mounted and its scroll stable.
 await number('bodyInsetLeft').scrollIntoViewIfNeeded();const scroller=p.locator('.cms-editor-scroll'),scroll=await scroller.evaluate(el=>el.scrollTop);
 await number('bodyInsetLeft').press('ArrowUp');await p.waitForTimeout(220);assert.ok(Math.abs(await scroller.evaluate(el=>el.scrollTop)-scroll)<3,'inspector scroll jumped');assert.equal(await number('bodyInsetLeft').inputValue(),'33');
 assert.deepEqual(await p.frameLocator('#siteFrame').locator('#heroTitle').evaluate(el=>({text:el.textContent,style:el.getAttribute('style')})),heroBefore,'unrelated Hero changed');assert.equal(await section.locator('.vh-cms-photo img').getAttribute('src'),imageBefore);
 assert.deepEqual(f.records.get('home:published'),publishedBefore,'editing a draft changed the publication');
 await p.locator('#save').click();await p.locator('#status').filter({hasText:'перевірено на сервері'}).waitFor();await p.reload();await ready();assert.equal(await choose('headingAlign').inputValue(),'right');assert.equal(await choose('bodyPosition').inputValue(),'bottom');assert.equal(await number('bodyInsetLeft').inputValue(),'33');
 const saved=f.records.get('home:draft').shared.cmsPageDraft.existing['existing-3'];assert.equal(saved.design.bodyInsetLeft,33);assert.equal(saved.fieldStyles['unified:title'].size,27);assert.equal(saved.layoutImages[0],imageBefore);
 await p.locator('#publish').click();await p.locator('#status').filter({hasText:'Публікацію перевірено'}).waitFor();
 const pub=await f.context.newPage();
 for(const width of [1366,820,390,320]){
  await pub.setViewportSize({width,height:900});await pub.goto(base+'/index.html');await pub.waitForFunction(()=>window.__VH_PUBLISHED_READY);
  const block=pub.locator('[data-cms-legacy="existing-3"]');g=await block.evaluate(geometry);assert.equal(g.headingAlign,'right');assert.equal(g.bodyAlign,'left');
  if(width>760){assert.ok(g.body.rect.right<=g.heading.rect.x);assert.equal(g.body.left,33);assert.ok(g.paragraph.y>g.title.y+20)}else{assert.ok(g.heading.rect.bottom<=g.body.rect.y+1,'phone stacking');assert.ok(g.body.left<=20&&g.body.top<=28&&g.body.bottom<=28,'phone insets');}
  assert.ok(await pub.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'page overflow at '+width);assert.equal(await block.locator('.vh-cms-copy-body strong').textContent(),'Другий абзац.');
 }
 // Newly added blocks use the same positioning renderer; returning to single clears it.
 const added=await pub.evaluate(()=>{const s=document.createElement('section');s.innerHTML='<h2>New heading</h2><p>New body</p><a href="catalog.html">CTA</a>';document.body.append(s);const d={layoutVersion:1,photoPreset:'text-only',textLayout:'heading-right',headingAlign:'right',bodyAlign:'center',headingPosition:'bottom',bodyPosition:'top',bodyInsetLeft:20};VHCMSModel.applyDesign(s,d,'home');const result={align:getComputedStyle(s.querySelector('.vh-cms-copy-body p')).textAlign,heading:getComputedStyle(s.querySelector('.vh-cms-copy-heading h2')).textAlign,links:s.querySelectorAll('.vh-cms-copy a').length};VHCMSModel.applyDesign(s,{...d,textLayout:'single'},'home');result.positioned=s.hasAttribute('data-vh-column-position');return result});assert.deepEqual(added,{align:'center',heading:'right',links:1,positioned:false});
 assert.deepEqual(f.errors,[]);console.log('PASS: independent column alignment/position/insets, Slow Fashion overrides, reversed layouts, isolated reset, stable scroll, save/F5/publication and responsive limits.');
}finally{await f.browser.close()}})().catch(e=>{console.error(e);process.exit(1)});
