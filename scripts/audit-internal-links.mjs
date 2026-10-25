// Read-only audit: count discoverable product links in generated static HTML.
// Run: node scripts/audit-internal-links.mjs
import {readFileSync,existsSync} from 'node:fs';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const xml=readFileSync(join(root,'sitemap.xml'),'utf8');
const locs=[...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m=>m[1].replaceAll('&amp;','&'));
const products=locs.filter(u=>new URL(u).pathname.includes('/seo-product/'));
const sources=locs.filter(u=>/\/seo-(category|subcategory)\//.test(new URL(u).pathname));
sources.unshift(new URL('catalog.html',locs[0]).href,new URL('index.html',locs[0]).href);
const links=new Map();
let missingSourceFiles=0;
for(const url of sources){
  const pathname=decodeURIComponent(new URL(url).pathname);
  const relative=pathname.replace(/^\/vintage\.hedonista\//,'');
  const file=join(root,relative);
  if(!existsSync(file)){missingSourceFiles++;continue}
  const html=readFileSync(file,'utf8');
  for(const match of html.matchAll(/<a\b[^>]*\bhref\s*=\s*["']([^"']+)["']/gi)){
    try{
      const target=new URL(match[1],new URL(html.match(/<base\b[^>]*href=["']([^"']+)["']/i)?.[1]||url,url)).href;
      if(!links.has(target))links.set(target,new Set());
      links.get(target).add(url);
    }catch{}
  }
}
const discovered=products.filter(p=>links.has(p));
const missing=products.filter(p=>!links.has(p));
console.log(JSON.stringify({productUrls:products.length,sourcePages:sources.length,missingSourceFiles,productsLinkedInInitialHtml:discovered.length,productsWithoutStaticLinks:missing.length,examples:missing.slice(0,12)},null,2));
console.log('NOTE: This measures static HTML links only. Google may additionally discover JS-rendered links; this is not a Google indexing report.');
