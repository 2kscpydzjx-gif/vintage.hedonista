// Keep empty collections reachable while publishing only useful search landings.
const publicStatuses=new Set(['published','reserved','sold']);
export function subcategoryHasProducts(subcategory,products){
 return products.some(product=>publicStatuses.has(product.status)&&product.slug&&
  String(product.category_id)===String(subcategory.category_id)&&
  String(product.subcategory_id)===String(subcategory.id));
}
export function subcategoryIndexing(html,hasProducts){
 const previous=/<meta\b(?=[^>]*\bdata-vh-empty-subcategory=["']1["'])[^>]*>\s*/gi;
 const clean=html.replace(previous,'');
 if(hasProducts)return clean;
 if(!/<\/head>/i.test(clean))throw Error('Subcategory head is missing');
 return clean.replace(/<\/head>/i,'<meta name="robots" content="noindex,follow" data-vh-empty-subcategory="1"></head>');
}
