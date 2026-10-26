// STEP 106: run `node scripts/generate-sitemap.mjs` in a networked Node.js 18+ environment.
import {readFileSync,writeFileSync,mkdirSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {fillCatalogEditorial} from './seo-editorial.mjs';
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
const [products,news,categories,subcategories]=await Promise.all([
 rows('products','id,slug,name,status,category_id,subcategory_id,cover_image,price,brand,size,color,condition,material,season,short_description,description','status=in.(published,reserved,sold)'),
 rows('news','id,slug,title,excerpt,cover_image,content','status=eq.published'),
 rows('categories','id,name,slug','is_active=eq.true'),
 rows('subcategories','id,category_id,name,slug','id=not.is.null')
]);
for(const p of products)if(p.slug)entries.push(new URL('seo-product/'+encodeURIComponent(p.slug)+'/index.html',base).href);
for(const n of news)if(n.slug)entries.push(new URL('seo-article/'+encodeURIComponent(n.slug)+'/index.html',base).href);
for(const c of categories)if(c.slug)entries.push(new URL('seo-category/'+encodeURIComponent(c.slug)+'/index.html',base).href);
const activeCategories=new Map(categories.map(c=>[String(c.id),c]));
// Curated subcategory metadata fallbacks; saved Supabase metadata takes priority.
const subcategorySeoFallbacks={
  "aksesuary/korsety": [
    "Вінтажні корсети | Vintage Hedonista",
    "Вінтажні корсети з виразним силуетом і незвичайними деталями. Перегляньте добірку корсетів у Vintage Hedonista."
  ],
  "aksesuary/головні-убори": [
    "Вінтажні головні убори | Vintage Hedonista",
    "Вінтажні головні убори для особливих образів. Знайдіть оригінальні аксесуари з характером у Vintage Hedonista."
  ],
  "aksesuary/краватки": [
    "Вінтажні краватки | Vintage Hedonista",
    "Вінтажні краватки з цікавими візерунками та фактурами. Акцентні аксесуари для індивідуального стилю у Vintage Hedonista."
  ],
  "aksesuary/пояси": [
    "Вінтажні пояси та ремені | Vintage Hedonista",
    "Вінтажні пояси та ремені, які доповнюють силует і додають образу характеру. Добірка аксесуарів Vintage Hedonista."
  ],
  "aksesuary/прикраси": [
    "Вінтажні прикраси | Vintage Hedonista",
    "Вінтажні прикраси з оригінальними деталями для повсякденних і святкових образів. Відкрийте колекцію Vintage Hedonista."
  ],
  "aksesuary/рукавички": [
    "Вінтажні рукавички | Vintage Hedonista",
    "Вінтажні рукавички для елегантних образів. Незвичайні фактури та деталі у добірці аксесуарів Vintage Hedonista."
  ],
  "aksesuary/сумки-та-клатчі": [
    "Вінтажні сумки та клатчі | Vintage Hedonista",
    "Вінтажні сумки та клатчі з характером. Відкрийте оригінальні моделі та цікаві деталі у Vintage Hedonista."
  ],
  "aksesuary/хустки": [
    "Вінтажні хустки | Vintage Hedonista",
    "Вінтажні хустки з виразними принтами та кольорами. Стильні акценти для різних образів у Vintage Hedonista."
  ],
  "dzhynsy-ta-bryuky/shorty": [
    "Вінтажні жіночі шорти | Vintage Hedonista",
    "Вінтажні жіночі шорти з оригінальним кроєм і деталями. Обирайте особливі моделі для літніх образів у Vintage Hedonista."
  ],
  "dzhynsy-ta-bryuky/брюки": [
    "Вінтажні жіночі брюки | Vintage Hedonista",
    "Вінтажні жіночі брюки та штани різних силуетів. Класичні й виразні моделі для індивідуального стилю у Vintage Hedonista."
  ],
  "dzhynsy-ta-bryuky/джинси": [
    "Вінтажні жіночі джинси | Vintage Hedonista",
    "Вінтажні жіночі джинси з характерним кроєм і деталями. Відкрийте джинсову класику у добірці Vintage Hedonista."
  ],
  "verkhnii-odyah/kimono": [
    "Вінтажні кімоно | Vintage Hedonista",
    "Вінтажні кімоно з виразними принтами та вільними силуетами. Незвичайні речі для особливих образів у Vintage Hedonista."
  ],
  "verkhnii-odyah/plashchi": [
    "Вінтажні плащі та тренчі | Vintage Hedonista",
    "Вінтажні жіночі плащі та тренчі з характерним кроєм. Відкрийте елегантні моделі верхнього одягу у Vintage Hedonista."
  ],
  "verkhnii-odyah/кейпи-та-пончо": [
    "Вінтажні кейпи та пончо | Vintage Hedonista",
    "Вінтажні кейпи та пончо з оригінальними силуетами. Виразний верхній одяг для незвичайних образів у Vintage Hedonista."
  ],
  "verkhnii-odyah/куртки": [
    "Вінтажні жіночі куртки | Vintage Hedonista",
    "Вінтажні жіночі куртки з цікавими фактурами та деталями. Знайдіть особливий верхній одяг у Vintage Hedonista."
  ],
  "verkhnii-odyah/пальто": [
    "Вінтажні жіночі пальта | Vintage Hedonista",
    "Вінтажні жіночі пальта: класичні силуети, виразний крій та цікаві фактури. Добірка Vintage Hedonista."
  ],
  "verkhnii-odyah/піджаки-та-жакети": [
    "Вінтажні жакети та піджаки | Vintage Hedonista",
    "Вінтажні жіночі жакети й піджаки з характером. Класичні та незвичайні фасони для індивідуальних образів у Vintage Hedonista."
  ],
  "verkhnii-odyah/шуби": [
    "Вінтажні шуби | Vintage Hedonista",
    "Вінтажні шуби та виразні зимові силуети. Перегляньте колекцію верхнього одягу Vintage Hedonista."
  ]
};
for(const sub of subcategories){
 const parent=activeCategories.get(String(sub.category_id));
 if(parent?.slug&&sub.slug)entries.push(new URL('seo-subcategory/'+encodeURIComponent(parent.slug)+'/'+encodeURIComponent(sub.slug)+'/index.html',base).href);
}
const esc=s=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const unique=[...new Set(entries)];
if(products.length===0&&news.length===0)throw Error('No published products or articles were returned; refusing to overwrite sitemap.xml. Check Supabase public SELECT permissions and publication statuses.');
const xml='<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'+unique.map(u=>'  <url><loc>'+esc(u)+'</loc></url>').join('\n')+'\n</urlset>\n';
// Editorial content is rendered into static SEO snapshots for crawlers.
const catalogEditorial=JSON.parse(readFileSync(new URL('../catalog-seo-content.json',import.meta.url),'utf8'));
// Missing table before the one-time migration must not break sitemap generation.
let savedEditorial=[];
try{savedEditorial=await rows('vh_catalog_seo_blocks','page_key,heading,description,features,image','page_key=not.is.null')}
catch(e){if(/HTTP 404|HTTP 400/.test(String(e)))console.warn('SEO blocks table not yet installed; using defaults');else throw e}
const editorialOverrides=new Map(savedEditorial.map(row=>[row.page_key,row]));
function editorialFor(kind,name,slug,parentSlug){
 const key=kind==='category'?'category:'+slug:'subcategory:'+parentSlug+':'+slug;
 const override=editorialOverrides.get(key)||(kind==='category'?catalogEditorial.categories?.[slug]:catalogEditorial.subcategories?.[parentSlug+'/'+slug]);
 return override||{heading:'Вінтажні '+name.toLowerCase()+' у Vintage Hedonista',description:'Відкрийте добірку '+name.toLowerCase()+' у Vintage Hedonista. Знайдіть вінтажні речі з характером та доповніть свій гардероб особливими деталями.'};
}
function editorialHtml(content){
 if(!content?.heading||!content?.description)return '';
 const features=(content.features||[]).slice(0,3).map(([title,desc])=>'<div><h3>'+htmlEscape(title)+'</h3><p>'+htmlEscape(desc)+'</p></div>').join('');
 const image=content.image?'<img class="vh-catalog-seo-image" src="'+htmlEscape(content.image)+'" alt="'+htmlEscape(content.heading)+'" loading="lazy">':'';
 return '<div class="vh-catalog-seo-layout"><div class="vh-catalog-seo-copy"><h2>'+htmlEscape(content.heading)+'</h2><p>'+htmlEscape(content.description)+'</p>'+(features?'<div class="vh-catalog-seo-features">'+features+'</div>':'')+'</div>'+image+'</div>';
}
function embedEditorial(html,content){
 const markup=editorialHtml(content);
 return fillCatalogEditorial(html,markup);
}
// Static HTML snapshots: unique titles/descriptions in initial HTML response.
// Page body remains client-rendered; this is SEO head prerendering, not full SSR.
const seo=await rows('vh_seo_metadata','entity_type,entity_id,seo_title,meta_description','entity_type=in.(product,article,category,subcategory)');
const seoMap=new Map(seo.map(x=>[x.entity_type+':'+x.entity_id,x]));
// Decode already-escaped HTML entities before escaping output once.
// CMS fields may contain literal "&amp;" from rich text editing.
const decodeEntities=x=>String(x??'').replace(/&(?:amp|lt|gt|quot|apos|nbsp|#39|#x([0-9a-f]+)|#([0-9]+));/gi,(match,hex,dec)=>{
 if(hex||dec){const cp=parseInt(hex||dec,hex?16:10);return cp>0&&cp<=0x10ffff&&!(cp>=0xd800&&cp<=0xdfff)?String.fromCodePoint(cp):match}
 return {'&amp;':'&','&lt;':'<','&gt;':'>','&quot;':'"','&apos;':"'",'&nbsp;':' ','&#39;':"'"}[match.toLowerCase()]??match;
});
const htmlEscape=x=>decodeEntities(x).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');
const strip=x=>decodeEntities(String(x??'').replace(/<[^>]*>/g,' ')).replace(/\s+/g,' ').trim();
function snapshot(kind,row){
 const isProduct=kind==='product';
 const dir=isProduct?'seo-product':'seo-article';
 const file=isProduct?'product.html':'article.html';
 const titleFallback=(isProduct?row.name:row.title)+' — Vintage Hedonista';
 const meta=seoMap.get((isProduct?'product:':'article:')+row.id)||{};
 const title=strip(meta.seo_title)||titleFallback;
 const productDescription=()=>{
  // Fallback only: custom descriptions in vh_seo_metadata always take priority.
  const name=strip(row.name)||'Вінтажний жіночий одяг';
  const brand=strip(row.brand);
  const material=strip(row.material);
  const condition=strip(row.condition);
  const opening=name+(brand?' від '+brand:'')+'.';
  const details=[material&&'Матеріал: '+material+'.',condition&&'Стан: '+condition+'.'].filter(Boolean);
  // Add whole sentences only: do not truncate in the middle of a word or phrase.
  const parts=[opening];
  for(const detail of details)if((parts.join(' ')+' '+detail).length<=160)parts.push(detail);
  const closing='Vintage Hedonista.';
  if((parts.join(' ')+' '+closing).length<=165)parts.push(closing);
  return parts.join(' ');
 };
 const desc=strip(meta.meta_description)||(isProduct?productDescription():strip(row.excerpt)||'Vintage Hedonista');
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
  // Static inventory marker is read by the JSON-LD generator and SEO sync check.
  html=html.replace('</head>','<meta name="vh-product-inventory" content="'+htmlEscape(row.status||'')+'"></head>');
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
for(const dir of ['seo-product','seo-article','seo-category','seo-subcategory'])rmSync(join(root,dir),{recursive:true,force:true});
for(const p of products)if(p.slug)snapshot('product',p);
for(const n of news)if(n.slug)snapshot('article',n);
// Category SEO fallbacks. Supabase vh_seo_metadata always takes priority.
const categorySeoFallbacks={
  "sukni": [
    "Вінтажні сукні жіночі | Vintage Hedonista",
    "Відкрийте колекцію вінтажних жіночих суконь Vintage Hedonista. Оригінальні фасони, виразні деталі та особливі знахідки для індивідуального стилю."
  ],
  "sorochky-ta-bluzy": [
    "Вінтажні блузи та сорочки | Vintage Hedonista",
    "Вінтажні жіночі блузи та сорочки з характером. Романтичні силуети, цікаві фактури й оригінальні деталі в колекції Vintage Hedonista."
  ],
  "verkhnii-odyah": [
    "Вінтажний верхній одяг жіночий | Vintage Hedonista",
    "Вінтажний жіночий верхній одяг: пальта, тренчі, куртки та інші особливі речі. Відкрийте добірку Vintage Hedonista для образів із характером."
  ],
  "dzhynsy-ta-bryuky": [
    "Вінтажні джинси та брюки жіночі | Vintage Hedonista",
    "Жіночі вінтажні джинси, брюки та штани з виразним кроєм. Знайдіть оригінальні моделі для повсякденних і сміливих образів у Vintage Hedonista."
  ],
  "spidnytsi": [
    "Вінтажні спідниці жіночі | Vintage Hedonista",
    "Вінтажні жіночі спідниці різних фасонів і довжин. Обирайте особливі силуети та фактури для індивідуального гардероба у Vintage Hedonista."
  ],
  "kofty-ta-kardyhany": [
    "Вінтажні кофти та кардигани | Vintage Hedonista",
    "Вінтажні жіночі кофти й кардигани: цікава в'язка, фактури та оригінальні силуети. Добірка особливих речей у Vintage Hedonista."
  ],
  "komplekty-ta-kostyumy": [
    "Вінтажні костюми та комплекти | Vintage Hedonista",
    "Жіночі вінтажні костюми та комплекти для виразних образів. Відкрийте оригінальні поєднання речей у колекції Vintage Hedonista."
  ],
  "vzuttya": [
    "Вінтажне жіноче взуття | Vintage Hedonista",
    "Вінтажне жіноче взуття з характером: класичні та незвичайні моделі, цікаві деталі й особливі знахідки у Vintage Hedonista."
  ],
  "aksesuary": [
    "Вінтажні аксесуари жіночі | Vintage Hedonista",
    "Вінтажні жіночі аксесуари для завершення образу. Оригінальні деталі, що підкреслюють індивідуальність, у добірці Vintage Hedonista."
  ]
};
// Crawlable category-to-subcategory navigation in generated SEO snapshots.
function subcategoryLinksHtml(category){
 const children=subcategories.filter(sub=>String(sub.category_id)===String(category.id)&&sub.slug);
 if(!children.length)return '';
 const links=children.map(sub=>'<a href="'+htmlEscape(new URL('seo-subcategory/'+encodeURIComponent(category.slug)+'/'+encodeURIComponent(sub.slug)+'/index.html',base).href)+'">'+htmlEscape(sub.name)+'</a>').join(' ');
 return '<nav class="vh-seo-subcategory-links" aria-label="Підкатегорії"><h2>Переглянути підкатегорії</h2><div>'+links+'</div></nav>';
}
// Crawlable, user-accessible index: product links exist before JS runs.
// A compact native disclosure keeps the current product grid and pagination unchanged.
function productLinksHtml(items){
 const unique=[...new Map(items.filter(p=>p.slug).map(p=>[p.slug,p])).values()];
 if(!unique.length)return '';
 const links=unique.map(p=>'<a href="'+htmlEscape(new URL('seo-product/'+encodeURIComponent(p.slug)+'/index.html',base).href)+'">'+htmlEscape(p.name||p.slug)+'</a>').join(' · ');
 return '<nav class="vh-static-product-links wrap" aria-label="Посилання на товари"><details><summary>Переглянути всі товари колекції ('+unique.length+')</summary><p>'+links+'</p></details></nav>';
}
function appendProductLinks(html,items){
 return html.replace('</main>',productLinksHtml(items)+'</main>');
}
// Main catalog gets a complete link index; category/subcategory pages get relevant items.
{
 const path=new URL('../catalog.html',import.meta.url);
 const catalogHtml=readFileSync(path,'utf8');
 const clean=catalogHtml.replace(/<nav class="vh-static-product-links wrap"[\s\S]*?<\/nav>/g,'');
 writeFileSync(path,appendProductLinks(clean,products));
}
for(const c of categories)if(c.slug){
 const slug=String(c.slug).normalize('NFC');
 if(slug==='.'||slug==='..'||/[\\/\x00-\x1f]/.test(slug))throw Error('Unsafe category slug: '+slug);
 const meta=seoMap.get('category:'+c.id)||{};
 const title=strip(meta.seo_title)||categorySeoFallbacks[slug]?.[0]||c.name+' — вінтажний одяг | Vintage Hedonista';
 const desc=strip(meta.meta_description)||categorySeoFallbacks[slug]?.[1]||'Переглядайте '+c.name.toLowerCase()+' у Vintage Hedonista: добірний вінтажний одяг та унікальні речі з характером.';
 const canonical=new URL('seo-category/'+encodeURIComponent(slug)+'/index.html',base).href;
 let html=readFileSync(new URL('../catalog.html',import.meta.url),'utf8').replace(/<nav class="vh-static-product-links wrap"[\s\S]*?<\/nav>/g,'');
 html=html.replace(/<head>/i,'<head><base id="vh-seo-base" href="../../">');
 html=html.replace(/<title>[^<]*<\/title>/i,'<title>'+htmlEscape(title)+'</title>');
 html=html.replace(/<meta name="description"[^>]*>/i,'<meta name="description" content="'+htmlEscape(desc)+'">');
 html=html.replace(/<link rel="canonical"[^>]*>/i,'<link rel="canonical" href="'+htmlEscape(canonical)+'"><meta name="vh-static-canonical" content="'+htmlEscape(canonical)+'">');
 html=html.replace(/<h1 class="page-title">[^<]*<\/h1>/i,'<h1 class="page-title">'+htmlEscape(c.name.toUpperCase())+'</h1>');
 html=embedEditorial(html,editorialFor('category',c.name,slug));
 html=appendProductLinks(html,products.filter(p=>String(p.category_id)===String(c.id)));
 html=html.replace('</main>','<div class="wrap">'+subcategoryLinksHtml(c)+'</div></main>');
 html=html.replace('</head>','<meta name="vh-category-slug" content="'+htmlEscape(slug)+'"></head>');
 const target=join(root,'seo-category',slug);mkdirSync(target,{recursive:true});writeFileSync(join(target,'index.html'),html);
}
for(const sub of subcategories){
 const parent=activeCategories.get(String(sub.category_id));
 if(!parent?.slug||!sub.slug)continue;
 const meta=seoMap.get('subcategory:'+sub.id)||{};
 const title=strip(meta.seo_title)||subcategorySeoFallbacks[parent.slug+'/'+sub.slug]?.[0]||sub.name+' — вінтажний одяг | Vintage Hedonista';
 const desc=strip(meta.meta_description)||subcategorySeoFallbacks[parent.slug+'/'+sub.slug]?.[1]||'Переглядайте '+sub.name.toLowerCase()+' у Vintage Hedonista: вінтажний одяг та речі з характером.';
 const canonical=new URL('seo-subcategory/'+encodeURIComponent(parent.slug)+'/'+encodeURIComponent(sub.slug)+'/index.html',base).href;
 let html=readFileSync(new URL('../catalog.html',import.meta.url),'utf8').replace(/<nav class="vh-static-product-links wrap"[\s\S]*?<\/nav>/g,'');
 html=html.replace('<head>','<head><base id="vh-seo-base" href="../../../">');
 html=html.replace(/<title>[^<]*<\/title>/i,'<title>'+htmlEscape(title)+'</title>');
 html=html.replace(/<meta name="description"[^>]*>/i,'<meta name="description" content="'+htmlEscape(desc)+'">');
 html=html.replace(/<link rel="canonical"[^>]*>/i,'<link rel="canonical" href="'+htmlEscape(canonical)+'"><meta name="vh-static-canonical" content="'+htmlEscape(canonical)+'">');
 html=html.replace(/<h1 class="page-title">[^<]*<\/h1>/i,'<h1 class="page-title">'+htmlEscape(sub.name.toUpperCase())+'</h1>');
 html=embedEditorial(html,editorialFor('subcategory',sub.name,sub.slug,parent.slug));
 html=appendProductLinks(html,products.filter(p=>String(p.subcategory_id)===String(sub.id)));
 const target=join(root,'seo-subcategory',String(parent.slug),String(sub.slug));
 mkdirSync(target,{recursive:true});writeFileSync(join(target,'index.html'),html);
}
writeFileSync(new URL('../sitemap.xml',import.meta.url),xml);
console.log(`Sitemap + SEO HTML: ${unique.length} URLs (${products.length} products, ${news.length} articles, ${categories.length} categories)`);
