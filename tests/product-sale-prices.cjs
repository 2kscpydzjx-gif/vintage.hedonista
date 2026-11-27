const assert=require('node:assert/strict'),fs=require('node:fs');
const {fixture}=require('./cms-browser-fixture.cjs');
const base='http://127.0.0.1:8765',photo=base+'/assets/test-upload.png';
const product={id:'sale',slug:'vovnyanyi-zhaket-kardyhan',name:'Акційний жакет',price:680,old_price:800,status:'published',stock:1,cover_image:photo,product_images:[],size:'S-M',brand:'Fixture'};
(async()=>{const f=await fixture({reducedMotion:'reduce'});try{
 f.user(null);f.session(null);f.data('products',[product,{...product,id:'fractional',slug:'fractional',name:'Неповний відсоток',price:600,old_price:700},{...product,id:'normal',slug:'normal',name:'Без знижки',old_price:null}]);
 const p=await f.context.newPage();await p.goto(base+'/catalog.html');await p.locator('.catalog-luxury-card').first().waitFor();
 const sale=p.locator('.catalog-luxury-card').filter({hasText:product.name});
 assert.equal(await sale.locator('.catalog-badge.sale').innerText(),'−15%');assert.equal(await sale.locator('del').innerText(),'800 грн');
 assert.equal(await p.locator('.catalog-luxury-card').filter({hasText:'Неповний відсоток'}).locator('.catalog-badge.sale').innerText(),'−14%');
 assert.equal(await p.locator('.catalog-luxury-card').filter({hasText:'Без знижки'}).locator('.catalog-badge.sale,del').count(),0);
 await sale.locator('.catalog-luxury-name').click();await p.locator('.vh-price-before').waitFor();
 assert.equal(await p.locator('#productPrice').innerText(),'680 грн');assert.equal(await p.locator('.vh-price-before del').innerText(),'800 грн');
 assert.equal(await p.locator('.vh-price-discount').innerText(),'−15%');assert.equal(await p.locator('.vh-price-saving').innerText(),'Економія 120 грн');
 for(const width of [320,390,768,1366]){
  await p.setViewportSize({width,height:900});const row=p.locator('.product-price-row');await row.scrollIntoViewIfNeeded();
  assert.ok(await row.evaluate(el=>el.scrollWidth<=el.clientWidth+1),'price row overflows '+width);
  const price=await p.locator('#productPrice').boundingBox(),saving=await p.locator('.vh-price-saving').boundingBox();assert.ok(saving.y>=price.y+price.height-1);
  if([390,1366].includes(width)){fs.mkdirSync('test-results/sale-motion',{recursive:true});await row.screenshot({path:'test-results/sale-motion/product-price-'+width+'.png'})}
 }
 // Price revalidation must keep both amounts and the saving consistent, without placing an order.
 await p.locator('#buyBtn').click();for(const [id,value] of Object.entries({oFirstName:'Олена',oLastName:'Коваль',oPhone:'+380671234567',oCity:'Одеса',oEmail:'fixture@example.test',oDelivery:'Відділення №12'}))await p.locator('#'+id).fill(value);
 f.data('products',[{...product,price:600,old_price:800}]);await p.evaluate(()=>submitOrder());
 assert.equal(await p.locator('#productPrice').innerText(),'600 грн');assert.equal(await p.locator('.vh-price-discount').innerText(),'−25%');assert.equal(await p.locator('.vh-price-saving').innerText(),'Економія 200 грн');
 assert.equal(f.rpcCalls.filter(c=>c.name==='vh_create_checkout_order').length,0,'changed price placed an order without confirmation');
 await p.locator('.order-v126-close').click();
 f.data('products',[{...product,price:600,old_price:null}]);await p.reload();await p.waitForFunction(()=>currentProduct?.old_price===null);
 assert.equal(await p.locator('[data-vh-price-before],[data-vh-price-after]').count(),0,'removed discount left stale markup');
 assert.equal(await p.locator('#productPrice').innerText(),'600 грн');
 assert.deepEqual(f.errors,[]);assert.equal(f.calls.some(c=>c.op!=='select'),false);
 console.log('PASS: catalog percentage badges, product old/current price and savings at four sizes, existing SEO route, live price revalidation and discount removal without data writes.');
}finally{await f.browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
