const assert=require('node:assert/strict');
const {fixture}=require('./cms-browser-fixture.cjs');
const base='http://127.0.0.1:8765',capId='capsule-whole',mainId='main-look',altId='alternate-look';
const products=[1000,1500,800,1200,1700].map((price,i)=>({id:'piece-'+i,name:'Річ '+(i+1),slug:'piece-'+i,price,stock:1,status:'published',cover_image:base+'/assets/test-upload.png'}));
const sum=products.reduce((n,p)=>n+p.price,0),ids=products.map(p=>p.id);
const mainLinks=products.map((p,i)=>({capsule_id:capId,look_id:mainId,product_id:p.id,sort_order:i}));
const allLinks=[...mainLinks,...products.slice(0,2).map((p,i)=>({capsule_id:capId,look_id:altId,product_id:p.id,sort_order:i}))];
const fill=async p=>{for(const [id,value] of Object.entries({checkoutName:'Олена',checkoutLastName:'Коваль',checkoutContact:'+380671234567',checkoutCity:'Одеса',checkoutEmail:'capsule@example.test',checkoutDelivery:'Відділення №12'}))await p.locator('#'+id).fill(value)};
(async()=>{const f=await fixture({reducedMotion:'reduce'}),created=[],lines=[];let price=0;try{
 f.user(null);
 const seed=value=>{
  price=value;
  f.data('products',products);
  f.data('capsule_styles',[{id:'style',slug:'test-style',title:'Тестовий стиль',is_active:true}]);
  f.data('capsules',[{id:capId,style_id:'style',title:'Цільна капсула',price,is_active:true,cover_image:base+'/assets/test-upload.png'}]);
  // Main is deliberately not first in source order; presentation order cannot define identity.
  f.data('capsule_looks',[{id:altId,capsule_id:capId,is_main:false,sort_order:0},{id:mainId,capsule_id:capId,is_main:true,sort_order:10}]);
  f.data('capsule_look_products',allLinks);
 };
 f.rpc(async({name,args})=>{
  if(name!=='vh_create_checkout_order')return {data:name==='is_admin'?true:[],error:null};
  const chosen=products.filter(p=>args.p_product_ids.includes(p.id));
  const subtotal=chosen.reduce((n,p)=>n+p.price,0),total=args.p_capsule_id&&price>0?Math.min(price,subtotal):subtotal;
  const make=(product,amount)=>({id:'order-'+created.length,customer_name:args.p_customer_name,phone:args.p_contact,email:args.p_email,comment:args.p_comment,status:'new',amount,created_at:'2026-10-27T10:00:00Z',product_name:product?.name||'Цільна капсула',product_id:product?.id||null,capsule_id:args.p_capsule_id||null});
  const orderIds=[];
  // Model the existing API distinction: no capsule IDs means separate product orders.
  if(args.p_capsule_id){
   assert.equal(args.p_capsule_id,capId);assert.equal(args.p_look_id,mainId);assert.deepEqual([...args.p_product_ids].sort(),[...ids].sort());
   const order=make(null,total);created.push(order);orderIds.push(order.id);
   chosen.forEach(p=>lines.push({order_id:order.id,product_id:p.id,product_name:p.name,unit_price:p.price}));
  }else for(const p of chosen){const order=make(p,p.price);created.push(order);orderIds.push(order.id)}
  f.data('orders',created);f.data('order_items',lines);
  return {data:{success:true,total,order_ids:orderIds},error:null};
 });
 const p=await f.context.newPage();
 const open=async(value,cart=[])=>{
  seed(value);await p.goto(base+'/capsule-1.html?style=test-style');await p.waitForFunction(()=>document.querySelector('.capsule-info h1')?.textContent==='Цільна капсула'&&document.querySelectorAll('.capsule-product-card').length===5);
  await p.evaluate(cart=>vhSetCart(cart),cart);await p.locator('#capsuleAddAll').click();
 };
 const checkout=async()=>{await p.locator('#vhCheckoutLink').click();await p.waitForURL('**/checkout.html');await p.waitForFunction(()=>document.querySelectorAll('.checkout-item').length>0);await fill(p)};
 for(const [value,total] of [[0,sum],[sum-500,sum-500],[sum,sum],[sum+1000,sum]]){
  const before=created.length,beforeEmails=f.functionCalls.length;
  await open(value);
  const cart=await p.evaluate(()=>vhGetCart());assert.equal(cart.length,5);assert.ok(cart.every(x=>x.capsule_offer?.id===capId&&x.capsule_offer.look_id===mainId),'capsule identity missing at price '+value);
  await checkout();assert.equal(await p.locator('#checkoutTotal').textContent(),new Intl.NumberFormat('uk-UA').format(total)+' грн');
  await p.locator('.checkout-submit').click();await p.locator('.checkout-success').waitFor();
  assert.equal(created.length-before,1,'capsule split into product orders at price '+value);assert.equal(f.functionCalls.length-beforeEmails,0,'capsule duplicated the server notification');
  const order=created.at(-1);assert.equal(order.capsule_id,capId);assert.equal(lines.filter(l=>l.order_id===order.id).length,5);assert.equal(order.amount,total);
 }
 // Recover carts made by the old code: add the same capsule again, without duplicates.
 await open(0,products);assert.equal(await p.evaluate(()=>vhGetCart().length),5);assert.ok(await p.evaluate(()=>vhGetCart().every(x=>x.capsule_offer?.id==='capsule-whole')));
 await checkout();
 const assertBlocked=async(message)=>{
  const before=f.rpcCalls.filter(x=>x.name==='vh_create_checkout_order').length;
  await p.evaluate(()=>submitCartCheckout());assert.equal(f.rpcCalls.filter(x=>x.name==='vh_create_checkout_order').length,before,'invalid capsule fell back to individual checkout');assert.match(await p.locator('.vh-checkout-feedback').textContent(),message);
 };
 // Membership changes, removed lines and inactive capsules must fail before RPC, never split silently.
 f.data('capsule_look_products',allLinks.filter(l=>l.product_id!==ids[0]));await assertBlocked(/Склад капсули змінився/);
 f.data('capsule_look_products',allLinks);await p.locator('.checkout-item button').last().click();await p.waitForFunction(()=>document.querySelectorAll('.checkout-item').length===4);await assertBlocked(/неповна/);
 await open(0);await checkout();f.data('capsules',[{id:capId,price:0,is_active:false}]);await assertBlocked(/недоступна/);
 await open(0);await checkout();f.data('capsule_looks',[{id:mainId,capsule_id:capId,is_main:false}]);await assertBlocked(/Склад капсули змінився/);
 // Mixed and multiple capsule carts cannot lose their identity through this single-capsule RPC.
 await open(0);await checkout();await p.evaluate(()=>{const cart=vhGetCart();cart.push({id:'extra',name:'Інша річ',price:100,stock:1,status:'published'});vhSetCart(cart)});
 f.data('products',[...products,{id:'extra',price:100,stock:1,status:'published'}]);await assertBlocked(/окремим замовленням/);
 f.data('capsules',[{id:capId,price:0,is_active:true},{id:'second-capsule',price:0,is_active:true}]);
 f.data('capsule_looks',[{id:mainId,capsule_id:capId,is_main:true},{id:'second-main',capsule_id:'second-capsule',is_main:true}]);
 f.data('capsule_look_products',[...allLinks,{capsule_id:'second-capsule',look_id:'second-main',product_id:'extra'}]);
 await p.evaluate(()=>{const cart=vhGetCart();cart.find(x=>x.id==='extra').capsule_offer={id:'second-capsule',look_id:'second-main',product_ids:['extra']};vhSetCart(cart)});await assertBlocked(/окремим замовленням/);
 await open(0);await checkout();await p.evaluate(()=>{const cart=vhGetCart();delete cart[0].capsule_offer;vhSetCart(cart)});await assertBlocked(/неповна/);
 // Alternative look and ordinary purchases retain their existing individual-product path.
 await open(0);await p.evaluate(()=>vhSetCart([]));await p.locator('#vhCartBackdrop').click({position:{x:4,y:4}});await p.locator('#capsuleLookTrack .capsule-look-option').nth(1).click();await p.locator('#capsuleAddAll').click();
 assert.ok(await p.evaluate(()=>vhGetCart().every(x=>!x.capsule_offer)));await checkout();const before=created.length;await p.locator('.checkout-submit').click();await p.locator('.checkout-success').waitFor();assert.equal(created.length-before,2);assert.equal(f.rpcCalls.findLast(x=>x.name==='vh_create_checkout_order').args.p_capsule_id,null);
 // The admin reads the stored parent and its actual line records as one capsule with five products.
 f.data('orders',[created[0]]);f.data('order_items',lines.filter(l=>l.order_id===created[0].id));
 const admin=await f.context.newPage();await admin.goto(base+'/admin/admin.html?page=orders');await admin.locator('#ordersTable .order-card-v135').waitFor();assert.equal(await admin.locator('#ordersTable .order-card-v135').count(),1);assert.match(await admin.locator('#ordersTable').textContent(),/Комплект · 5 речей/);
 await admin.locator('#ordersTable .order-card-v135').click();await admin.locator('#vhCapsuleOrderLines').waitFor({state:'visible'});assert.match(await admin.locator('#vhCapsuleOrderLines').textContent(),/Склад капсули \(5\)/);for(const product of products)assert.ok((await admin.locator('#vhCapsuleOrderLines').textContent()).includes(product.name));assert.equal(await admin.locator('#odCity').textContent(),'Одеса');
 await admin.reload();await admin.locator('#ordersTable .order-card-v135').waitFor();assert.equal(await admin.locator('#ordersTable .order-card-v135').count(),1);assert.match(await admin.locator('#ordersTable').textContent(),/Комплект · 5 речей/);
 assert.deepEqual(f.errors,[]);console.log('PASS: real capsule page → cart → checkout → one parent with five lines → admin/reload, zero/equal/higher/discounted prices, main-look identity, old-cart recovery and fail-closed invalid/mixed capsules; ordinary orders retained. All writes/emails isolated.');
}finally{await f.browser.close()}})().catch(e=>{console.error(e);process.exit(1)});
