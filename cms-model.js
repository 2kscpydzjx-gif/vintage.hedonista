/* Shared field discovery and layout renderer for the editor and storefront.
   Existing revisions keep their keys. New layouts are explicitly versioned. */
(()=>{'use strict';
 const caches=new WeakMap(),layouts=new WeakMap(),originalStyles=new WeakMap();
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
   if(node.closest(dynamicSelector+',.vh-cms-composition,svg,script,style'))continue;
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
  const cached=caches.get(section);if(cached&&cached.every(f=>section.contains(f.el)||section===f.el))return cached;
  const result=[],used=new Map();
  const add=f=>{const kinds=used.get(f.el)||new Set();if(kinds.has(f.type))return;kinds.add(f.type);used.set(f.el,kinds);result.push(f)};
  for(const el of section.querySelectorAll('[id]')){
   const id=el.id;
   if((page==='about'&&/^about(?:Hero|Philosophy|Editorial|P[1-4]|Manifest|Origin|Final)/.test(id))||(page==='delivery'&&/^delivery(?:Kicker|Title|Intro|Shipping|Payment|Extra|Process|Step[1-3]|Returns|Refund|Cta)/.test(id))||(page==='contacts'&&/^contacts(?:Kicker|Title|Intro|List|Instagram|Telegram|Email|Phone|Help|Topics|Topic[1-3])/.test(id))||(page==='journal'&&/^journal(?:PageTitle|PageSubtitle|NewTitle|GuideTitle|GuideSubtitle|OtherTitle|CtaTitle|CtaText|CtaLink)$/.test(id))){
    add({el,id,type:id.endsWith('Image')||/^aboutEditorial[123]$/.test(id)?'image':el.tagName==='A'?'link':'text'});
   }
  }
  for(const selector of staticSelectors[page]||[])for(const [i,el] of [...section.querySelectorAll(selector)].entries())add({el,id:'static:'+selector+':'+i,type:el.matches('.capsule-hero-photo,#heroMain,#heroSide1,#heroSide2')?'image':el.tagName==='A'?'link':'text'});
  // Preserve the three legacy fallback field keys before adding all remaining fields.
  if(!result.length){const heading=section.querySelector('h1,h2,h3'),description=[...section.querySelectorAll('p')].find(el=>!el.closest(dynamicSelector));const media=photos(section)[0];if(media)add({el:media.node,id:'unified:image',type:'image',photo:media});if(heading&&!heading.closest(dynamicSelector))add({el:heading,id:'unified:title',type:'text'});if(description)add({el:description,id:'unified:description',type:'text'})}
  for(const el of section.querySelectorAll(textSelector)){
   if(el.closest(dynamicSelector+',.vh-cms-composition,.vh-cms-custom-buttons,button,select,svg,script,style,.placeholder,[aria-hidden="true"]'))continue;
   if(!el.textContent.trim())continue;
   if(el.tagName==='A'){add({el,id:'link:'+path(section,el),type:'link'});add({el,id:'label:'+path(section,el),type:'text'});continue}
   // A parent rich-text field owns its inline children, avoiding overlapping writes.
   if(result.some(f=>f.type==='text'&&f.el!==el&&f.el.contains(el)))continue;
   if(el.querySelector('h1,h2,h3,h4,p,ul,ol,a,input,select,button,img'))continue;
   add({el,id:'text:'+path(section,el),type:'text'});
  }
  for(const photo of photos(section)){
   if(result.some(f=>f.type==='image'&&(f.el===photo.node||f.el.contains(photo.node))))continue;
   add({el:photo.node,id:'media:'+path(section,photo.node)+':'+photo.kind,type:'image',photo});
  }
  caches.set(section,result);return result;
 }
 function setImage(f,value){
  if(value!=='__removed__'&&!validImage(value))return;
  const node=f.el,removed=value==='__removed__',kind=f.photo?.kind||(node.tagName==='IMG'?'img':node.tagName==='VIDEO'?'poster':'bg');
  if(kind==='img'){if(removed)node.style.visibility='hidden';else{node.src=value;node.removeAttribute('srcset');node.removeAttribute('sizes');node.style.removeProperty('visibility')}}
  else if(kind==='poster'){if(removed)node.removeAttribute('poster');else node.poster=value}
  else if(kind==='bg'){node.style.setProperty('background-image',removed?'none':'url('+JSON.stringify(value)+')','important');node.querySelectorAll('img').forEach(img=>img.style.display='none')}
  else{const key='vh-photo-'+f.id.replace(/[^a-z0-9]/gi,'-');node.setAttribute('data-'+key,'');let css=node.ownerDocument.getElementById(key);if(!css){css=node.ownerDocument.createElement('style');css.id=key;node.ownerDocument.head.append(css)}css.textContent='[data-'+key+']'+kind+'{background-image:'+(removed?'none':'url('+JSON.stringify(value)+')')+'!important}'}
 }
 function mappedValue(f,mapped){if(Object.prototype.hasOwnProperty.call(mapped||{},f.id))return mapped[f.id];const aliases=f.el.id?['static:#'+f.el.id+':0',f.el.id]:[];for(const id of aliases)if(Object.prototype.hasOwnProperty.call(mapped||{},id))return mapped[id];return undefined}
 function applyMapped(section,mapped,page){for(const f of fields(section,page)){const value=mappedValue(f,mapped);if(typeof value!=='string')continue;if(f.type==='text'){const html=clean(value,section.ownerDocument);if(f.el.innerHTML!==html)f.el.innerHTML=html}else if(f.type==='link'){if(value===''||validLink(value))f.el.setAttribute('href',value)}else setImage(f,value)}}
 function installStyles(doc){
  if(doc.getElementById('vh-cms-model-css'))return;
  const style=doc.createElement('style');style.id='vh-cms-model-css';style.textContent=`
  [data-vh-studio-selected]{outline:2px solid #b9936c!important;outline-offset:-2px}
  [data-vh-layout]{display:block!important;position:relative!important;height:auto!important;max-height:none!important;min-height:0!important;padding:0!important;overflow:visible!important;background:none!important}
  [data-vh-layout]>:not(.vh-cms-composition){display:none!important}
  .vh-cms-composition{display:grid!important;grid-template-columns:var(--vh-photo-width,50%) minmax(0,1fr)!important;min-height:var(--vh-layout-height,320px)!important;background:var(--vh-layout-bg,#211812)!important;color:var(--vh-layout-color,#f2e5d5)!important;overflow:hidden!important;isolation:isolate;position:relative;gap:0;width:100%;box-sizing:border-box}
  .vh-cms-composition *{box-sizing:border-box}
  .vh-cms-composition>.vh-cms-copy{grid-column:2;grid-row:1;display:flex;flex-direction:column;justify-content:var(--vh-text-position,center);padding:clamp(24px,5vw,72px);min-width:0;text-align:var(--vh-text-align,left)}
  .vh-cms-composition>.vh-cms-copy>*{color:inherit;max-width:100%;overflow-wrap:anywhere}
  .vh-cms-composition>.vh-cms-copy h1,.vh-cms-composition>.vh-cms-copy h2{font-family:'Bodoni Moda',Georgia,serif;font-weight:400;font-size:var(--vh-heading-size,clamp(28px,4vw,58px));line-height:1.15;margin:0 0 20px}
  .vh-cms-composition>.vh-cms-copy p{font-family:Montserrat,Arial,sans-serif;font-size:var(--vh-body-size,16px);line-height:1.7}
  .vh-cms-composition>.vh-cms-photo{position:relative;grid-row:1;grid-column:1;overflow:hidden;min-width:0;min-height:var(--vh-layout-height,320px);background:#493328}
  .vh-cms-composition>.vh-cms-photo>img{display:block!important;width:100%!important;height:100%!important;position:absolute;inset:0;max-width:none!important;object-fit:var(--vh-fit,cover)!important;object-position:var(--vh-x,50%) var(--vh-y,50%)!important;transform:scale(var(--vh-zoom,1));transform-origin:var(--vh-x,50%) var(--vh-y,50%)}
  [data-vh-layout=wide]>.vh-cms-composition{grid-template-columns:var(--vh-photo-width,65%) minmax(0,1fr)!important}
  .vh-cms-photo:first-child>img{object-fit:var(--vh-fit-desktop,var(--vh-fit))!important;object-position:var(--vh-x-desktop,var(--vh-x)) var(--vh-y-desktop,var(--vh-y))!important;transform:scale(var(--vh-zoom-desktop,var(--vh-zoom)))}
  @media(min-width:761px) and (max-width:1024px){.vh-cms-photo:first-child>img{object-fit:var(--vh-fit-tablet,var(--vh-fit))!important;object-position:var(--vh-x-tablet,var(--vh-x)) var(--vh-y-tablet,var(--vh-y))!important;transform:scale(var(--vh-zoom-tablet,var(--vh-zoom)))}}
  @media(max-width:760px){.vh-cms-photo:first-child>img{object-fit:var(--vh-fit-mobile,var(--vh-fit))!important;object-position:var(--vh-x-mobile,var(--vh-x)) var(--vh-y-mobile,var(--vh-y))!important;transform:scale(var(--vh-zoom-mobile,var(--vh-zoom)))}}
  [data-vh-layout=right]>.vh-cms-composition{grid-template-columns:minmax(0,1fr) var(--vh-photo-width,50%)!important}
  [data-vh-layout=right]>.vh-cms-composition>.vh-cms-copy{grid-column:1}
  [data-vh-layout=right]>.vh-cms-composition>.vh-cms-photo{grid-column:2}
  [data-vh-layout=stacked]>.vh-cms-composition,[data-vh-layout=text-top]>.vh-cms-composition,[data-vh-layout=text-only]>.vh-cms-composition{grid-template-columns:minmax(0,1fr)!important}
  [data-vh-layout=stacked]>.vh-cms-composition>.vh-cms-copy{grid-column:1;grid-row:2}
  [data-vh-layout=text-top]>.vh-cms-composition>.vh-cms-copy{grid-column:1;grid-row:1}
  [data-vh-layout=text-top]>.vh-cms-composition>.vh-cms-photo{grid-row:2}
  [data-vh-layout=text-only]>.vh-cms-composition>.vh-cms-copy{grid-column:1;grid-row:1}
  [data-vh-layout=framed]>.vh-cms-composition{grid-template-columns:calc(var(--vh-photo-width,50%)/2) minmax(0,1fr) calc(var(--vh-photo-width,50%)/2)!important}
  [data-vh-layout=framed]>.vh-cms-composition>.vh-cms-photo:nth-of-type(2){grid-column:3}
  [data-vh-layout=three-photos]>.vh-cms-composition{grid-template-columns:2fr 1fr!important;grid-template-rows:220px 220px auto!important;gap:8px}
  [data-vh-layout=three-photos]>.vh-cms-composition>.vh-cms-photo{min-height:0;grid-column:1;grid-row:1/3}
  [data-vh-layout=three-photos]>.vh-cms-composition>.vh-cms-photo:nth-of-type(2){grid-column:2;grid-row:1}
  [data-vh-layout=three-photos]>.vh-cms-composition>.vh-cms-photo:nth-of-type(3){grid-column:2;grid-row:2}
  [data-vh-layout=three-photos]>.vh-cms-composition>.vh-cms-copy{grid-column:1/-1;grid-row:3}
  [data-vh-layout=gradient-hero]>.vh-cms-composition{display:block!important;min-height:max(420px,var(--vh-layout-height,420px))!important}
  [data-vh-layout=gradient-hero]>.vh-cms-composition>.vh-cms-photo{position:absolute;inset:0;width:100%;height:100%}
  [data-vh-layout=gradient-hero]>.vh-cms-composition>.vh-cms-photo:after{content:'';position:absolute;inset:0;background:linear-gradient(90deg,rgba(12,8,6,.92),rgba(12,8,6,.5) 55%,transparent)}
  [data-vh-layout=gradient-hero]>.vh-cms-composition>.vh-cms-copy{position:relative;z-index:1;min-height:inherit;width:min(760px,75%)}
  @media(max-width:760px){.vh-cms-composition{grid-template-columns:minmax(0,1fr)!important}.vh-cms-composition>.vh-cms-copy{grid-column:1!important;grid-row:2}.vh-cms-composition>.vh-cms-photo{grid-column:1!important;grid-row:1;min-height:280px}.vh-cms-composition>.vh-cms-copy{padding:28px 22px}[data-vh-layout=right]>.vh-cms-composition{grid-template-columns:1fr!important}[data-vh-layout=gradient-hero]>.vh-cms-composition>.vh-cms-copy{width:100%}[data-vh-layout=text-top]>.vh-cms-composition>.vh-cms-copy{grid-row:1}[data-vh-layout=text-top]>.vh-cms-composition>.vh-cms-photo{grid-row:2}[data-vh-layout=framed]>.vh-cms-composition{grid-template-columns:1fr 1fr!important}[data-vh-layout=framed]>.vh-cms-composition>.vh-cms-photo:nth-of-type(2){grid-column:2!important}[data-vh-layout=framed]>.vh-cms-composition>.vh-cms-copy{grid-column:1/-1!important;grid-row:2}[data-vh-layout=three-photos]>.vh-cms-composition{grid-template-columns:1fr 1fr!important;grid-template-rows:220px 130px auto!important}[data-vh-layout=three-photos]>.vh-cms-composition>.vh-cms-photo{min-height:0;grid-row:1!important;grid-column:1/-1!important}[data-vh-layout=three-photos]>.vh-cms-composition>.vh-cms-photo:nth-of-type(2){grid-row:2!important;grid-column:1!important}[data-vh-layout=three-photos]>.vh-cms-composition>.vh-cms-photo:nth-of-type(3){grid-row:2!important;grid-column:2!important}[data-vh-layout=three-photos]>.vh-cms-composition>.vh-cms-copy{grid-row:3!important}}
  @media(max-width:760px){
  [data-vh-mobile-order=text-first]:is([data-vh-layout=left],[data-vh-layout=right],[data-vh-layout=wide],[data-vh-layout=stacked],[data-vh-layout=text-top])>.vh-cms-composition>.vh-cms-copy{grid-row:1!important}
  [data-vh-mobile-order=text-first]:is([data-vh-layout=left],[data-vh-layout=right],[data-vh-layout=wide],[data-vh-layout=stacked],[data-vh-layout=text-top])>.vh-cms-composition>.vh-cms-photo{grid-row:2!important}
  [data-vh-mobile-order=photo-first]:is([data-vh-layout=left],[data-vh-layout=right],[data-vh-layout=wide],[data-vh-layout=stacked],[data-vh-layout=text-top])>.vh-cms-composition>.vh-cms-copy{grid-row:2!important}
  [data-vh-mobile-order=photo-first]:is([data-vh-layout=left],[data-vh-layout=right],[data-vh-layout=wide],[data-vh-layout=stacked],[data-vh-layout=text-top])>.vh-cms-composition>.vh-cms-photo{grid-row:1!important}
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
 function resetLayout(section){const state=layouts.get(section);if(!state)return;for(const {node,anchor} of state.collections){if(anchor.isConnected)anchor.replaceWith(node)}for(const item of state.hidden){if(item.value)item.node.style.setProperty('display',item.value,item.priority);else item.node.style.removeProperty('display')}state.root.remove();section.removeAttribute('data-vh-layout');layouts.delete(section)}
 function applyFieldStyles(section,styles,page){for(const f of fields(section,page)){const d=styles?.[f.id];if(!d||f.type!=='text')continue;const node=f.el;if(d.size!=null)node.style.setProperty('font-size',clamp(d.size,8,140,16)+'px','important');if(['left','center','right'].includes(d.align))node.style.setProperty('text-align',d.align,'important');if(/^#[a-f0-9]{6}$/i.test(d.color||''))node.style.setProperty('color',d.color,'important');if(d.lineHeight!=null)node.style.setProperty('line-height',clamp(d.lineHeight,.8,3,1.6),'important');if(d.weight)node.style.setProperty('font-weight',clamp(d.weight,100,900,400),'important')}}
 function imageSources(section,edit={},page){const doc=section.ownerDocument,imageFields=fields(section,page).filter(f=>f.type==='image');
  const urls=imageFields.map(f=>{const value=mappedValue(f,edit.mapped);return value==='__removed__'?'':value||f.el.getAttribute('src')||f.photo?.url||f.el.querySelector('img')?.src||doc.defaultView.getComputedStyle(f.el).backgroundImage.match(/url\(["']?(.+?)["']?\)/)?.[1]||''});
  if(typeof edit.templateImage==='string')urls[0]=edit.templateImage==='__removed__'?'':edit.templateImage;
  if(typeof edit.capsuleImage==='string')urls[0]=edit.capsuleImage==='__removed__'?'':edit.capsuleImage;
  if(edit.capsuleSecondImage)urls[1]=edit.capsuleSecondImage;
  for(const [i,value] of Object.entries(edit.layoutImages||{}))urls[Number(i)]=value;
  return urls;
 }
 function applyDesign(section,d,page,edit={}){
  if(d?.layoutVersion!==1)return;
  if(page==='catalog'&&section.querySelector('.catalog-heading')){applyMapped(section,edit.mapped,page);applyDesign(section.querySelector('.catalog-heading'),d,page,edit);applyFieldStyles(section,edit.fieldStyles,page);return;}

  installStyles(section.ownerDocument);resetLayout(section);
  applyMapped(section,edit.mapped,page);
  for(const [key,selector,legacyKey] of [['title','h1,h2,h3','unified:title'],['description','p','unified:description']]){if(typeof edit[key]!=='string')continue;const node=section.querySelector(selector);if(!node)continue;const mapped=fields(section,page).some(f=>f.el===node&&f.type==='text'&&mappedValue(f,edit.mapped)!==undefined);if(mapped||Object.prototype.hasOwnProperty.call(edit.mapped||{},legacyKey))continue;if(key==='title')node.textContent=edit[key];else node.innerHTML=clean(edit[key],section.ownerDocument);}

  if(!originalStyles.has(section)){if(edit.hidden){const previous=section.style.display;section.style.removeProperty('display');originalStyles.set(section,section.getAttribute('style'));section.style.display=previous}else originalStyles.set(section,section.getAttribute('style'));}
  const original=originalStyles.get(section);if(original===null)section.removeAttribute('style');else section.setAttribute('style',original);
  if(edit.hidden){section.style.display='none';return}
  const doc=section.ownerDocument,all=fields(section,page),preset=d.photoPreset||'original';
  const tone={light:'#f2e5d5',gold:'#b7956d',dark:'#211a15'}[d.textTone];
  const props={'--vh-photo-width':clamp(d.photoWidth,25,75,50)+'%','--vh-layout-height':clamp(d.minHeight,120,1000,320)+'px','--vh-layout-bg':d.backgroundMode==='transparent'?'transparent':'#211812','--vh-layout-color':tone||'#f2e5d5','--vh-text-align':['left','center','right'].includes(d.align)?d.align:'left','--vh-text-position':{top:'flex-start',center:'center',bottom:'flex-end'}[d.textPosition]||'center'};
  if(d.headingSize!=null)props['--vh-heading-size']=clamp(d.headingSize,16,120,40)+'px';if(d.bodySize!=null)props['--vh-body-size']=clamp(d.bodySize,10,48,16)+'px';
  for(const [key,value] of Object.entries(props))section.style.setProperty(key,value);
  for(const key of ['marginTop','marginBottom'])if(d[key]!=null)section.style.setProperty(key==='marginTop'?'margin-top':'margin-bottom',clamp(d[key],0,160,28)+'px','important');
  for(const f of all.filter(f=>f.type==='text')){if(d.align)f.el.style.setProperty('text-align',d.align,'important');const size=f.el.matches('h1,h2,h3,h4,h5,h6')?d.headingSize:d.bodySize;if(size!=null)f.el.style.setProperty('font-size',clamp(size,8,140,16)+'px','important');if(tone)f.el.style.setProperty('color',tone,'important');if(d.letterSpacing!=null)f.el.style.setProperty('letter-spacing',clamp(d.letterSpacing,-1,8,0)+'px','important')}
  applyFieldStyles(section,edit.fieldStyles,page);
  if(preset==='original'){for(const [i,url] of Object.entries(edit.layoutImages||{})){const f=all.filter(f=>f.type==='image')[Number(i)];if(f&&(validImage(url)||url==='__removed__'))setImage(f,url)}applyButtons(section,edit.customButtons);return;}
  const root=doc.createElement('div');root.className='vh-cms-composition';
  const imageFields=all.filter(f=>f.type==='image');
  const urls=imageSources(section,edit,page);
  const count=preset==='text-only'?0:preset==='framed'?2:preset==='three-photos'?3:1;
  for(let i=0;i<count;i++){const photo=doc.createElement('div');photo.className='vh-cms-photo';const image=doc.createElement('img');image.alt=imageFields[i]?.el.getAttribute('alt')||'';if(validImage(urls[i]))image.src=urls[i];else image.alt='Додайте фотографію';const crop={fit:d.photoFit||'cover',x:d.photoX??50,y:d.photoY??50,zoom:100,...d['crop'+i],...edit.mediaCrop?.[imageFields[i]?.id]};for(const [key,value] of Object.entries({'--vh-fit':crop.fit==='contain'?'contain':'cover','--vh-x':clamp(crop.x,0,100,50)+'%','--vh-y':clamp(crop.y,0,100,50)+'%','--vh-zoom':clamp(crop.zoom,crop.fit==='contain'?50:100,200,100)/100}))photo.style.setProperty(key,value);if(i===0)for(const device of ['desktop','tablet','mobile']){const c={...crop,...d.cropDevices?.[device]};for(const [key,value] of Object.entries({fit:c.fit==='contain'?'contain':'cover',x:clamp(c.x,0,100,50)+'%',y:clamp(c.y,0,100,50)+'%',zoom:clamp(c.zoom,c.fit==='contain'?50:100,200,100)/100}))photo.style.setProperty('--vh-'+key+'-'+device,value)}photo.append(image);root.append(photo)}
  const copy=doc.createElement('div');copy.className='vh-cms-copy';
  for(const f of all.filter(f=>f.type==='text'&&!all.some(other=>other.type==='text'&&other.el!==f.el&&other.el.contains(f.el))).sort((a,b)=>a.el.compareDocumentPosition(b.el)&4?-1:1)){const node=f.el.cloneNode(true);node.removeAttribute('id');node.removeAttribute('hidden');node.querySelectorAll('[id]').forEach(n=>n.removeAttribute('id'));if(node.tagName==='A'){const link=all.find(x=>x.el===f.el&&x.type==='link');if(link){const href=edit.mapped?.[link.id]??f.el.getAttribute('href');if(validLink(href))node.setAttribute('href',href)}}copy.append(node)}
  if(!copy.children.length){const p=doc.createElement('p');p.textContent='';copy.append(p)}root.append(copy);
  const hidden=[...section.children].map(node=>({node,value:node.style.getPropertyValue('display'),priority:node.style.getPropertyPriority('display')}));for(const item of hidden)item.node.style.setProperty('display','none','important');section.style.setProperty('display','block','important');section.style.setProperty('min-height','0','important');section.style.setProperty('height','auto','important');section.style.setProperty('max-height','none','important');section.style.setProperty('padding','0','important');section.dataset.vhMobileOrder=d.mobileOrder||'layout';section.dataset.vhLayout=preset;section.append(root);layouts.set(section,{root,collections:[],hidden});
  // Keep live catalog/slider nodes and their handlers in place, outside the new static composition.
  const collections=[...section.querySelectorAll(dynamicSelector)].filter(el=>!el.closest('.vh-cms-composition'));
  if(collections.length){const group=doc.createElement('div');group.className='vh-cms-collections';group.style.gridColumn='1 / -1';for(const node of collections){const item=hidden.find(item=>item.node===node);if(item){if(item.value)node.style.setProperty('display',item.value,item.priority);else node.style.removeProperty('display')}const anchor=doc.createComment('CMS collection');node.before(anchor);group.append(node);layouts.get(section).collections.push({node,anchor})}root.append(group)}applyButtons(section,edit.customButtons);
 }
 function applyButtons(section,buttons){
  section.querySelectorAll('.vh-cms-custom-buttons').forEach(node=>node.remove());if(!Array.isArray(buttons)||!buttons.length)return;
  const holder=section.ownerDocument.createElement('div');holder.className='vh-cms-custom-buttons';holder.style.cssText='display:flex;flex-wrap:wrap;gap:10px;position:relative;min-height:60px;padding:12px';
  for(const b of buttons){const a=section.ownerDocument.createElement('a');a.textContent=String(b.label||'Кнопка');a.href=validLink(b.url)?b.url:'#';a.style.cssText='display:inline-flex;align-items:center;justify-content:center;min-height:40px;padding:9px 14px;max-width:100%;text-decoration:none;font:12px Arial,sans-serif;width:'+clamp(b.width,70,500,160)+'px;border:1px solid #b99b7c;background:'+(b.style==='light'?'#eee1ce':'#201811')+';color:'+(b.style==='light'?'#231b16':'#fff');if(b.x!=null&&b.y!=null){holder.style.minHeight='200px';a.style.position='absolute';a.style.left=clamp(b.x,0,100,50)+'%';a.style.top=clamp(b.y,0,100,50)+'%';a.style.transform='translate(-50%,-50%)'}else if(b.position==='center')a.style.margin='0 auto';else if(b.position==='right')a.style.marginLeft='auto';holder.append(a)}
  const copy=section.querySelector('.vh-cms-composition>.vh-cms-copy');(copy||section).append(holder);
 }
 function motion(section,animation,duration){installStyles(section.ownerDocument);if(!animation||animation==='system'){section.style.removeProperty('animation');section.removeAttribute('data-vh-motion');return;}const names={'fade-up':'vhUnifiedUp','fade-left':'vhUnifiedLeft','fade-right':'vhUnifiedRight',fade:'vhUnifiedFade',zoom:'vhUnifiedZoom'};if(animation==='none'){section.style.setProperty('animation','none','important');section.removeAttribute('data-vh-motion')}else if(names[animation]){section.style.removeProperty('animation');section.dataset.vhMotion=animation;section.style.setProperty('--vh-motion-name',names[animation]);section.style.setProperty('--vh-motion-duration',clamp(duration,200,1500,650)+'ms')}}
 window.VHCMSModel={imageSources,applyButtons,mappedValue,clean,fields,sections,sectionId,applyMapped,applyDesign,applyFieldStyles,photos,motion,validImage,validLink,resetLayout};
})();
