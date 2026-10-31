const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {execFileSync}=require('node:child_process');
const {fixture}=require('./cms-browser-fixture.cjs');
const http=require('node:http');
const root=path.resolve(__dirname,'..'),dist=path.join(root,'dist'),domain='https://vintazhka.com.ua/';
let server,base;
const read=file=>fs.readFileSync(path.join(dist,file),'utf8');
function build(branch,test=false){return execFileSync(process.execPath,['scripts/build-hosting.mjs','--launch-domain',...(test?['--cloudflare-test']:[])],{cwd:root,env:{...process.env,SITE_BASE_URL:'',VERCEL_ENV:'production',VERCEL_PROJECT_ID:'fixture',CF_PAGES:'1',CF_PAGES_BRANCH:branch,VH_PRODUCTION_BRANCH:'main'},encoding:'utf8'})}
async function pagesRouting(f){
 server=http.createServer((request,response)=>{
  const url=new URL(request.url,'http://preview.local'),canonical=url.pathname.replace(/\/index\.html$/,'/').replace(/\.html$/,'');
  if(canonical!==url.pathname){response.writeHead(301,{Location:canonical+url.search});return response.end()}
  const relative=decodeURIComponent(url.pathname).replace(/^\//,''),file=path.resolve(dist,relative.endsWith('/')||!relative?relative+'index.html':/\.[^/]+$/.test(relative)?relative:relative+'.html');
  const found=file.startsWith(dist+path.sep)&&fs.existsSync(file)&&fs.statSync(file).isFile();
  const types={'.html':'text/html; charset=utf-8','.js':'application/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.woff2':'font/woff2','.webp':'image/webp','.png':'image/png'};
  if(relative==='assets/test-upload.png'){response.writeHead(200,{'Content-Type':'image/png'});return response.end(f.png)}
  response.writeHead(found?200:404,{'Content-Type':found?(types[path.extname(file)]||'application/octet-stream'):'text/html; charset=utf-8'});response.end(fs.readFileSync(found?file:path.join(dist,'404.html')));
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));base='http://127.0.0.1:'+server.address().port;
 await f.context.route(base+'/**',route=>route.continue());
}
(async()=>{
 // A rehearsal project stays read-only even when Cloudflare calls its branch "production".
 console.log(build('main',true).trim());process.env.VH_TEST_BUILT='1';
 assert.match(read('_headers'),/\/\*\n(?:[^\n]*\n)*?  X-Robots-Tag: noindex/);
 assert.equal(read('robots.txt'),'User-agent: *\nDisallow: /\n');
 assert.match(read('index.html'),/VH_DEPLOYMENT=.*readOnlyData/);assert.match(read('index.html'),/canonical" href="https:\/\/vintazhka.com.ua\/"/);
 assert.match(read('sitemap.xml'),/https:\/\/vintazhka.com.ua\/contacts</);assert.doesNotMatch(read('sitemap.xml'),/\.html</);
 for(const script of ['scripts/audit-seo.mjs','scripts/audit-internal-links.mjs'])execFileSync(process.execPath,[script,'--root=dist'],{cwd:root,stdio:'pipe'});
 const f=await fixture();try{
  f.session(null);f.user(null);await pagesRouting(f);
  f.data('categories',[{id:'cat',slug:'verkhnii-odyah',name:'Верхній одяг',is_active:true}]);
  f.data('subcategories',[{id:'sub',category_id:'cat',slug:'kimono',name:'Кімоно'}]);
  const product={id:'cf-product',name:'Тест Cloudflare',slug:'vovnyanyi-zhaket-kardyhan',price:1200,status:'published',category_id:'cat',subcategory_id:'sub',cover_image:base+'/assets/test-upload.png',product_images:[],categories:{slug:'verkhnii-odyah',name:'Верхній одяг'},subcategories:{slug:'kimono',name:'Кімоно'}};
  f.data('products',[product]);
  const p=await f.context.newPage();let requestedApi=[];
  await f.context.route('**/*.supabase.co/**',route=>{requestedApi.push({url:route.request().url(),method:route.request().method()});return route.fulfill({contentType:'application/json',body:JSON.stringify({ok:true})})});
  for(const file of ['index','about','delivery','contacts','journal','catalog','capsule']){
   await p.goto(base+'/'+(file==='index'?'index':file)+'.html');await p.waitForFunction(()=>window.VHCMSBoot?.state==='ready');
   assert.equal(new URL(p.url()).pathname,file==='index'?'/':'/'+file);
   await p.waitForFunction(expected=>document.querySelector('link[rel=canonical]')?.href===expected,domain+(file==='index'?'':file));
   assert.match(await p.locator('meta[name=robots]').getAttribute('content'),/noindex/);
   assert.equal(await p.locator('#vh-cloudflare-preview-notice').count(),1);
   if(['about','delivery','contacts','journal'].includes(file))await p.waitForFunction(name=>document.body.classList.contains('vh-'+name+'-motion'),file);
  }
  for(const route of ['seo-category/verkhnii-odyah/','seo-subcategory/verkhnii-odyah/kimono/','seo-product/'+product.slug+'/']){
   await p.goto(base+'/'+route+'index.html');await p.waitForFunction(()=>window.VHSEORuntime&&window.VH_CONFIG);
   assert.equal(new URL(p.url()).pathname,'/'+route);
   if(route.startsWith('seo-product/')){await p.waitForFunction(()=>document.querySelector('#productName')?.textContent==='Тест Cloudflare');await p.waitForFunction(()=>document.querySelector('#vh-product-breadcrumb-structured-data'));const schema=JSON.parse(await p.locator('#vh-static-product-jsonld').textContent());assert.equal(schema.url,domain+route);assert.equal(schema.offers.url,domain+route)}
   else{await p.waitForFunction(()=>window.VHCMSBoot.state==='ready');assert.equal(await p.evaluate(()=>catalogState.category),'verkhnii-odyah');if(route.includes('kimono'))assert.equal(await p.evaluate(()=>catalogState.subcategory),'kimono')}
   assert.equal(await p.locator('link[rel=canonical]').getAttribute('href'),domain+route);assert.equal(await p.evaluate(()=>document.baseURI),base+'/');
  }
  // Exercise actual browser network boundaries, including the Request and XHR upload paths.
  requestedApi=[];
  const results=await p.evaluate(async()=>{
   const api='https://yffwjgwwkapdrpwyjwfp.supabase.co',out=[];
   for(const [url,method] of [['/rest/v1/products','PATCH'],['/rest/v1/vh_page_revisions','POST'],['/rest/v1/orders','DELETE'],['/rest/v1/rpc/vh_create_checkout_order','POST'],['/rest/v1/rpc/vh_save_product_measurements','POST'],['/functions/v1/send-order-email','POST'],['/storage/v1/object/vintage-media/test.png','POST'],['/auth/v1/recover','POST']]){const r=await fetch(new Request(api+url,{method}));out.push({status:r.status,code:(await r.json()).code})}
   let xhrBlocked=false;try{const xhr=new XMLHttpRequest();xhr.open('POST',api+'/storage/v1/object/vintage-media/test.png');xhr.send('image')}catch(e){xhrBlocked=e.name==='NotAllowedError'}
   const read=await fetch(api+'/rest/v1/products?select=id'),login=await fetch(api+'/auth/v1/token?grant_type=password',{method:'POST'}),admin=await fetch(api+'/rest/v1/rpc/is_admin',{method:'POST'});
   return {out,xhrBlocked,read:read.status,login:login.status,admin:admin.status};
  });
  assert.ok(results.out.every(r=>r.status===403&&r.code==='VH_PREVIEW_READ_ONLY'));assert.equal(results.xhrBlocked,true);assert.equal(results.read,200);assert.equal(results.login,200);assert.equal(results.admin,200);
  assert.equal(requestedApi.length,3,'a write reached the mocked API');
  const missing=await p.goto(base+'/does-not-exist');assert.equal(missing.status(),404);assert.match(await p.locator('h1').textContent(),/не знайдено/);
  await f.context.unroute('**/*.supabase.co/**');f.session({user:{id:'admin'},access_token:'fixture'});f.user({id:'admin'});f.rpc(async()=>({data:true,error:null}));
  const baseline=JSON.stringify([...f.records]);await p.goto(base+'/admin/cms-builder.html');await p.waitForFunction(()=>document.querySelector('.cms-review-banner'));
  assert.equal(await p.locator('#save').isDisabled(),true);assert.equal(await p.locator('#publish').isDisabled(),true);
  await p.locator('#add').click();
  const localBlocks=await p.evaluate(()=>JSON.parse(localStorage.getItem(VHCMSDraftStore.keys('home').blocks)||'[]'));assert.ok(localBlocks.some(block=>block.id.startsWith('demo-')));
  await p.reload();await p.waitForFunction(()=>document.querySelector('.cms-review-banner'));
  assert.deepEqual(await p.evaluate(()=>JSON.parse(localStorage.getItem(VHCMSDraftStore.keys('home').blocks)||'[]')),localBlocks);
  assert.equal(JSON.stringify([...f.records]),baseline);assert.equal(f.calls.filter(c=>c.op!=='select').length,0);assert.deepEqual(f.errors,[]);
 }finally{await f.browser.close()}
 console.log(build('feature-test').trim());assert.match(read('index.html'),/readOnlyData/);
 console.log(build('main').trim());assert.doesNotMatch(read('index.html'),/VH_DEPLOYMENT/);assert.doesNotMatch(read('index.html'),/name="robots" content="noindex/);assert.match(read('_headers'),/https:\/\/:project.pages.dev/);assert.match(read('robots.txt'),/Allow: \/\n/);
 console.log('PASS: Cloudflare clean routes preserve CMS, page motion and SEO; rehearsal blocks outgoing database/order/email/upload writes, keeps local CMS drafts, and has real 404/noindex; main build remains writable.');
})().catch(error=>{console.error(error);process.exitCode=1}).finally(async()=>{if(server)await new Promise(resolve=>server.close(resolve));execFileSync(process.execPath,['scripts/build-hosting.mjs'],{cwd:root,env:{...process.env,SITE_BASE_URL:'',CF_PAGES:'',VERCEL_ENV:'production',VERCEL_PROJECT_ID:'fixture'},stdio:'pipe'})});
