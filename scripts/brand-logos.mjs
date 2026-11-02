export function renderBrandLogos(html,file){
 const prefix=file.startsWith('admin/')?'../':'';
 const source=prefix+'assets/vintazhka-logo-original.png';
 html=html.replace(/<img\b[^>]*>/gi,tag=>{
  if(!/\b(?:vh-header-logo|vh-footer-logo-img|vh-admin-logo)\b/.test(tag)||!/(?:\.\.\/)?assets\/vintage-hedonista-logo(?:-v257(?:-lossless)?|-admin)?\.(?:webp|png)/i.test(tag))return tag;
  const next=tag.replace(/\bsrc="[^"]*"/i,'src="'+source+'"').replace(/\balt="[^"]*"/i,'alt="Vintazhka"');
  return '<span class="vh-logo-viewport">'+next+'</span>';
 });
 html=html.replace(/(<link\b[^>]*\brel="(?:icon|apple-touch-icon)"[^>]*\bhref=")[^"]*assets\/vintage-hedonista-logo\.png(")/gi,'$1'+source+'$2');
 if(!/href="(?:\.\.\/)?brand-logo\.css/.test(html))html=html.replace(/<\/head>/i,'<link rel="stylesheet" href="'+prefix+'brand-logo.css?v=1"></head>');
 return html;
}
