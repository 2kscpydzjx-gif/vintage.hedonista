// Preserve CMS attributes when filling the static category/subcategory editorial slot.
export function fillCatalogEditorial(html,markup){
 const slot=/<section\b(?=[^>]*\bid=["']catalogSeoEditorial["'])[^>]*>[\s\S]*?<\/section>/i;
 if(!slot.test(html))throw Error('Catalog SEO editorial slot is missing');
 return html.replace(slot,section=>{
  const opening=section.match(/^<section\b[^>]*>/i)[0].replace(/\s+hidden(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))?/i,'');
  return opening.replace(/>$/,(markup?'':' hidden')+'>')+markup+'</section>';
 });
}
