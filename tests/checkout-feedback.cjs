const assert=require('node:assert/strict'),fs=require('node:fs'),{fixture}=require('./cms-browser-fixture.cjs');
const base='http://127.0.0.1:8765',product={id:'feedback-item',slug:'feedback-item',name:'Жакет <img src=x onerror="window.injected=true"> з довгою назвою',price:1200,status:'published',stock:1,cover_image:base+'/assets/test-upload.png',product_images:[]};
const values=['Олена','Коваль','+380 (67) 123-45-67','Одеса','feedback@example.test','Відділення №12'];
(async()=>{const f=await fixture({reducedMotion:'reduce',isMobile:true,hasTouch:true});try{
 f.user(null);f.data('products',[{...product,name:'Жакет із довгою назвою для перевірки оформлення'}]);
 let failure=null,created=0;
 f.rpc(async({name})=>{if(name!=='vh_create_checkout_order')return {data:[],error:null};if(failure)return {data:null,error:{message:failure,vhPublicMessage:'private-provider-detail secret@example.test'}};created++;return {data:{success:true,total:1200,order_ids:['isolated-order'],order_number:'VH-123'},error:null}});
 const p=await f.context.newPage();
 fs.mkdirSync('test-results/prelaunch-feedback',{recursive:true});
 for(const kind of ['order','cart'])for(const width of [320,430,820,1024]){
  await p.setViewportSize({width,height:900});
  await p.goto(base+'/product.html?slug='+product.slug);await p.locator('#buyBtn').waitFor();
  if(kind==='order')await p.locator('#buyBtn').click();else{await p.evaluate(item=>vhSetCart([item]),product);await p.goto(base+'/checkout.html');await p.locator('.checkout-item').waitFor()}
  const ids=kind==='order'?['oFirstName','oLastName','oPhone','oCity','oEmail','oDelivery']:['checkoutName','checkoutLastName','checkoutContact','checkoutCity','checkoutEmail','checkoutDelivery'];
  const submit=()=>p.evaluate(kind=>kind==='order'?submitOrder():submitCartCheckout(),kind);
  const scope=kind==='order'?'#orderModal':'#checkoutForm';
  const before=f.rpcCalls.length;await submit();assert.equal(f.rpcCalls.length,before);assert.equal(await p.locator(scope+' [aria-invalid=true]').count(),6);
  assert.equal(await p.evaluate(()=>document.activeElement.id),ids[0]);
  for(const [i,id] of ids.entries())await p.locator('#'+id).fill(values[i]);
  await p.locator('#'+ids[2]).fill('abc123');await submit();assert.equal(await p.locator('#'+ids[2]).getAttribute('aria-invalid'),'true');assert.match(await p.locator('#'+ids[2]+'-error').textContent(),/номер телефону/);assert.equal(await p.evaluate(()=>document.activeElement.id),ids[2]);
  await p.locator('#'+ids[2]).fill(values[2]);await p.locator('#'+ids[4]).fill('invalid');await submit();assert.equal(await p.locator('#'+ids[4]).getAttribute('aria-invalid'),'true');assert.equal(await p.locator('#'+ids[4]).getAttribute('aria-describedby'),ids[4]+'-error');await p.locator('#'+ids[4]).fill(values[4]);
  if(kind==='order'&&width===320){
   const calls=f.rpcCalls.length;
   await p.evaluate(()=>{window.testProductFrom=publicSb.from;publicSb.from=table=>table==='products'?{select(){return this},eq(){return this},maybeSingle:async()=>({data:null,error:{message:'Failed to fetch'}})}:window.testProductFrom(table)});
   await submit();assert.equal(f.rpcCalls.length,calls);assert.match(await p.locator('.vh-checkout-feedback').textContent(),/Немає зв’язку/);assert.doesNotMatch(await p.locator('.vh-checkout-feedback').textContent(),/могло бути прийняте/);
   await p.evaluate(()=>{publicSb.from=window.testProductFrom;delete window.testProductFrom});
  }
  // Shrinking viewport exercises scrolling while the on-screen keyboard would occupy space.
  await p.setViewportSize({width,height:430});failure='permission denied for table orders secret@example.test';await submit();
  let message=await p.locator('.vh-checkout-feedback').textContent();assert.match(message,/Не вдалося оформити/);assert.doesNotMatch(message,/permission|orders|secret@/);assert.equal(await p.locator('#'+ids[5]).inputValue(),values[5]);
  assert.equal(await p.locator('.vh-checkout-feedback').getAttribute('role'),'alert');
  if(width===320&&kind==='order'){await p.waitForTimeout(2400);assert.equal(await p.locator('.vh-checkout-feedback').isVisible(),true)}
  failure='TypeError: Failed to fetch';await submit();message=await p.locator('.vh-checkout-feedback').textContent();assert.match(message,/могло бути прийняте/);assert.match(message,/Перед повторним/);
  assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'overflow '+kind+' '+width);
  const r=await p.locator('.vh-checkout-feedback').boundingBox();assert.ok(r.x>=0&&r.x+r.width<=width+.5&&r.y<430&&r.y+r.height>0,'feedback outside shrunken viewport '+kind+' '+width+' '+JSON.stringify(r));
  if(width===430)await p.screenshot({path:'test-results/prelaunch-feedback/'+kind+'-network.png'});
  failure=null;await submit();const success=p.locator((kind==='order'?'#orderModal ':'.checkout-grid ')+'.vh-order-success');await success.waitFor();
  assert.match(await success.textContent(),/ЗАМОВЛЕННЯ ПРИЙНЯТО/);assert.match(await success.textContent(),/VH-123/);assert.match(await success.textContent(),/1\s?200 грн/);assert.equal(await success.locator('li').count(),1);
  assert.equal(await p.evaluate(()=>document.activeElement.classList.contains('vh-order-success')),true);assert.equal(await success.locator('img').count(),0);assert.equal(await p.evaluate(()=>window.injected),undefined);
  assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'success overflow '+width);
  assert.equal(await p.locator('#toast').getAttribute('role'),'status');
  if(width===430)await p.screenshot({path:'test-results/prelaunch-feedback/'+kind+'-success.png'});
  if(kind==='order'){
   await p.locator('.order-v126-close').click();await p.setViewportSize({width,height:900});await p.locator('#buyBtn').click();assert.equal(await p.locator('#orderModal .vh-order-success').count(),0);assert.equal(await p.locator('#oFirstName').isVisible(),true);
  }
 }
 assert.equal(created,8);assert.deepEqual(f.errors,[]);console.log('PASS: persistent private-safe errors, accessible field validation/focus, ambiguous network outcomes and lasting purchase confirmations on phone/tablet, including a shrunken viewport.');
}finally{await f.browser.close()}})().catch(e=>{console.error(e);process.exit(1)});
