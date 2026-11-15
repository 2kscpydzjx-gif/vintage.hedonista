/* Keep existing SEO snapshots and newly generated articles on the same layout. */
export function renderArticleLayout(html){
 if(!/<main\b[^>]*\bclass=["'][^"']*\barticle-page\b/i.test(html))return html;
 if(!/\bhref=["'][^"']*article-layout\.css(?:\?|["'])/i.test(html))html=html.replace(/<\/head>/i,'<link rel="stylesheet" href="article-layout.css?v=2"></head>');
 return html.replace(/(<article\b[^>]*\bclass=["'])([^"']*\barticle-v71\b[^"']*)(["'][^>]*>)([\s\S]*?)(<\/article>)/gi,(_,start,classes,end,body,close)=>{
  const cover=body.match(/<figure\b[^>]*\bclass=["'][^"']*\barticle-v71-cover\b[^"']*["'][^>]*>[\s\S]*?<\/figure>/i);
  const heading=body.match(/<section\b[^>]*\bclass=["'][^"']*\barticle-v71-cover-intro\b[^"']*["'][^>]*>[\s\S]*?<\/section>/i);
  if(cover&&heading&&heading.index<cover.index)body=body.replace(cover[0],'').replace(heading[0],()=>cover[0]+heading[0]);
  const names=new Set(classes.split(/\s+/).filter(Boolean));names.add('article-editorial');
  if(cover)names.add('has-cover');else names.delete('has-cover');
  return start+[...names].join(' ')+end+body+close;
 });
}
