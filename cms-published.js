(()=>{'use strict';
const map={'index.html':'home','catalog.html':'catalog','capsule.html':'capsules','about.html':'about','journal.html':'journal','delivery.html':'delivery','contacts.html':'contacts'};
const page=map[location.pathname.split('/').pop()||'index.html'];if(!page)return;
const config=window.VH_CONFIG;if(!config||!window.supabase){document.documentElement.classList.remove('vh-cms-booting');return;}
const db=window.supabase.createClient(config.supabaseUrl,config.supabaseKey);
const safeHtml=html=>{const t=document.createElement('template');t.innerHTML=String(html);const allowed=new Set(['P','BR','STRONG','B','EM','I','UL','OL','LI','H2','H3','A']);function scrub(root){for(const n of [...root.childNodes]){if(n.nodeType===8){n.remove();continue}if(n.nodeType!==1)continue;if(!allowed.has(n.tagName)){n.replaceWith(...n.childNodes);scrub(root);continue}for(const a of [...n.attributes]){if(a.name==='href'&&n.tagName==='A'&&/^(https?:|mailto:|tel:|\/|#)/i.test(a.value))continue;n.removeAttribute(a.name)}scrub(n)}}scrub(t.content);return t.innerHTML};
const selectors={catalog:['.catalog-heading .kicker','.catalog-heading .page-title','.catalog-intro-label','.catalog-intro'],capsules:['.capsule-hero-copy .capsule-kicker','.capsule-hero-copy h1','.capsule-hero-copy h2','.capsule-hero-copy p','.capsule-hero-photo','.capsule-intro-grid h2','.capsule-intro-grid p']};
function fields(section){const f=[...section.querySelectorAll('[id]')].filter(el=>page==='about'?/^about(?:Hero|Philosophy|Editorial|P[1-4]|Manifest|Origin|Final)/.test(el.id):page==='delivery'?/^delivery(?:Kicker|Title|Intro|Shipping|Payment|Extra|Process|Step[1-3]|Cta)/.test(el.id):page==='contacts'?/^contacts(?:Kicker|Title|Intro|List|Instagram|Telegram|Email|Phone|Help|Topics|Topic[1-3])/.test(el.id):false).map(el=>({el,id:el.id,type:el.id.endsWith('Image')||/^aboutEditorial[123]$/.test(el.id)?'image':el.tagName==='A'?'link':'text'}));for(const sel of selectors[page]||[]){[...section.querySelectorAll(sel)].forEach((el,i)=>f.push({el,id:'static:'+sel+':'+i,type:el.matches('.capsule-hero-photo')?'image':el.tagName==='A'?'link':'text'}))}return f}
function sections(){const main=document.querySelector('main')||document.body;let c=(page==='home'?[...document.body.children].filter(e=>e.tagName==='SECTION'):page==='about'?[...main.children].filter(e=>e.tagName==='SECTION'):[...main.children]).filter(e=>!['SCRIPT','STYLE','HEADER','FOOTER'].includes(e.tagName)&&(page==='home'||page==='about'||e.getBoundingClientRect().height>50));if(c.length<2){const ss=[...main.querySelectorAll('section')].filter(e=>e.getBoundingClientRect().height>50);const top=ss.filter(e=>!ss.some(p=>p!==e&&p.contains(e)));if(top.length>1)c=top;else{const cs=[...main.querySelectorAll('article,section,[class*="section"],[class*="hero"],[class*="content"],[class*="editorial"]')].filter(e=>e.getBoundingClientRect().height>90);const top2=cs.filter(e=>!cs.some(p=>p!==e&&p.contains(e)));if(top2.length>1)c=top2}}return c.slice(0,35)}
function apply(d){const original=sections(),edits=d.shared?.cmsPageDraft?.existing||{};original.forEach((el,i)=>{const e=edits['existing-'+i];if(!e)return;if(e.hidden)el.style.display='none';for(const f of fields(el)){const v=e.mapped?.[f.id];if(typeof v!=='string')continue;if(f.type==='text')f.el.innerHTML=safeHtml(v);else if(f.type==='link'&&/^(https?:|mailto:|tel:|\/|#)/i.test(v))f.el.setAttribute('href',v);else if(f.type==='image'){if(v==='__removed__'){f.el.style.backgroundImage='none';f.el.querySelectorAll('img').forEach(img=>img.style.display='none')}else if(/^(https?:|\/|\.\/|\.\.\/|data:image\/)/i.test(v)){f.el.style.backgroundImage='url('+JSON.stringify(v)+')';f.el.style.backgroundSize='cover';f.el.querySelectorAll('img').forEach(img=>img.style.display='none')}}}if(page==='home'&&el.matches('.homepage-capsules')){
 const media=el.querySelector('#homeCapsulesMedia');
 if(media&&typeof e.capsuleImage==='string'){
  if(e.capsuleImage==='__removed__')media.replaceChildren();
  else if(['https://','http://','/','./','../'].some(prefix=>e.capsuleImage.startsWith(prefix))){
   const img=document.createElement('img');img.src=e.capsuleImage;img.alt='Фото капсул';img.loading='eager';img.style.cssText='width:100%;height:100%;object-fit:cover;display:block';media.replaceChildren(img);
  }
 }
}
if(e.design&&typeof e.design==='object'){const design=e.design;
 if(design.backgroundMode==='transparent'){el.style.setProperty('background-color','transparent','important');el.style.setProperty('background-image','none','important')}
 else if(design.backgroundMode==='dark')el.style.setProperty('background-color','#0d0c09','important');
 if(page==='home'&&el.matches('.homepage-capsules')){
  el.dataset.cmsCapsulesLayout=design.layout||'original';
  el.style.setProperty('--vh-capsules-photo-width',Math.max(25,Math.min(75,Number(design.photoWidth)||50))+'%');
  el.style.removeProperty('flex-direction');
  const media=el.querySelector('#homeCapsulesMedia'),copy=el.querySelector('.editorial-copy');
  media?.style.removeProperty('order');copy?.style.removeProperty('order');
 }
 if(page==='home'&&el.matches('.homepage-capsules')){
  const capsuleBtn=el.querySelector('#homeCapsulesBtn');
  if(capsuleBtn){
   const lightPanel=design.surface==='white'||design.surface==='cream'||design.textTone==='dark';
   capsuleBtn.style.setProperty('background-color',lightPanel?'#211a15':'#f2e5d5','important');
   capsuleBtn.style.setProperty('border-color',lightPanel?'#211a15':'#f2e5d5','important');
   capsuleBtn.style.setProperty('color',lightPanel?'#ffffff':'#211a15','important');
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
 if(['left','center','right'].includes(design.align))el.style.textAlign=design.align;
 if(['light','gold','dark'].includes(design.textTone))el.style.color={light:'#f2e5d5',gold:'#b7956d',dark:'#211a15'}[design.textTone];
 }if(typeof e.title==='string'){const h=el.querySelector('h1,h2,h3');if(h)h.textContent=e.title}if(typeof e.description==='string'){const p=el.querySelector('p');if(p)p.innerHTML=safeHtml(e.description)}});
 // STEP 87: limited rollout on the static About page only.
 // Never rearrange dynamic catalog, journal, checkout or shared storefront components.
 if(page==='about'||page==='home')renderAboutBlocks(d,original);

}
function renderAboutBlocks(data,original){
 const main=document.querySelector('main')||document.body;
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
 original.forEach((el,i)=>nodes.set('existing-'+i,el));
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
  section.append(card);const motion=['fade-up','fade-left','fade-right','zoom','fade','none'].includes(b.animation)?b.animation:'fade-up';section.dataset.motion=motion;section.style.setProperty('--vh-cms-duration',limit(b.duration,200,1500,650)+'ms');nodes.set(b.id,section);
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
function shell(s){if(!s)return;const header=document.querySelector('body > header'),footer=document.querySelector('footer.site-footer-v64,body > footer');if(header){const logo=header.querySelector('.vh-header-logo,.brand img');if(logo&&s.headerLogo)logo.src=s.headerLogo;const nav=header.querySelector('nav.nav,nav');if(nav)[...nav.querySelectorAll('a')].forEach((a,i)=>{const n=s.nav?.[String(i)];if(n?.label)a.textContent=n.label;if(n?.href&&/^(https?:|\/|\.\/|\.\.\/|[\w-]+\.html|#)/i.test(n.href))a.setAttribute('href',n.href)})}if(footer){const logo=footer.querySelector('.vh-footer-logo-img,.footer-v64-logo img');if(logo&&s.footerLogo)logo.src=s.footerLogo;const p=footer.querySelector('.footer-v64-center p,.footer-v64-center');if(p&&s.footerText)p.textContent=s.footerText;for(const [key,sel] of [['instagram','[data-footer-instagram]'],['telegram','[data-footer-telegram]']]){const a=footer.querySelector(sel);if(a&&/^https:\/\//i.test(s[key]||''))a.href=s[key]}}}
async function run(){try{const [{data,error},{data:home,error:he}]=await Promise.all([db.from('vh_page_revisions').select('blocks,shared').eq('page_key',page).eq('revision_status','published').maybeSingle(),db.from('vh_page_revisions').select('shared').eq('page_key','home').eq('revision_status','published').maybeSingle()]);if(error||he){console.warn('CMS published content unavailable',error||he);return}if(page==='capsules'&&!window.__VH_CAPSULES_RENDER_DONE){await Promise.race([new Promise(resolve=>window.addEventListener('vh:capsules-rendered',resolve,{once:true})),new Promise(resolve=>setTimeout(resolve,5000))]);}if(page==='home'&&!window.__VH_HOME_RENDER_DONE){await Promise.race([new Promise(resolve=>window.addEventListener('vh:home-rendered',resolve,{once:true})),new Promise(resolve=>setTimeout(resolve,5000))]);}if(data)apply(data);if(home?.shared)shell(home.shared)}catch(e){console.warn('CMS published content failed',e)}finally{document.documentElement.classList.remove('vh-cms-booting')}}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',run,{once:true});else run();
})();

