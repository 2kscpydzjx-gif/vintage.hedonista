/* Vintazhka shared safe rich text output */
(function(){
 // Only numeric layout values survive rich-text sanitizing; never retain pasted styles.
 function figureLayout(node,values={}){
  const width=values.width??node.getAttribute('data-vh-width'),align=values.align??node.getAttribute('data-vh-align'),x=values.x??node.getAttribute('data-vh-x');
  const w=/^\d{1,3}$/.test(String(width))?Math.max(20,Math.min(100,Number(width))):null;
  if(w!==null){node.setAttribute('data-vh-width',String(w));node.style.setProperty('--vh-photo-width',w+'%')}
  if(['left','right','center','free'].includes(align))node.setAttribute('data-vh-align',align);
  if(align==='free'&&/^\d{1,3}$/.test(String(x))){const pos=Math.max(0,Math.min(100,Number(x)));node.setAttribute('data-vh-x',String(pos));node.style.setProperty('--vh-photo-offset',((100-(w??100))*pos/100)+'%')}
 }
 function photoRowLayout(node,value=node.getAttribute('data-vh-photo-row')){
  if(!/^[23]$/.test(String(value)))return;
  const count=[...node.children].filter(child=>child.tagName==='FIGURE').length;
  const columns=count>=2&&count<=3?count:Number(value);
  node.setAttribute('data-vh-photo-row',String(columns));node.style.setProperty('--vh-photo-columns',String(columns));
 }
 const tags=new Set(['P','DIV','BR','STRONG','B','EM','I','UL','OL','LI','H1','H2','H3','H4','A','BLOCKQUOTE','FIGURE','FIGCAPTION','IMG']);
 function ok(url){const s=String(url||'').trim();if(!s||/[\u0000-\u001f]/.test(s))return false;return /^(https?:\/\/|mailto:|tel:|\/(?!\/)|\.\/|\.\.\/|#)/i.test(s)}
 function clean(html){const doc=new DOMParser().parseFromString('<div>'+String(html??'')+'</div>','text/html'),root=doc.body.firstElementChild;
  function visit(el){for(const node of [...el.childNodes]){if(node.nodeType===8){node.remove();continue}if(node.nodeType!==1)continue;
   if(['SCRIPT','STYLE','IFRAME','OBJECT','SVG','MATH','FORM','TEMPLATE'].includes(node.tagName)){node.remove();continue}
   const href=node.getAttribute('href'),src=node.getAttribute('src'),alt=node.getAttribute('alt'),w=node.getAttribute('data-vh-width'),align=node.getAttribute('data-vh-align'),x=node.getAttribute('data-vh-x'),row=node.getAttribute('data-vh-photo-row');
   visit(node);if(!tags.has(node.tagName)){node.replaceWith(...node.childNodes);continue}
   for(const a of [...node.attributes])node.removeAttribute(a.name);
   if(node.tagName==='A'&&ok(href)){node.setAttribute('href',href.trim());node.setAttribute('rel','noopener noreferrer');if(/^https?:\/\//i.test(href))node.setAttribute('target','_blank')}
   if(node.tagName==='IMG'){if(ok(src)&&!/^mailto:|^tel:|^#/i.test(src)){node.setAttribute('src',src);node.setAttribute('alt',alt||'');node.setAttribute('loading','lazy')}else node.remove()}
   if(node.tagName==='FIGURE')figureLayout(node,{width:w,align,x});
   if(node.tagName==='DIV')photoRowLayout(node,row);
  }}visit(root);return root.innerHTML}
 // Decode entity-encoded ampersands in text only, after sanitizing rich HTML.
 function decodeAmpText(root){
  const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
  let textNode;while((textNode=walker.nextNode())){
   if(textNode.nodeValue.includes('&amp;'))textNode.nodeValue=textNode.nodeValue.replace(/&amp;/gi,'&');
  }
 }
 function render(node,value){if(!node)return;const v=String(value??'');if(/<\s*\/?\s*(?:p|div|br|a|strong|b|em|i|ul|ol|li|h[2-4]|blockquote|figure|img)\b/i.test(v)){node.innerHTML=clean(v);decodeAmpText(node)}else{node.textContent=v.replace(/&amp;/gi,'&');node.style.whiteSpace='pre-line'}}
 window.VHSafeRich={clean,render,ok,figureLayout,photoRowLayout};
})();
