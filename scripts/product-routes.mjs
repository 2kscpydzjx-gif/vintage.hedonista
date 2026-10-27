export function renderProductRoutes(slugs){
 const known=[...new Set(slugs.filter(value=>typeof value==='string'&&value))].sort();
 return `/* Generated with the published SEO snapshots. Unknown slugs use the live product page. */
(()=>{'use strict';const known=new Set(${JSON.stringify(known).replace(/</g,'\\u003c')});
 const slug=value=>typeof value==='string'?value:String(value?.slug||'');
 const route=value=>'seo-product/'+encodeURIComponent(slug(value))+'/index.html';
 function href(value){const key=slug(value);return key?(known.has(key)?route(key):'product.html?slug='+encodeURIComponent(key)):'catalog.html'}
 function canonical(value){return new URL(route(value),window.VH_CONFIG?.siteUrl||'https://2kscpydzjx-gif.github.io/vintage.hedonista/').href}
 window.VHProductRoutes={href,canonical};})();\n`;
}
