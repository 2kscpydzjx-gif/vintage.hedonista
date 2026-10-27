// Preserve CMS attributes when filling the static category/subcategory editorial slot.
export function fillCatalogEditorial(html,markup){
 const slot=/<section\b(?=[^>]*\bid=["']catalogSeoEditorial["'])[^>]*>[\s\S]*?<\/section>/i;
 if(!slot.test(html))throw Error('Catalog SEO editorial slot is missing');
 return html.replace(slot,section=>{
  const opening=section.match(/^<section\b[^>]*>/i)[0].replace(/\s+hidden(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))?/i,'');
  return opening.replace(/>$/,(markup?'':' hidden')+'>')+markup+'</section>';
 });
}

// The interactive catalog already lists products; retain a usable no-JS fallback.
export function stripStaticProductLinks(html){
 return html.replace(/(?:<noscript>\s*)?<nav\b(?=[^>]*\bclass=["'][^"']*\bvh-static-product-links\b[^"']*["'])[^>]*>[\s\S]*?<\/nav>(?:\s*<\/noscript>)?/gi,'');
}
export function staticProductFallback(items,base){
 const unique=[...new Map(items.filter(p=>p.slug).map(p=>[p.slug,p])).values()];
 if(!unique.length)return '';
 const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const links=unique.map(p=>'<a href="'+esc(new URL('seo-product/'+encodeURIComponent(p.slug)+'/index.html',base).href)+'">'+esc(p.name||p.slug)+'</a>').join(' · ');
 return '<noscript><nav class="vh-static-product-links wrap" aria-label="Товари колекції"><h2>Товари колекції</h2><p>'+links+'</p></nav></noscript>';
}
