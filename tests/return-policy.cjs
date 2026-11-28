const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {fixture}=require('./cms-browser-fixture.cjs');
const origin='https://vintazhka.com.ua',root=path.resolve(__dirname,'../dist');
(async()=>{const f=await fixture({reducedMotion:'reduce'});try{
 f.user(null);f.session(null);
 await f.context.addInitScript(()=>{try{localStorage.setItem('vh_analytics_consent_v1',JSON.stringify({value:'denied',at:Date.now()}));localStorage.setItem('vh_campaign_dismissed_black-friday-2026','1')}catch{}});
 const serve=route=>{
  let name=decodeURIComponent(new URL(route.request().url()).pathname);if(name.endsWith('/'))name+='index.html';if(!path.extname(name))name+='.html';const file=path.resolve(root,'.'+name);
  if(!file.startsWith(root+path.sep))return route.abort();
  const type={'.html':'text/html','.css':'text/css','.js':'text/javascript','.png':'image/png','.webp':'image/webp','.ico':'image/x-icon','.webmanifest':'application/manifest+json','.woff2':'font/woff2'}[path.extname(file)]||'text/plain';
  return fs.existsSync(file)?route.fulfill({contentType:type,body:fs.readFileSync(file)}):route.fulfill({status:404,body:''});
 };await f.context.route(origin+'/**',serve);
 const p=await f.context.newPage();
 for(const width of [320,390,768,1366]){
  await p.setViewportSize({width,height:900});
  for(const page of ['index.html','catalog.html','delivery.html','product.html','privacy.html']){
   await p.goto(origin+'/'+page);await p.waitForFunction(()=>window.VHCMSBoot?VHCMSBoot.state==='ready':window.__VH_SHELL_READY);
   const link=p.locator('footer [data-vh-returns-link]');assert.equal(await link.count(),1);assert.match(await link.getAttribute('href'),/returns(?:\.html)?$/);
   await link.click();await p.waitForURL('**/returns*');assert.equal(await p.locator('main h1').innerText(),'Повернення товарів і коштів');
  }
  const text=await p.locator('main').innerText();
  assert.match(text,/14 календарних днів після отримання/);assert.match(text,/3 робочих днів після отримання та перевірки/);
  assert.match(text,/Час доставки посилки до магазину до цих 3 робочих днів не входить/);
  assert.match(text,/зворотну доставку оплачує покупець/);assert.match(text,/зворотну доставку оплачує Vintazhka/);
  assert.match(text,/Комісії за оформлення повернення або повторне розміщення товару немає/);assert.match(text,/Готову етикетку[\s\S]*не надаємо/);
  const policy=JSON.parse(await p.locator('#vh-merchant-return-policy-jsonld').textContent()).hasMerchantReturnPolicy;
  assert.equal(policy.merchantReturnDays,14);assert.equal(policy.applicableCountry,'UA');assert.match(policy.merchantReturnLink,/\/returns(?:\.html)?$/);
  assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'horizontal overflow at '+width);
  await p.locator('main a[href="mailto:vintazhka.shop@gmail.com"]').first().focus();assert.equal(await p.locator('main a[href="mailto:vintazhka.shop@gmail.com"]').first().evaluate(el=>el===document.activeElement),true);
  fs.mkdirSync('test-results/returns',{recursive:true});await p.screenshot({path:'test-results/returns/policy-'+width+'.png',fullPage:true});
 }
 await p.goto(origin+'/delivery.html');await p.waitForFunction(()=>VHCMSBoot.state==='ready');assert.match(await p.locator('#deliveryReturnsTitle').locator('..').innerText(),/14 календарних днів/);assert.equal(await p.locator('a[href="returns.html"]').count()>=1,true);
 // Google and visitors can read the full policy without scripts or login.
 const plain=await f.browser.newContext({javaScriptEnabled:false});await plain.route(origin+'/**',serve);const raw=await plain.newPage();
 await raw.goto(origin+'/returns.html');assert.equal(await raw.locator('main section').count(),5);assert.match(await raw.locator('main').innerText(),/14 календарних днів[\s\S]*3 робочих днів/);await plain.close();
 assert.equal(f.calls.filter(c=>c.op!=='select').length,0);assert.deepEqual(f.errors,[]);
 console.log('PASS: dedicated static return policy, matching 14-day structured data, delivery summary, footer links after storefront initialization at four widths, contact/focus, no-script access, no overflow or data writes.');
}finally{await f.browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
