(function(){
function setMeta(name,content,attr='name'){let e=document.head.querySelector(`meta[${attr}="${name}"]`);if(!e){e=document.createElement('meta');e.setAttribute(attr,name);document.head.append(e)}e.setAttribute('content',content||'')}
function canonical(url){let e=document.head.querySelector('link[rel="canonical"]');if(!e){e=document.createElement('link');e.rel='canonical';document.head.append(e)}e.href=url}
async function apply(sb,kind,id,fallback={}){const url=new URL(location.href);url.hash='';if(['localhost','127.0.0.1'].includes(url.hostname)){url.protocol='https:';url.hostname='2kscpydzjx-gif.github.io';url.port='';url.pathname='/vintage.hedonista/'+url.pathname.split('/').pop();}const {data,error}=await sb.from('vh_seo_metadata').select('seo_title,meta_description').eq('entity_type',kind).eq('entity_id',String(id)).maybeSingle();if(error)console.warn('SEO metadata',error);const title=data?.seo_title||fallback.title||'Vintage Hedonista';const desc=data?.meta_description||fallback.description||'';document.title=title;setMeta('description',desc);setMeta('og:title',title,'property');setMeta('og:description',desc,'property');setMeta('og:url',url.href,'property');canonical(document.querySelector('meta[name="vh-static-canonical"]')?.content||url.href)}
function set({title,description,canonicalUrl}={}){
 const t=title||document.title;const d=description||'';
 document.title=t;setMeta('description',d);setMeta('og:title',t,'property');setMeta('og:description',d,'property');
 const live=new URL(location.href);if(['localhost','127.0.0.1'].includes(live.hostname)){live.protocol='https:';live.hostname='2kscpydzjx-gif.github.io';live.port='';live.pathname='/vintage.hedonista/'+live.pathname.split('/').pop();}live.hash='';const u=canonicalUrl||live.href;setMeta('og:url',u,'property');canonical(u);
}
function productStructuredData(product,images=[]){
 if(!product||!product.name)return;
 const cleanText=value=>String(value||'').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();
 const origin='https://2kscpydzjx-gif.github.io/vintage.hedonista/';
 const url=product.slug?new URL('seo-product/'+encodeURIComponent(product.slug)+'/index.html',origin).href:location.href;
 const photos=[...new Set(images.filter(x=>typeof x==='string'&&/^https?:\/\//i.test(x)))].slice(0,12);
 const rawPrice=Number(product.price);
 const available=product.status==='published';
 const schema={'@context':'https://schema.org','@type':'Product',
  name:cleanText(product.name),url,
  ...(photos.length?{image:photos}:{}),
  ...(product.brand?{brand:{'@type':'Brand',name:cleanText(product.brand)}}:{}),
  ...(product.short_description||product.description?{description:cleanText(product.short_description||product.description).slice(0,1200)}:{}),
  ...(product.sku?{sku:String(product.sku)}:{}),
  ...(Number.isFinite(rawPrice)&&rawPrice>=0?{offers:{'@type':'Offer',url,priceCurrency:'UAH',price:rawPrice,availability:available?'https://schema.org/InStock':'https://schema.org/OutOfStock',itemCondition:'https://schema.org/UsedCondition'}}:{})
 };
 let el=document.getElementById('vh-product-structured-data');
 if(!el){el=document.createElement('script');el.type='application/ld+json';el.id='vh-product-structured-data';document.head.append(el)}
 el.textContent=JSON.stringify(schema).replace(/</g,'\\u003c');
}
window.VHSEORuntime={apply,set,productStructuredData};
})();
