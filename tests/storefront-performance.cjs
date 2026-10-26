const assert=require('node:assert/strict');
const {fixture}=require('./cms-browser-fixture.cjs');
const base='http://127.0.0.1:8765';
(async()=>{const f=await fixture();let releaseSettings;try{
 const settingsGate=new Promise(resolve=>releaseSettings=resolve);
 const home=await f.context.newPage();let settingsFinished=false;
 await home.route('**/rest/v1/site_settings*',async route=>{await settingsGate;settingsFinished=true;await route.fulfill({contentType:'application/json',body:JSON.stringify([{id:1}])})});
 await home.goto(base+'/index.html',{waitUntil:'domcontentloaded'});
 // Hold settings deliberately: independent homepage content must already be requested.
 const deadline=Date.now()+2000;
 while(!f.calls.some(x=>x.table==='homepage_top_items')&&Date.now()<deadline)await new Promise(r=>setTimeout(r,10));
 assert.ok(f.calls.some(x=>x.table==='homepage_top_items'),'homepage content waits for settings');assert.equal(settingsFinished,false);
 releaseSettings();await home.waitForFunction(()=>window.VHCMSBoot.state==='ready');await home.close();
 f.data('categories',[{id:'c1',slug:'coats',name:'Пальта',is_active:true}]);
 f.data('subcategories',[{id:'s1',category_id:'c1',slug:'wool',name:'Вовняні'}]);
 const product=(id,extra={})=>({id,name:'Пальто '+id,slug:'coat-'+id,status:'published',price:1500,brand:'Brand A',size:'M',season:'Зима',color:'Чорний',material:'Вовна',description:'Пошуковий текст із повного опису',short_description:'Короткий опис',created_at:'2026-10-25',cover_image:base+'/assets/test-upload.png?cover='+id,category_id:'c1',subcategory_id:'s1',categories:{id:'c1',slug:'coats',name:'Пальта'},subcategories:{id:'s1',slug:'wool',name:'Вовняні',category_id:'c1'},product_images:[{image_url:base+'/assets/test-upload.png?second='+id,sort_order:2},{image_url:base+'/assets/test-upload.png?cover='+id,sort_order:1}],...extra});
 f.data('products',[product('1'),product('2',{status:'reserved',brand:'Brand B',size:'L',price:2000,description:'Інший опис'}),product('3',{status:'sold',price:2500})]);
 for(const width of [1440,390]){
  const page=await f.context.newPage();await page.setViewportSize({width,height:850});await page.goto(base+'/catalog.html');await page.waitForFunction(()=>window.VHCMSBoot.state==='ready');
  const query=f.calls.filter(x=>x.table==='products'&&x.columns?.includes('product_images')).at(-1);
  assert.ok(query&&!query.columns.includes('*'),'catalog still downloads every product field');
  for(const field of ['description','material','season','color','product_images(image_url,sort_order)'])assert.ok(query.columns.includes(field));
  assert.equal(await page.locator('.catalog-luxury-card').count(),3);assert.equal(await page.locator('.catalog-badge.reserved').count(),1);assert.equal(await page.locator('.catalog-badge.sold').count(),1);
  assert.equal(await page.locator('.catalog-luxury-photo.has-second-photo').count(),3,'hover gallery disappeared');
  // Exercise existing filtering/sorting, including full-description search.
  await page.evaluate(()=>{catalogState.query='Пошуковий текст';applyCatalog(true)});assert.equal(await page.locator('.catalog-luxury-card').count(),2);
  await page.evaluate(()=>{catalogState.query='';catalogState.availability='published';applyCatalog(true)});assert.equal(await page.locator('.catalog-luxury-card').count(),1);
  await page.evaluate(()=>{catalogState.availability='all';catalogState.brands.add('Brand B');applyCatalog(true)});assert.equal(await page.locator('.catalog-luxury-card').count(),1);
  await page.evaluate(()=>{catalogState.brands.clear();catalogState.category='coats';catalogState.subcategory='wool';catalogState.sort='price-desc';applyCatalog(true)});assert.equal(await page.locator('.catalog-luxury-card').count(),3);assert.match(await page.locator('.catalog-luxury-card').first().textContent(),/Пальто 3/);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.close();
 }
 assert.deepEqual(f.errors,[]);console.log('PASS: homepage content starts while settings are pending; smaller catalog projection preserves photos, status, category/subcategory, brand, description search and sorting on desktop/phone.');
}finally{releaseSettings?.();await f.browser.close()}})().catch(e=>{console.error(e);process.exit(1)});
