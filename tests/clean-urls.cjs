const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {execFileSync}=require('node:child_process');
const {fixture}=require('./cms-browser-fixture.cjs'),{pagesHandler}=require('./pages-routing.cjs');
const root=path.resolve(__dirname,'..'),dist=path.join(root,'dist'),domain='https://vintazhka.com.ua/';
const build=preview=>execFileSync(process.execPath,['scripts/build-hosting.mjs','--launch-domain',...(preview?['--cloudflare-test']:[])],{cwd:root,env:{...process.env,SITE_BASE_URL:'',CF_PAGES:'1',CF_PAGES_BRANCH:preview?'test-clean-urls':'main',VERCEL_ENV:'production',VERCEL_PROJECT_ID:'fixture',VH_NAVIGATION_SNAPSHOT_FILE:path.join(root,'scripts/published-navigation.json')},encoding:'utf8'});
function walk(dir){return fs.readdirSync(dir).flatMap(name=>{const file=path.join(dir,name);return fs.statSync(file).isDirectory()?walk(file):[file]})}
(async()=>{let server;const f=await fixture({reducedMotion:'reduce'});try{
 console.log(build(true).trim());f.user(null);f.session(null);
 server=http.createServer(pagesHandler(dist,f.png));await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
 await f.context.route(base+'/**',route=>route.continue());
 const kinds={'seo-product':'product','seo-category':'catalog','seo-subcategory':'catalog','seo-article':'journal'};
 let checked=0;
 for(const [old,prefix] of Object.entries(kinds))for(const file of walk(path.join(root,old)).filter(f=>f.endsWith('/index.html'))){
  const suffix=path.relative(path.join(root,old),path.dirname(file)).split(path.sep).map(encodeURIComponent).join('/'),next=prefix+'/'+suffix+'/';
  assert.equal(fs.existsSync(path.join(dist,old,suffix,'index.html')),false);
  for(const tail of ['/index.html','/','']){
   const r=await fetch(base+'/'+old+'/'+suffix+tail+'?utm_source=saved-link&note=a%26b',{redirect:'manual'});assert.equal(r.status,301);const target=new URL(r.headers.get('location'),base);assert.equal(target.pathname,'/'+next);assert.equal(target.searchParams.get('utm_source'),'saved-link');assert.equal(target.searchParams.get('note'),'a&b');
  }
  const response=await fetch(base+'/'+next);assert.equal(response.status,200);const html=await response.text();
  assert.ok(/<h1\b/.test(html),'static content missing '+next);assert.ok(html.includes('rel="canonical" href="'+domain+next+'"'));assert.doesNotMatch(html,/href="[^"<>]*seo-(?:product|category|subcategory|article)\//);
  const canonical=await fetch(base+'/'+next+'index.html',{redirect:'manual'});assert.equal(canonical.status,301);assert.equal(new URL(canonical.headers.get('location'),base).pathname,'/'+next);checked++;
 }
 const sitemap=fs.readFileSync(path.join(dist,'sitemap.xml'),'utf8');assert.doesNotMatch(sitemap,/seo-(?:product|category|subcategory|article)\//);assert.equal((sitemap.match(/<loc>/g)||[]).length,(fs.readFileSync(path.join(root,'sitemap.xml'),'utf8').match(/<loc>/g)||[]).length);
 for(const rootPage of ['catalog','journal']){const r=await fetch(base+'/'+rootPage+'/',{redirect:'manual'});assert.equal(r.status,301);assert.equal(new URL(r.headers.get('location'),base).pathname,'/'+rootPage)}
 const known={id:'route-known',slug:'vovnyanyi-zhaket-kardyhan',name:'Вовняний жакет',price:1200,status:'published',category_id:'outer',subcategory_id:'kimono',categories:{name:'Верхній одяг',slug:'verkhnii-odyah'},subcategories:{name:'Кімоно',slug:'kimono'},cover_image:base+'/assets/test-upload.png',product_images:[]};
 const fresh={...known,id:'route-fresh',slug:'novyi-zhaket-bez-snapshot',name:'Новий жакет'},article={id:'article-fresh',slug:'nova-istoriya-bez-snapshot',title:'Нова історія',excerpt:'Короткий опис',content:'Історія речей.',status:'published',published_at:'2026-11-02'};
 f.data('products',[known,fresh]);f.data('news',[article]);f.data('categories',[{id:'outer',name:'Верхній одяг',slug:'verkhnii-odyah',is_active:true},{id:'fresh-category',name:'Нова категорія',slug:'nova-kategoriya',is_active:true}]);f.data('subcategories',[{id:'kimono',category_id:'outer',name:'Кімоно',slug:'kimono'}]);
 f.data('vh_seo_metadata',[{entity_type:'page',entity_id:'home',seo_title:'SAVED HOME TITLE',meta_description:'Home description'},{entity_type:'page',entity_id:'catalog',seo_title:'SAVED CATALOG TITLE',meta_description:'Catalog description'}]);
 const p=await f.context.newPage();
 for(const width of [390,1440]){
  await p.setViewportSize({width,height:950});
  // A real catalog link, then product/gallery/breadcrumbs/cart and checkout.
  await p.goto(base+'/catalog');await p.waitForFunction(()=>VHCMSBoot.state==='ready');await p.locator('#catalogProducts a[href="product/'+known.slug+'/"]').first().click();
  await p.waitForURL('**/product/'+known.slug+'/');await p.waitForFunction(()=>document.querySelector('#productName')?.textContent==='Вовняний жакет');
  const schema=JSON.parse(await p.locator('#vh-static-product-jsonld').textContent());assert.equal(schema.url,domain+'product/'+known.slug+'/');assert.equal(schema.offers.url,schema.url);
  assert.equal(await p.locator('meta[property="og:type"]').getAttribute('content'),'product');
  const crumbs=await p.locator('.product-breadcrumbs [data-vh-seo-crumb][href]').evaluateAll(els=>els.map(el=>el.getAttribute('href')));assert.ok(crumbs.some(h=>h===base+'/catalog/verkhnii-odyah/'));assert.ok(crumbs.some(h=>h===base+'/catalog/verkhnii-odyah/kimono/'));
  await p.locator('[onclick="addCurrentProductToCart()"]').click();await p.locator('[data-header-cart]').click();await p.locator('#vhCheckoutLink').click();await p.waitForURL('**/checkout');await p.locator('.checkout-item').waitFor();
  // No snapshot is needed for a newly published product or article.
  for(const route of ['product/'+fresh.slug+'/','product.html?slug='+fresh.slug+'&utm_source=shared']){
   const response=await p.goto(base+'/'+route);assert.equal(response.status(),200);await p.waitForFunction(()=>document.querySelector('#productName')?.textContent==='Новий жакет');assert.equal(new URL(p.url()).pathname,'/product/'+fresh.slug+'/');assert.equal(await p.locator('link[rel=canonical]').getAttribute('href'),domain+'product/'+fresh.slug+'/');assert.equal(await p.evaluate(()=>document.baseURI),base+'/');
  }
  await p.goto(base+'/journal/'+article.slug+'/');await p.locator('#articleRoot h1').filter({hasText:'Нова історія'}).waitFor();await p.waitForFunction(()=>document.querySelector('meta[property="og:type"]')?.content==='article');assert.equal(await p.locator('link[rel=canonical]').getAttribute('href'),domain+'journal/'+article.slug+'/');
  await p.goto(base+'/catalog/verkhnii-odyah/');await p.waitForFunction(()=>VHCMSBoot.state==='ready');assert.equal(await p.evaluate(()=>catalogState.category),'verkhnii-odyah');
  await p.evaluate(()=>{catalogState.subcategory='kimono';updateCatalogUrl()});assert.equal(new URL(p.url()).pathname,'/catalog/verkhnii-odyah/kimono/');assert.equal(await p.evaluate(()=>document.baseURI),base+'/');
  await p.evaluate(()=>{catalogState.category=null;catalogState.subcategory=null;updateCatalogUrl()});assert.equal(new URL(p.url()).pathname,'/catalog');
  await p.goto(base+'/catalog/nova-kategoriya/');await p.waitForFunction(()=>VHCMSBoot.state==='ready');assert.equal(await p.evaluate(()=>catalogState.category),'nova-kategoriya');assert.equal(await p.locator('link[rel=canonical]').getAttribute('href'),domain+'catalog/nova-kategoriya/');assert.doesNotMatch(await p.title(),/SAVED HOME TITLE/);
  await p.goto(base+'/product/neisnuyuchyi-tovar/');await p.locator('#productRoot h1').filter({hasText:'Товар не знайдено'}).waitFor();assert.match(await p.locator('meta[name=robots]').getAttribute('content'),/noindex/);
 }
 const missing=await p.goto(base+'/neisnuyucha-storinka');assert.equal(missing.status(),404);
 assert.deepEqual(f.errors,[]);assert.equal(f.calls.filter(c=>c.op!=='select').length,0);assert.equal(f.rpcCalls.length,0);assert.equal(f.functionCalls.length,0);
 console.log('PASS: '+checked+' static clean URLs, single-hop permanent redirects and query retention, complete initial HTML/canonical/OG/JSON-LD/sitemap, new products/articles/categories before snapshots, desktop/mobile catalog→product→cart→checkout, filters, root assets and no data writes.');
 console.log(build(false).trim());assert.doesNotMatch(fs.readFileSync(path.join(dist,'index.html'),'utf8'),/readOnlyData/);
}finally{await f.browser.close();if(server)await new Promise(r=>server.close(r));execFileSync(process.execPath,['scripts/build-hosting.mjs'],{cwd:root,env:{...process.env,CF_PAGES:'',VERCEL_ENV:'production',VERCEL_PROJECT_ID:'fixture',SITE_BASE_URL:''},stdio:'pipe'})}})().catch(e=>{console.error(e);process.exitCode=1});
