import assert from 'node:assert/strict';
import {readFileSync,existsSync,statSync} from 'node:fs';
import vm from 'node:vm';
import {renderProductRoutes} from '../scripts/product-routes.mjs';
import {sharingHead} from '../scripts/seo-head.mjs';
import {renderPublishedNavigation,publishedNavigation} from '../scripts/published-navigation.mjs';
const window={VH_CONFIG:{siteUrl:'https://shop.example/'}};
const navigation=renderPublishedNavigation('<html><head></head><body><header><nav><a href="journal.html">Журнал &amp; стиль</a></nav></header><main><h1>Product</h1></main></body></html>',{updated_at:'2026-10-31',nav:{0:{label:'Quotes " & <script>unsafe</script>',href:'javascript:alert(1)'}}});
assert.ok(navigation.includes('Quotes &quot; &amp; &lt;script&gt;unsafe&lt;/script&gt;'));
assert.ok(navigation.includes('href="journal.html"'));assert.ok(!navigation.includes('javascript:'));
assert.ok(navigation.includes('data-vh-nav-default-label="Журнал &amp; стиль"'));assert.ok(navigation.includes('<main><h1>Product</h1></main>'));
const originalFetch=globalThis.fetch;
try{
 globalThis.fetch=async(url,options)=>{
  assert.ok(url.startsWith('https://project.supabase.co/rest/v1/vh_page_revisions?'));assert.ok(url.includes('revision_status=eq.published'));assert.equal(options.method||'GET','GET');assert.equal(options.headers['Accept-Profile'],'public');assert.equal(options.headers.apikey,'sb_publishable_fixture');
  return {ok:true,json:async()=>[{updated_at:'2026-10-31',shared:{nav:{3:{label:'Published'}},cmsPageDraft:{privateTestField:'not copied'}}}]};
 };
 assert.deepEqual(await publishedNavigation('supabaseUrl: "https://project.supabase.co", supabaseKey: "sb_publishable_fixture"',{cloudflare:true,fixture:null}),{updated_at:'2026-10-31',nav:{3:{label:'Published'}}});
}finally{globalThis.fetch=originalFetch}
vm.runInNewContext(renderProductRoutes(['known','known','сукня']),{window,URL});
assert.equal(window.VHProductRoutes.href({slug:'known'}),'seo-product/known/index.html');
assert.equal(window.VHProductRoutes.href({slug:'new-jacket'}),'product.html?slug=new-jacket');
assert.equal(window.VHProductRoutes.href({slug:'new & <script>'}),'product.html?slug=new%20%26%20%3Cscript%3E');
assert.equal(window.VHProductRoutes.canonical({slug:'сукня'}),'https://shop.example/seo-product/%D1%81%D1%83%D0%BA%D0%BD%D1%8F/index.html');
window.VH_CONFIG.prettyUrls=true;
assert.equal(window.VHProductRoutes.href({slug:'known'}),'seo-product/known/');
assert.equal(window.VHProductRoutes.canonical({slug:'сукня'}),'https://shop.example/seo-product/%D1%81%D1%83%D0%BA%D0%BD%D1%8F/');
const html='<html><head><title>Manual title</title><meta content="old" property="og:title"><meta property="og:title" content="duplicate"></head><body><h1>Keep content</h1></body></html>';
const data={title:'Quote " & <tag>',description:'Saved description',image:'https://images.example/cover.webp',canonical:'https://shop.example/seo-product/coat/index.html'};
const updated=sharingHead(html,data);
assert.equal((updated.match(/property="og:title"/g)||[]).length,1);assert.ok(updated.includes('Quote &quot; &amp; &lt;tag&gt;'));
assert.ok(updated.includes('name="twitter:card" content="summary_large_image"'));assert.ok(updated.includes('rel="icon"'));
assert.ok(updated.includes('<h1>Keep content</h1>'));assert.ok(updated.includes('<title>Manual title</title>'));
assert.equal(sharingHead(updated,data),updated,'metadata regeneration must be idempotent');
const manifest=JSON.parse(readFileSync(new URL('../assets/optimized/manifest.json',import.meta.url)));
for(const image of manifest.images){assert.ok(image.originalBytes>0);assert.equal(image.sha256.length,64);for(const variant of image.variants){const file=new URL('../'+variant.src,import.meta.url);assert.ok(existsSync(file));assert.equal(statSync(file).size,variant.bytes);assert.ok(variant.bytes<image.originalBytes);const header=readFileSync(file).subarray(0,12);assert.equal(header.toString('ascii',0,4),'RIFF');assert.equal(header.toString('ascii',8,12),'WEBP')}}
console.log('PASS: live links for new products, canonical domain configuration, escaped/idempotent sharing metadata, and bounded WebP derivatives.');
