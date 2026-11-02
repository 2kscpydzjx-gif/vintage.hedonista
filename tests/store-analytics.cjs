const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {fixture}=require('./cms-browser-fixture.cjs');
const script=fs.readFileSync(path.join(__dirname,process.env.VH_TEST_BUILT==='1'?'../dist/analytics.js':'../analytics.js'),'utf8');
const consentKey='vh_analytics_consent_v1';
const product={id:'isolated-jacket',slug:'isolated-jacket',name:'Вовняний жакет',brand:'Marc Cain',price:1200,status:'published',stock:1,product_images:[]};
const commands=p=>p.evaluate(()=>Array.from(window.dataLayer||[],args=>Array.from(args)));
const events=async p=>(await commands(p)).filter(args=>args[0]==='event');
(async()=>{
 const f=await fixture({reducedMotion:'reduce'});try{
  f.user(null);f.session(null);
  // Entire production-shaped origin and Google requests are intercepted locally.
  // No test traffic is sent to the store, Supabase, or the real GA property.
  const google=[];
  await f.context.route('https://www.googletagmanager.com/**',route=>{google.push(route.request().url());return route.fulfill({contentType:'text/javascript',body:'/* isolated Google tag */'})});
  await f.context.route('https://vintazhka.com.ua/**',route=>route.fulfill({contentType:'text/html; charset=utf-8',body:'<!doctype html><html><head><meta charset="utf-8"><title>Vintazhka</title></head><body><main>Тест</main><footer></footer><script>'+script+'</script></body></html>'}));
  const p=await f.context.newPage();
  await p.goto('https://vintazhka.com.ua/product.html?slug=isolated-jacket&email=customer%40example.test#private-fragment');
  await p.locator('#vh-analytics-choice').waitFor();
  await p.evaluate(product=>{VHAnalytics.commerce('view_item',[product],1200,'product:'+product.id);VHAnalytics.commerce('add_to_cart',[product],1200)},product);
  assert.equal(google.length,0);assert.equal((await commands(p)).length,0,'data collected before choice');
  await p.getByRole('button',{name:'Відхилити',exact:true}).click();
  assert.equal(google.length,0);assert.equal((await events(p)).length,0);
  await p.reload();assert.equal(await p.locator('#vh-analytics-choice').count(),0,'refusal not remembered');
  await p.getByRole('button',{name:'Налаштування cookie',exact:true}).click();
  await p.getByRole('button',{name:'Дозволити',exact:true}).click();
  await p.waitForFunction(()=>document.getElementById('vh-google-analytics'));
  await p.evaluate(product=>{
   const unsafe={...product,email:'customer@example.test',phone:'+380671234567',customer_name:'Покупець',comment:'Private note'};
   VHAnalytics.commerce('view_item',[unsafe],1200,'product:'+product.id);
   VHAnalytics.commerce('view_item',[unsafe],1200,'product:'+product.id);
   VHAnalytics.commerce('order_placed',[unsafe],1200,'private-order-id');
   VHAnalytics.commerce('order_placed',[unsafe],1200,'private-order-id');
   VHAnalytics.commerce('purchase',[unsafe],1200);
  },product);
  let sent=await events(p);assert.deepEqual(sent.map(x=>x[1]),['page_view','view_item','order_placed']);
  const order=sent.find(x=>x[1]==='order_placed')[2];assert.equal(order.currency,'UAH');assert.equal(order.value,1200);assert.deepEqual(Object.keys(order.items[0]).sort(),['item_brand','item_id','item_name','price','quantity']);
  assert.equal(order.page_location,'https://vintazhka.com.ua/product/isolated-jacket/');
  assert.doesNotMatch(JSON.stringify(await commands(p)),/customer@example|private-order-id|Private note|private-fragment|380671234567/);
  for(const width of [320,390,820,1440]){
   await p.setViewportSize({width,height:900});await p.getByRole('button',{name:'Налаштування cookie',exact:true}).click();
   const rect=await p.locator('#vh-analytics-choice').boundingBox();assert.ok(rect.x>=0&&rect.x+rect.width<=width,'cookie controls overflow '+width);
   assert.ok(await p.getByRole('button',{name:'Відхилити',exact:true}).evaluate(el=>el.getBoundingClientRect().height>=44));
   await p.getByRole('button',{name:'Дозволити',exact:true}).click();
  }
  assert.equal((await events(p)).filter(x=>x[1]==='page_view').length,1,'settings duplicated page view');
  await p.evaluate(()=>document.cookie='_ga=isolated; Path=/; Domain=.vintazhka.com.ua');
  await p.getByRole('button',{name:'Налаштування cookie',exact:true}).click();await p.getByRole('button',{name:'Відхилити',exact:true}).click();
  const count=(await events(p)).length;
  await p.evaluate(product=>VHAnalytics.commerce('add_to_cart',[product],1200),product);
  assert.equal((await events(p)).length,count);assert.equal(await p.evaluate(()=>window['ga-disable-G-15N51M35Y2']),true);assert.doesNotMatch(await p.evaluate(()=>document.cookie),/_ga=/);
  // Refusal and tags must not leak to account/admin/auth callback/preview pages.
  for(const pathname of ['/account','/account.html','/admin/admin.html','/catalog?code=single-use-secret','/catalog#access_token=secret']){
   await p.goto('https://vintazhka.com.ua'+pathname);assert.equal(await p.evaluate(()=>typeof window.VHAnalytics),'undefined');assert.equal(await p.locator('#vh-google-analytics').count(),0);
  }
  const preview=await f.context.newPage();await preview.goto('http://127.0.0.1:8765/catalog.html');await preview.addScriptTag({content:script});assert.equal(await preview.evaluate(()=>typeof window.VHAnalytics),'undefined');await preview.close();
  // Real storefront handlers with isolated RPCs: successful orders only, no payment claim.
  await f.context.addInitScript(()=>{window.__analyticsCalls=[];window.VHAnalytics={commerce(...args){window.__analyticsCalls.push(args)}}});
  f.user(null);f.session(null);f.data('products',[product]);let fail=true;
  f.rpc(async({name})=>name==='vh_create_checkout_order'?fail?{data:null,error:{message:'Isolated failure'}}:{data:{success:true,total:1200,order_ids:['isolated-order'],order_number:123},error:null}:{data:[],error:null});
  const shop=await f.context.newPage();await shop.goto('http://127.0.0.1:8765/product.html?slug='+product.slug);await shop.locator('#buyBtn').waitFor();
  assert.equal(await shop.evaluate(()=>__analyticsCalls.filter(x=>x[0]==='view_item').length),1);
  await shop.evaluate(()=>{addCurrentProductToCart();addCurrentProductToCart()});assert.equal(await shop.evaluate(()=>__analyticsCalls.filter(x=>x[0]==='add_to_cart').length),1);
  await shop.goto('http://127.0.0.1:8765/checkout.html');await shop.locator('.checkout-item').waitFor();
  await shop.evaluate(()=>initCheckoutPage());assert.equal(await shop.evaluate(()=>__analyticsCalls.filter(x=>x[0]==='begin_checkout').length)>=1,true);
  const values={checkoutName:'Олена',checkoutLastName:'Коваль',checkoutContact:'+380671234567',checkoutCity:'Одеса',checkoutEmail:'customer@example.test',checkoutDelivery:'№12'};
  for(const [id,value] of Object.entries(values))await shop.locator('#'+id).fill(value);
  await shop.evaluate(()=>submitCartCheckout());assert.equal(await shop.evaluate(()=>__analyticsCalls.filter(x=>x[0]==='order_placed').length),0);
  fail=false;await shop.evaluate(()=>submitCartCheckout());await shop.locator('.checkout-success').waitFor();
  const calls=await shop.evaluate(()=>__analyticsCalls);assert.equal(calls.filter(x=>x[0]==='order_placed').length,1);assert.equal(calls.filter(x=>x[0]==='purchase'||x[0]==='remove_from_cart').length,0);assert.doesNotMatch(JSON.stringify(calls),/customer@example|380671234567|Олена|Коваль/);
  assert.equal(f.functionCalls.length,0);assert.ok(f.calls.every(c=>c.op==='select'),'unexpected isolated writes: '+JSON.stringify(f.calls.filter(c=>c.op!=='select').map(c=>({op:c.op,table:c.table}))));assert.deepEqual(f.errors,[]);
  console.log('PASS: analytics opt-in/refusal/revocation, single page view, event allowlist, private URL and payload filtering, responsive controls, account/preview exclusion, real storefront hooks and failed/successful isolated checkout. No real GA or store writes.');
 }finally{await f.browser.close()}
})().catch(error=>{console.error(error);process.exitCode=1});
