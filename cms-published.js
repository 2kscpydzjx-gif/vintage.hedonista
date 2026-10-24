(async()=>{'use strict';
// Cached HTML from before the shared model was introduced can still load this runtime.
if(!window.VHCMSModel){
 const source=document.currentScript?.src||document.baseURI;
 try{await new Promise((resolve,reject)=>{const script=document.createElement('script');script.src=new URL('cms-model.js?v=1',source).href;script.onload=resolve;script.onerror=reject;document.head.append(script)});}
 catch(error){console.warn('CMS model could not load',error);document.documentElement.classList.remove('vh-cms-booting');return;}
}

const map={'index.html':'home','catalog.html':'catalog','capsule.html':'capsules','about.html':'about','journal.html':'journal','delivery.html':'delivery','contacts.html':'contacts'};
const isCatalogSeoSnapshot=/\/seo-(?:category|subcategory)\//.test(location.pathname)&&!!document.querySelector('meta[name="vh-static-canonical"]');
const page=isCatalogSeoSnapshot?'catalog':map[location.pathname.split('/').pop()||'index.html'];if(!page)return;
const isEditorPreview=window.parent!==window&&new URLSearchParams(location.search).get('cms-preview')==='1';
const config=window.VH_CONFIG;if(!config||!window.supabase){document.documentElement.classList.remove('vh-cms-booting');return;}
const db=window.supabase.createClient(config.supabaseUrl,config.supabaseKey);
const safeHtml=html=>window.VHCMSModel.clean(html);
function fields(section){return window.VHCMSModel.fields(section,page)}
function sections(){return window.VHCMSModel.sections(document,page)}
function cmsApplyExistingLayout(el,d,mediaValue){
 if(!el||!d)return;
 const preset=d.photoPreset||'left',enabled=preset==='gradient-hero';
 el.classList.toggle('vh-existing-gradient-hero',enabled);
 el.classList.toggle('vh-existing-two-photo',preset==='framed');
 const doc=el.ownerDocument;
 let css=doc.getElementById('vh-existing-presets-css');
 if(!css){css=doc.createElement('style');css.id='vh-existing-presets-css';doc.head.append(css)}
 css.textContent=`
 .vh-existing-gradient-hero{position:relative!important;display:flex!important;align-items:center!important;justify-content:flex-start!important;isolation:isolate!important;min-height:clamp(420px,50vw,700px)!important;overflow:hidden!important;background:#211812!important;background-image:none!important}
 .vh-existing-gradient-hero>.vh-cms-gradient-layer{position:absolute!important;inset:0!important;width:100%!important;height:100%!important;z-index:0!important;pointer-events:none!important;background-size:cover!important;background-position:center!important}
 .vh-existing-gradient-hero>:not(.vh-cms-gradient-layer){z-index:1}
 .vh-existing-gradient-hero :is(h1,h2,h3,p,.eyebrow){color:#f5eadc!important}
 .vh-existing-gradient-hero.hero{height:auto!important;min-height:clamp(420px,50vw,700px)!important;overflow:hidden!important}
 .vh-existing-gradient-hero.hero>.hero-grid{display:flex!important;flex-direction:column!important;justify-content:center!important;position:relative!important;width:100%!important;max-width:none!important;min-height:inherit!important;height:auto!important;padding:0!important;margin:0!important;grid-template-columns:none!important;background:transparent!important}
 .vh-existing-gradient-hero.hero .hero-copy{position:relative!important;z-index:3!important;display:flex!important;flex-direction:column!important;justify-content:center!important;align-items:flex-start!important;width:min(660px,65%)!important;max-width:660px!important;min-height:inherit!important;height:auto!important;margin:0!important;padding:clamp(30px,5vw,80px)!important;background:transparent!important;background-image:none!important;box-shadow:none!important}
 .vh-existing-gradient-hero.hero .hero-media{display:none!important}
 .vh-existing-gradient-hero.hero .hero-grid:before,.vh-existing-gradient-hero.hero .hero-grid:after,.vh-existing-gradient-hero.hero .hero-copy:before,.vh-existing-gradient-hero.hero .hero-copy:after{content:none!important;display:none!important}
 .vh-existing-gradient-hero.editorial{display:flex!important;flex-direction:row!important;align-items:center!important}
 .vh-existing-gradient-hero.editorial>.editorial-media{display:none!important}
 .vh-existing-gradient-hero.editorial>.editorial-copy{position:relative!important;z-index:3!important;width:min(660px,65%)!important;max-width:660px!important;min-height:0!important;margin:0!important;padding:clamp(30px,5vw,80px)!important;background:transparent!important;background-image:none!important;box-shadow:none!important}
 .vh-existing-gradient-hero :is(.hero-copy,.editorial-copy,.section-copy,.text-panel,.copy-panel){background:transparent!important;background-image:none!important;box-shadow:none!important}
 @media(max-width:760px){.vh-existing-gradient-hero.hero .hero-copy,.vh-existing-gradient-hero.editorial>.editorial-copy{width:100%!important;max-width:none!important;min-height:440px!important;padding:30px!important}}
 `;
 let layer=Array.from(el.children).find(n=>n.classList.contains('vh-cms-gradient-layer'));
 if(!enabled){layer?.remove();return}
 if(!layer){layer=doc.createElement('div');layer.className='vh-cms-gradient-layer';layer.setAttribute('aria-hidden','true');el.prepend(layer)}
 // Only use the photo assigned to THIS layout. Never inherit stale native hero slots.
 const raw=typeof mediaValue==='string'?mediaValue.trim():'';
 const url=raw&&raw!=='__removed__'&&['https://','http://','/','./','../'].some(prefix=>raw.startsWith(prefix))?raw:'';
 const image=url?'url('+JSON.stringify(url)+')':'none';
 // Keep the image on a real CSS background layer, independent of storefront image nodes.
 layer.style.setProperty('background-image',url?'linear-gradient(90deg,rgba(12,8,6,.90),rgba(12,8,6,.65) 38%,rgba(12,8,6,.10)),'+image:'none','important');
 layer.dataset.cmsImage=url?'set':'empty';
 if(url){
  const test=new Image();
  test.onerror=()=>{console.warn('[Vintage CMS] Banner photo failed to load:',url);layer.dataset.cmsImage='error'};
  test.src=new URL(url,doc.baseURI).href;
 }
}
function resolvePublishedBannerImage(e,el){
 // The published legacy CMS stores the banner image at images.image0.
 // A dedicated templateImage overrides it, including intentional removal.
 if(typeof e.templateImage==='string')return e.templateImage;
 if(e.design?.photoPreset!=='gradient-hero')return '';
 const first=e.images?.image0;
 if(typeof first==='string')return first;
 const mapped=e.mapped||{};
 const hero=el.querySelector('#heroMain,#homeCapsulesMedia,.editorial-media,.hero-main');
 const field=fields(el).find(f=>f.type==='image'&&(f.el===hero||hero?.contains(f.el)));
 const candidates=[field?.id,...Object.keys(mapped).filter(k=>/hero.?main|capsules.?media|editorial.?media/i.test(k))];
 for(const key of candidates){const value=mapped[key];if(typeof value==='string'&&value&&value!=='__removed__')return value}
 return '';
}
function applyPublishedHeroMotion(el,e){
 if(!el||e?.design?.photoPreset!=='gradient-hero')return;
 const mode=e.animation||'system';
 let st=document.getElementById('vh-published-hero-motion-css');
 if(!st){st=document.createElement('style');st.id='vh-published-hero-motion-css';st.textContent=`
 @keyframes vhHeroReveal{from{opacity:0;transform:translateY(22px)}to{opacity:1;transform:translateY(0)}}
 @keyframes vhHeroPhotoReveal{from{opacity:.45;transform:scale(1.045)}to{opacity:1;transform:scale(1)}}
 .vh-existing-gradient-hero.vh-hero-animate :is(.hero-copy,.editorial-copy){animation:vhHeroReveal .85s ease-out both!important}
 .vh-existing-gradient-hero.vh-hero-animate>.vh-cms-gradient-layer{animation:vhHeroPhotoReveal 1.3s ease-out both!important}
 @media(prefers-reduced-motion:reduce){.vh-existing-gradient-hero.vh-hero-animate :is(.hero-copy,.editorial-copy),.vh-existing-gradient-hero.vh-hero-animate>.vh-cms-gradient-layer{animation:none!important}}
 `;document.head.append(st)}
 el.classList.toggle('vh-hero-animate',mode!=='none');
}
function cmsApplyPublishedImages(section,images){
 if(!images||typeof images!=='object')return;
 let index=0;
 const match=x=>String(x||'').match(/url\(\s*['"]?([^'"\)]+)['"]?\s*\)/)?.[1]||'';
 const nodes=[section,...section.querySelectorAll('*')].slice(0,900);
 for(const node of nodes){
  const entries=[];
  if(node.tagName==='IMG')entries.push(['img',node.getAttribute('src')]);
  if(node.tagName==='VIDEO')entries.push(['poster',node.getAttribute('poster')]);
  entries.push(['bg',match(getComputedStyle(node).backgroundImage)]);
  for(const pseudo of ['::before','::after'])try{entries.push([pseudo,match(getComputedStyle(node,pseudo).backgroundImage)])}catch{}
  for(const [kind,url] of entries){
   if(!url||url==='none'||url.startsWith('data:'))continue;
   const value=images['image'+index++];
   if(typeof value==='string'){
    if(kind==='img'){
     if(value==='__removed__')node.style.visibility='hidden';
     else{node.src=value;node.removeAttribute('srcset');node.style.removeProperty('visibility')}
    }else if(kind==='poster'){
     if(value==='__removed__')node.removeAttribute('poster');else node.poster=value;
    }else if(kind==='bg'){
     node.style.setProperty('background-image',value==='__removed__'?'none':'url('+JSON.stringify(value)+')','important');
    }else{
     const attr='data-vh-cms-photo-'+(index-1);
     node.setAttribute(attr,'');
     let style=document.getElementById('vh-cms-pseudo-'+(index-1)+'-'+(section.dataset.vhCmsIndex||'0'));
     if(!style){style=document.createElement('style');style.id='vh-cms-pseudo-'+(index-1)+'-'+(section.dataset.vhCmsIndex||'0');document.head.append(style)}
     style.textContent='['+attr+']'+kind+'{background-image:'+(value==='__removed__'?'none':'url('+JSON.stringify(value)+')')+'!important}';
    }
   }
   if(index>=40)return;
  }
 }
}
function cmsApplyPublishedAnimation(section,animation){
 const names=['none','fade-up','fade-left','fade-right','fade','zoom'];
 for(const name of names)section.classList.remove('cms-animation-'+name);
 if(names.includes(animation))section.classList.add('cms-animation-'+animation);
 let css=document.getElementById('vh-cms-public-animation-css');
 if(!css){css=document.createElement('style');css.id='vh-cms-public-animation-css';css.textContent=`
 @keyframes vhCmsUp{from{opacity:0;transform:translateY(24px)}to{opacity:1;transform:none}}
 @keyframes vhCmsLeft{from{opacity:0;transform:translateX(-24px)}to{opacity:1;transform:none}}
 @keyframes vhCmsRight{from{opacity:0;transform:translateX(24px)}to{opacity:1;transform:none}}
 @keyframes vhCmsFade{from{opacity:0}to{opacity:1}}
 @keyframes vhCmsZoom{from{opacity:0;transform:scale(.96)}to{opacity:1;transform:none}}
 .cms-animation-fade-up{animation:vhCmsUp .7s both!important}
 .cms-animation-fade-left{animation:vhCmsLeft .7s both!important}
 .cms-animation-fade-right{animation:vhCmsRight .7s both!important}
 .cms-animation-fade{animation:vhCmsFade .7s both!important}
 .cms-animation-zoom{animation:vhCmsZoom .7s both!important}
 .cms-animation-none{animation:none!important;opacity:1!important;transform:none!important}
 @media(prefers-reduced-motion:reduce){.cms-animation-fade-up,.cms-animation-fade-left,.cms-animation-fade-right,.cms-animation-fade,.cms-animation-zoom{animation:none!important}}
 `;document.head.append(css)}
}
function apply(d){const original=sections(),edits=d.shared?.cmsPageDraft?.existing||{};const publishedOrder=d.shared?.cmsPageDraft?.order;if(page==='about'&&Array.isArray(publishedOrder)&&publishedOrder.length){original.forEach((el,i)=>{if(!publishedOrder.includes(window.VHCMSModel.sectionId(el,i)))el.style.display='none'})}original.forEach((el,i)=>{const e=edits[window.VHCMSModel.sectionId(el,i)];if(!e)return;if(e.design?.layoutVersion===1){window.VHCMSModel.applyMapped(el,e.mapped,page);window.VHCMSModel.applyDesign(el,e.design,page,e);window.VHCMSModel.motion(el,e.animation,e.duration);return;}el.dataset.vhCmsIndex=String(i);window.VHCMSModel.applyMapped(el,e.mapped,page);window.VHCMSModel.applyFieldStyles(el,e.fieldStyles,page);if(e.images&&e.design?.photoPreset!=='gradient-hero')cmsApplyPublishedImages(el,e.images);cmsApplyPublishedAnimation(el,e.animation);if(e.hidden)el.style.display='none';for(const f of fields(el)){const v=e.mapped?.[f.id];if(typeof v!=='string')continue;if(f.type==='text')f.el.innerHTML=safeHtml(v);else if(f.type==='link'&&/^(https?:|mailto:|tel:|\/|#)/i.test(v))f.el.setAttribute('href',v);else if(f.type==='image'){if(v==='__removed__'){f.el.style.backgroundImage='none';f.el.querySelectorAll('img').forEach(img=>img.style.display='none')}else if(/^(https?:|\/|\.\/|\.\.\/|data:image\/)/i.test(v)){f.el.style.backgroundImage='url('+JSON.stringify(v)+')';f.el.style.backgroundSize='cover';f.el.querySelectorAll('img').forEach(img=>img.style.display='none')}}}if(page==='home'&&el.matches('.homepage-capsules')){
 const media=el.querySelector('#homeCapsulesMedia');
 if(media&&typeof e.capsuleImage==='string'){
  if(e.capsuleImage==='__removed__')media.replaceChildren();
  else if(['https://','http://','/','./','../'].some(prefix=>e.capsuleImage.startsWith(prefix))){
   const img=document.createElement('img');img.src=e.capsuleImage;img.alt='Фото капсул';img.loading='eager';img.style.cssText='width:100%;height:100%;object-fit:cover;display:block';media.replaceChildren(img);
  }
 }
}
if(e.design&&typeof e.design==='object'){const design=e.design;
 const bounded=(value,min,max)=>value!==undefined&&value!==null&&value!==''&&Number.isFinite(Number(value))?Math.max(min,Math.min(max,Number(value))):null;
 const headingSize=bounded(design.headingSize,16,96),bodySize=bounded(design.bodySize,12,32),tracking=bounded(design.letterSpacing,-1,5);
 const textRoot=el.querySelector('.copy,.editorial-copy,.vh-lab-copy,.hero-copy')||el;
 if(design.align&&['left','center','right'].includes(design.align))textRoot.style.setProperty('text-align',design.align,'important');
 for(const heading of textRoot.querySelectorAll('h1,h2,h3,h4'))if(headingSize!==null)heading.style.setProperty('font-size',headingSize+'px','important');
 for(const copy of textRoot.querySelectorAll('p,.vh-rte-content,.vh-lab-copy > div,.copy > div'))if(bodySize!==null)copy.style.setProperty('font-size',bodySize+'px','important');
 if(tracking!==null)for(const item of textRoot.querySelectorAll('h1,h2,h3,h4,p,.vh-lab-copy > div,.copy > div'))item.style.setProperty('letter-spacing',tracking+'px','important');
if(design.photoPreset==='gradient-hero'||!e.mapped||!fields(el).some(f=>f.type==='image'))cmsApplyExistingLayout(el,design,resolvePublishedBannerImage(e,el));applyPublishedHeroMotion(el,e);
 if(design.backgroundMode==='transparent'){el.style.setProperty('background-color','transparent','important');el.style.setProperty('background-image','none','important')}
 else if(design.backgroundMode==='dark')el.style.setProperty('background-color','#0d0c09','important');
 if(page==='home'&&el.matches('.homepage-capsules')){
  el.dataset.cmsCapsulesLayout=design.layout||'original';
  el.style.setProperty('--vh-capsules-photo-width',Math.max(25,Math.min(75,Number(design.photoWidth)||50))+'%');
  el.style.removeProperty('flex-direction');
  const media=el.querySelector('#homeCapsulesMedia'),copy=el.querySelector('.editorial-copy');
  media?.style.removeProperty('order');copy?.style.removeProperty('order');
  const preset=design.photoPreset||'original';const active=preset==='framed';
  let second=el.querySelector(':scope > .vh-cms-editorial-second-photo');
  if(preset==='framed'&&active){
   if(!second){second=document.createElement('div');second.className='vh-cms-editorial-second-photo';el.append(second)}
   const url=e.capsuleSecondImage;
   second.style.setProperty('background-image',url&&url!=='__removed__'?'url('+JSON.stringify(url)+')':'none','important');
   second.style.setProperty('background-size','cover','important');
   second.style.setProperty('background-position',(Number(design.capsuleRightX??50))+'% '+(Number(design.capsuleRightY??50))+'%','important');
   second.style.setProperty('aspect-ratio','auto','important');
   second.style.setProperty('grid-column','3','important');second.style.setProperty('grid-row','1','important');
  }else second?.remove();
  if(active&&media&&copy){
   const framed=preset==='framed',stacked=design.layout==='stacked',textOnly=preset==='text-only';
   const left=Math.max(20,Math.min(45,Number(design.capsuleLeftWidth)||38));
   const right=Math.max(20,Math.min(45,Number(design.capsuleRightWidth)||38));
   const width=Math.max(25,Math.min(75,Number(design.photoWidth)||50));
   el.style.setProperty('height','500px','important');el.style.setProperty('min-height','0','important');el.style.setProperty('max-height','500px','important');el.style.setProperty('overflow','hidden','important');
   media.style.setProperty('height','100%','important');media.style.setProperty('min-height','0','important');
   copy.style.setProperty('height','100%','important');copy.style.setProperty('min-height','0','important');copy.style.setProperty('box-sizing','border-box','important');copy.style.setProperty('padding','24px clamp(16px,2vw,36px)','important');copy.style.setProperty('overflow','hidden','important');
   if(second){second.style.setProperty('height','100%','important');second.style.setProperty('min-height','0','important')}
   el.style.setProperty('display','grid','important');
   el.style.setProperty('grid-template-columns',stacked||textOnly?'1fr':framed?left+'% '+(100-left-right)+'% '+right+'%':preset==='wide'?'65% 35%':width+'% '+(100-width)+'%','important');
   media.style.setProperty('display',textOnly?'none':'block','important');copy.style.setProperty('display','flex','important');copy.style.setProperty('flex-direction','column','important');copy.style.setProperty('justify-content','center','important');
   media.style.setProperty('grid-column',design.layout==='photo-right'&&!framed?'2':'1','important');media.style.setProperty('grid-row','1','important');
   copy.style.setProperty('grid-column',stacked||textOnly?'1':framed?'2':design.layout==='photo-right'?'1':'2','important');copy.style.setProperty('grid-row',stacked?'2':'1','important');
   media.style.setProperty('order','0','important');copy.style.setProperty('order','0','important');
  }

 }
 if(page==='home'&&el.matches('.homepage-capsules')){
  const capsuleBtn=el.querySelector('#homeCapsulesBtn');
  if(capsuleBtn){
   // V284: use the published capsule button theme, not the legacy inline preset.
   for(const prop of ['background','background-color','border','border-color','color','border-radius','box-shadow'])capsuleBtn.style.removeProperty(prop);
  }
  const media=el.querySelector('#homeCapsulesMedia');
  if(media)for(const key of ['desktop','tablet','mobile']){
   const crop={fit:design.photoFit||'cover',x:design.photoX??50,y:design.photoY??50,zoom:100,...(design.cropDevices?.[key]||{})};
   media.style.setProperty('--vh-crop-'+key+'-fit',crop.fit==='contain'?'contain':'cover');
   media.style.setProperty('--vh-crop-'+key+'-x',Math.max(0,Math.min(100,Number(crop.x)||0))+'%');
   media.style.setProperty('--vh-crop-'+key+'-y',Math.max(0,Math.min(100,Number(crop.y)||0))+'%');
   media.style.setProperty('--vh-crop-'+key+'-zoom',Math.max(0.5,Math.min(2,(Number(crop.zoom)||100)/100)));
   media.style.setProperty('--vh-crop-'+key+'-effective-zoom',crop.fit==='contain'?Math.max(0.5,Math.min(2,(Number(crop.zoom)||100)/100)):Math.max(1,Math.min(2,(Number(crop.zoom)||100)/100)));
   media.style.setProperty('--vh-crop-'+key+'-pan-x',((Math.max(0,Math.min(100,Number.isFinite(Number(crop.x))?Number(crop.x):50))-50)/2)+'%');
   media.style.setProperty('--vh-crop-'+key+'-pan-y',((Math.max(0,Math.min(100,Number.isFinite(Number(crop.y))?Number(crop.y):50))-50)/2)+'%');
  }
  const photo=el.querySelector('#homeCapsulesMedia img');
  if(photo){photo.style.objectFit=design.photoFit==='contain'?'contain':'cover';photo.style.objectPosition=`${Number.isFinite(+design.photoX)?+design.photoX:50}% ${Number.isFinite(+design.photoY)?+design.photoY:50}%`}
  const copy=el.querySelector(':scope > .editorial-copy');
  if(copy){
   if(design.surface==='transparent')copy.style.setProperty('background','transparent','important');
   else if(design.surface==='white')copy.style.setProperty('background','#fff','important');
   else if(design.surface==='cream')copy.style.setProperty('background','#f3eadf','important');
  }
 }
 // Existing editorial blocks have their own opaque copy panel: style it directly.
 const copyPanel=el.querySelector(':scope > .editorial-copy, :scope > .homepage-capsules-copy');
 if(copyPanel&&(design.backgroundMode==='transparent'||design.backgroundMode==='dark')){
  if(design.backgroundMode==='transparent'){
   copyPanel.style.setProperty('background','transparent','important');
   copyPanel.style.setProperty('background-color','transparent','important');
   copyPanel.style.setProperty('background-image','none','important');
  }else{
   copyPanel.style.removeProperty('background');
   copyPanel.style.removeProperty('background-color');
   copyPanel.style.removeProperty('background-image');
  }
 }
 if(copyPanel&&['light','gold','dark'].includes(design.textTone)){
  const tone={light:'#f2e5d5',gold:'#b7956d',dark:'#211a15'}[design.textTone];
  copyPanel.style.setProperty('color',tone,'important');
  for(const node of copyPanel.querySelectorAll('h1,h2,h3,p,.eyebrow'))node.style.setProperty('color',tone,'important');
 }
 // V284: keep the capsule kicker, heading and copy in their distinct theme colors.
 if(page==='home'&&el.matches('.homepage-capsules')){
  const colors={homeCapsulesKicker:'#b99975',homeCapsulesTitle:'#eee3d6',homeCapsulesText:'#ded0bf'};
  for(const [id,color] of Object.entries(colors)){const node=el.querySelector('#'+id);if(node)node.style.setProperty('color',color,'important');}
 }
 if(['left','center','right'].includes(design.align))el.style.textAlign=design.align;
 if(['light','gold','dark'].includes(design.textTone))el.style.color={light:'#f2e5d5',gold:'#b7956d',dark:'#211a15'}[design.textTone];
 }if(typeof e.title==='string'&&!Object.prototype.hasOwnProperty.call(e.mapped||{},'unified:title')){const h=el.querySelector('h1,h2,h3');if(h)h.textContent=e.title}if(typeof e.description==='string'&&!Object.prototype.hasOwnProperty.call(e.mapped||{},'unified:description')){const p=el.querySelector('p');if(p)p.innerHTML=safeHtml(e.description)}});
 // STEP 87: limited rollout on the static About page only.
 // Never rearrange dynamic catalog, journal, checkout or shared storefront components.
 renderAboutBlocks(d,original);original.forEach((el,i)=>{const edit=edits[window.VHCMSModel.sectionId(el,i)]||{};window.VHCMSModel.applyFieldStyles(el,edit.fieldStyles,page);window.VHCMSModel.applyButtons(el,edit.customButtons);window.VHCMSModel.motion(el,edit.animation,edit.duration||700)});

}
function renderAboutBlocks(data,original){
 const main=document.querySelector('main')||document.body;
 document.querySelectorAll('.vh-cms-live-block').forEach(el=>el.remove());document.getElementById('vh-cms-published-step87')?.remove();
 if(!original.length)return;
 const order=data.shared?.cmsPageDraft?.order;
 const newBlocks=Array.isArray(data.blocks)?data.blocks.filter(b=>b&&typeof b.id==='string'&&b.visible!==false):[];
 const allowedTypes=new Set(['editorial','banner','text','gallery']);
 const allowedImages=/^(https?:\/\/|\/|\.\/?|\.\.\/)/i;
 const style=document.createElement('style');style.id='vh-cms-published-step87';
 style.textContent=`.vh-cms-live-block{box-sizing:border-box;width:100%;clear:both;background:#efe7dc;color:#261a14}.vh-cms-live-card{display:grid;grid-template-columns:1fr 1fr;min-height:300px;background:#0d0c09;color:#f1e4d4}.vh-cms-live-photo{min-height:280px;background:#493328 center/cover no-repeat}.vh-cms-live-copy{padding:clamp(30px,6vw,88px);align-self:center}.vh-cms-live-copy h2{font-family:'Bodoni Moda',Georgia,serif;font-size:clamp(28px,4vw,58px);font-weight:400;margin:0 0 18px}.vh-cms-live-copy p{line-height:1.75;font-family:'Montserrat',Arial,sans-serif}.vh-cms-live-card[data-type=text]{display:block;background:#e9dccb;color:#261a14}.vh-cms-live-card[data-type=banner]{position:relative;display:block}.vh-cms-live-card[data-type=banner] .vh-cms-live-photo{position:absolute;inset:0;opacity:.35}.vh-cms-live-card[data-type=banner] .vh-cms-live-copy{position:relative;max-width:750px}.vh-cms-live-card[data-type=gallery]{grid-template-columns:repeat(3,1fr)}.vh-cms-live-card[data-type=gallery] .vh-cms-live-copy{grid-column:1/-1}@media(max-width:700px){.vh-cms-live-card{grid-template-columns:1fr}.vh-cms-live-card[data-type=banner] .vh-cms-live-copy{max-width:100%}}`;

 /* STEP 89: parity with builder surfaces, brand palette, and motion. */
 style.textContent+=`.vh-cms-live-block{background:transparent!important;overflow:visible!important}.vh-cms-live-card{background:#0d0c09;color:#f2e5d5;overflow:hidden;isolation:isolate}.vh-cms-live-photo{background-color:#493328}.vh-cms-live-copy{box-sizing:border-box;align-self:stretch;display:flex;flex-direction:column;justify-content:center;min-width:0}.vh-cms-live-card[data-type=editorial]{align-items:stretch}.vh-cms-live-card[data-type=editorial] .vh-cms-live-photo{height:100%;min-height:100%}.vh-cms-live-card[data-surface=white] .vh-cms-live-copy{background:#fff!important;color:#211a15!important}.vh-cms-live-card[data-surface=cream] .vh-cms-live-copy{background:#f5ede2!important;color:#211a15!important}.vh-cms-live-card[data-surface=transparent]{background:transparent!important}.vh-cms-live-card[data-surface=transparent] .vh-cms-live-copy{background:transparent!important}.vh-cms-live-card[data-surface=white] .vh-cms-live-copy *, .vh-cms-live-card[data-surface=cream] .vh-cms-live-copy *{color:#211a15!important}.vh-cms-live-card[data-type=banner] .vh-cms-live-photo{opacity:.5}.vh-cms-live-block.vh-cms-motion{animation:vhCmsReveal var(--vh-cms-duration,650ms) ease both}@keyframes vhCmsReveal{from{opacity:0;transform:translateY(26px)}to{opacity:1;transform:none}}.vh-cms-live-block[data-motion=fade-left].vh-cms-motion{animation-name:vhCmsLeft}.vh-cms-live-block[data-motion=fade-right].vh-cms-motion{animation-name:vhCmsRight}.vh-cms-live-block[data-motion=zoom].vh-cms-motion{animation-name:vhCmsZoom}.vh-cms-live-block[data-motion=fade].vh-cms-motion{animation-name:vhCmsFade}@keyframes vhCmsLeft{from{opacity:0;transform:translateX(-32px)}to{opacity:1;transform:none}}@keyframes vhCmsRight{from{opacity:0;transform:translateX(32px)}to{opacity:1;transform:none}}@keyframes vhCmsZoom{from{opacity:0;transform:scale(.96)}to{opacity:1;transform:none}}@keyframes vhCmsFade{from{opacity:0}to{opacity:1}}@media(prefers-reduced-motion:reduce){.vh-cms-live-block.vh-cms-motion{animation:none!important}}`;
 style.textContent+=`.vh-cms-live-copy{font-family:'Montserrat',Arial,sans-serif}.vh-cms-live-copy h2{font-family:'Bodoni Moda',Georgia,serif}.vh-cms-live-card[data-type=editorial]:has(.cms92-second-photo) .vh-cms-live-photo{min-width:0}@media(max-width:700px){.vh-cms-live-card[data-type=editorial]:has(.cms92-second-photo){grid-template-columns:1fr 1fr!important}.vh-cms-live-card[data-type=editorial]:has(.cms92-second-photo) .vh-cms-live-copy{grid-column:1/-1;grid-row:2}.vh-cms-live-card[data-type=editorial]:has(.cms92-second-photo) .vh-cms-live-photo{min-height:220px}}`;
 style.textContent+=`.vh-cms-live-card[data-type=gallery]{display:grid!important;grid-template-columns:2fr 1fr!important;grid-template-rows:180px 180px auto!important;gap:10px;padding:10px;min-height:0!important}.vh-cms-live-card[data-type=gallery]>.vh-cms-live-photo{min-height:0!important;height:100%!important;width:100%!important;margin:0!important;aspect-ratio:auto!important;background-size:cover!important}.vh-cms-live-card[data-type=gallery]>.vh-cms-live-photo:first-child{grid-row:1/3;grid-column:1}.vh-cms-live-card[data-type=gallery]>.vh-cms-live-photo:nth-child(2){grid-row:1;grid-column:2}.vh-cms-live-card[data-type=gallery]>.vh-cms-live-photo:nth-child(3){grid-row:2;grid-column:2}.vh-cms-live-card[data-type=gallery]>.vh-cms-live-copy{grid-column:1/-1!important;grid-row:3;padding:25px!important}@media(max-width:700px){.vh-cms-live-card[data-type=gallery]{grid-template-rows:140px 140px auto!important}.vh-cms-live-card[data-type=editorial]{grid-template-columns:1fr!important}.vh-cms-live-card[data-type=editorial]>.vh-cms-live-photo{min-height:240px!important;max-height:380px!important}.vh-cms-live-card[data-type=editorial]>.vh-cms-live-copy{min-height:180px!important}}`;
 style.textContent+=`@media(max-width:700px){
.vh-cms-live-block,.vh-cms-live-block *{box-sizing:border-box}
.vh-cms-live-card[data-type=editorial]{display:flex!important;flex-direction:column!important;grid-template-columns:none!important;min-height:0!important;width:100%!important;direction:ltr!important;overflow:hidden!important}
.vh-cms-live-card[data-type=editorial]>.vh-cms-live-photo{order:0!important;display:block!important;flex:0 0 auto!important;width:100%!important;height:auto!important;min-height:0!important;max-height:none!important;aspect-ratio:4/3!important;margin:0!important;align-self:stretch!important;background-size:cover!important}
.vh-cms-live-card[data-type=editorial]>.vh-cms-live-copy{order:1!important;display:block!important;flex:0 0 auto!important;min-width:0!important;width:100%!important;max-width:100%!important;padding:28px 22px!important}
.vh-cms-live-card[data-type=editorial]>.vh-cms-live-copy h2{font-size:clamp(28px,8vw,42px)!important;overflow-wrap:anywhere}
.vh-cms-live-card[data-type=editorial]>.vh-cms-live-copy *{max-width:100%;overflow-wrap:anywhere}
.vh-cms-live-card[data-type=editorial]:has(>.cms92-second-photo){display:grid!important;grid-template-columns:minmax(0,1fr) minmax(0,1fr)!important;gap:0!important}
.vh-cms-live-card[data-type=editorial]:has(>.cms92-second-photo)>.vh-cms-live-photo{grid-row:1!important;grid-column:1!important;aspect-ratio:3/4!important}
.vh-cms-live-card[data-type=editorial]:has(>.cms92-second-photo)>.cms92-second-photo{grid-row:1!important;grid-column:2!important}
.vh-cms-live-card[data-type=editorial]:has(>.cms92-second-photo)>.vh-cms-live-copy{grid-row:2!important;grid-column:1/-1!important}
.vh-cms-live-card[data-type=editorial][data-mobile-order=text-first]:not(:has(>.cms92-second-photo))>.vh-cms-live-copy{order:-1!important}
.vh-cms-live-card[data-type=gallery]{width:100%!important;grid-template-columns:minmax(0,1fr) minmax(0,1fr)!important;grid-template-rows:220px 130px auto!important;gap:6px!important}
.vh-cms-live-card[data-type=gallery]>.vh-cms-live-photo:first-child{grid-column:1/-1!important;grid-row:1!important}
.vh-cms-live-card[data-type=gallery]>.vh-cms-live-photo:nth-child(2){grid-column:1!important;grid-row:2!important}
.vh-cms-live-card[data-type=gallery]>.vh-cms-live-photo:nth-child(3){grid-column:2!important;grid-row:2!important}
.vh-cms-live-card[data-type=gallery]>.vh-cms-live-copy{grid-column:1/-1!important;grid-row:3!important;padding:25px 20px!important;min-width:0!important}
.vh-cms-live-card[data-type=banner]{min-height:340px!important}
.vh-cms-live-card[data-type=banner]>.vh-cms-live-copy{max-width:100%!important;padding:42px 22px!important}
}`;style.textContent+=`
.vh-cms-live-card[data-cms-background=transparent]{background:transparent!important;background-color:transparent!important}
.vh-cms-live-card[data-cms-background=transparent]>.vh-cms-live-copy{background:transparent!important;background-color:transparent!important;color:#211a15!important}.vh-cms-live-card[data-cms-background=transparent]>.vh-cms-live-copy *{color:#211a15!important}

`;style.textContent+=`.vh-cms-live-card[data-cms-background=transparent]{background:#f2e9de!important;color:#211a15!important}.vh-cms-live-card[data-cms-background=transparent]>.vh-cms-live-copy{background:none!important;background-color:transparent!important;color:#211a15!important}.vh-cms-live-card[data-cms-background=transparent]>.vh-cms-live-copy *{color:#211a15!important}`;style.textContent+=`.vh-cms-live-card[data-type=banner]{position:relative!important;display:block!important;min-height:500px!important;isolation:isolate}.vh-cms-live-card[data-type=banner]>.vh-cms-live-photo{position:absolute!important;inset:0!important;width:100%!important;height:100%!important;margin:0!important;opacity:1!important;background-size:cover!important}.vh-cms-live-card[data-type=banner]>.vh-cms-live-photo::after{content:'';position:absolute;inset:0;background:linear-gradient(90deg,rgba(12,9,7,.92),rgba(15,11,9,.78) 26%,rgba(17,12,9,.48) 50%,transparent 100%)}.vh-cms-live-card[data-type=banner]>.vh-cms-live-copy{position:relative!important;z-index:1!important;max-width:min(650px,60%)!important;background:transparent!important;color:#f6ebdf!important;padding:70px clamp(28px,5vw,80px)!important}.vh-cms-live-card[data-type=banner]>.vh-cms-live-copy *{color:#f6ebdf!important}@media(max-width:700px){.vh-cms-live-card[data-type=banner]>.vh-cms-live-copy{max-width:100%!important;min-height:420px!important;justify-content:end!important}.vh-cms-live-card[data-type=banner]>.vh-cms-live-photo::after{background:linear-gradient(0deg,rgba(12,9,7,.92),rgba(12,9,7,.48) 55%,transparent)}}`;document.head.append(style);
 const nodes=new Map();
 original.forEach((el,i)=>nodes.set(window.VHCMSModel.sectionId(el,i),el));
 for(const b of newBlocks){if(!allowedTypes.has(b.type)||nodes.has(b.id))continue;
  const section=document.createElement('section');section.className='vh-cms-live-block';section.dataset.cmsBlockId=b.id;
  const d=b.design||{};const limit=(n,min,max,fallback)=>Number.isFinite(Number(n))?Math.max(min,Math.min(max,Number(n))):fallback;
  const sp={compact:12,normal:28,wide:64};section.style.marginTop=limit(d.marginTop,0,160,sp[d.spacing]??28)+'px';section.style.marginBottom=limit(d.marginBottom,0,160,sp[d.spacing]??28)+'px';
  const card=document.createElement('div');card.className='vh-cms-live-card';card.dataset.type=b.type;card.dataset.mobileOrder=d.mobileOrder||'photo-first';card.dataset.cmsBackground=d.backgroundMode||'dark';card.dataset.surface=['white','cream','transparent'].includes(d.surface)?d.surface:'original';
  card.style.minHeight=limit(d.minHeight,100,1100,320)+'px';
  if(/^#[0-9a-f]{6}$/i.test(d.background||''))card.style.backgroundColor=d.background;
  if(/^#[0-9a-f]{6}$/i.test(d.color||''))card.style.color=d.color;
  if(card.dataset.surface==='transparent'||d.backgroundMode==='transparent')card.style.setProperty('background-color','transparent','important');else if(d.backgroundMode==='dark')card.style.setProperty('background-color','#0d0c09','important');if(d.textTone)card.style.setProperty('color',({light:'#f2e5d5',gold:'#b7956d',dark:'#211a15'})[d.textTone]||'#f2e5d5','important');
  const pct=(v,def,min,max)=>Math.max(min,Math.min(max,Number.isFinite(Number(v))?Number(v):def));
  const photoWidth=pct(d.photoWidth,50,20,80);if(b.type==='editorial')card.style.gridTemplateColumns=d.photoPreset==='framed'?'minmax(0,1fr) minmax(0,1.35fr) minmax(0,1fr)':d.photoPreset==='wide'?'60% 40%':d.photoPreset?'50% 50%':`${photoWidth}% ${100-photoWidth}%`;if(d.photoPreset==='right')card.style.direction='rtl';
  const photo=(slot=0)=>{const el=document.createElement('div');el.className='vh-cms-live-photo';const imageUrl=slot===0?b.image:b.images?.[slot];if(typeof imageUrl==='string'&&allowedImages.test(imageUrl))el.style.backgroundImage='url('+JSON.stringify(imageUrl)+')';el.style.margin=pct(d.photoInset,0,0,120)+'px';el.style.backgroundSize=d.photoFit==='contain'?'contain':'cover';el.style.backgroundRepeat='no-repeat';el.style.backgroundPosition=`${pct(d.photoX,50,0,100)}% ${pct(d.photoY,50,0,100)}%`;if(['1/1','4/5','3/4','4/3','16/9'].includes(d.photoRatio))el.style.aspectRatio=d.photoRatio;if(d.photoFit==='contain')el.style.backgroundColor='transparent';const crop=d['crop'+slot];if(crop){el.style.backgroundPosition=`${pct(crop.x,50,0,100)}% ${pct(crop.y,50,0,100)}%`;el.style.backgroundSize=`${pct(crop.zoom,100,100,200)}% auto`;}if(d.photoPreset){el.style.margin=d.photoPreset==='square'?'28px':'0';el.style.width=d.photoPreset==='square'?'calc(100% - 56px)':'100%';el.style.boxSizing='border-box';el.style.minHeight='0';el.style.height=d.photoPreset==='square'?'auto':'100%';el.style.alignSelf='center';el.style.aspectRatio=d.photoPreset==='square'?'1 / 1':'auto';el.style.direction='ltr'}return el};
  if(b.type==='gallery'){for(let i=0;i<3;i++)card.append(photo(i))}else if(b.type!=='text')card.append(photo());
  const copy=document.createElement('div');copy.className='vh-cms-live-copy';copy.style.direction='ltr';const h=document.createElement('h2');h.textContent=String(b.title||'').slice(0,300);const body=document.createElement('div');body.innerHTML=safeHtml(b.body||'');copy.append(h,body);copy.style.textAlign=['left','center','right'].includes(d.align)?d.align:'left';card.append(copy);if(b.type==='editorial'&&d.photoPreset==='framed'){const second=photo(1);second.classList.add('cms92-second-photo');card.append(second)}  if(d.backgroundMode==='transparent'||d.surface==='transparent'){
   card.style.setProperty('background','#f2e9de','important');
   card.style.setProperty('color','#211a15','important');
   copy.style.setProperty('background','none','important');
   copy.style.setProperty('background-color','transparent','important');
   copy.style.setProperty('color','#211a15','important');
   copy.querySelectorAll('h2,p,div,span').forEach(x=>x.style.setProperty('color','#211a15','important'));
  }
  if(d.photoPreset==='text-only'){
   card.querySelectorAll('.vh-cms-live-photo').forEach(photo=>photo.remove());
   card.style.display='block';
   copy.style.width='100%';
  }else if(b.type!=='gallery'&&b.type!=='text'&&d.photoPreset!=='gradient-hero'){
   const width=Math.max(25,Math.min(75,Number(d.photoWidth)||50));
   card.style.gridTemplateColumns=d.layout==='stacked'?'1fr':width+'% '+(100-width)+'%';
   if(d.layout==='photo-right'){const media=card.querySelector('.vh-cms-live-photo');if(media)media.style.order='2';copy.style.order='1'}
  }
  window.VHCMSModel.applyDesign(card,d,page,{layoutImages:{0:b.image,...b.images}});section.append(card);const motion=['fade-up','fade-left','fade-right','zoom','fade','none'].includes(b.animation)?b.animation:'fade-up';section.dataset.motion=motion;section.style.setProperty('--vh-cms-duration',limit(b.duration,200,1500,650)+'ms');nodes.set(b.id,section);
 }
 // Animate once when published blocks enter the viewport.
 const motionNodes=[...nodes.entries()].filter(([id])=>!id.startsWith('existing-')).map(([,node])=>node).filter(node=>node.dataset.motion!=='none');
 if('IntersectionObserver' in window){const observer=new IntersectionObserver(entries=>{for(const entry of entries){if(entry.isIntersecting){entry.target.classList.add('vh-cms-motion');observer.unobserve(entry.target)}}},{threshold:.08});motionNodes.forEach(node=>observer.observe(node))}else motionNodes.forEach(node=>node.classList.add('vh-cms-motion'));
 // Reorder only when every existing section is a direct child of <main>.
 // Otherwise append new blocks safely without disturbing nested site markup.
 const canReorder=original.every(el=>el.parentElement===main);
 const ordered=Array.isArray(order)?order.filter(id=>typeof id==='string'&&nodes.has(id)):[];
 const ids=[...new Set([...ordered,...nodes.keys()])];
 if(canReorder){const anchor=document.createComment('VH CMS published blocks');main.insertBefore(anchor,original[0]);let cursor=anchor;for(const id of ids){const el=nodes.get(id);if(!el)continue;cursor.after(el);cursor=el}anchor.remove()}
 else{for(const b of newBlocks){const node=nodes.get(b.id);if(node){const footer=document.querySelector('body > footer');if(footer&&main===document.body)footer.before(node);else main.append(node)}}}
}
function shell(s){if(!s)return;const header=document.querySelector('body > header'),footer=document.querySelector('footer.site-footer-v64,body > footer');if(header){const logo=header.querySelector('.vh-header-logo,.brand img');if(logo&&s.headerLogo)logo.src=s.headerLogo;const nav=header.querySelector('nav.nav,nav');if(nav)[...nav.querySelectorAll('a')].forEach((a,i)=>{const n=s.nav?.[String(i)];if(n?.label)a.textContent=n.label;if(n?.href&&/^(https?:|\/|\.\/|\.\.\/|[\w-]+\.html|#)/i.test(n.href))a.setAttribute('href',n.href)})}if(footer){const logo=footer.querySelector('.vh-footer-logo-img,.footer-v64-logo img');if(logo&&s.footerLogo)logo.src=s.footerLogo;const p=footer.querySelector('.footer-v64-center p,.footer-v64-center');if(p&&typeof s.footerText==='string')p.textContent=s.footerText;const copyright=footer.querySelector('.footer-v64-copy');if(copyright&&typeof s.footerCopyright==='string')copyright.textContent=s.footerCopyright;for(const [key,sel] of [['instagram','[data-footer-instagram]'],['telegram','[data-footer-telegram]']]){const a=footer.querySelector(sel);if(a&&/^https:\/\//i.test(s[key]||''))a.href=s[key]}}}
const publishedCacheKey='vh-published-cache-v1-'+page;
const homeCacheKey='vh-published-cache-v1-home-shell';
function readPublishedCache(key){try{return JSON.parse(localStorage.getItem(key)||'null')}catch{return null}}
function writePublishedCache(key,value){if(!value)return;try{localStorage.setItem(key,JSON.stringify(value))}catch{}}
async function fetchPublished(key){
 const {data,error}=await db.from('vh_page_revisions').select('blocks,shared').eq('page_key',key).eq('revision_status','published').maybeSingle();
 if(error)throw error;return data;
}
async function run(){try{
 const [pageResult,homeResult]=await Promise.allSettled([fetchPublished(page),fetchPublished('home')]);
 let data=pageResult.status==='fulfilled'?pageResult.value:null;
 let home=homeResult.status==='fulfilled'?homeResult.value:null;
 if(data)writePublishedCache(publishedCacheKey,data);
 else data=readPublishedCache(publishedCacheKey);
 if(home)writePublishedCache(homeCacheKey,home);
 else home=readPublishedCache(homeCacheKey);
 if(pageResult.status==='rejected')console.warn('CMS using last published page snapshot',pageResult.reason);
 if(homeResult.status==='rejected')console.warn('CMS using last published shared snapshot',homeResult.reason);
if(page==='capsules'&&!window.__VH_CAPSULES_RENDER_DONE){await Promise.race([new Promise(resolve=>window.addEventListener('vh:capsules-rendered',resolve,{once:true})),new Promise(resolve=>setTimeout(resolve,5000))]);}if(page==='home'&&!window.__VH_HOME_RENDER_DONE){await Promise.race([new Promise(resolve=>window.addEventListener('vh:home-rendered',resolve,{once:true})),new Promise(resolve=>setTimeout(resolve,5000))]);}if(page==='journal'&&!window.__VH_JOURNAL_RENDER_DONE){
 await Promise.race([new Promise(resolve=>window.addEventListener('vh:journal-rendered',resolve,{once:true})),new Promise(resolve=>setTimeout(resolve,5000))]);
}
if(page==='about'&&!window.__VH_ABOUT_SETTINGS_READY){await Promise.race([new Promise(resolve=>window.addEventListener('vh:about-settings-ready',resolve,{once:true})),new Promise(resolve=>setTimeout(resolve,8000))]);}
if(page==='about'&&!data&&!isEditorPreview)document.documentElement.classList.add('vh-cms-no-publication');
if(data&&!isEditorPreview){apply(data);window.__VH_CMS_CURRENT_REVISION=data;
 // Some storefront scripts replace the original hero markup after CMS runs.
 // Reapply the same published revision when their render completes.
 window.addEventListener('vh:service-rendered',()=>apply(data));
 const eventName=page==='home'?'vh:home-rendered':page==='capsules'?'vh:capsules-rendered':page==='journal'?'vh:journal-rendered':null;
 if(eventName)window.addEventListener(eventName,()=>{try{apply(data)}catch(err){console.warn('CMS hero reapply failed',err)}},{once:true});
 }if(home?.shared)shell(home.shared)}catch(e){console.warn('CMS published content failed',e);if(page==='about')document.documentElement.classList.add('vh-cms-no-publication')}finally{window.__VH_PUBLISHED_READY=true;window.dispatchEvent(new Event('vh:published-ready'));document.documentElement.classList.remove('vh-cms-booting')}}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',run,{once:true});else run();
})();

