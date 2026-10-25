/* Shared field discovery and layout renderer for the editor and storefront.
   Existing revisions keep their keys. New layouts are explicitly versioned. */
(()=>{'use strict';
 const caches=new WeakMap(),layouts=new WeakMap(),originalStyles=new WeakMap(),themes=new WeakMap(),nativePhotos=new WeakMap();
 const dynamicSelector='.new-arrivals-carousel,#topGrid,.category-viewport,.journal-mobile-viewport,#productGrid,.product-grid,#journalFeatured,#journalNewGrid,#journalGuideList,#journalOtherGrid,.capsule-cards-grid,.journal-v37-toolbar';
 const staticSelectors={home:['#heroMain','#heroEyebrow','#heroTitle','#heroDescription','#heroCatalogBtn','#heroAboutBtn'],catalog:['.catalog-heading .kicker','.catalog-heading .page-title','.catalog-intro-label','.catalog-intro'],capsules:['.capsule-hero-copy .capsule-kicker','.capsule-hero-copy h1','.capsule-hero-copy h2','.capsule-hero-copy p','.capsule-hero-photo','.capsule-intro-grid h2','.capsule-intro-grid p']};
 const textSelector='h1,h2,h3,h4,h5,h6,p,li,blockquote,figcaption,dt,dd,a,span,strong,small,label,div.eyebrow,div.kicker,div[class*="label"],div[class*="kicker"],div[id^="journalGuideTitle"]';
 const clamp=(value,min,max,fallback)=>value!==''&&value!=null&&Number.isFinite(Number(value))?Math.max(min,Math.min(max,Number(value))):fallback;
 const validImage=value=>typeof value==='string'&&(/^(https?:\/\/|\/(?!\/)|\.\.?\/)/i.test(value)||/^[\w./% -]+\.(?:png|jpe?g|webp|avif|gif|svg)(?:[?#].*)?$/i.test(value)||/^data:image\/(?:png|jpeg|webp|gif|avif);base64,[a-z0-9+/=\s]+$/i.test(value));
 const validLink=value=>typeof value==='string'&&(/^(https?:\/\/|mailto:|tel:|\/(?!\/)|\.\.?\/|#)/i.test(value)||/^[\w-]+\.html(?:[?#].*)?$/.test(value));
 function clean(html,doc=document){
  const t=doc.createElement('template');t.innerHTML=String(html||'');
  const allowed=new Set(['P','BR','STRONG','B','EM','I','U','S','UL','OL','LI','H1','H2','H3','H4','H5','H6','A','SPAN','BLOCKQUOTE']);
  const walk=root=>{for(const el of [...root.childNodes]){if(el.nodeType===8){el.remove();continue}if(el.nodeType!==1)continue;if(/^(SCRIPT|STYLE|IFRAME|OBJECT|EMBED|SVG|MATH|FORM|INPUT|BUTTON)$/.test(el.tagName)){el.remove();continue}walk(el);if(!allowed.has(el.tagName)){el.replaceWith(...el.childNodes);continue}const href=el.getAttribute('href');for(const attr of [...el.attributes])el.removeAttribute(attr.name);if(el.tagName==='A'&&validLink(href))el.setAttribute('href',href)}};
  walk(t.content);return t.innerHTML;
 }
 function sections(doc,page){
  const marked=[...doc.querySelectorAll('[data-cms-section]')];if(marked.length)return marked;
  const main=doc.querySelector('main')||doc.body;
  return (page==='home'?[...doc.body.children].filter(el=>el.tagName==='SECTION'):[...main.children]).filter(el=>!el.matches('script,style,header,footer,.vh-cms-live-block,.vh-cms-injected-unit,#vh-cms-injected')).slice(0,60);
 }
 function sectionId(el,i){return el.dataset.cmsLegacy||'existing-'+i}
 function path(section,node){const parts=[];for(let el=node;el&&el!==section;el=el.parentElement){const siblings=[...el.parentElement.children].filter(x=>x.tagName===el.tagName);parts.unshift(el.tagName.toLowerCase()+':nth-of-type('+(siblings.indexOf(el)+1)+')')}return parts.join('>')||':scope'}
 function photos(section){
  const result=[],doc=section.ownerDocument,win=doc.defaultView;
  for(const node of [section,...section.querySelectorAll('*')]){
   if(node.closest(dynamicSelector+',.vh-cms-composition,.vh-cms-gradient-layer,svg,script,style'))continue;
   const add=(url,kind)=>{if(validImage(url))result.push({node,url,kind})};
   if(node.tagName==='IMG')add(node.getAttribute('src'),'img');
   if(node.tagName==='VIDEO')add(node.getAttribute('poster'),'poster');
   const match=value=>String(value||'').match(/url\(\s*['"]?([^'"\)]+)['"]?\s*\)/)?.[1]||'';
   add(match(win.getComputedStyle(node).backgroundImage),'bg');
   for(const pseudo of ['::before','::after'])add(match(win.getComputedStyle(node,pseudo).backgroundImage),pseudo);
  }
  return result.slice(0,60);
 }
 function fields(section,page){
  const mediaNodes=[section,...section.querySelectorAll('img,video,[style*=background-image]')].filter(node=>!node.closest(dynamicSelector+',.vh-cms-composition,.vh-cms-gradient-layer'));const cached=caches.get(section);if(cached&&cached.every(f=>section.contains(f.el)||section===f.el)&&cached.mediaNodes?.length===mediaNodes.length&&cached.mediaNodes.every((node,i)=>node===mediaNodes[i]))return cached;
  const result=[],used=new Map();
  const add=f=>{const kinds=used.get(f.el)||new Set(),kind=f.type==='image'?'image:'+(f.photo?.kind||(f.el.tagName==='IMG'?'img':'bg')):f.type;if(kinds.has(kind))return;kinds.add(kind);used.set(f.el,kinds);result.push(f)};
  for(const el of section.querySelectorAll('[id]')){
   const id=el.id;
   if((page==='about'&&/^about(?:Hero|Philosophy|Editorial|P[1-4]|Manifest|Origin|Final)/.test(id))||(page==='delivery'&&/^delivery(?:Kicker|Title|Intro|Shipping|Payment|Extra|Process|Step[1-3]|Returns|Refund|Cta)/.test(id))||(page==='contacts'&&/^contacts(?:Kicker|Title|Intro|List|Instagram|Telegram|Email|Phone|Help|Topics|Topic[1-3])/.test(id))||(page==='journal'&&/^journal(?:PageTitle|PageSubtitle|NewTitle|GuideTitle|GuideSubtitle|OtherTitle|CtaTitle|CtaText|CtaLink)$/.test(id))){
    add({el,id,type:id.endsWith('Image')||/^aboutEditorial[123]$/.test(id)?'image':el.tagName==='A'?'link':'text'});
   }
  }
  for(const selector of staticSelectors[page]||[])for(const [i,el] of [...section.querySelectorAll(selector)].entries())add({el,id:'static:'+selector+':'+i,type:el.matches('.capsule-hero-photo,#heroMain,#heroSide1,#heroSide2')?'image':el.tagName==='A'?'link':'text'});
  // Preserve the three legacy fallback field keys before adding all remaining fields.
  if(!result.length){const heading=section.querySelector('h1,h2,h3'),description=[...section.querySelectorAll('p')].find(el=>!el.closest(dynamicSelector));const media=photos(section)[0]||(()=>{const node=section.querySelector('#homeCapsulesMedia,#editorialMedia');return node?{node,url:'',kind:'bg',placeholder:true}:null})();if(media)add({el:media.node,id:'unified:image',type:'image',photo:media.placeholder?undefined:media});if(heading&&!heading.closest(dynamicSelector))add({el:heading,id:'unified:title',type:'text'});if(description)add({el:description,id:'unified:description',type:'text'})}
  for(const el of section.querySelectorAll(textSelector)){
   if(el.closest(dynamicSelector+',.vh-cms-composition,.vh-cms-custom-buttons,button,select,svg,script,style,.placeholder,.about-placeholder,.capsule-hero-photo,.hero-main,.hero-small,[aria-hidden="true"]'))continue;
   if(!el.textContent.trim())continue;
   if(el.tagName==='A'){add({el,id:'link:'+path(section,el),type:'link'});add({el,id:'label:'+path(section,el),type:'text'});continue}
   // A parent rich-text field owns its inline children, avoiding overlapping writes.
   if(result.some(f=>f.type==='text'&&f.el!==el&&f.el.contains(el)))continue;
   if(el.querySelector('h1,h2,h3,h4,p,ul,ol,a,input,select,button,img'))continue;
   add({el,id:'text:'+path(section,el),type:'text'});
  }
  for(const photo of photos(section)){
   if(result.some(f=>f.type==='image'&&((f.el===photo.node&&(f.photo?.kind||(f.el.tagName==='IMG'?'img':'bg'))===photo.kind)||(f.el!==photo.node&&f.el.contains(photo.node)&&!photo.kind.startsWith('::')))))continue;
   add({el:photo.node,id:'media:'+path(section,photo.node)+':'+photo.kind,type:'image',photo});
  }
  result.mediaNodes=mediaNodes;caches.set(section,result);return result;
 }
 function setImage(f,value){
  if(value!=='__removed__'&&!validImage(value))return;
  const node=f.el,doc=node.ownerDocument,removed=value==='__removed__',kind=f.photo?.kind||(node.tagName==='IMG'?'img':node.tagName==='VIDEO'?'poster':'bg');
  if(kind==='img'){if(removed)node.style.visibility='hidden';else{node.src=value;node.removeAttribute('srcset');node.removeAttribute('sizes');node.style.removeProperty('visibility')}}
  else if(kind==='poster'){if(removed)node.removeAttribute('poster');else node.poster=value}
  else if(kind==='bg'){installStyles(doc);const child=!f.photo?.kind&&node.querySelector(':scope>img');if(child){if(removed)child.style.visibility='hidden';else{child.src=value;child.removeAttribute('srcset');child.style.removeProperty('visibility');child.style.removeProperty('display')}node.style.setProperty('background-image','none','important')}else{node.style.setProperty('background-image',removed?'none':'url('+JSON.stringify(value)+')','important');node.querySelectorAll('img').forEach(img=>img.style.display='none')}if(removed)delete node.dataset.vhPhotoAssigned;else node.dataset.vhPhotoAssigned='true'}
  else{const key='vh-photo-'+(node.closest('[data-cms-section]')?.dataset.cmsSection||'block')+'-'+f.id.replace(/[^a-z0-9]/gi,'-');node.setAttribute('data-'+key,'');let css=node.ownerDocument.getElementById(key);if(!css){css=node.ownerDocument.createElement('style');css.id=key;node.ownerDocument.head.append(css)}css.textContent='[data-'+key+']'+kind+'{background-image:'+(removed?'none':'url('+JSON.stringify(value)+')')+'!important}'}
 }
 function mappedValue(f,mapped){if(Object.prototype.hasOwnProperty.call(mapped||{},f.id))return mapped[f.id];const aliases=f.el.id?['static:#'+f.el.id+':0',f.el.id]:[];for(const id of aliases)if(Object.prototype.hasOwnProperty.call(mapped||{},id))return mapped[id];return undefined}
 function applyMapped(section,mapped,page){for(const f of fields(section,page)){const value=mappedValue(f,mapped);if(typeof value!=='string')continue;if(f.type==='text'){const html=clean(value,section.ownerDocument);if(f.el.innerHTML!==html)f.el.innerHTML=html}else if(f.type==='link'){if(value===''||validLink(value))f.el.setAttribute('href',value)}else setImage(f,value)}}
 function installStyles(doc){
  if(doc.getElementById('vh-cms-model-css'))return;
  const style=doc.createElement('style');style.id='vh-cms-model-css';style.textContent=`
  [data-vh-photo-assigned]>.placeholder,[data-vh-photo-assigned].about-placeholder>span,[data-vh-photo-assigned].capsule-hero-photo>span{visibility:hidden!important}
  [data-vh-studio-selected]{outline:2px solid #b9936c!important;outline-offset:-2px}
  [data-vh-layout]{display:block!important;position:relative!important;height:auto!important;max-height:none!important;min-height:0!important;padding:0!important;overflow:visible!important;background:none!important}
  [data-vh-layout]>:not(.vh-cms-composition){display:none!important}
  .vh-cms-composition{display:grid!important;grid-template-columns:var(--vh-photo-width,50%) minmax(0,1fr)!important;grid-template-rows:auto;min-height:var(--vh-layout-min-height,0px)!important;background:var(--vh-layout-bg)!important;color:var(--vh-layout-color)!important;position:relative;isolation:isolate;width:100%;gap:0;box-sizing:border-box;overflow:hidden}
  .vh-cms-composition *{box-sizing:border-box}
  .vh-cms-composition>.vh-cms-copy{grid-column:2;grid-row:1;display:flex;flex-direction:column;align-items:var(--vh-copy-align,flex-start);justify-content:var(--vh-text-position,center);padding:clamp(24px,5vw,72px);min-width:0;min-height:0;text-align:var(--vh-text-align,left)}
  .vh-cms-composition>.vh-cms-copy>:not(a):not(.vh-cms-custom-buttons){width:100%;max-width:100%;overflow-wrap:anywhere}
  .vh-cms-composition>.vh-cms-copy>a{display:inline-flex!important;align-items:center;justify-content:center;align-self:var(--vh-copy-align,flex-start)!important;width:fit-content!important;max-width:100%!important;flex:0 0 auto!important;white-space:normal}
  .vh-cms-composition>.vh-cms-copy h1,.vh-cms-composition>.vh-cms-copy h2{font-family:'Bodoni Moda',Georgia,serif;font-weight:400;font-size:var(--vh-heading-size,clamp(28px,4vw,58px));line-height:1.15;margin:0 0 20px}
  .vh-cms-composition>.vh-cms-copy p{font-family:Montserrat,Arial,sans-serif;font-size:var(--vh-body-size,16px);line-height:1.7}
  .vh-cms-composition>.vh-cms-photo{position:relative;grid-row:1;grid-column:1;overflow:hidden;min-width:0;min-height:var(--vh-layout-min-height,0px);background:transparent}
  :is(.vh-cms-photo,[data-vh-native-photo]){--vh-current-fit:var(--vh-fit-desktop,cover);--vh-current-x:var(--vh-x-desktop,50%);--vh-current-y:var(--vh-y-desktop,50%);--vh-current-zoom:var(--vh-zoom-desktop,1)}
  .vh-cms-composition>.vh-cms-photo>img{display:block!important;width:100%!important;height:100%!important;position:absolute;inset:0;max-width:none!important}
  .vh-cms-composition>.vh-cms-photo>img,:is(img,video)[data-vh-native-photo]{object-fit:var(--vh-current-fit)!important;object-position:var(--vh-current-x) var(--vh-current-y)!important;transform:scale(var(--vh-current-zoom))!important;transform-origin:var(--vh-current-x) var(--vh-current-y)!important}
  [data-vh-layout=right]>.vh-cms-composition{grid-template-columns:minmax(0,1fr) var(--vh-photo-width,50%)!important}
  [data-vh-layout=right]>.vh-cms-composition>.vh-cms-copy{grid-column:1}
  [data-vh-layout=right]>.vh-cms-composition>.vh-cms-photo{grid-column:2}
  :is([data-vh-layout=stacked],[data-vh-layout=text-top],[data-vh-layout=text-only])>.vh-cms-composition{grid-template-columns:minmax(0,1fr)!important}
  :is([data-vh-layout=stacked],[data-vh-layout=text-top])[data-vh-height=auto]>.vh-cms-composition{min-height:0!important}
  [data-vh-layout=stacked]>.vh-cms-composition>.vh-cms-copy{grid-column:1;grid-row:2}
  [data-vh-layout=text-top]>.vh-cms-composition>.vh-cms-copy{grid-column:1;grid-row:1}
  [data-vh-layout=text-top]>.vh-cms-composition>.vh-cms-photo{grid-row:2}
  :is([data-vh-layout=stacked],[data-vh-layout=text-top])>.vh-cms-composition>.vh-cms-photo{height:var(--vh-vertical-photo-height,320px);min-height:0}
  [data-vh-layout=text-only]>.vh-cms-composition>.vh-cms-copy{grid-column:1;grid-row:1}
  [data-vh-layout=framed]>.vh-cms-composition{grid-template-columns:calc(var(--vh-photo-width,50%)/2) minmax(0,1fr) calc(var(--vh-photo-width,50%)/2)!important}
  [data-vh-layout=framed]>.vh-cms-composition>.vh-cms-photo:nth-of-type(2){grid-column:3}
  [data-vh-layout=three-photos]>.vh-cms-composition{grid-template-columns:var(--vh-photo-width,65%) minmax(0,1fr)!important;grid-template-rows:var(--vh-gallery-row,220px) var(--vh-gallery-row,220px) auto!important;gap:8px}
  [data-vh-layout=three-photos]>.vh-cms-composition>.vh-cms-photo{min-height:0;grid-column:1;grid-row:1/3}
  [data-vh-layout=three-photos]>.vh-cms-composition>.vh-cms-photo:nth-of-type(2){grid-column:2;grid-row:1}
  [data-vh-layout=three-photos]>.vh-cms-composition>.vh-cms-photo:nth-of-type(3){grid-column:2;grid-row:2}
  [data-vh-layout=three-photos]>.vh-cms-composition>.vh-cms-copy{grid-column:1/-1;grid-row:3}
  [data-vh-layout=gradient-hero]>.vh-cms-composition{display:block!important}
  [data-vh-layout=gradient-hero]>.vh-cms-composition>.vh-cms-photo{position:absolute;inset:0;width:100%;height:100%;min-height:0}
  [data-vh-layout=gradient-hero]>.vh-cms-composition>.vh-cms-photo:after{content:'';position:absolute;inset:0;background:var(--vh-layout-overlay)}
  [data-vh-layout=gradient-hero]>.vh-cms-composition>.vh-cms-copy{position:relative;z-index:1;min-height:var(--vh-layout-min-height,420px);width:var(--vh-text-width,65%)}
  [data-vh-height=fixed]>.vh-cms-composition{height:var(--vh-block-height)!important;min-height:0!important;grid-template-rows:minmax(0,1fr)}
  [data-vh-height=fixed]>.vh-cms-composition>.vh-cms-photo{height:auto;min-height:0!important}
  [data-vh-height=fixed]>.vh-cms-composition>.vh-cms-copy{height:100%;overflow:auto;padding:min(5vw,calc(var(--vh-block-height)*.08));min-height:0}
  [data-vh-height=fixed][data-vh-layout=stacked]>.vh-cms-composition{grid-template-rows:minmax(0,var(--vh-photo-width)) minmax(0,1fr)!important}
  [data-vh-height=fixed][data-vh-layout=text-top]>.vh-cms-composition{grid-template-rows:minmax(0,1fr) minmax(0,var(--vh-photo-width))!important}
  [data-vh-height=fixed][data-vh-layout=three-photos]>.vh-cms-composition{grid-template-rows:minmax(0,1fr) minmax(0,1fr) minmax(0,1fr)!important;gap:0}
  [data-vh-height=fixed][data-vh-layout=gradient-hero]>.vh-cms-composition>.vh-cms-photo{height:100%}
  @media(min-width:761px) and (max-width:1024px){:is(.vh-cms-photo,[data-vh-native-photo]){--vh-current-fit:var(--vh-fit-tablet,var(--vh-fit-desktop,cover));--vh-current-x:var(--vh-x-tablet,var(--vh-x-desktop,50%));--vh-current-y:var(--vh-y-tablet,var(--vh-y-desktop,50%));--vh-current-zoom:var(--vh-zoom-tablet,var(--vh-zoom-desktop,1))}}
  @media(max-width:760px){
   :is(.vh-cms-photo,[data-vh-native-photo]){--vh-current-fit:var(--vh-fit-mobile,var(--vh-fit-desktop,cover));--vh-current-x:var(--vh-x-mobile,var(--vh-x-desktop,50%));--vh-current-y:var(--vh-y-mobile,var(--vh-y-desktop,50%));--vh-current-zoom:var(--vh-zoom-mobile,var(--vh-zoom-desktop,1))}
   .vh-cms-composition{grid-template-columns:minmax(0,1fr)!important}
   .vh-cms-composition>.vh-cms-copy{grid-column:1!important;grid-row:2;padding:28px 22px}
   [data-vh-height=auto]:is([data-vh-layout=left],[data-vh-layout=right],[data-vh-layout=wide],[data-vh-layout=stacked],[data-vh-layout=text-top])>.vh-cms-composition{min-height:0!important}
   .vh-cms-composition>.vh-cms-photo{grid-column:1!important;grid-row:1;height:var(--vh-vertical-photo-height,280px);min-height:0}
   [data-vh-layout=right]>.vh-cms-composition{grid-template-columns:1fr!important}
   [data-vh-layout=gradient-hero]>.vh-cms-composition>.vh-cms-copy{width:100%}
   [data-vh-layout=text-top]>.vh-cms-composition>.vh-cms-copy{grid-row:1}
   [data-vh-layout=text-top]>.vh-cms-composition>.vh-cms-photo{grid-row:2}
   [data-vh-layout=framed]>.vh-cms-composition{grid-template-columns:1fr 1fr!important}
   [data-vh-layout=framed]>.vh-cms-composition>.vh-cms-photo:nth-of-type(2){grid-column:2!important}
   [data-vh-layout=framed]>.vh-cms-composition>.vh-cms-copy{grid-column:1/-1!important;grid-row:2}
   [data-vh-layout=three-photos]>.vh-cms-composition{grid-template-columns:1fr 1fr!important;grid-template-rows:220px 130px auto!important}
   [data-vh-layout=three-photos]>.vh-cms-composition>.vh-cms-photo{height:auto;grid-row:1!important;grid-column:1/-1!important}
   [data-vh-layout=three-photos]>.vh-cms-composition>.vh-cms-photo:nth-of-type(2){grid-row:2!important;grid-column:1!important}
   [data-vh-layout=three-photos]>.vh-cms-composition>.vh-cms-photo:nth-of-type(3){grid-row:2!important;grid-column:2!important}
   [data-vh-layout=three-photos]>.vh-cms-composition>.vh-cms-copy{grid-row:3!important}
   [data-vh-mobile-order=text-first]:is([data-vh-layout=left],[data-vh-layout=right],[data-vh-layout=wide],[data-vh-layout=stacked],[data-vh-layout=text-top])>.vh-cms-composition>.vh-cms-copy{grid-row:1!important}
   [data-vh-mobile-order=text-first]:is([data-vh-layout=left],[data-vh-layout=right],[data-vh-layout=wide],[data-vh-layout=stacked],[data-vh-layout=text-top])>.vh-cms-composition>.vh-cms-photo{grid-row:2!important}
   [data-vh-mobile-order=photo-first]:is([data-vh-layout=left],[data-vh-layout=right],[data-vh-layout=wide],[data-vh-layout=stacked],[data-vh-layout=text-top])>.vh-cms-composition>.vh-cms-copy{grid-row:2!important}
   [data-vh-mobile-order=photo-first]:is([data-vh-layout=left],[data-vh-layout=right],[data-vh-layout=wide],[data-vh-layout=stacked],[data-vh-layout=text-top])>.vh-cms-composition>.vh-cms-photo{grid-row:1!important}
   [data-vh-height=fixed]>.vh-cms-composition{height:var(--vh-block-height)!important;grid-template-rows:minmax(0,var(--vh-photo-width)) minmax(0,1fr)!important}
   [data-vh-height=fixed]>.vh-cms-composition>.vh-cms-photo{height:auto!important}
   [data-vh-height=fixed]:is([data-vh-layout=text-top],[data-vh-mobile-order=text-first])>.vh-cms-composition{grid-template-rows:minmax(0,1fr) minmax(0,var(--vh-photo-width))!important}
   [data-vh-height=fixed][data-vh-layout=text-only]>.vh-cms-composition{grid-template-rows:minmax(0,1fr)!important}
   [data-vh-height=fixed][data-vh-layout=framed]>.vh-cms-composition{grid-template-rows:minmax(0,var(--vh-photo-width)) minmax(0,1fr)!important}
   [data-vh-height=fixed][data-vh-layout=three-photos]>.vh-cms-composition{grid-template-rows:minmax(0,1fr) minmax(0,1fr) minmax(0,1fr)!important}
   [data-vh-height=fixed][data-vh-layout=gradient-hero]>.vh-cms-composition>.vh-cms-photo{height:100%!important}
  }
  @keyframes vhUnifiedUp{from{opacity:0;transform:translateY(24px)}to{opacity:1;transform:none}}
  @keyframes vhUnifiedLeft{from{opacity:0;transform:translateX(-24px)}to{opacity:1;transform:none}}
  @keyframes vhUnifiedRight{from{opacity:0;transform:translateX(24px)}to{opacity:1;transform:none}}
  @keyframes vhUnifiedFade{from{opacity:0}to{opacity:1}}
  @keyframes vhUnifiedZoom{from{opacity:0;transform:scale(.96)}to{opacity:1;transform:none}}
  [data-vh-motion]{animation:var(--vh-motion-name) var(--vh-motion-duration,650ms) ease both!important}
  @media(prefers-reduced-motion:reduce){[data-vh-motion]{animation:none!important}}
  `;doc.head.append(style);
 }
 function resetLayout(section){const state=layouts.get(section);if(!state)return;for(const {node,anchor} of state.collections){if(anchor.isConnected)anchor.replaceWith(node)}for(const item of state.hidden){if(item.value)item.node.style.setProperty('display',item.value,item.priority);else item.node.style.removeProperty('display')}state.root.remove();section.removeAttribute('data-vh-layout');section.removeAttribute('data-vh-height');layouts.delete(section)}
 function applyFieldStyles(section,styles,page){for(const f of fields(section,page)){const d=styles?.[f.id];if(!d||f.type!=='text')continue;const node=f.el;if(d.size!=null)node.style.setProperty('font-size',clamp(d.size,8,140,16)+'px','important');if(['left','center','right'].includes(d.align))node.style.setProperty('text-align',d.align,'important');if(/^#[a-f0-9]{6}$/i.test(d.color||''))node.style.setProperty('color',d.color,'important');if(d.lineHeight!=null)node.style.setProperty('line-height',clamp(d.lineHeight,.8,3,1.6),'important');if(d.weight)node.style.setProperty('font-weight',clamp(d.weight,100,900,400),'important')}}
 function imageSources(section,edit={},page){const doc=section.ownerDocument,imageFields=fields(section,page).filter(f=>f.type==='image');
  const urls=imageFields.map(f=>{const value=mappedValue(f,edit.mapped);if(value==='__removed__')return '';if(value)return value;const bg=doc.defaultView.getComputedStyle(f.el,f.photo?.kind?.startsWith('::')?f.photo.kind:null).backgroundImage.match(/url\(["']?(.+?)["']?\)/)?.[1];return (f.el.tagName==='VIDEO'?f.el.getAttribute('poster'):f.el.getAttribute('src'))||bg||f.el.querySelector('img')?.src||f.photo?.url||''});
  if(typeof edit.templateImage==='string')urls[0]=edit.templateImage==='__removed__'?'':edit.templateImage;
  if(typeof edit.capsuleImage==='string')urls[0]=edit.capsuleImage==='__removed__'?'':edit.capsuleImage;
  if(edit.capsuleSecondImage)urls[1]=edit.capsuleSecondImage;
  for(const [i,value] of Object.entries(edit.layoutImages||{}))urls[Number(i)]=value;
  return urls;
 }
 function mediaKey(section,edit,page,index){return edit.mediaKeys?.[index]||fields(section,page).filter(f=>f.type==='image')[index]?.id||'layout:'+index}
 function photoCrop(edit={},design={},key,slot,device='desktop'){
  const base={fit:design.photoFit||'cover',x:design.photoX??50,y:design.photoY??50,zoom:100,...design['crop'+slot],...edit.mediaCrop?.[key]};
  const value={...base,...(slot===0?design.cropDevices?.desktop:{}),...edit.mediaSettings?.['layout:'+slot]?.desktop,...edit.mediaSettings?.[key]?.desktop,...(slot===0?design.cropDevices?.[device]:{}),...edit.mediaSettings?.['layout:'+slot]?.[device],...edit.mediaSettings?.[key]?.[device]};
  value.fit=value.fit==='contain'?'contain':'cover';return {fit:value.fit,x:clamp(value.x,0,100,50),y:clamp(value.y,0,100,50),zoom:clamp(value.zoom,value.fit==='contain'?50:100,200,100)};
 }
 function photoVariables(node,edit,design,key,slot){for(const device of ['desktop','tablet','mobile']){const value=photoCrop(edit,design,key,slot,device);for(const [name,v] of Object.entries({fit:value.fit,x:value.x+'%',y:value.y+'%',zoom:value.zoom/100}))node.style.setProperty('--vh-'+name+'-'+device,v)}}
 function sourceTheme(section,page){
  if(themes.has(section))return themes.get(section);
  const win=section.ownerDocument.defaultView,copy=section.querySelector('.hero-copy,.editorial-copy,.about-hero-copy,.about-final-copy,.copy,.vh-lab-copy,.vh-cms-live-copy')||section;
  const opaque=color=>color&&color!=='transparent'&&!/rgba\([^)]*,\s*0\)$/.test(color);
  let background='';for(let node=copy;node&&!background;node=node.parentElement){const color=win.getComputedStyle(node).backgroundColor;if(opaque(color))background=color}
  const text=new Map();for(const f of fields(section,page).filter(f=>f.type==='text')){const computed=win.getComputedStyle(f.el),entry={color:computed.color};if(f.el.tagName==='A'){entry.button={};for(const name of ['color','background-color','border-top-color','border-right-color','border-bottom-color','border-left-color','border-top-style','border-right-style','border-bottom-style','border-left-style','border-top-width','border-right-width','border-bottom-width','border-left-width','border-radius','padding-top','padding-right','padding-bottom','padding-left','font-family','font-size','font-weight','letter-spacing','text-transform','text-decoration'])entry.button[name]=computed.getPropertyValue(name)}text.set(f.el,entry)}
  const value={background:background||'#0d0c09',color:win.getComputedStyle(copy).color,height:section.getBoundingClientRect().height||320,copy,copyBackground:copy.style.getPropertyValue('background-color'),copyBackgroundPriority:copy.style.getPropertyPriority('background-color'),text};themes.set(section,value);return value;
 }
 function applyMediaSettings(section,edit={},page){
  if(section.hasAttribute('data-vh-layout'))return;
  let all=fields(section,page).filter(f=>f.type==='image');if(edit.design?.photoPreset==='gradient-hero'&&edit.design.layoutVersion!==1){const layer=section.querySelector(':scope>.vh-cms-gradient-layer');if(layer&&all[0])all=[{...all[0],el:layer,photo:{kind:'bg'}},...all.slice(1)]}const urls=imageSources(section,edit,page),win=section.ownerDocument.defaultView;
  all.forEach((f,index)=>{const key=f.id;const child=!f.photo?.kind&&!['IMG','VIDEO'].includes(f.el.tagName)&&f.el.querySelector(':scope>img');if(child&&win.getComputedStyle(child).display!=='none'){if(f.el.dataset.vhPhotoAssigned)f.el.style.setProperty('background-image','none','important');f={...f,el:child}}if(!edit.mediaSettings?.[key]&&!edit.mediaSettings?.['layout:'+index])return;installStyles(section.ownerDocument);photoVariables(f.el,edit,edit.design||{},key,index);f.el.dataset.vhNativePhoto='true';
   if(f.el.tagName==='IMG'||f.el.tagName==='VIDEO'){const parent=f.el.parentElement;if(parent&&parent!==section&&!parent.querySelector('h1,h2,h3,p,a,button'))parent.style.overflow='hidden';return}
   const kind=f.photo?.kind||'bg';let records=nativePhotos.get(f.el);if(!records){records=new Map();nativePhotos.set(f.el,records)}let record=records.get(kind);if(!record){record={image:new win.Image(),node:f.el};record.paint=()=>{if(!record.node.isConnected||!record.image.naturalWidth)return;const rect=record.node.getBoundingClientRect(),device=win.innerWidth<=760?'mobile':win.innerWidth<=1024?'tablet':'desktop',crop=photoCrop(record.edit,record.edit.design||{},record.key,record.index,device);const scale=(crop.fit==='contain'?Math.min:Math.max)(rect.width/record.image.naturalWidth,rect.height/record.image.naturalHeight)*crop.zoom/100;const size=record.image.naturalWidth*scale+'px '+record.image.naturalHeight*scale+'px',position=crop.x+'% '+crop.y+'%';if(record.pseudo){record.node.style.setProperty(record.variable+'-size',size);record.node.style.setProperty(record.variable+'-position',position)}else{const gradient=win.getComputedStyle(record.node).backgroundImage.includes('gradient(');record.node.style.setProperty('background-size',(gradient?'100% 100%, ':'')+size,'important');record.node.style.setProperty('background-position',(gradient?'center, ':'')+position,'important');record.node.style.setProperty('background-repeat','no-repeat','important')}};record.image.onload=record.paint;if(win.ResizeObserver){record.observer=new win.ResizeObserver(record.paint);record.observer.observe(f.el)}win.addEventListener('resize',record.paint,{passive:true});records.set(kind,record);if(kind.startsWith('::')){const token='vh-native-'+(section.dataset.cmsSection||'block')+'-'+key.replace(/[^a-z0-9]/gi,'-');record.pseudo=true;record.variable='--'+token;f.el.setAttribute('data-'+token,'');const style=section.ownerDocument.createElement('style');style.textContent='[data-'+token+']'+kind+'{background-size:var('+record.variable+'-size)!important;background-position:var('+record.variable+'-position)!important;background-repeat:no-repeat!important}';section.ownerDocument.head.append(style)}}
   record.edit=edit;record.key=key;record.index=index;const source=urls[index];if(validImage(source)&&record.source!==source){record.source=source;record.image.src=source}record.paint();
  });
 }
 function applyLegacyText(section,edit,page){
  for(const [key,selector,legacyKey] of [['title','h1,h2,h3','unified:title'],['description','p','unified:description']]){if(typeof edit[key]!=='string')continue;const node=section.querySelector(selector);if(!node)continue;const mapped=fields(section,page).some(f=>f.el===node&&f.type==='text'&&mappedValue(f,edit.mapped)!==undefined);if(mapped||Object.prototype.hasOwnProperty.call(edit.mapped||{},legacyKey))continue;if(key==='title')node.textContent=edit[key];else node.innerHTML=clean(edit[key],section.ownerDocument);}
 }
 function applyDesign(section,d,page,edit={}){
  if(d?.layoutVersion!==1)return;
  if(page==='catalog'&&section.querySelector('.catalog-heading')){applyMapped(section,edit.mapped,page);applyDesign(section.querySelector('.catalog-heading'),d,page,edit);applyFieldStyles(section,edit.fieldStyles,page);return;}

  installStyles(section.ownerDocument);resetLayout(section);const theme=sourceTheme(section,page);
  applyMapped(section,edit.mapped,page);
  applyLegacyText(section,edit,page);

  if(!originalStyles.has(section)){if(edit.hidden){const previous=section.style.display;section.style.removeProperty('display');originalStyles.set(section,section.getAttribute('style'));section.style.display=previous}else originalStyles.set(section,section.getAttribute('style'));}
  const original=originalStyles.get(section);if(original===null)section.removeAttribute('style');else section.setAttribute('style',original);
  if(edit.hidden){section.style.display='none';return}
  const doc=section.ownerDocument,all=fields(section,page),preset=d.photoPreset||'original';
  const tone={light:'#f2e5d5',gold:'#b7956d',dark:'#211a15'}[d.textTone];
  const background=({dark:'#0d0c09',light:'#ffffff',cream:'#f3eadf',transparent:'transparent'})[d.backgroundMode]||theme.background;
  const baseColor=background==='transparent'?theme.background:background;const channels=baseColor.startsWith('#')?baseColor.slice(1).match(/../g).map(value=>parseInt(value,16)):baseColor.match(/[\d.]+/g)?.slice(0,3)||[13,12,9];const overlay='linear-gradient(90deg,rgba('+channels.join(',')+',.96),rgba('+channels.join(',')+',.65) 55%,transparent)';
  const height=clamp(d.height,120,1600,theme.height),fixed=d.heightMode==='fixed'&&d.height!=null;
  const props={'--vh-layout-overlay':overlay,'--vh-photo-width':clamp(d.photoWidth,20,80,50)+'%','--vh-layout-min-height':clamp(d.minHeight,0,1600,theme.height)+'px','--vh-block-height':height+'px','--vh-gallery-row':Math.max(60,height/3)+'px','--vh-text-width':clamp(d.textWidth,20,100,65)+'%','--vh-layout-bg':background,'--vh-layout-color':tone||theme.color,'--vh-text-align':['left','center','right'].includes(d.align)?d.align:'left','--vh-copy-align':{left:'flex-start',center:'center',right:'flex-end'}[d.align]||'flex-start','--vh-text-position':{top:'flex-start',center:'center',bottom:'flex-end'}[d.textPosition]||'center'};
  if(d.headingSize!=null)props['--vh-heading-size']=clamp(d.headingSize,16,120,40)+'px';if(d.bodySize!=null)props['--vh-body-size']=clamp(d.bodySize,10,48,16)+'px';
  for(const [key,value] of Object.entries(props))section.style.setProperty(key,value);
  for(const key of ['marginTop','marginBottom'])if(d[key]!=null)section.style.setProperty(key==='marginTop'?'margin-top':'margin-bottom',clamp(d[key],0,160,28)+'px','important');
  for(const f of all.filter(f=>f.type==='text')){if(d.align)f.el.style.setProperty('text-align',d.align,'important');const size=f.el.matches('h1,h2,h3,h4,h5,h6')?d.headingSize:d.bodySize;if(size!=null)f.el.style.setProperty('font-size',clamp(size,8,140,16)+'px','important');if(tone)f.el.style.setProperty('color',tone,'important');else if(d.textTone==='original'&&theme.text.has(f.el))f.el.style.setProperty('color',theme.text.get(f.el).color,'important');if(d.letterSpacing!=null)f.el.style.setProperty('letter-spacing',clamp(d.letterSpacing,-1,8,0)+'px','important')}
  applyFieldStyles(section,edit.fieldStyles,page);
  if(preset==='original'){if(d.backgroundMode&&d.backgroundMode!=='original'){section.style.setProperty('background-color',background,'important');theme.copy.style.setProperty('background-color',background,'important')}else{if(theme.copyBackground)theme.copy.style.setProperty('background-color',theme.copyBackground,theme.copyBackgroundPriority);else theme.copy.style.removeProperty('background-color')}if(fixed){section.style.setProperty('height',height+'px','important');section.style.setProperty('min-height','0','important');section.style.setProperty('overflow','auto','important')}for(const [i,url] of Object.entries(edit.layoutImages||{})){const f=all.filter(f=>f.type==='image')[Number(i)];if(f&&(validImage(url)||url==='__removed__'))setImage(f,url)}applyMediaSettings(section,edit,page);applyButtons(section,edit.customButtons);return;}
  const root=doc.createElement('div');root.className='vh-cms-composition';
  const imageFields=all.filter(f=>f.type==='image');
  const urls=imageSources(section,edit,page);
  const count=preset==='text-only'?0:preset==='framed'?2:preset==='three-photos'?3:1;
  for(let i=0;i<count;i++){const photo=doc.createElement('div');photo.className='vh-cms-photo';const image=doc.createElement('img');image.alt=imageFields[i]?.el.getAttribute('alt')||'';if(validImage(urls[i]))image.src=urls[i];else image.alt='Додайте фотографію';photoVariables(photo,edit,d,mediaKey(section,edit,page,i),i);photo.append(image);root.append(photo)}
  const copy=doc.createElement('div');copy.className='vh-cms-copy';
  for(const f of all.filter(f=>f.type==='text'&&!all.some(other=>other.type==='text'&&other.el!==f.el&&other.el.contains(f.el))).sort((a,b)=>a.el.compareDocumentPosition(b.el)&4?-1:1)){const node=f.el.cloneNode(true);node.removeAttribute('id');node.removeAttribute('hidden');node.querySelectorAll('[id]').forEach(n=>n.removeAttribute('id'));const originalLook=theme.text.get(f.el);if(originalLook){const color=edit.fieldStyles?.[f.id]?.color||tone||originalLook.color;node.style.setProperty('color',color,'important');if(node.tagName==='A'&&originalLook.button){for(const [key,value] of Object.entries(originalLook.button))node.style.setProperty(key,value);if(edit.fieldStyles?.[f.id]?.color)node.style.setProperty('color',edit.fieldStyles[f.id].color,'important')}}if(node.tagName==='A'){const link=all.find(x=>x.el===f.el&&x.type==='link');if(link){const href=edit.mapped?.[link.id]??f.el.getAttribute('href');if(validLink(href))node.setAttribute('href',href)}}copy.append(node)}
  if(!copy.children.length){const p=doc.createElement('p');p.textContent='';copy.append(p)}root.append(copy);
  const hidden=[...section.children].map(node=>({node,value:node.style.getPropertyValue('display'),priority:node.style.getPropertyPriority('display')}));for(const item of hidden)item.node.style.setProperty('display','none','important');section.style.setProperty('display','block','important');section.style.setProperty('min-height','0','important');section.style.setProperty('height','auto','important');section.style.setProperty('max-height','none','important');section.style.setProperty('padding','0','important');section.dataset.vhHeight=fixed?'fixed':'auto';section.dataset.vhMobileOrder=d.mobileOrder||'layout';section.dataset.vhLayout=preset;section.append(root);layouts.set(section,{root,collections:[],hidden});
  // Keep live catalog/slider nodes and their handlers in place, outside the new static composition.
  const collections=[...section.querySelectorAll(dynamicSelector)].filter(el=>!el.closest('.vh-cms-composition'));
  if(collections.length){const group=doc.createElement('div');group.className='vh-cms-collections';group.style.gridColumn='1 / -1';for(const node of collections){const item=hidden.find(item=>item.node===node);if(item){if(item.value)node.style.setProperty('display',item.value,item.priority);else node.style.removeProperty('display')}const anchor=doc.createComment('CMS collection');node.before(anchor);group.append(node);layouts.get(section).collections.push({node,anchor})}root.append(group)}if(!fixed&&copy.children.length){const textHeight=copy.getBoundingClientRect().height||copy.scrollHeight;const share=clamp(d.photoWidth,20,80,50);section.style.setProperty('--vh-vertical-photo-height',Math.max(1,Math.min(8000,textHeight*share/(100-share)))+'px')}applyButtons(section,edit.customButtons);
 }
 function applyButtons(section,buttons){
  section.querySelectorAll('.vh-cms-custom-buttons').forEach(node=>node.remove());if(!Array.isArray(buttons)||!buttons.length)return;
  const holder=section.ownerDocument.createElement('div');holder.className='vh-cms-custom-buttons';holder.style.cssText='display:flex;flex-wrap:wrap;gap:10px;position:relative;min-height:60px;padding:12px';
  for(const b of buttons){const a=section.ownerDocument.createElement('a');a.textContent=String(b.label||'Кнопка');a.href=validLink(b.url)?b.url:'#';a.style.cssText='display:inline-flex;align-items:center;justify-content:center;min-height:40px;padding:9px 14px;max-width:100%;text-decoration:none;font:12px Arial,sans-serif;width:'+clamp(b.width,70,500,160)+'px;border:1px solid #b99b7c;background:'+(b.style==='light'?'#eee1ce':'#201811')+';color:'+(b.style==='light'?'#231b16':'#fff');if(b.x!=null&&b.y!=null){holder.style.minHeight='200px';a.style.position='absolute';a.style.left=clamp(b.x,0,100,50)+'%';a.style.top=clamp(b.y,0,100,50)+'%';a.style.transform='translate(-50%,-50%)'}else if(b.position==='center')a.style.margin='0 auto';else if(b.position==='right')a.style.marginLeft='auto';holder.append(a)}
  const copy=section.querySelector('.vh-cms-composition>.vh-cms-copy');(copy||section).append(holder);
 }
 function motion(section,animation,duration){installStyles(section.ownerDocument);if(!animation||animation==='system'){section.style.removeProperty('animation');section.removeAttribute('data-vh-motion');return;}const names={'fade-up':'vhUnifiedUp','fade-left':'vhUnifiedLeft','fade-right':'vhUnifiedRight',fade:'vhUnifiedFade',zoom:'vhUnifiedZoom'};if(animation==='none'){section.style.setProperty('animation','none','important');section.removeAttribute('data-vh-motion')}else if(names[animation]){section.style.removeProperty('animation');section.dataset.vhMotion=animation;section.style.setProperty('--vh-motion-name',names[animation]);section.style.setProperty('--vh-motion-duration',clamp(duration,200,1500,650)+'ms')}}
 window.VHCMSModel={version:2,applyLegacyText,mediaKey,photoCrop,applyMediaSettings,sourceTheme,imageSources,applyButtons,mappedValue,clean,fields,sections,sectionId,applyMapped,applyDesign,applyFieldStyles,photos,motion,validImage,validLink,resetLayout};
})();
