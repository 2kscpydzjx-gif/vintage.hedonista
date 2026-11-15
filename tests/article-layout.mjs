import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {renderArticleLayout} from '../scripts/article-layout.mjs';
const shell=body=>'<html><head><title>Original &amp; title</title></head><body><main class="article-page paper"><div id="articleRoot">'+body+'</div></main></body></html>';
const heading='<section class="article-v71-cover-intro"><div class="article-v71-masthead">Journal</div><h1>Original &amp; title</h1></section>';
const cover='<figure class="article-v71-cover"><img src="cover.webp" alt="Original photo"></figure>';
const body='<div class="article-v71-content"><h2>Original heading</h2><p>Keep this paragraph and <a href="/catalog">link</a>.</p><figure><img src="body.webp"></figure></div>';
for(const withCover of [false,true]){
 const source=shell('<article class="article-v71">'+heading+(withCover?cover:'')+body+'</article>');
 const result=renderArticleLayout(source);
 assert.equal(renderArticleLayout(result),result,'not idempotent');
 assert.ok(result.includes(body));assert.ok(result.includes(heading));assert.equal((result.match(/article-layout\.css/g)||[]).length,1);
 assert.equal((result.match(/<h1>/g)||[]).length,1);assert.ok(result.includes('article-editorial'+(withCover?' has-cover':'')));
 if(withCover)assert.ok(result.indexOf(cover)<result.indexOf(heading));
}
assert.equal(renderArticleLayout('<html><main class="product-page">Keep</main></html>'),'<html><main class="product-page">Keep</main></html>');
let count=0;
for(const slug of readdirSync(new URL('../seo-article/',import.meta.url))){
 const source=readFileSync(new URL('../seo-article/'+slug+'/index.html',import.meta.url),'utf8'),result=renderArticleLayout(source);
 assert.equal(renderArticleLayout(result),result,slug);
 assert.equal(result.match(/<h1\b[^>]*>[\s\S]*?<\/h1>/)?.[0],source.match(/<h1\b[^>]*>[\s\S]*?<\/h1>/)?.[0]);
 assert.equal(result.match(/<link\b[^>]*rel="canonical"[^>]*>/)?.[0],source.match(/<link\b[^>]*rel="canonical"[^>]*>/)?.[0]);
 assert.equal((result.match(/<img\b/g)||[]).length,(source.match(/<img\b/g)||[]).length);
 assert.ok(result.indexOf('class="article-v71-cover"')<result.indexOf('class="article-v71-cover-intro"'),slug);
 count++;
}
console.log('PASS: photo-first static layout, no-cover fallback, idempotent upgrades, all '+count+' article snapshots, original titles/content/images/canonicals and unrelated pages preserved.');
