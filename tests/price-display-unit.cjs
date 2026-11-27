const assert=require('node:assert/strict'),prices=require('../price-display.js');
for(const [price,old_price,percent,saving] of [[680,800,15,120],[1955,2300,15,345],[600,700,14,100],[800,1000,20,200],[0,100,100,100],['80','100',20,20]]){
 const d=prices.discount({price,old_price});assert.equal(d.percent,percent);assert.equal(d.saving,saving);
}
for(const old_price of [null,undefined,'',0,-1,500,499,'invalid',Infinity])assert.equal(prices.discount({price:500,old_price}),null);
for(const price of [null,undefined,'',-1,'invalid',Infinity])assert.equal(prices.discount({price,old_price:100}),null);
assert.equal(prices.discount({price:99.99,old_price:100}).badge,'ЗНИЖКА','tiny discounts must not claim zero percent');
const original='<div><span>ЦІНА</span><div class="big-price" id="productPrice">680 грн</div></div>';
const sale=prices.decorate(original,{price:680,old_price:800});
assert.match(sale,/<del[^>]*>800 грн<\/del>/);assert.match(sale,/−15%/);assert.match(sale,/Економія 120 грн/);
assert.match(sale,/id="productPrice">680 грн<\/div>/,'current price ID must remain unambiguous for SEO/checkout');
assert.equal(prices.decorate(sale,{price:680,old_price:800}),sale,'static decoration is not idempotent');
assert.equal(prices.decorate(sale,{price:680,old_price:null}),original,'stale sale markup was retained');
console.log('PASS: accurate non-overstated percentages, currency savings, invalid/non-sale values, shared static markup, idempotence and discount removal.');
