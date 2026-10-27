
const VH_CAPSULE_STATUS_STYLE="align-items:center!important;justify-content:center!important;background:rgba(12,9,7,.78)!important;color:#d8b989!important;border:1px solid #b99c72!important;border-radius:0!important;box-shadow:none!important;padding:9px 12px!important;font:600 11px/1.25 Montserrat,Arial,sans-serif!important;letter-spacing:.035em!important;width:max-content!important;max-width:100%!important;min-height:0!important;";
function vhStyleCapsuleBadge(node){if(!node)return;for(const d of VH_CAPSULE_STATUS_STYLE.split(';')){const i=d.indexOf(':');if(i<0)continue;node.style.setProperty(d.slice(0,i),d.slice(i+1).replace(/!important$/,''),'important')}}
(()=>{
'use strict';
const cfg=window.VH_CONFIG||{};
const sb=()=>window.supabase?.createClient&&cfg.supabaseUrl&&cfg.supabaseKey?window.supabase.createClient(cfg.supabaseUrl,cfg.supabaseKey):null;
const esc=v=>String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const money=v=>`${new Intl.NumberFormat('uk-UA',{maximumFractionDigits:0}).format(Number(v)||0)} ₴`;
const ph=(label,size)=>`<span>${esc(label)}<br><small>${esc(size)}</small></span>`;
function imageBox(el,url,label,size){if(!el)return;if(url){el.innerHTML=`<img src="${esc(url)}"${window.VHImageVariants?.attributes(esc(url))||''} alt="" loading="eager" decoding="async">`;el.classList.add('has-image')}else{el.innerHTML=ph(label,size);el.classList.remove('has-image')}}
function showError(msg){const t=document.querySelector('#toast');if(t){t.textContent=msg;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),3500)}console.error(msg)}
async function home(){
 const db=sb(); if(!db)return showError('Не вдалося підключитися до Supabase');
 const [{data:s,error:se},{data:styles,error:ste}]=await Promise.all([
   db.from('capsule_page_settings').select('*').eq('id',1).maybeSingle(),
   db.from('capsule_styles').select('id,title,short_description,image_url,slug,is_active,created_at').eq('is_active',true).order('created_at',{ascending:true})
 ]);
 if(se)showError(`Капсули: ${se.message}`); if(ste)showError(`Стилі: ${ste.message}`);
 if(s){
  const set=(sel,val)=>{const e=document.querySelector(sel);if(e&&val!=null)e.textContent=val};
  set('.capsule-kicker',s.hero_kicker);set('.capsule-hero h1',s.hero_title);set('.capsule-hero h2',s.hero_subtitle);set('.capsule-hero p',s.hero_description);set('.capsule-intro h2',s.mood_title);set('.capsule-intro p',s.mood_text);
  imageBox(document.querySelector('.capsule-hero-photo'),s.hero_image,'HERO ФОТО','РЕКОМЕНДОВАНО 1600 × 1200 px');
 }
 const grid=document.querySelector('.capsule-cards-grid'); if(!grid)return;
 grid.innerHTML='';
 (styles||[]).forEach(st=>{
   const a=document.createElement('article');a.className='capsule-card';
   a.innerHTML=`<div class="capsule-card-placeholder ${st.image_url?'has-image':''}">${st.image_url?`<img src="${esc(st.image_url)}"${window.VHImageVariants?.attributes(esc(st.image_url))||''} alt="${esc(st.title||'')}" loading="lazy" decoding="async">`:ph('ФОТО СТИЛЮ','1200 × 900 px')}</div><div class="capsule-card-copy"><h3>${esc(st.title||'БЕЗ НАЗВИ')}</h3><p>${esc(st.short_description||'')}</p></div><a class="capsule-card-link" href="capsule-1.html?style=${encodeURIComponent(st.slug||st.id)}">ПЕРЕГЛЯНУТИ</a>`;
   grid.appendChild(a);
 });
 if(!(styles||[]).length)grid.innerHTML='<div class="capsule-front-empty">Поки немає опублікованих стилів.</div>';
 window.__VH_CAPSULES_RENDER_DONE=true;
 window.dispatchEvent(new Event('vh:capsules-rendered'));
}
async function detail(){
 const db=sb(); if(!db)return showError('Не вдалося підключитися до Supabase');
 const key=new URLSearchParams(location.search).get('style');
 let q=db.from('capsule_styles').select('*').eq('is_active',true);
 const isUuid=key&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(key);
 q=key?(isUuid?q.eq('id',key):q.eq('slug',key)):q.order('created_at',{ascending:true}).limit(1);
 const {data:style,error}=await q.maybeSingle();
 if(error||!style){showError(error?.message||'Стиль не знайдено');return}
 document.title=`${style.title||'Капсули'} — Vintage Hedonista`;
 // STEP 49: test the full-bleed editorial HERO only for PREPPY.
 document.body.classList.add('vh-preppy-full-hero');
 const hero=document.querySelector('.capsule-detail-placeholder'); imageBox(hero,style.hero_image,'HERO ФОТО','РЕКОМЕНДОВАНО 1600 × 1200 px');
 if(style.page_title||style.title) hero?.setAttribute('aria-label',style.page_title||style.title);
 const heroCopy=document.querySelector('#capsuleStyleHeroCopy'); if(heroCopy){heroCopy.innerHTML=`<h1>${esc(style.page_title||style.title||'')}</h1>${style.page_description?`<p>${esc(style.page_description)}</p>`:''}`;}
 const {data:caps,error:ce}=await db.from('capsules').select('*').eq('style_id',style.id).eq('is_active',true).order('sort_order',{ascending:true}).order('created_at',{ascending:true});
 if(ce)return showError(`Капсули: ${ce.message}`);
 let capsules=caps||[], idx=0, lookIdx=0, looks=[], lookLinks=[], allProducts=[];
 const $=s=>document.querySelector(s), main=$('#capsuleMainVisual'), track=$('#capsuleLookTrack'), grid=$('.capsule-product-grid');
 function activeProducts(){const l=looks[lookIdx];if(!l)return[];const ids=lookLinks.filter(x=>String(x.look_id)===String(l.id)).sort((a,b)=>Number(a.sort_order||0)-Number(b.sort_order||0)).map(x=>x.product_id);const map=new Map(allProducts.map(p=>[String(p.id),p]));return ids.map(id=>map.get(String(id))).filter(Boolean)}
 async function loadRelated(c){
  const [{data:l,error:le},{data:links,error:pe}]=await Promise.all([
   db.from('capsule_looks').select('*').eq('capsule_id',c.id).order('sort_order',{ascending:true}).order('created_at',{ascending:true}),
   db.from('capsule_look_products').select('look_id,product_id,sort_order').eq('capsule_id',c.id).order('sort_order',{ascending:true})
  ]);
  if(le)showError(`Образи: ${le.message}`);if(pe)showError(`Товари образів: ${pe.message}`);looks=(l||[]).sort((a,b)=>Number(b.is_main===true)-Number(a.is_main===true));lookLinks=links||[];
  // Fallback for data created before per-look products existed.
  if(!lookLinks.length&&looks.length){const {data:old}=await db.from('capsule_products').select('product_id,sort_order').eq('capsule_id',c.id).order('sort_order',{ascending:true});lookLinks=(old||[]).map(x=>({...x,look_id:looks[0].id}))}
  const ids=[...new Set(lookLinks.map(x=>x.product_id).filter(Boolean))];allProducts=[];
  if(ids.length){const {data:p,error:e}=await db.from('products').select('id,name,slug,price,brand,size,cover_image,status,stock').in('id',ids);if(e)showError(`Товари: ${e.message}`);allProducts=p||[]}
 }
 let vh47Switching=false;
 async function vh47ChooseLook(next){
  if(vh47Switching||next===lookIdx||next<0||next>=looks.length)return;
  vh47Switching=true;
  const reduce=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const elements=[main,grid];
  if(!reduce){const dir=next>lookIdx?1:-1;elements.forEach(el=>{el.style.setProperty('--vh47-dir',String(dir));el.classList.add('vh47-slide-out')});await new Promise(r=>setTimeout(r,165))}
  lookIdx=next;updateActiveLook();
  if(!reduce){elements.forEach(el=>{el.classList.remove('vh47-slide-out');el.classList.add('vh47-slide-in')});requestAnimationFrame(()=>requestAnimationFrame(()=>elements.forEach(el=>{el.classList.remove('vh47-slide-in');el.classList.add('vh47-slide-settle')})));await new Promise(r=>setTimeout(r,255));elements.forEach(el=>el.classList.remove('vh47-slide-settle'))}
  vh47Switching=false;
 }
 function updateActiveLook(){
  const l=looks[lookIdx],products=activeProducts();imageBox(main,l?.image_url||capsules[idx]?.cover_image,'ФОТО ГОЛОВНОГО ОБРАЗУ','КВАДРАТНЕ 1:1');main.setAttribute('role','button');main.setAttribute('tabindex','0');main.setAttribute('aria-label','Відкрити фото образу');renderLooks();renderProducts();
  const available=products.filter(p=>p.status==='published'&&(p.stock==null||Number(p.stock)>0));
  const sum=products.reduce((s,p)=>s+(Number(p.price)||0),0);
  const capsule=capsules[idx];
  const completeMainLook=l?.is_main===true&&products.length>0&&Number(capsule?.price)>0;
  const displayPrice=completeMainLook?Math.min(sum,Number(capsule.price)):sum;
  $('.capsule-buy-meta b').textContent=money(displayPrice);
  const label=$('.capsule-buy-meta span');if(label)label.textContent=`ОБРАЗ ${String(lookIdx+1).padStart(2,'0')}`;
  const add=$('#capsuleAddAll');
  const unavailable=products.some(p=>p.status!=='published'||(p.stock!=null&&Number(p.stock)<=0));
  const sold=products.some(p=>p.status==='sold');
  if(add){add.disabled=unavailable||!products.length;add.textContent=unavailable?(sold?'ОБРАЗ ПРОДАНО':'ОБРАЗ ЗАРЕЗЕРВОВАНО'):'ДОДАТИ ОБРАЗ У КОШИК';}
  main.style.position='relative';
  let photoBadge=main.querySelector('.vh-capsule-photo-badge');
  if(!photoBadge){photoBadge=document.createElement('span');photoBadge.className='vh-capsule-photo-badge';main.appendChild(photoBadge);vhStyleCapsuleBadge(photoBadge)}
  photoBadge.textContent=unavailable?(sold?'ПРОДАНО':'ЗАРЕЗЕРВОВАНО'):'';
  photoBadge.style.setProperty('display',unavailable?'inline-flex':'none','important');

 }
 function renderLooks(){
  track.innerHTML='';looks.forEach((l,i)=>{const b=document.createElement('button');b.className=`capsule-look-option${i===lookIdx?' active':''}`;b.type='button';b.innerHTML=`<div class="capsule-look-thumb ${l.image_url?'has-image':''}">${l.image_url?`<img src="${esc(l.image_url)}"${window.VHImageVariants?.attributes(esc(l.image_url))||''} alt="${esc(l.title||'')}" loading="lazy">`:ph(`ФОТО ОБРАЗУ ${String(i+1).padStart(2,'0')}`,'1:1')}</div><span>${esc(l.title||`ОБРАЗ ${String(i+1).padStart(2,'0')}`)}</span>`;b.onclick=()=>vh47ChooseLook(i);track.appendChild(b)});$('#capsulePrev').disabled=looks.length<2;$('#capsuleNext').disabled=looks.length<2
 }
 function renderProducts(){const products=activeProducts();grid.innerHTML='';products.forEach(p=>{const a=document.createElement('article');a.className='capsule-product-card';a.innerHTML=`<a class="capsule-product-photo ${p.cover_image?'has-image':''}" href="${window.VHProductRoutes?.href(p)||('product.html?slug='+encodeURIComponent(p.slug||''))}">${p.cover_image?`<img src="${esc(p.cover_image)}"${window.VHImageVariants?.attributes(esc(p.cover_image))||''} alt="${esc(p.name)}" loading="lazy">`:'ФОТО ТОВАРУ'}${p.status==='sold'||p.status==='reserved'?`<span class="vh-capsule-item-badge" style="${VH_CAPSULE_STATUS_STYLE}">${p.status==='sold'?'ПРОДАНО':'ЗАРЕЗЕРВОВАНО'}</span>`:''}</a><h3>${esc(p.name)}</h3>${p.brand?`<div class="capsule-product-brand">${esc(p.brand)}</div>`:''}<p>${money(p.price)}</p><a class="capsule-product-open" href="${window.VHProductRoutes?.href(p)||('product.html?slug='+encodeURIComponent(p.slug||''))}">ПЕРЕГЛЯНУТИ →</a>`;grid.appendChild(a)});if(!products.length)grid.innerHTML='<div class="capsule-front-empty">До цього образу ще не додано товарів.</div>'}
 function addActiveLookToCart(){
  const products=activeProducts();
  if(!products.length)return showError('У цьому образі немає товарів');
  try{
   const cart=typeof vhGetCart==='function'?vhGetCart():JSON.parse(localStorage.getItem('vh_cart_v1')||'[]');
   let added=0,already=0,unavailable=0;
   for(const p of products){
    if(p.status!=='published'||(p.stock!=null&&Number(p.stock)<=0)){unavailable++;continue}
    if(cart.some(x=>String(x.id)===String(p.id))){already++;continue}
    cart.push({id:p.id,name:p.name,slug:p.slug,brand:p.brand||'',price:Number(p.price||0),cover_image:p.cover_image||''});
    added++;
   }
   if(added||already){
    const capsule=capsules[idx];
    const completeIds=[...new Set(products.map(p=>String(p.id)))];
    // Capsule identity is independent of whether it has a special price.
    if(looks[lookIdx]?.is_main===true&&completeIds.length===products.length&&unavailable===0){
     for(const item of cart){
      if(completeIds.includes(String(item.id))){
       item.capsule_offer={id:capsule.id,title:capsule.title||'Капсула',look_id:looks[lookIdx]?.id||null,product_ids:completeIds};
      }
     }
    }
    if(typeof vhSetCart==='function')vhSetCart(cart);
    else localStorage.setItem('vh_cart_v1',JSON.stringify(cart));
    if(typeof vhRenderCart==='function')vhRenderCart();
    if(typeof vhOpenPanel==='function')vhOpenPanel('cart');
   }
   const parts=[];
   if(added)parts.push('Додано '+added+' реч.');
   if(already)parts.push('Уже в кошику: '+already+'.');
   if(unavailable)parts.push('Недоступні: '+unavailable+'.');
   if(typeof toast==='function')toast(parts.join(' ')||'Немає доступних речей для додавання');
   else if(!added)showError(parts.join(' ')||'Немає доступних речей');
  }catch(e){console.error('Capsule cart',e);showError('Не вдалося додати образ у кошик')}
 }

 async function renderCapsule(){
  if(!capsules.length){$('.capsule-showcase-grid').innerHTML=`<div class="capsule-front-empty">У стилі «${esc(style.title||'')}» поки немає опублікованих капсул.</div>`;$('.capsule-products').hidden=true;$('.capsule-page-nav').hidden=true;return}
  const c=capsules[idx];lookIdx=0;await loadRelated(c);$('#capsuleCurrentLabel').textContent=`КАПСУЛА ${String(idx+1).padStart(2,'0')}`;$('.capsule-info-kicker').textContent=`КАПСУЛА ${String(idx+1).padStart(2,'0')}`;$('.capsule-info h1').textContent=c.title||'БЕЗ НАЗВИ';$('.capsule-info-description').textContent=c.description||'';$('#capsuleGroupPrev').disabled=idx===0;$('#capsuleGroupNext').disabled=idx===capsules.length-1;updateActiveLook()
 }
 function openMainPhoto(){const url=main.querySelector('img')?.src;if(!url)return;const overlay=document.createElement('div');overlay.className='capsule-photo-lightbox';overlay.innerHTML=`<button type="button" aria-label="Закрити фото">×</button><img src="${esc(url)}"${window.VHImageVariants?.attributes(esc(url))||''} alt="Фото образу">`;document.body.appendChild(overlay);document.body.style.overflow='hidden';const close=()=>{overlay.remove();document.body.style.overflow='';document.removeEventListener('keydown',onKey)};const onKey=e=>{if(e.key==='Escape')close()};overlay.addEventListener('click',e=>{if(e.target===overlay||e.target.tagName==='BUTTON')close()});document.addEventListener('keydown',onKey)}
 main.addEventListener('click',openMainPhoto);main.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();openMainPhoto()}});
 $('#capsulePrev').onclick=()=>{if(!looks.length)return;vh47ChooseLook(lookIdx<=0?looks.length-1:lookIdx-1)};$('#capsuleNext').onclick=()=>{if(!looks.length)return;vh47ChooseLook((lookIdx+1)%looks.length)};$('#capsuleAddAll').onclick=addActiveLookToCart;
 let switching=false;async function moveCapsule(delta){if(switching||idx+delta<0||idx+delta>=capsules.length)return;switching=true;const el=$('.capsule-showcase-grid');const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;if(!reduce){el.classList.add('capsule-swipe-out');el.style.setProperty('--swipe-dir',String(delta));await new Promise(r=>setTimeout(r,210))}idx+=delta;await renderCapsule();if(!reduce){el.classList.remove('capsule-swipe-out');el.classList.add('capsule-swipe-in');requestAnimationFrame(()=>requestAnimationFrame(()=>el.classList.remove('capsule-swipe-in')));await new Promise(r=>setTimeout(r,330))}switching=false}$('#capsuleGroupPrev').onclick=()=>moveCapsule(-1);$('#capsuleGroupNext').onclick=()=>moveCapsule(1);
 let x=null,y=null;$('.capsule-showcase-grid')?.addEventListener('touchstart',e=>{x=e.touches[0]?.clientX??null;y=e.touches[0]?.clientY??null},{passive:true});$('.capsule-showcase-grid')?.addEventListener('touchend',async e=>{if(x==null)return;const d=(e.changedTouches[0]?.clientX??x)-x,dy=(e.changedTouches[0]?.clientY??y)-y;x=y=null;if(Math.abs(d)<55||Math.abs(d)<=Math.abs(dy)*1.2)return;if(d<0)await moveCapsule(1);else await moveCapsule(-1)},{passive:true});
 await renderCapsule();
}
window.addEventListener('load',()=>{document.body.classList.contains('capsule-index-live')?home():document.body.classList.contains('capsule-style-live')&&detail()});
})();
