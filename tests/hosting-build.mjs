import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync,existsSync,readdirSync,statSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {gzipSync} from 'node:zlib';
const root=resolve(import.meta.dirname,'..'),build=(preview,domain=false)=>execFileSync(process.execPath,['scripts/build-hosting.mjs',...(domain?['--launch-domain']:[])],{cwd:root,env:{...process.env,SITE_BASE_URL:'',VERCEL_ENV:preview?'preview':'production',VERCEL_PROJECT_ID:preview?'prj_npe9JPYcE2zOAPUENtqSWZAy9kHA':'production-fixture'},encoding:'utf8'});
const read=file=>readFileSync(join(root,'dist',file),'utf8');
const sourceConfig=readFileSync(join(root,'config.js'),'utf8'),sourceSitemap=readFileSync(join(root,'sitemap.xml'),'utf8');
const legacy=sourceConfig.match(/siteUrl\s*:\s*"([^"]+)"/)[1],domain=JSON.parse(readFileSync(join(root,'launch-site.json'),'utf8')).siteUrl;
console.log(build(true).trim());
assert.equal(read('robots.txt'),'User-agent: *\nDisallow: /\n');
for(const file of ['index.html','catalog.html','checkout.html','product.html','admin/cms-builder.html'])assert.match(read(file),/<meta name="robots" content="noindex,nofollow,noarchive">/);
assert.ok(read('config.js').includes(domain));assert.ok(!read('sitemap.xml').includes(legacy));
console.log(build(false,true).trim());
assert.doesNotMatch(read('index.html'),/noindex/);assert.match(read('account.html'),/noindex/);
assert.equal(read('robots.txt'),'User-agent: *\nAllow: /\nDisallow: /admin/\nSitemap: '+domain+'sitemap.xml\n');
const locs=xml=>[...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m=>m[1]);
const oldUrls=locs(sourceSitemap),newUrls=locs(read('sitemap.xml'));
assert.equal(newUrls.length,oldUrls.length);assert.equal(new Set(newUrls).size,newUrls.length);
assert.deepEqual(newUrls,oldUrls.map(url=>url.replace(legacy,domain).replace(domain+'index.html',domain)));
assert.ok(newUrls.includes(domain));
function walk(dir){return readdirSync(dir).flatMap(name=>{const file=join(dir,name);return statSync(file).isDirectory()?walk(file):[file]})}
for(const file of walk(join(root,'dist')).filter(file=>/\.(html|js|json|xml|txt)$/.test(file))){
 const content=readFileSync(file,'utf8');assert.ok(!content.includes(legacy),'legacy site reference in '+file);
 if(!file.endsWith('.html'))continue;
 const canonical=content.match(/<link rel="canonical" href="([^"]+)"/i)?.[1];
 if(canonical){assert.ok(canonical.startsWith(domain));assert.ok(newUrls.includes(canonical));}
 // Content and existing route names survive domain preparation unchanged.
 const source=readFileSync(join(root,file.slice(join(root,'dist').length+1)),'utf8');
 assert.equal(content.match(/<title>([^<]+)<\/title>/)?.[1],source.match(/<title>([^<]+)<\/title>/)?.[1]);
 assert.deepEqual([...content.matchAll(/<h[1-6]\b[^>]*>([\s\S]*?)<\/h[1-6]>/g)].map(m=>m[1]),[...source.matchAll(/<h[1-6]\b[^>]*>([\s\S]*?)<\/h[1-6]>/g)].map(m=>m[1]));
}
for(const script of ['scripts/audit-seo.mjs','scripts/audit-internal-links.mjs'])console.log(execFileSync(process.execPath,[script,'--root=dist'],{cwd:root,encoding:'utf8'}).trim());
console.log(build(false).trim());
assert.doesNotMatch(read('index.html'),/noindex/);assert.match(read('account.html'),/noindex/);assert.equal(read('robots.txt'),readFileSync(join(root,'robots.txt'),'utf8'));
for(const excluded of ['.git','node_modules','tests','docs','scripts','supabase','work','package.json','package-lock.json','vercel.json','launch-site.json','SUPABASE_ORDER_PERMISSIONS_V250.sql'])assert.equal(existsSync(join(root,'dist',excluded)),false,excluded+' leaked into public build');
for(const required of ['checkout-feedback.js','order-delivery.js','admin/cms-builder.js','admin/config.js','image-variants.js','cms-boot.css','product-routes.js'])assert.equal(existsSync(join(root,'dist',required)),true,'missing '+required);
function htmlFiles(dir){return readdirSync(dir).flatMap(name=>{const path=join(dir,name);return statSync(path).isDirectory()?htmlFiles(path):name.endsWith('.html')?[path]:[]})}
let checked=0;
for(const file of htmlFiles(join(root,'dist'))){
 const html=readFileSync(file,'utf8'),url=new URL(file.slice(join(root,'dist').length),'https://build.example'),base=html.match(/<base\b[^>]*href="([^"]+)"/)?.[1],doc=base?new URL(base,url):url;
 for(const match of html.matchAll(/<(?:script|link)\b[^>]*(?:src|href)="([^"]+)"[^>]*>/g)){
  const target=new URL(match[1],doc);if(target.origin!=='https://build.example'||!(/\.(?:js|css|png|woff2?|ico|webp)$/.test(target.pathname)))continue;
  assert.equal(existsSync(join(root,'dist',decodeURIComponent(target.pathname))),true,file+' missing '+target.pathname);checked++;
 }
}
const sizes={};for(const file of ['styles.css','site.js']){const source=readFileSync(join(root,file)),built=readFileSync(join(root,'dist',file));assert.ok(built.length<source.length);sizes[file]={source:source.length,built:built.length,gzip:gzipSync(built).length}}
const routes=JSON.parse(readFileSync(join(root,'vercel.json')));assert.ok(routes.headers.some(rule=>rule.has?.some(condition=>condition.type==='host')&&rule.headers.some(h=>h.key==='X-Robots-Tag'&&h.value.includes('noindex'))));
assert.equal(readFileSync(join(root,'config.js'),'utf8'),sourceConfig);assert.equal(readFileSync(join(root,'sitemap.xml'),'utf8'),sourceSitemap);
console.log('PASS: domain URLs/SEO/content and static discoverability, preview indexing protection, current production/source preservation, private sources excluded and '+checked+' public references resolve. '+JSON.stringify(sizes));
