const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {fixture}=require('./cms-browser-fixture.cjs');
const script=fs.readFileSync(path.join(__dirname,process.env.VH_TEST_BUILT==='1'?'../dist/analytics.js':'../analytics.js'),'utf8');
const consentKey='vh_analytics_consent_v1';
(async()=>{
 const f=await fixture();
 try{
  // The storefront origin and both vendors are fulfilled locally; nothing is
  // sent to the production store, Microsoft project, or Google property.
  const requests=[];
  await f.context.route('https://www.googletagmanager.com/**',route=>route.fulfill({contentType:'text/javascript',body:'/* isolated Google tag */'}));
  await f.context.route('https://www.clarity.ms/**',route=>{
   requests.push(route.request().url());
   return route.fulfill({contentType:'text/javascript',body:`window.__clarityCommands=Array.from(window.clarity.q||[],args=>Array.from(args));window.clarity=(...args)=>window.__clarityCommands.push(args);`});
  });
  await f.context.route('https://vintazhka.com.ua/**',route=>route.fulfill({contentType:'text/html; charset=utf-8',body:'<!doctype html><html><head><meta charset="utf-8"><title>Vintazhka</title></head><body><main>Каталог</main><footer></footer><script>'+script+'</script></body></html>'}));
  async function open(url,choice=null,gpc=false){
   const p=await f.context.newPage();
   await p.addInitScript(({key,choice,gpc})=>{
    localStorage.removeItem(key);
    if(choice)localStorage.setItem(key,JSON.stringify({value:choice,at:Date.now()}));
    if(gpc)Object.defineProperty(navigator,'globalPrivacyControl',{value:true});
   },{key:consentKey,choice,gpc});
   await p.goto(url);return p;
  }
  const p=await open('https://vintazhka.com.ua/catalog');
  assert.equal(requests.length,0);assert.equal(await p.evaluate(()=>typeof clarity),'undefined');
  await p.getByRole('button',{name:'Відхилити',exact:true}).click();
  assert.equal(requests.length,0,'Clarity loaded after refusal');
  await p.getByRole('button',{name:'Налаштування cookie',exact:true}).click();
  await p.getByRole('button',{name:'Дозволити',exact:true}).click();
  await p.waitForFunction(()=>window.__clarityCommands);
  assert.deepEqual(requests,['https://www.clarity.ms/tag/zgzibrhpx7']);
  assert.deepEqual(await p.evaluate(()=>__clarityCommands[0]),['consentv2',{analytics_Storage:'granted',ad_Storage:'denied'}]);
  // Repeated acceptance neither reloads the tag nor duplicates initialization.
  await p.getByRole('button',{name:'Налаштування cookie',exact:true}).click();
  await p.getByRole('button',{name:'Дозволити',exact:true}).click();assert.equal(requests.length,1);
  await p.evaluate(()=>{document.cookie='_clck=test; Path=/';document.cookie='_clsk=test; Path=/; Domain=.vintazhka.com.ua'});
  await p.getByRole('button',{name:'Налаштування cookie',exact:true}).click();
  await p.getByRole('button',{name:'Відхилити',exact:true}).click();
  assert.deepEqual(await p.evaluate(()=>__clarityCommands.slice(-2)),[['consentv2',{analytics_Storage:'denied',ad_Storage:'denied'}],['stop']]);
  assert.doesNotMatch(await p.evaluate(()=>document.cookie),/_clck=|_clsk=/);
  await p.getByRole('button',{name:'Налаштування cookie',exact:true}).click();
  await p.getByRole('button',{name:'Дозволити',exact:true}).click();
  assert.deepEqual(await p.evaluate(()=>__clarityCommands.slice(-2)),[['start'],['consentv2',{analytics_Storage:'granted',ad_Storage:'denied'}]]);
  assert.equal(requests.length,1);await p.close();
  const saved=await open('https://vintazhka.com.ua/product/a-jacket/','granted');
  await saved.waitForFunction(()=>window.__clarityCommands);assert.equal(requests.length,2);await saved.close();
  for(const target of ['/account','/account.html','/admin/admin.html','/checkout','/checkout.html','/password-recovery.html','/catalog?email=customer%40example.test','/catalog?code=secret','/catalog?slug=jacket&phone=private','/catalog#private-fragment']){
   const before=requests.length,privatePage=await open('https://vintazhka.com.ua'+target,'granted');
   assert.equal(await privatePage.locator('#vh-microsoft-clarity').count(),0,'Clarity injected on '+target);
   assert.equal(requests.length,before);await privatePage.close();
  }
  const denied=await open('https://vintazhka.com.ua/catalog','denied');
  assert.equal(await denied.locator('#vh-microsoft-clarity').count(),0);assert.equal(await denied.locator('#vh-analytics-choice').count(),0);await denied.close();
  const gpc=await open('https://vintazhka.com.ua/catalog','granted',true);
  assert.equal(await gpc.locator('#vh-microsoft-clarity').count(),0);
  await gpc.getByRole('button',{name:'Налаштування cookie',exact:true}).click();await gpc.getByRole('button',{name:'Дозволити',exact:true}).click();
  assert.equal(await gpc.locator('#vh-google-analytics,#vh-microsoft-clarity').count(),0,'GPC overridden by consent button');await gpc.close();
  const preview=await open('https://vintazhka.com.ua/catalog');
  await preview.evaluate(()=>{window.VH_DEPLOYMENT={readOnlyData:true};delete window.VHAnalytics});await preview.addScriptTag({content:script});
  assert.equal(await preview.evaluate(()=>typeof VHAnalytics),'undefined');await preview.close();
  assert.deepEqual(f.errors,[]);
  console.log('PASS: Clarity tag ID, opt-in, saved consent, refusal, revocation/stop, re-consent, cookie cleanup, ad consent denied, GPC and private URL/page exclusions. All vendor requests mocked.');
 }finally{await f.browser.close()}
})().catch(error=>{console.error(error);process.exitCode=1});
