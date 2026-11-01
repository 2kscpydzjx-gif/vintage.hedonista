import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
process.argv.push('--import-only');
const {destination,page}=await import('../scripts/build.mjs');
const files=JSON.parse(await readFile(new URL('../routes.json',import.meta.url),'utf8'));
const examples=[
  ['/vintage.hedonista/','','','https://vintazhka.com.ua/'],
  ['/vintage.hedonista','','','https://vintazhka.com.ua/'],
  ['/vintage.hedonista/index.html','?utm_source=old','#top','https://vintazhka.com.ua/?utm_source=old#top'],
  ['/vintage.hedonista/catalog.html','?category=coats&sort=new','#products','https://vintazhka.com.ua/catalog?category=coats&sort=new#products'],
  ['/vintage.hedonista/product.html','?id=5b49b492-3af1-4f73-b2fe-86fded33f4a8','','https://vintazhka.com.ua/product?id=5b49b492-3af1-4f73-b2fe-86fded33f4a8'],
  ['/vintage.hedonista/seo-product/vovnyana-kepka-v-anhliiskomu-styli/index.html','','','https://vintazhka.com.ua/seo-product/vovnyana-kepka-v-anhliiskomu-styli/'],
  ['/vintage.hedonista/admin/index.html','','','https://vintazhka.com.ua/admin/'],
  ['/vintage.hedonista/account.html','','#access_token=fixture&type=recovery','https://vintazhka.com.ua/account#access_token=fixture&type=recovery'],
  ['/vintage.hedonista/unknown.html','?a=%2F&x=%26','#anchor','https://vintazhka.com.ua/unknown?a=%2F&x=%26#anchor'],
  ['/vintage.hedonista//evil.example/path','?next=https://evil.example','#x','https://vintazhka.com.ua//evil.example/path?next=https://evil.example#x'],
  ['/vintage.hedonista-not-this/catalog.html','','','https://vintazhka.com.ua/vintage.hedonista-not-this/catalog'],
];
for(const [pathname,search,hash,expected] of examples){
  assert.equal(destination(pathname,search,hash),expected);
  let actual;
  const script=page('404.html').match(/<script>([\s\S]*?)<\/script>/)[1];
  vm.runInNewContext(script,{URL,location:{pathname,search,hash,replace:value=>{actual=value;}}});
  assert.equal(actual,expected,'Embedded redirect must use the actual incoming URL');
}
assert.equal(new Set(files).size,files.length);
for(const file of files){
  const html=await readFile(new URL('../'+file,import.meta.url),'utf8');
  const expected=file==='404.html'?'https://vintazhka.com.ua/':destination('/vintage.hedonista/'+file);
  assert.ok(html.includes('<link rel="canonical" href="'+expected+'">'),file);
  assert.ok(html.includes('http-equiv="refresh" content="0;url='+expected+'"'),file);
  assert.ok(html.indexOf('<script>')<html.indexOf('http-equiv="refresh"'),file);
  assert.ok(!html.includes('supabase')&&!html.includes('cms-published')&&!html.includes('noindex'),file);
}
assert.equal(await readFile(new URL('../robots.txt',import.meta.url),'utf8'),'User-agent: *\nAllow: /\n');
console.log('PASS: '+files.length+' static pages; query/hash, root, product, admin, recovery, fallback and fixed-origin redirects.');
