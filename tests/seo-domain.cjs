const assert=require('node:assert/strict');
const {execFileSync}=require('node:child_process');
const path=require('node:path');
const {fixture}=require('./cms-browser-fixture.cjs');
const root=path.resolve(__dirname,'..'),base='http://127.0.0.1:8765',domain='https://vintazhka.com.ua/';
const build=preview=>execFileSync(process.execPath,['scripts/build-hosting.mjs'],{cwd:root,env:{...process.env,SITE_BASE_URL:'',VERCEL_ENV:preview?'preview':'production',VERCEL_PROJECT_ID:preview?'prj_npe9JPYcE2zOAPUENtqSWZAy9kHA':'production-fixture'},stdio:'pipe'});
async function urls(page,expected){
 await page.waitForFunction(value=>document.querySelector('link[rel="canonical"]')?.href===value&&document.querySelector('meta[property="og:url"]')?.content===value,expected);
 assert.equal(await page.locator('link[rel=canonical]').count(),1);
 assert.match(await page.locator('meta[name=robots]').getAttribute('content'),/noindex/);
}
(async()=>{
 build(true);process.env.VH_TEST_BUILT='1';const f=await fixture({reducedMotion:'reduce'});
 try{
  f.session(null);f.user(null);
  f.data('categories',[{id:'cat',slug:'verkhnii-odyah',name:'Верхній одяг',is_active:true}]);
  f.data('subcategories',[{id:'sub',category_id:'cat',slug:'kimono',name:'Кімоно'}]);
  f.data('vh_seo_metadata',[{entity_type:'page',entity_id:'home',seo_title:'Збережений SEO-заголовок',meta_description:'Збережений опис головної'}]);
  const product={id:'test-product',slug:'vovnyanyi-zhaket-kardyhan',name:'Тестовий жакет',price:1200,status:'published',category_id:'cat',subcategory_id:'sub',cover_image:base+'/assets/test-upload.png',short_description:'Тестовий опис',description:'Опис товару',product_images:[],categories:{slug:'verkhnii-odyah',name:'Верхній одяг'},subcategories:{slug:'kimono',name:'Кімоно'}};
  f.data('products',[product]);
  const p=await f.context.newPage(),externalSite=[];
  p.on('request',r=>{if(/^https:\/\/(?:2kscpydzjx-gif\.github\.io|vintazhka\.com\.ua)\//.test(r.url()))externalSite.push(r.url())});
  await p.goto(base+'/index.html?utm_source=test');await p.waitForFunction(()=>window.VHCMSBoot.state==='ready');await p.waitForFunction(()=>document.title==='Збережений SEO-заголовок');await urls(p,domain);
  await p.goto(base+'/catalog.html?category=verkhnii-odyah&subcategory=kimono&utm_source=test');await p.waitForFunction(()=>window.VHCMSBoot.state==='ready');await urls(p,domain+'seo-subcategory/verkhnii-odyah/kimono/index.html');
  await p.evaluate(()=>{catalogState.subcategory='';updateCatalogUrl()});await urls(p,domain+'seo-category/verkhnii-odyah/index.html');
  await p.evaluate(()=>{catalogState.category='';updateCatalogUrl()});await urls(p,domain+'catalog.html');
  for(const route of ['seo-category/verkhnii-odyah/index.html','seo-subcategory/verkhnii-odyah/kimono/index.html','seo-product/'+product.slug+'/index.html']){
   await p.goto(base+'/'+route);await p.waitForFunction(()=>window.VHSEORuntime&&window.VH_CONFIG);
   if(route.startsWith('seo-product/')){
    await p.waitForFunction(()=>document.querySelector('#productName')?.textContent==='Тестовий жакет');
    await p.waitForFunction(()=>document.querySelector('#vh-product-breadcrumb-structured-data'));
    const schema=await p.locator('#vh-static-product-jsonld').textContent().then(JSON.parse);
    assert.equal(schema.url,domain+route);assert.equal(schema.offers.url,domain+route);
    assert.equal(await p.locator('script[type="application/ld+json"]').evaluateAll(nodes=>nodes.map(n=>JSON.parse(n.textContent)).filter(x=>x['@type']==='Product').length),1);
    const breadcrumbs=JSON.parse(await p.locator('#vh-product-breadcrumb-structured-data').textContent());assert.equal(breadcrumbs.itemListElement[0].item,domain);
   }else await p.waitForFunction(()=>window.VHCMSBoot.state==='ready');
   await urls(p,domain+route);
   assert.equal(await p.evaluate(()=>document.baseURI),base+'/','snapshot resources leave the preview host');
   assert.equal(await p.locator('.brand').first().getAttribute('href'),'index.html');
  }
  assert.deepEqual(externalSite,[],'preview loaded old/new production resources');
  assert.deepEqual(f.errors,[]);assert.deepEqual(f.calls.filter(x=>x.op!=='select').map(x=>({table:x.table,op:x.op})),[]);assert.equal(f.rpcCalls.length,0);
  console.log('PASS: domain canonicals/OG survive saved page SEO and category filters; nested snapshots use preview assets; live Product/Breadcrumb JSON-LD and noindex remain correct, without external writes.');
 }finally{await f.browser.close();build(false)}
})().catch(error=>{console.error(error);process.exitCode=1});
