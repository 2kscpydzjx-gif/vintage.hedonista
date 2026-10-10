// STEP 106: run `node scripts/generate-sitemap.mjs` in a networked Node.js 18+ environment.
import {readFileSync,writeFileSync,mkdirSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
const cfg=readFileSync(new URL('../config.js',import.meta.url),'utf8');
const url=cfg.match(/supabaseUrl\s*:\s*['"]([^'"]+)/)?.[1];
const key=cfg.match(/supabaseKey\s*:\s*['"]([^'"]+)/)?.[1];
if(!url||!key)throw Error('Missing public Supabase config');
const base=process.env.SITE_BASE_URL||'https://2kscpydzjx-gif.github.io/vintage.hedonista/';
if(!base.endsWith('/'))throw Error('SITE_BASE_URL must end with /');
if(!/^https:\/\//.test(base))throw Error('SITE_BASE_URL must be https');
async function rows(table,select,filter){
 const all=[];for(let offset=0;;offset+=1000){
  const u=`${url}/rest/v1/${table}?select=${encodeURIComponent(select)}&${filter}&limit=1000&offset=${offset}`;
  const r=await fetch(u,{headers:{apikey:key,'Accept-Profile':'public'}});
  if(!r.ok)throw Error(`${table}: HTTP ${r.status}; ${await r.text()}`);
  const part=await r.json();if(!Array.isArray(part))throw Error(`${table}: unexpected response`);
  all.push(...part);if(part.length<1000)break;
 }return all;
}
const root=fileURLToPath(new URL('../',import.meta.url));
const staticPages=['index.html','catalog.html','about.html','journal.html','delivery.html','contacts.html','capsule.html'];
const entries=staticPages.map(p=>new URL(p,base).href);
const [products,news,categories]=await Promise.all([
 rows('products','id,slug,name,cover_image,price,brand,size,color,condition,material,season,short_description,description','status=eq.published'),
 rows('news','id,slug,title,excerpt,cover_image,content','status=eq.published'),
 rows('categories','slug','is_active=eq.true')
]);
for(const p of products)if(p.slug)entries.push(new URL('seo-product/'+encodeURIComponent(p.slug)+'/index.html',base).href);
for(const n of news)if(n.slug)entries.push(new URL('seo-article/'+encodeURIComponent(n.slug)+'/index.html',base).href);
for(const c of categories)if(c.slug)entries.push(new URL('catalog.html?category='+encodeURIComponent(c.slug),base).href);
const esc=s=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const unique=[...new Set(entries)];
if(products.length===0&&news.length===0)throw Error('No published products or articles were returned; refusing to overwrite sitemap.xml. Check Supabase public SELECT permissions and publication statuses.');
const xml='<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'+unique.map(u=>'  <url><loc>'+esc(u)+'</loc></url>').join('\n')+'\n</urlset>\n';
// Static HTML snapshots: unique titles/descriptions in initial HTML response.
// Page body remains client-rendered; this is SEO head prerendering, not full SSR.
const seo=await rows('vh_seo_metadata','entity_type,entity_id,seo_title,meta_description','entity_type=in.(product,article)');
const seoMap=new Map(seo.map(x=>[x.entity_type+':'+x.entity_id,x]));
const htmlEscape=x=>String(x??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');
const strip=x=>String(x??'').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();
function snapshot(kind,row){
 const isProduct=kind==='product';
 const dir=isProduct?'seo-product':'seo-article';
 const file=isProduct?'product.html':'article.html';
 const titleFallback=(isProduct?row.name:row.title)+' — Vintage Hedonista';
 const meta=seoMap.get((isProduct?'product:':'article:')+row.id)||{};
 const title=strip(meta.seo_title)||titleFallback;
 const desc=strip(meta.meta_description)||strip(isProduct?row.name:row.excerpt)||'Vintage Hedonista';
 const canonical=new URL(dir+'/'+encodeURIComponent(row.slug)+'/index.html',base).href;
 let html=readFileSync(new URL('../'+file,import.meta.url),'utf8');
 // Base URL makes the existing site's relative links/assets resolve from root.
 html=html.replace(/<head>/i,'<head><base id="vh-seo-base" href="'+htmlEscape(base)+'"><script>if(location.hostname==="127.0.0.1"||location.hostname==="localhost"){document.getElementById("vh-seo-base").href=location.origin+"/"}</script>');
 html=html.replace(/<title>[^<]*<\/title>/i,'<title>'+htmlEscape(title)+'</title>');
 html=html.replace(/<meta name="description"[^>]*>/i,'<meta name="description" content="'+htmlEscape(desc)+'">');
 html=html.replace(/<\/head>/i,'<link rel="canonical" href="'+htmlEscape(canonical)+'"><meta name="vh-static-canonical" content="'+htmlEscape(canonical)+'"><meta property="og:title" content="'+htmlEscape(title)+'"><meta property="og:description" content="'+htmlEscape(desc)+'"><meta property="og:url" content="'+htmlEscape(canonical)+'"></head>');
 // STEP 109: real content is present in the initial response, before JS runs.
 // Dynamic site.js retains control of all interactions and refreshes data on load.
 if(isProduct){
  const plain=strip(row.description||row.short_description||'');
  const replaceText=(id,value)=>{const re=new RegExp('(<[^>]+\\bid="'+id+'"[^>]*>)[\\s\\S]*?(</[^>]+>)','i');html=html.replace(re,(_,a,b)=>a+htmlEscape(value)+b)};
  replaceText('productName',row.name||'Товар');
  replaceText('productBreadcrumb',row.name||'Товар');
  replaceText('productShortDescription',row.short_description||'');
  replaceText('productDesc',plain||'Опис буде додано.');
  replaceText('productPrice',row.price!=null?new Intl.NumberFormat('uk-UA').format(Number(row.price))+' грн':'Ціну уточнюйте');
  for(const [id,value] of [['productBrandFact',row.brand],['productSeason',row.season],['productMaterial',row.material],['productCondition',row.condition],['productSize',row.size],['productColor',row.color]])replaceText(id,value||'—');
  if(row.cover_image){html=html.replace(/(<img\s+id="galleryMainImg"[^>]*)(>)/i,(_,a,b)=>a.replace(/\s+alt="[^"]*"/gi,'')+' src="'+htmlEscape(row.cover_image)+'" alt="'+htmlEscape(row.name||'Фото товару')+'"'+b)}
 }else{
  // Plain-text fallback avoids injecting untrusted CMS HTML into static pages.
  const content=strip(row.content||'');
  const article='<article class="article-v71"><section class="article-v71-cover-intro"><div class="article-v71-masthead">HEDONISTA JOURNAL</div><h1>'+htmlEscape(row.title||'Стаття')+'</h1></section>'+(row.cover_image?'<figure class="article-v71-cover"><img src="'+htmlEscape(row.cover_image)+'" alt="'+htmlEscape(row.title||'Стаття')+'" loading="eager"></figure>':'')+(row.excerpt?'<div class="article-v71-deck"><p>'+htmlEscape(row.excerpt)+'</p></div>':'')+'<div class="article-v71-content"><p>'+htmlEscape(content||row.excerpt||'')+'</p></div></article>';
  html=html.replace(/(<div\s+id="articleRoot"[^>]*>)/i,'$1'+article);
 }
 const slug=String(row.slug||'').normalize('NFC');
 if(!slug||slug==='.'||slug==='..'||/[\\/\x00-\x1f]/.test(slug))throw Error('Unsafe slug for '+dir+': '+slug);
 const target=join(root,dir,slug);mkdirSync(target,{recursive:true});
 writeFileSync(join(target,'index.html'),html);
}
// Do not delete existing snapshots until all Supabase requests succeeded.
for(const dir of ['seo-product','seo-article'])rmSync(join(root,dir),{recursive:true,force:true});
for(const p of products)if(p.slug)snapshot('product',p);
for(const n of news)if(n.slug)snapshot('article',n);
writeFileSync(new URL('../sitemap.xml',import.meta.url),xml);
console.log(`Sitemap + SEO HTML: ${unique.length} URLs (${products.length} products, ${news.length} articles, ${categories.length} categories)`);
