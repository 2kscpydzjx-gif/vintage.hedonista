import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import vm from 'node:vm';
import {merchantFeed,addProductImagesToSitemap,productImages,publicImage} from '../scripts/merchant-feed.mjs';
import condition from '../scripts/product-condition.cjs';
const settings={country:'UA',language:'uk',defaultGender:'female',defaultAgeGroup:'adult',defaultCondition:'used'},siteUrl='https://shop.example/';
const item={id:'stable-id',slug:'сукня-з-принтом',name:'Сукня & жакет',short_description:'<p>Льон &amp; <strong>шовк</strong>.</p>',price:'1250.5',status:'published',size:'S-M',color:'Синій',condition:'Нова',brand:'Real brand',categories:{name:'Сукні'},cover_image:'https://images.example/фото.webp',product_images:[{image_url:'https://images.example/other.jpg',sort_order:2},{image_url:'https://images.example/фото.webp',sort_order:0}]};
const source=structuredClone(item),feed=merchantFeed([item],{siteUrl,settings});
assert.equal(feed.report.included,1);assert.equal(feed.report.excluded.length,0);assert.deepEqual(item,source);
for(const text of ['<g:id>stable-id</g:id>','<g:title>Сукня &amp; жакет</g:title>','<g:description>Льон &amp; шовк.</g:description>','<g:price>1250.50 UAH</g:price>','<g:condition>new</g:condition>','<g:gender>female</g:gender>','<g:age_group>adult</g:age_group>','<g:availability>in_stock</g:availability>'])assert.ok(feed.xml.includes(text),text);
assert.doesNotMatch(feed.xml,/<g:(?:adult|identifier_exists|gtin|mpn)>/);
assert.equal((feed.xml.match(/<g:additional_image_link>/g)||[]).length,1);
assert.ok(productImages(item)[0].includes('%D1%84%D0%BE%D1%82%D0%BE'));
assert.equal(publicImage('javascript:alert(1)'),null);assert.equal(publicImage('https://user:secret@example.com/image.jpg'),null);
assert.equal(publicImage('https://images.example/a&b,c.webp#fragment'),'https://images.example/a%26b%2Cc.webp');
const lots={...item,product_images:Array.from({length:20},(_,i)=>({image_url:'https://images.example/'+i+'.webp',sort_order:i}))};
assert.equal((merchantFeed([lots],{siteUrl,settings}).xml.match(/<g:additional_image_link>/g)||[]).length,10);
const filtered=merchantFeed([item,{...item,id:'draft',status:'draft'},{...item,id:'missing',size:'',color:null},{...item,id:'generic',color:'Різнокольоровий'}],{siteUrl,settings});
assert.equal(filtered.report.included,1);assert.equal(filtered.report.excluded.length,2);assert.doesNotMatch(filtered.xml,/<g:id>draft<\/g:id>/);
const bag=merchantFeed([{...item,name:'Сумка',size:null,id:'bag',categories:{name:'Аксесуари'},condition:null,brand:'No Brand'}],{siteUrl,settings});
assert.equal(bag.report.included,1);assert.doesNotMatch(bag.xml,/<g:(?:size|brand)>/);assert.match(bag.xml,/<g:condition>used<\/g:condition>/);
assert.throws(()=>merchantFeed([{...item,name:'Корсет',categories:{name:'Аксесуари'},size:null}],{siteUrl,settings}));
for(const status of ['sold','reserved'])assert.match(merchantFeed([{...item,status}],{siteUrl,settings}).xml,/<g:availability>out_of_stock<\/g:availability>/);
for(const bad of [{price:0},{price:null},{price:''},{price:-5},{slug:'../private'},{cover_image:'data:image/png,none',product_images:[]}])assert.throws(()=>merchantFeed([{...item,...bad}],{siteUrl,settings}));
assert.throws(()=>merchantFeed([item,item],{siteUrl,settings}));assert.throws(()=>merchantFeed([],{siteUrl,settings}));
const old='https://source.example/store/',loc=old+'seo-product/'+encodeURIComponent(item.slug)+'/index.html',sitemap='<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>'+loc+'</loc></url><url><loc>'+old+'journal.html</loc></url></urlset>';
const images=addProductImagesToSitemap(sitemap,[item,{...item,id:'private',slug:'private',status:'draft'}],old,siteUrl);
assert.match(images,/xmlns:image="http:\/\/www.google.com\/schemas\/sitemap-image\/1.1"/);
assert.equal((images.match(/<image:image>/g)||[]).length,2);assert.ok(images.includes('<loc>'+loc+'</loc>'));assert.ok(images.includes('<url><loc>'+old+'journal.html</loc></url>'));
assert.equal(addProductImagesToSitemap(images,[item],old,siteUrl),images,'Duplicate image sitemap entries');
const conditions=[['Нова','new'],['Новий','new'],['Нове','new'],['Нові','new'],['Нова з бірками','new'],['Ідеальний','used'],['Стан нових (вдягались 1 раз)','used'],[null,'used'],['Як новий','used']];
const runtime=readFileSync(new URL('../vh-seo-runtime.js',import.meta.url),'utf8');
const match=runtime.match(/const itemCondition=([^;]+);/);assert.ok(match);
for(const [value,expected] of conditions){
 assert.equal(condition(value),expected);
 assert.equal(vm.runInNewContext(match[1],{product:{condition:value}}),expected==='new'?'NewCondition':'UsedCondition');
}
let staticCount=0;
for(const entry of readdirSync(new URL('../seo-product/',import.meta.url),{withFileTypes:true})){
 if(!entry.isDirectory())continue;
 const html=readFileSync(new URL('../seo-product/'+entry.name+'/index.html',import.meta.url),'utf8');
 const stored=html.match(/<script\b[^>]*id="vh-static-product-jsonld"[^>]*>([\s\S]*?)<\/script>/)?.[1];
 const visible=html.match(/<[^>]*id="productCondition"[^>]*>([\s\S]*?)<\/[^>]+>/)?.[1]||'';
 assert.ok(stored,entry.name+' missing structured data');
 const schema=JSON.parse(stored);
 assert.equal(schema.offers.itemCondition,'https://schema.org/'+(condition(visible)==='new'?'NewCondition':'UsedCondition'),entry.name+' mismatched condition');staticCount++;
}
assert.ok(staticCount);
console.log('PASS: Merchant XML, public status/stock, stable IDs, names/units/prices, size/color exclusions, real brands, no fabricated identifiers, 10 extra photos, image sitemap/idempotency and consistent conditions; no writes.');
