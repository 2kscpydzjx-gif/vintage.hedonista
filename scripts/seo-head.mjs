const escape=value=>String(value||'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
export function sharingHead(html,{title,description,image,canonical}={}){
 const values={'og:title':title,'og:description':description,'og:url':canonical,'og:type':/\/seo-product\//.test(canonical||'')?'product':/\/seo-article\//.test(canonical||'')?'article':'website','og:site_name':'Vintage Hedonista','og:locale':'uk_UA','og:image':image,'twitter:card':'summary_large_image','twitter:title':title,'twitter:description':description,'twitter:image':image};
 for(const [name,value] of Object.entries(values)){
  if(!value)continue;const attr=name.startsWith('og:')?'property':'name',tag='<meta '+attr+'="'+name+'" content="'+escape(value)+'">';let found=false;
  html=html.replace(/<meta\b[^>]*>/gi,current=>{const key=current.match(/\b(?:name|property)\s*=\s*["']([^"']+)["']/i)?.[1];if(key!==name)return current;if(found)return '';found=true;return tag});
  if(!found)html=html.replace(/<\/head>/i,tag+'</head>');
 }
 if(!/<link\b[^>]*\brel=["'](?:shortcut )?icon["']/i.test(html))html=html.replace(/<\/head>/i,'<link rel="icon" type="image/png" href="assets/vintage-hedonista-logo.png"></head>');
 if(!/<link\b[^>]*\brel=["']apple-touch-icon["']/i.test(html))html=html.replace(/<\/head>/i,'<link rel="apple-touch-icon" href="assets/vintage-hedonista-logo.png"></head>');
 return html;
}
