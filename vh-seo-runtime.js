(function(){
function setMeta(name,content,attr='name'){let e=document.head.querySelector(`meta[${attr}="${name}"]`);if(!e){e=document.createElement('meta');e.setAttribute(attr,name);document.head.append(e)}e.setAttribute('content',content||'')}
function canonical(url){let e=document.head.querySelector('link[rel="canonical"]');if(!e){e=document.createElement('link');e.rel='canonical';document.head.append(e)}e.href=url}
const sourceRoot=new URL('.',document.currentScript?.src||document.baseURI);
function siteBase(){try{const value=new URL(window.VH_CONFIG?.siteUrl||'https://2kscpydzjx-gif.github.io/vintage.hedonista/');if(!value.pathname.endsWith('/'))value.pathname+='/';return value.href}catch{return 'https://2kscpydzjx-gif.github.io/vintage.hedonista/'}}
function publicLocation(){const live=new URL(location.href),path=live.pathname.startsWith(sourceRoot.pathname)?live.pathname.slice(sourceRoot.pathname.length):live.pathname.replace(/^\//,''),base=siteBase();const current=document.querySelector('link[rel="canonical"]')?.href;if(current&&current.startsWith(base))return current;return new URL(path==='index.html'&&new URL(base).pathname==='/'?'':path+live.search,base).href}
function socialImage(image){const value=image||document.querySelector('meta[property="og:image"]')?.content||window.VH_CONFIG?.shareImageUrl;if(value){setMeta('og:image',value,'property');setMeta('twitter:image',value)}setMeta('twitter:card','summary_large_image')}
async function apply(sb,kind,id,fallback={}){const {data,error}=await sb.from('vh_seo_metadata').select('seo_title,meta_description').eq('entity_type',kind).eq('entity_id',String(id)).maybeSingle();if(error)console.warn('SEO metadata',error);const title=data?.seo_title||fallback.title||'Vintage Hedonista',desc=data?.meta_description||fallback.description||'';set({title,description:desc,image:fallback.image,canonicalUrl:document.querySelector('meta[name="vh-static-canonical"]')?.content||fallback.canonicalUrl||publicLocation()})}
function set({title,description,canonicalUrl,image}={}){
 const t=title||document.title,d=description||'';document.title=t;setMeta('description',d);setMeta('og:title',t,'property');setMeta('og:description',d,'property');setMeta('twitter:title',t);setMeta('twitter:description',d);
 const u=canonicalUrl||publicLocation();setMeta('og:url',u,'property');setMeta('og:type',/\/seo-product\//.test(u)?'product':/\/seo-article\//.test(u)?'article':'website','property');canonical(u);socialImage(image);
}
function productStructuredData(product,images=[]){
 if(!product||!product.name)return;
 const cleanText=value=>String(value||'').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();
 const origin=siteBase();
 const url=product.slug?new URL('seo-product/'+encodeURIComponent(product.slug)+'/index.html',origin).href:publicLocation();
 const photos=[...new Set(images.filter(x=>typeof x==='string'&&/^https?:\/\//i.test(x)))].slice(0,12);
 if(photos[0])socialImage(photos[0]);
 const rawPrice=Number(product.price);
 const availability={published:'InStock',reserved:'OutOfStock',sold:'SoldOut'}[product.status]||'OutOfStock';
 const schema={'@context':'https://schema.org','@type':'Product',
  name:cleanText(product.name),url,
  ...(photos.length?{image:photos}:{}),
  ...(product.brand?{brand:{'@type':'Brand',name:cleanText(product.brand)}}:{}),
  ...(product.short_description||product.description?{description:cleanText(product.short_description||product.description).slice(0,1200)}:{}),
  ...(product.sku?{sku:String(product.sku)}:{}),
  ...(Number.isFinite(rawPrice)&&rawPrice>=0?{offers:{'@type':'Offer',url,priceCurrency:'UAH',price:rawPrice,availability:'https://schema.org/'+availability,itemCondition:'https://schema.org/UsedCondition'}}:{})
 };
 // Static SEO snapshots already contain Product JSON-LD. Update that same
 // element after loading live inventory instead of creating a duplicate Product.
 let staticEl=document.getElementById('vh-static-product-jsonld');
 if(staticEl){
  staticEl.textContent=JSON.stringify(schema).replace(/</g,'\\u003c');
  document.getElementById('vh-product-structured-data')?.remove();
 }else{
 let el=document.getElementById('vh-product-structured-data');
 if(!el){el=document.createElement('script');el.type='application/ld+json';el.id='vh-product-structured-data';document.head.append(el)}
 el.textContent=JSON.stringify(schema).replace(/</g,'\\u003c');
 }
 // Match the visible product breadcrumbs with machine-readable navigation.
 const category=product.categories?.slug&&product.categories?.name?product.categories:null;
 const subcategory=category&&product.subcategories?.slug&&product.subcategories?.name?product.subcategories:null;
 const entries=[
  {name:'Головна',url:new URL(new URL(origin).pathname==='/'?'':'index.html',origin).href},
  {name:'Каталог',url:new URL('catalog.html',origin).href}
 ];
 if(category)entries.push({name:cleanText(category.name),url:new URL('seo-category/'+encodeURIComponent(category.slug)+'/index.html',origin).href});
 if(subcategory)entries.push({name:cleanText(subcategory.name),url:new URL('seo-subcategory/'+encodeURIComponent(category.slug)+'/'+encodeURIComponent(subcategory.slug)+'/index.html',origin).href});
 entries.push({name:cleanText(product.name),url});
 const breadcrumbs={'@context':'https://schema.org','@type':'BreadcrumbList',itemListElement:entries.map((entry,i)=>({'@type':'ListItem',position:i+1,name:entry.name,item:entry.url}))};
 let breadcrumbEl=document.getElementById('vh-product-breadcrumb-structured-data');
 if(!breadcrumbEl){breadcrumbEl=document.createElement('script');breadcrumbEl.type='application/ld+json';breadcrumbEl.id='vh-product-breadcrumb-structured-data';document.head.append(breadcrumbEl)}
 breadcrumbEl.textContent=JSON.stringify(breadcrumbs).replace(/</g,'\\u003c');
}
window.VHSEORuntime={apply,set,productStructuredData};
})();
