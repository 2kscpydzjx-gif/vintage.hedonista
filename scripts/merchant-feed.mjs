import condition from './product-condition.cjs';

const publicStatuses=new Set(['published','reserved','sold']);
const entities={amp:'&',lt:'<',gt:'>',quot:'"',apos:"'",nbsp:' '};
export const decode=value=>String(value??'').replace(/&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi,(all,name)=>{
 if(name[0]!=='#')return entities[name.toLowerCase()];
 const code=name[1].toLowerCase()==='x'?parseInt(name.slice(2),16):Number(name.slice(1));
 return code>0&&code<=0x10ffff&&!(code>=0xd800&&code<=0xdfff)?String.fromCodePoint(code):all;
});
export const plain=value=>decode(String(value??'').replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi,' ').replace(/<[^>]*>/g,' ')).replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g,'').replace(/\s+/g,' ').replace(/\s+([.,!?;:])/g,'$1').trim();
export const xml=value=>String(value??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;');
const limit=(value,length)=>Array.from(value).slice(0,length).join('');
const slugOK=value=>typeof value==='string'&&value.trim()&&value!=='.'&&value!=='..'&&!/[\/\\\x00-\x1f?#]/.test(value);
export function publicImage(value){
 try{
  const url=new URL(String(value??''));
  if(!['https:','http:'].includes(url.protocol)||url.username||url.password)return null;
  url.hash='';url.pathname=url.pathname.replace(/&/g,'%26').replace(/,/g,'%2C');
  return url.href.length<=2000?url.href:null;
 }catch{return null;}
}
export function productImages(product){
 const gallery=[...(product.product_images||[])].sort((a,b)=>Number(a.sort_order??0)-Number(b.sort_order??0)||String(a.image_url).localeCompare(String(b.image_url)));
 return [...new Set([product.cover_image,...gallery.map(image=>image.image_url)].map(publicImage).filter(Boolean))];
}
export function productAddress(product,siteUrl){return new URL('product/'+encodeURIComponent(product.slug)+'/',siteUrl).href;}
const genericColor=value=>/^(?:різнокольоров(?:ий|а|е|і)|кольоров(?:ий|а|е|і)|мультиколор|multicolou?r|various|n\/?a|—|-)$/iu.test(value);
const placeholderBrand=value=>/^(?:no\s*(?:brand|name)|unknown|невідом(?:ий|а)|без\s*бренд[ау]?|—|-)$/iu.test(value);

export function merchantFeed(products,{siteUrl,settings}){
 const base=new URL(siteUrl);
 if(base.protocol!=='https:'||base.username||base.password||base.pathname!=='/'||base.search||base.hash)throw Error('Merchant site must be an HTTPS origin');
 if(settings.country!=='UA'||settings.language!=='uk'||settings.defaultGender!=='female'||settings.defaultAgeGroup!=='adult'||settings.defaultCondition!=='used')throw Error('Review the confirmed Merchant settings before exporting');
 const items=[],excluded=[],warnings=[],ids=new Set();
 for(const product of [...products].sort((a,b)=>String(a.id).localeCompare(String(b.id)))){
  if(!publicStatuses.has(product.status))continue;
  const name=plain(product.name),description=plain(product.short_description||product.description),color=plain(product.color),size=plain(product.size);
  const category=plain(product.categories?.name),subcategory=plain(product.subcategories?.name);
  const accessory=/аксес|accessor/i.test(category);
  const needsSize=!(accessory&&/сумк|сереж|прикра|намист|браслет|хуст|шарф|крават|bag|jewel|scarf/iu.test(subcategory+' '+name));
  const photos=productImages(product),price=Number(product.price),reasons=[];
  if(!product.id||String(product.id).length>50||ids.has(String(product.id)))throw Error('Missing, duplicate or oversized stable product ID');
  ids.add(String(product.id));
  if(!slugOK(product.slug))reasons.push('Некоректна адреса товару');
  if(!name)reasons.push('Не заповнена назва');
  if(!description)reasons.push('Не заповнений опис');
  if(product.price==null||String(product.price).trim()===''||!Number.isFinite(price)||price<=0)reasons.push('Немає коректної ціни');
  if(!photos.length)reasons.push('Немає доступного посилання на фото');
  if(!color||genericColor(color))reasons.push('Потрібно вказати конкретний колір або кольори');
  if(needsSize&&!size)reasons.push('Не заповнений розмір');
  if(reasons.length){excluded.push({id:product.id,name,url:slugOK(product.slug)?productAddress(product,base):null,reasons});continue;}
  const fields=[['id',product.id],['title',limit(name,150)],['description',limit(description,5000)],['link',productAddress(product,base)],['image_link',photos[0]],...photos.slice(1,11).map(photo=>['additional_image_link',photo]),['availability',product.status==='published'?'in_stock':'out_of_stock'],['price',price.toFixed(2)+' UAH'],['condition',condition(product.condition)],['gender',settings.defaultGender],['age_group',settings.defaultAgeGroup],['color',limit(color,100)]];
  if(size)fields.push(['size',limit(size,100)]);
  if(product.material)fields.push(['material',limit(plain(product.material),200)]);
  if(category)fields.push(['product_type',[category,subcategory].filter(Boolean).join(' > ')]);
  const brand=plain(product.brand);if(brand&&!placeholderBrand(brand))fields.push(['brand',limit(brand,70)]);
  // Missing GTIN/MPN does not establish that manufacturer identifiers never existed.
  // Do not fabricate identifiers or set identifier_exists=no for every vintage item.
  if(condition(product.condition)==='new')warnings.push({id:product.id,name,reason:'Новий товар: перевірити ідентифікатори виробника, якщо Google їх запросить'});
  if(color.length>40||/\d/.test(color))warnings.push({id:product.id,name,reason:'Перевірити написання й довжину значення кольору'});
  items.push('    <item>\n'+fields.map(([key,value])=>'      <g:'+key+'>'+xml(value)+'</g:'+key+'>').join('\n')+'\n    </item>');
 }
 if(!items.length)throw Error('No complete public offers; refusing to replace the Merchant feed with an empty file');
 const output='<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">\n  <channel>\n    <title>Vintazhka — каталог товарів</title>\n    <link>'+xml(base.href)+'</link>\n    <description>Вінтажний жіночий одяг та аксесуари. Україна.</description>\n    <language>uk-UA</language>\n'+items.join('\n')+'\n  </channel>\n</rss>\n';
 return {xml:output,report:{included:items.length,excluded,warnings}};
}

export function addProductImagesToSitemap(sitemap,products,sourceBase,siteUrl){
 if(!/<urlset\b/.test(sitemap))throw Error('Expected a URL sitemap');
 const images=new Map();
 for(const product of products){
  if(!publicStatuses.has(product.status)||!slugOK(product.slug))continue;
  const photos=productImages(product).slice(0,1000);
  images.set(new URL('seo-product/'+encodeURIComponent(product.slug)+'/index.html',sourceBase).href,photos);
  images.set(productAddress(product,siteUrl),photos);
 }
 let output=sitemap;
 if(!/xmlns:image=/.test(output))output=output.replace(/<urlset\b/,'<urlset xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"');
 return output.replace(/<url>([\s\S]*?)<\/url>/g,(all,body)=>{
  const url=decode(body.match(/<loc>([\s\S]*?)<\/loc>/)?.[1]||'');
  if(!images.has(url))return all;
  const clean=body.replace(/<image:image\b[^>]*>[\s\S]*?<\/image:image>/g,'');
  return '<url>'+clean+images.get(url).map(photo=>'<image:image><image:loc>'+xml(photo)+'</image:loc></image:image>').join('')+'</url>';
 });
}
