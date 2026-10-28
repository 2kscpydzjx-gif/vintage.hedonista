const assert=require('node:assert/strict');
const {fixture}=require('./cms-browser-fixture.cjs');
const base='http://127.0.0.1:8765';
const rect=e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom,w:r.width,h:r.height}};
(async()=>{const f=await fixture({hasTouch:true,reducedMotion:'reduce'});try{
 f.user(null);f.data('categories',[{id:'c',name:'Комплекти та костюми',slug:'suits',is_active:true}]);
 f.data('products',Array.from({length:6},(_,i)=>({id:String(i),slug:'jacket-'+i,name:i===5?'Довга назва вінтажного жакета з візерунком і великим коміром':'Жакет №'+i,brand:'Vintage',price:1200,status:'published',category_id:'c',stock:1,cover_image:base+'/assets/test-upload.png',product_images:[]})));
 const p=await f.context.newPage();
 for(const width of [320,390,430,760,768,820,821,900,1024,1180,1368]){
  await p.setViewportSize({width,height:1180});await p.goto(base+'/catalog.html');await p.waitForFunction(()=>window.VHCMSBoot.state==='ready'&&document.querySelectorAll('.catalog-luxury-card').length===6);
  const cards=p.locator('.catalog-luxury-card'),photos=await cards.locator('.catalog-luxury-photo').evaluateAll(els=>els.map(e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom}}));
  const nextRow=photos.find(photo=>photo.y>photos[0].y+2);assert.ok(nextRow,'need more than one catalog row');assert.ok(nextRow.y-photos[0].bottom<=110,'excess reserved blank space below short product names at '+width);
  assert.ok(await cards.locator('.catalog-luxury-name').evaluateAll(els=>els.every(e=>e.scrollWidth<=e.clientWidth+1&&e.getBoundingClientRect().bottom<=e.closest('.catalog-luxury-card').getBoundingClientRect().bottom)),'clipped product names at '+width);
  if(width>760){
   const sidebar=await p.locator('#catalogSidebar').evaluate(rect);assert.ok(sidebar.right+16<=photos[0].x,'sidebar overlaps products at '+width);
   const [heading,intro]=await p.locator('.catalog-heading-main,.catalog-intro-block').evaluateAll(els=>els.map(e=>{const r=e.getBoundingClientRect();return {y:r.y,bottom:r.bottom}}));assert.ok(heading.bottom>intro.y&&intro.bottom>heading.y,'catalog intro slips to a separate row at '+width);
   const [label,arrow]=await p.locator('#catalogSortCurrent,.catalog-sort-chevron').evaluateAll(els=>els.map(e=>{const r=e.getBoundingClientRect();return {x:r.x,right:r.right}}));assert.ok(label.right+4<=arrow.x,'sort text overlaps arrow at '+width);
  }
  await p.locator('#catalogSortTrigger').click();await p.locator('#catalogSortMenu').waitFor();
  const dropdown=await p.locator('#catalogSortMenu').evaluate(rect);assert.ok(dropdown.x>=0&&dropdown.right<=width,'sorting dropdown outside viewport at '+width);
  await p.locator('.catalog-sort-option[data-sort=price-desc]').click();assert.equal(await p.locator('#catalogSortCurrent').textContent(),'Ціна: від більшої');assert.equal(await p.locator('#catalogSortTrigger').getAttribute('aria-expanded'),'false');
  for(const page of ['catalog.html','index.html','contacts.html']){
   if(page!=='catalog.html'){await p.goto(base+'/'+page);await p.waitForFunction(()=>window.VHCMSBoot.state==='ready')}
   const footer=p.locator('footer');const coldHeight=await footer.evaluate(el=>el.getBoundingClientRect().height);assert.ok(coldHeight<=160,'footer reserves oversized offscreen space at '+width+' '+page+': '+coldHeight);await footer.scrollIntoViewIfNeeded();const layout=await footer.evaluate(el=>{const frame=el.querySelector('.footer-v64').getBoundingClientRect();return {height:el.getBoundingClientRect().height,frame:{x:frame.x,right:frame.right},parts:[...el.querySelectorAll('.footer-v64-brand,.footer-v64-center,.footer-v64-socials')].map(e=>{const r=e.getBoundingClientRect();return {x:r.x,right:r.right,center:r.y+r.height/2}}),icons:[...el.querySelectorAll('.footer-social-btn svg')].map(svg=>{const s=getComputedStyle(svg),r=svg.getBoundingClientRect();return {width:r.width,height:r.height,fill:s.fill,stroke:s.stroke}})}});
   assert.ok(layout.height<=160,'oversized footer at '+width+' '+page+': '+JSON.stringify(layout));assert.ok(layout.parts.every(r=>r.x>=layout.frame.x&&r.right<=layout.frame.right),'footer extends beyond its container at '+width+' '+page);assert.ok(layout.parts[0].right<=layout.parts[1].x&&layout.parts[1].right<=layout.parts[2].x,'footer columns overlap at '+width+' '+page+' '+JSON.stringify(layout));assert.ok(Math.max(...layout.parts.map(p=>p.center))-Math.min(...layout.parts.map(p=>p.center))<2,'footer split into extra rows at '+width+' '+page);
   assert.equal(layout.icons.length,2);assert.ok(layout.icons.every(i=>i.width>=18&&i.height===i.width&&i.fill==='none'&&!['none','rgb(0, 0, 0)'].includes(i.stroke)),'invisible footer icons at '+width+' '+page);
   assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'page overflow at '+width+' '+page);
  }
 }
 assert.deepEqual(f.errors,[]);assert.equal(f.calls.filter(c=>c.op!=='select').length,0);
 console.log('PASS: catalog sidebar separation, compact product rows, aligned heading/sorting, and non-overlapping single-row footers with visible icons on home/catalog/contacts across 11 touch widths.');
}finally{await f.browser.close()}})().catch(e=>{console.error(e);process.exit(1)});
