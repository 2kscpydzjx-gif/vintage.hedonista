const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {fixture}=require('./cms-browser-fixture.cjs');
const base='http://127.0.0.1:8765',slug='vovnyanyi-zhaket-kardyhan';
(async()=>{const f=await fixture({reducedMotion:'reduce'});try{
 f.user(null);f.session(null);
 f.data('products',[{id:'isolated-product',slug,name:'Тестовий товар',price:1200,status:'published',cover_image:base+'/assets/test-upload.png',product_images:[]}]);
 // Emulate the clean Pages directory URL while retaining the real generated HTML.
 await f.context.route(base+'/seo-product/'+slug+'/',route=>route.fulfill({contentType:'text/html',body:fs.readFileSync(path.join(__dirname,'../dist/seo-product',slug,'index.html'))}));
 for(const route of ['/index.html','/product.html?slug='+slug,'/seo-product/'+slug+'/index.html','/seo-product/'+slug+'/','/seo-category/aksesuary/index.html']){
  const p=await f.context.newPage();await p.goto(base+route);
  await p.waitForFunction(()=>typeof window.vhSignUp==='function');
  await p.locator('[data-header-profile]').click();await p.locator('#vhAuthLogin').waitFor();
  await p.getByRole('button',{name:'ЗАРЕЄСТРУВАТИСЯ',exact:true}).click();
  await p.evaluate(()=>{sb.auth.signUp=async payload=>{window.__isolatedSignup=payload;return {data:{user:null,session:null},error:null}}});
  for(const [id,value] of Object.entries({vhAuthFirstName:'Олена',vhAuthLastName:'Коваль',vhAuthLogin:'customer@example.test',vhAuthPassword:'isolated-test-password'}))await p.locator('#'+id).fill(value);
  await p.locator('#vhAuthSubmit').click();await p.waitForFunction(()=>window.__isolatedSignup);
  const payload=await p.evaluate(()=>window.__isolatedSignup);
  assert.equal(payload.options.emailRedirectTo,base+'/account.html',route+' pointed confirmation into the current directory');
  assert.equal(payload.email,'customer@example.test');assert.equal(payload.options.data.full_name,'Олена Коваль');
  assert.match(await p.locator('#vhAuthMessage').textContent(),/Підтвердьте реєстрацію/);
  assert.equal(f.calls.filter(c=>c.table==='customer_profiles'&&c.op!=='select').length,0);
  await p.close();
 }
 assert.deepEqual(f.errors,[]);
 console.log('PASS: real registration form targets the root account page from home, direct product, nested SEO product/category and clean Pages URLs. No real signup or email used.');
}finally{await f.browser.close()}})().catch(error=>{console.error(error);process.exitCode=1});
