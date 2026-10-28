const assert=require('node:assert/strict');
const {fixture}=require('./cms-browser-fixture.cjs');
const base='http://127.0.0.1:8765';
const product={id:'isolated-product',name:'Вовняний жакет-кардиган',slug:'isolated-jacket',price:1200,stock:1,status:'published',brand:'Marc Cain',cover_image:base+'/assets/test-upload.png',product_images:[]};
const values={checkoutName:'Олена',checkoutLastName:'Коваль',checkoutContact:'+380671234567',checkoutCity:'Одеса',checkoutEmail:'checkout@example.test',checkoutDelivery:'Відділення №12',checkoutComment:'Зателефонуйте після 18:00.\nДякую!'};
const fill=async p=>{for(const [id,value] of Object.entries(values))await p.locator('#'+id).fill(value)};
const cart=async(p,items)=>p.evaluate(items=>localStorage.setItem('vh_cart_v1',JSON.stringify(items)),items);
const checkout=async p=>{await p.goto(base+'/checkout.html');await p.waitForFunction(()=>document.querySelector('#checkoutItems')?.textContent.trim())};
const formValues=p=>p.locator('#checkoutForm input,#checkoutForm textarea').evaluateAll(els=>Object.fromEntries(els.map(el=>[el.id,el.value])));
(async()=>{const f=await fixture({reducedMotion:'reduce'}),created=[];try{
 f.user(null);f.data('products',[product]);
 let fail=false,gate=null;
 f.rpc(async({name,args})=>{
  if(name!=='vh_create_checkout_order')return {data:name==='is_admin'?true:[],error:null};
  if(gate)await gate;
  if(fail)return {data:null,error:{message:'Тестова помилка сервера'}};
  const row={id:'isolated-order-'+created.length,order_number:100+created.length,customer_name:args.p_customer_name,phone:args.p_contact,email:args.p_email,comment:args.p_comment,product_name:product.name,product_id:product.id,status:'new',amount:args.p_capsule_id?1500:1200,created_at:'2026-10-27T08:00:00Z'};
  created.push(row);return {data:{success:true,total:row.amount,order_ids:[row.id]},error:null};
 });
 const p=await f.context.newPage();await p.setViewportSize({width:1440,height:1000});
 // Actual entry point: product → add to cart → drawer → checkout.
 await p.goto(base+'/product.html?slug='+product.slug);await p.locator('#buyBtn').waitFor();
 await p.locator('#buyBtn').click();await p.locator('#orderModal').waitFor({state:'visible'});
 for(const id of ['oFirstName','oLastName','oPhone','oCity','oEmail','oDelivery','oComment'])assert.equal(await p.locator('#'+id).count(),1);
 await p.evaluate(()=>closeOrder());
 await p.locator('[onclick="addCurrentProductToCart()"]').click();await p.locator('[data-header-cart]').click();await p.locator('#vhCheckoutLink').click();await p.waitForURL('**/checkout.html');await p.waitForFunction(()=>document.querySelector('.checkout-item'));
 for(const id of Object.keys(values)){assert.equal(await p.locator('#'+id).count(),1);if(id!=='checkoutComment')assert.equal(await p.locator('#'+id).getAttribute('required'),'')}
 await fill(p);
 // Required shipping/recipient data must be checked even if called without native form validation.
 for(const id of ['checkoutName','checkoutLastName','checkoutContact','checkoutCity','checkoutEmail','checkoutDelivery']){
  await p.locator('#'+id).fill('');const before=f.rpcCalls.length;await p.evaluate(()=>submitCartCheckout());assert.equal(f.rpcCalls.length,before,'missing '+id+' reached RPC');await p.locator('#'+id).fill(values[id]);
 }
 await p.locator('#checkoutEmail').fill('broken-email');await p.evaluate(()=>submitCartCheckout());assert.equal(created.length,0);await p.locator('#checkoutEmail').fill(values.checkoutEmail);
 // Repricing and removal rerender the order summary, preserving everything already entered.
 f.data('products',[{...product,price:1300}]);await p.evaluate(()=>submitCartCheckout());assert.match(await p.locator('.vh-checkout-feedback').textContent(),/Ціна змінилася/);assert.deepEqual(await formValues(p),values);assert.equal(created.length,0);
 f.data('products',[product]);await cart(p,[product,{...product,id:'remove-me'}]);await p.evaluate(()=>initCheckoutPage());await p.locator('.checkout-item button').last().click();await p.waitForFunction(()=>document.querySelectorAll('.checkout-item').length===1);assert.deepEqual(await formValues(p),values);
 fail=true;await p.locator('.checkout-submit').click();await p.waitForFunction(()=>document.querySelector('.vh-checkout-feedback')?.textContent.includes('Не вдалося оформити'));assert.doesNotMatch(await p.locator('.vh-checkout-feedback').textContent(),/Тестова помилка/);assert.deepEqual(await formValues(p),values);assert.equal(await p.locator('.checkout-submit').isEnabled(),true);assert.equal(f.functionCalls.length,0);assert.equal(await p.evaluate(()=>JSON.parse(localStorage.getItem('vh_cart_v1')).length),1);
 fail=false;let release;gate=new Promise(resolve=>release=resolve);
 const before=f.rpcCalls.filter(x=>x.name==='vh_create_checkout_order').length;
 await p.evaluate(()=>{submitCartCheckout();submitCartCheckout()});
 await p.waitForFunction(()=>document.querySelector('.checkout-submit').disabled);assert.equal(f.functionCalls.length,0);await p.evaluate(item=>vhSetCart([...vhGetCart(),item]),{...product,id:'added-while-checkout',name:'Додано в іншій вкладці'});release();gate=null;
 await p.locator('.checkout-success').waitFor();assert.equal(f.rpcCalls.filter(x=>x.name==='vh_create_checkout_order').length,before+1,'double submit created two orders');
 assert.deepEqual(await p.evaluate(()=>vhGetCart().map(item=>item.id)),['added-while-checkout'],'accepted order erased a new item added during submission');assert.equal(f.functionCalls.length,1);
 const args=f.rpcCalls.findLast(x=>x.name==='vh_create_checkout_order').args;
 assert.deepEqual(Object.keys(args).sort(),['p_product_ids','p_customer_name','p_contact','p_email','p_comment','p_capsule_id','p_look_id'].sort(),'existing RPC contract changed');
 assert.equal(args.p_customer_name,'Олена Коваль');assert.equal(args.p_contact,values.checkoutContact);assert.equal(args.p_email,values.checkoutEmail);assert.deepEqual(args.p_product_ids,[product.id]);
 assert.match(args.p_comment,/Місто: Одеса\nВідділення: Відділення №12/);assert.ok(args.p_comment.endsWith(values.checkoutComment));
 // Same form at phone/tablet widths; guests never receive a previous account's local profile.
 for(const width of [320,390,820,1024,1368]){
  await p.setViewportSize({width,height:1000});await cart(p,[product]);await p.evaluate(()=>localStorage.setItem('vh_profile_v1',JSON.stringify({name:'Чужий Профіль',city:'Не підставляти',delivery_address:'№99'})));await checkout(p);
  assert.equal(await p.locator('#checkoutName').inputValue(),'');assert.equal(await p.locator('#checkoutCity').inputValue(),'');await fill(p);
  const controls=await p.locator('#checkoutForm input,#checkoutForm textarea').evaluateAll(els=>els.map(el=>{const r=el.getBoundingClientRect();return {left:r.left,right:r.right,width:r.width,height:r.height}}));assert.ok(controls.every(r=>r.left>=0&&r.right<=width&&r.width>=200&&r.height>=44),'form geometry '+width);assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'document overflow '+width);
 }
 // Logged-in profile includes surname and delivery; editing and removing a line must not overwrite it.
 f.user({id:'customer',email:'auth@example.test',user_metadata:{first_name:'Метадані',last_name:'Профілю'}});
 f.data('customer_profiles',[{id:'customer',first_name:'Ірина',last_name:'Бондар',email:'profile@example.test',phone:'+380501234567',city:'Львів',delivery_address:'Відділення №5'}]);
 await checkout(p);assert.equal(await p.locator('#checkoutLastName').inputValue(),'Бондар');assert.equal(await p.locator('#checkoutCity').inputValue(),'Львів');assert.equal(await p.locator('#checkoutDelivery').inputValue(),'Відділення №5');assert.equal(await p.locator('#checkoutEmail').inputValue(),'profile@example.test');
 await fill(p);await p.evaluate(()=>initCheckoutPage());assert.deepEqual(await formValues(p),values);
 // Unavailable and empty carts cannot create orders.
 f.data('products',[{...product,status:'reserved'}]);let count=created.length;await p.evaluate(()=>submitCartCheckout());assert.equal(created.length,count);assert.match(await p.locator('.vh-checkout-feedback').textContent(),/недоступні/);
 await cart(p,[]);await p.evaluate(()=>submitCartCheckout());assert.equal(created.length,count);assert.match(await p.locator('.vh-checkout-feedback').textContent(),/Кошик порожній/);
 // Capsule bundles retain the same pricing, main-look and product validation path.
 const second={...product,id:'second-product',price:700},offer={id:'capsule',look_id:'main-look',product_ids:[product.id,second.id],title:'Капсула'};
 f.data('products',[product,second]);f.data('capsules',[{id:'capsule',price:1500,is_active:true,title:'Капсула'}]);f.data('capsule_looks',[{id:'main-look',capsule_id:'capsule',is_main:true}]);f.data('capsule_look_products',[product,second].map(x=>({capsule_id:'capsule',look_id:'main-look',product_id:x.id})));
 await cart(p,[product,second].map(x=>({...x,capsule_offer:offer})));await checkout(p);await fill(p);assert.match(await p.locator('#checkoutTotal').textContent(),/1\s?500/);await p.locator('.checkout-submit').click();await p.locator('.checkout-success').waitFor();assert.equal(created.length,count+1);assert.equal(f.rpcCalls.findLast(x=>x.name==='vh_create_checkout_order').args.p_capsule_id,'capsule');
 // Read the stored RPC payload through the real admin UI, including refresh and old native orders.
 f.data('orders',[created[0],{...created[0],id:'native-order',comment:'Звичайний коментар',city:'Київ',delivery_address:'№7'}]);
 const admin=await f.context.newPage();await admin.goto(base+'/admin/admin.html?page=orders');await admin.locator('#ordersTable .order-card-v135').first().waitFor();
 assert.match(await admin.locator('#ordersTable').textContent(),/Одеса/);assert.match(await admin.locator('#ordersTable').textContent(),/Відділення №12/);
 await admin.locator('#ordersTable .order-card-v135').first().click();await admin.locator('#odCity').waitFor({state:'visible'});assert.equal(await admin.locator('#odCity').textContent(),'Одеса');assert.equal(await admin.locator('#odDelivery').textContent(),'Відділення №12');assert.equal(await admin.locator('#odComment').textContent(),values.checkoutComment);
 await admin.reload();await admin.locator('#ordersTable .order-card-v135').first().waitFor();assert.match(await admin.locator('#ordersTable').textContent(),/Одеса/);assert.match(await admin.locator('#ordersTable').textContent(),/Київ/);
 const hostileCity='<img src=x onerror="window.checkoutInjected=true">';
 const hostileComment=await p.evaluate(city=>VHOrderDelivery.encode(city,'№12',''),hostileCity);
 f.data('orders',[{...created[0],comment:hostileComment}]);await admin.evaluate(()=>loadOrders());
 assert.match(await admin.locator('.order-delivery-v135').textContent(),/<img src=x/);assert.equal(await admin.locator('.order-delivery-v135 img').count(),0);assert.equal(await admin.evaluate(()=>window.checkoutInjected),undefined);
 // The transport is readable without this codec and preserves ordinary/native comments and columns.
 const result=await p.evaluate(()=>{const native={city:'Існуюче місто',delivery_address:'№9',comment:VHOrderDelivery.encode('Одеса','№12','Дві\nстроки')};return {native:VHOrderDelivery.read(native),plain:VHOrderDelivery.read({comment:'Не змінювати'}),empty:VHOrderDelivery.read({comment:VHOrderDelivery.encode('Одеса','№12','')})}});
 assert.equal(result.native.city,'Існуюче місто');assert.equal(result.native.delivery_address,'№9');assert.equal(result.native.comment,'Дві\nстроки');assert.deepEqual(result.plain,{comment:'Не змінювати'});assert.equal(result.empty.comment,null);
 assert.deepEqual(f.errors,[]);console.log('PASS: product → cart → full checkout → RPC → admin delivery/comment; required fields, profile, guest privacy, repricing/removal, retry/double-submit, empty/unavailable cart, capsule pricing and responsive form. All orders/emails isolated.');
}finally{await f.browser.close()}})().catch(e=>{console.error(e);process.exit(1)});
