import {readFileSync,existsSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {configuredSite,pageAddress,prettyAddress} from './seo-deployment.mjs';
const root=resolve(fileURLToPath(new URL('../',import.meta.url)),process.argv.find(arg=>arg.startsWith('--root='))?.slice(7)||'.');
const base=configuredSite(pathToFileURL(root+'/'));
const pretty=/prettyUrls\s*[:=]\s*true/.test(readFileSync(join(root,'config.js'),'utf8'));
function localPath(address){const url=new URL(address);if(url.origin!==new URL(base).origin||!url.pathname.startsWith(new URL(base).pathname))throw Error('URL outside configured site: '+address);const path=decodeURIComponent(url.pathname.slice(new URL(base).pathname.length));return !path||path.endsWith('/')?path+'index.html':/\.[^/]+$/.test(path)?path:path+'.html'}
const xml=readFileSync(join(root,'sitemap.xml'),'utf8');
const urls=[...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m=>m[1].replaceAll('&amp;','&'));
let errors=[];let checked=0;
const templateMetadata=[];
for(const address of urls){
 const u=new URL(address);
 const path=localPath(address); // URL is encoded, disk folder is Unicode
 if(!/^seo-(product|article|category|subcategory)\//.test(path))continue;
 const file=join(root,path);checked++;
 if(!existsSync(file)){errors.push('Missing: '+path);continue}
 const html=readFileSync(file,'utf8');
 const documentBase=new URL(html.match(/<base\b[^>]*href="([^"]+)"/i)?.[1]||address,address);
 const canonical=html.match(/<link rel="canonical" href="([^"]+)"/i)?.[1];
 if(canonical!==address)errors.push('Canonical mismatch: '+path);
 const ogUrl=html.match(/<meta\s+property="og:url"\s+content="([^"]+)"/i)?.[1];
 if(ogUrl!==canonical)errors.push('Open Graph URL mismatch: '+path);
 if(!/<h1\b[^>]*>[^<]+<\/h1>/i.test(html))errors.push('Missing H1: '+path);
 if(/<img\b[^>]*\balt="[^"]*"[^>]*\balt=/i.test(html))errors.push('Duplicate ALT: '+path);
 if(!/<base\b[^>]*id="vh-seo-base"/i.test(html))errors.push('Missing root base: '+path);
 if(/\/seo-category\//.test(u.pathname)){
  const nav=html.match(/<nav class="vh-seo-subcategory-links"[^>]*>([\s\S]*?)<\/nav>/i)?.[1];
  if(nav){
   const hrefs=[...nav.matchAll(/<a\s+href="([^"]+)"/gi)].map(m=>m[1].replaceAll('&amp;','&'));
   if(!hrefs.length)errors.push('Empty subcategory navigation: '+path);
   for(const href of hrefs){
    let target;
    try{target=new URL(href,documentBase)}catch{errors.push('Invalid subcategory URL: '+href);continue}
    if(target.origin!==u.origin||!target.pathname.startsWith(u.pathname.replace(/seo-category\/[^/]+\/(?:index\.html)?$/,'seo-subcategory/'))){
     errors.push('Unexpected subcategory link: '+href);continue
    }
    const targetPath=localPath(target.href);
    if(!existsSync(join(root,targetPath)))errors.push('Broken subcategory link: '+href);
   }
  }
 }
 if(/\/seo-product\//.test(u.pathname)){
  const inventory=html.match(/<meta\s+name=["']vh-product-inventory["']\s+content=["']([^"']*)["']/i)?.[1];
  const expected={published:'InStock',reserved:'OutOfStock',sold:'SoldOut'}[inventory];
  const blocks=[...html.matchAll(/<script\b(?=[^>]*\bid=["']vh-static-product-jsonld["'])[^>]*>([\s\S]*?)<\/script>/gi)];
  if(blocks.length!==1){errors.push('Expected exactly one static Product JSON-LD: '+path);continue}
  let product;
  try{product=JSON.parse(blocks[0][1])}catch{errors.push('Invalid Product JSON-LD: '+path);continue}
  if(product?.['@type']!=='Product'){errors.push('Incorrect Product JSON-LD type: '+path);continue}
  if(product.url!==canonical||product.offers&&product.offers.url!==canonical)errors.push('Product JSON-LD URL mismatch: '+path);
  const priceVisible=/<[^>]+id=["']productPrice["'][^>]*>[\s\S]*?\d[\s\S]*?<\/[^>]+>/i.test(html);
  if(priceVisible&&!product.offers)errors.push('Missing Offer for priced product: '+path);
  if(product.offers){
   if(!product.offers.availability)errors.push('Missing Offer availability: '+path);
   if(expected&&product.offers.availability!=='https://schema.org/'+expected)errors.push('Availability/status mismatch: '+path);
   if(!expected)errors.push('Unknown inventory status for Offer: '+path);
  }
 }
 if(/\/seo-(?:category|subcategory)\//.test(u.pathname)){
  const editorial=html.match(/<section\b(?=[^>]*\bid=["']catalogSeoEditorial["'])[^>]*>([\s\S]*?)<\/section>/i);
  if(!editorial||!/<h2\b[^>]*>[^<]+<\/h2>/i.test(editorial[1])||!/<p\b[^>]*>[^<]+<\/p>/i.test(editorial[1])||/\s+hidden(?:\s|>|=)/i.test(editorial[0].split('>')[0]+'>'))errors.push('Missing visible static SEO editorial: '+path);
  // Informational report only: editorial text can legitimately be customized in Supabase.
  const seoTitle=html.match(/<title>([^<]*)<\/title>/i)?.[1]||'';
  const seoDescription=html.match(/<meta name="description" content="([^"]*)"/i)?.[1]||'';
  const genericTitle=seoTitle.endsWith(' — вінтажний одяг | Vintage Hedonista');
  const genericDescription=seoDescription.startsWith('Переглядайте ')&&seoDescription.includes(' у Vintage Hedonista:');
  if(genericTitle||genericDescription)templateMetadata.push({path,title:genericTitle,description:genericDescription});
  if(!/<meta name="vh-static-canonical" content="[^"]+">/i.test(html))errors.push('Missing static canonical marker: '+path);
  if(!/<script defer src="site\.js\?v=\d+"><\/script>/i.test(html))errors.push('Missing catalog script: '+path);
 }
}
const staticPages=['index.html','catalog.html','about.html','journal.html','delivery.html','contacts.html','capsule.html'];
for(const page of staticPages){
 const html=readFileSync(join(root,page),'utf8');
 const head=html.slice(0,html.toLowerCase().indexOf('</head>'));
 const title=head.match(/<title>([^<]+)<\/title>/i)?.[1];
 const description=head.match(/<meta\s+name="description"\s+content="([^"]+)"/i)?.[1];
 const canonical=head.match(/<link\s+rel="canonical"\s+href="([^"]+)"/i)?.[1];
 if(!title)errors.push('Missing title: '+page);
 if(!description)errors.push('Missing description: '+page);
 if(canonical!==(pretty?prettyAddress(pageAddress(page,base)):pageAddress(page,base)))errors.push('Canonical mismatch: '+page);
 if(!urls.includes(canonical))errors.push('Static page missing from sitemap: '+page);
}
for(const page of ['account.html','checkout.html','admin/index.html','admin/admin.html','admin/cms-builder.html']){
 const html=readFileSync(join(root,page),'utf8');
 if(!/<meta\s+name="robots"\s+content="[^"]*\bnoindex\b/i.test(html))errors.push('Missing noindex on utility page: '+page);
 if(urls.some(url=>new URL(url).pathname.endsWith('/'+page)))errors.push('Utility page is in sitemap: '+page);
}
if(errors.length){console.error(errors.slice(0,30).join('\n'));process.exitCode=1}
else console.log(`SEO audit OK: ${checked} snapshot HTML files, canonical and H1 verified (${urls.length} sitemap URLs).`);

// Report weak fallback metadata without failing the deployment.
console.log('Category/subcategory generic SEO metadata: '+templateMetadata.length+' page(s).');
for(const item of templateMetadata)console.log('  '+item.path+' [generic '+[item.title?'title':null,item.description?'description':null].filter(Boolean).join('+')+']');
