export function renderProductRoutes(slugs){
 const known=[...new Set(slugs.filter(value=>typeof value==='string'&&value))].sort();
 return `/* Generated with the published SEO snapshots. Unknown slugs use the live product page. */
(()=>{'use strict';const known=new Set(${JSON.stringify(known).replace(/</g,'\\u003c')});
 const clean=()=>!!window.VH_CONFIG?.cleanUrls;
 function path(kind,...parts){const prefixes=clean()?{product:'product',category:'catalog',subcategory:'catalog',article:'journal'}:{product:'seo-product',category:'seo-category',subcategory:'seo-subcategory',article:'seo-article'};return prefixes[kind]+'/'+parts.map(encodeURIComponent).join('/')+'/'+(window.VH_CONFIG?.prettyUrls?'':'index.html')}
 window.VHStorefrontRoutes={path};
 const slug=value=>typeof value==='string'?value:String(value?.slug||'');
 const route=value=>path('product',slug(value));
 function href(value){const key=slug(value);return key?(known.has(key)||clean()?route(key):'product.html?slug='+encodeURIComponent(key)):'catalog.html'}
 function canonical(value){const url=new URL(route(value),window.VH_CONFIG?.siteUrl||'https://2kscpydzjx-gif.github.io/vintage.hedonista/');if(window.VH_CONFIG?.prettyUrls)url.pathname=url.pathname.replace(/\\/index\\.html$/,'/');return url.href}
 window.VHProductRoutes={href,canonical};})();\n`;
}
