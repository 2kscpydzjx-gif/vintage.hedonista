const sb=supabase.createClient(VH_CONFIG.supabaseUrl,VH_CONFIG.supabaseKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,storage:window.localStorage,storageKey:'vintage-hedonista-customer-auth'}});

/* V138: public catalog/content client.
   It NEVER reads the persisted customer session. This prevents an old/deleted
   account token from turning otherwise-public SELECT requests into 401 errors. */
const publicSb=supabase.createClient(VH_CONFIG.supabaseUrl,VH_CONFIG.supabaseKey,{
  auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}
});
const $=id=>document.getElementById(id);
let SITE_SETTINGS={};

function money(v){return Number(v||0).toLocaleString('uk-UA')+' грн'}
function toast(msg){const el=$('toast');if(!el)return;el.textContent=msg;el.classList.add('show');setTimeout(()=>el.classList.remove('show'),2200)}
function placeholder(label,size){return `<div class="placeholder"><div><b>${label}</b>${size}<br>Додайте фото в адмінці</div></div>`}
function productCard(p){const href=`product.html?slug=${encodeURIComponent(p.slug)}`;return `<article class="card"><a class="photo" href="${href}">${p.cover_image?`<img src="${p.cover_image}" alt="${p.name}" loading="lazy" decoding="async">`:placeholder('Фото товару','1200 × 1500 px')}</a><div class="meta"><div><a class="name" href="${href}">${p.name}</a><div class="price">${money(p.price)}</div></div><button class="heart">♡</button></div></article>`}
document.addEventListener('click',e=>{if(e.target.classList.contains('heart'))e.target.textContent=e.target.textContent==='♡'?'♥':'♡'});

const VH_SETTINGS_CACHE_KEY='vh-site-settings-v256';
function applySettingsMeta(s={}){SITE_SETTINGS=s||{};document.querySelectorAll('[data-instagram]').forEach(el=>el.textContent=SITE_SETTINGS.instagram||'@vintage_hedonista');document.querySelectorAll('[data-telegram]').forEach(el=>el.textContent=SITE_SETTINGS.telegram||'Vintage Hedonista');document.querySelectorAll('[data-city]').forEach(el=>el.textContent=SITE_SETTINGS.city||'Одеса, Україна');if($('shippingText')&&SITE_SETTINGS.shipping_text)$('shippingText').textContent=SITE_SETTINGS.shipping_text;if($('paymentText')&&SITE_SETTINGS.payment_text)$('paymentText').textContent=SITE_SETTINGS.payment_text}
function cachedSettings(){try{return JSON.parse(localStorage.getItem(VH_SETTINGS_CACHE_KEY)||'{}')||{}}catch{return {}}}
async function loadSettings(){
 const cached=cachedSettings();
 if(Object.keys(cached).length)applySettingsMeta(cached);
 // Public settings do not need the customer auth/session client. This avoids auth
 // recovery work on the critical homepage path and is friendlier to mobile LCP.
 const {data,error}=await publicSb.from('site_settings').select('*').eq('id',1).maybeSingle();
 if(error){console.error(error);return cached}
 const fresh=data||cached||{};applySettingsMeta(fresh);
 try{localStorage.setItem(VH_SETTINGS_CACHE_KEY,JSON.stringify(fresh))}catch{}
 return fresh
}

async function initHome(){
 const s=await loadSettings();
 const heroSection=document.querySelector('.hero');
 if(heroSection){
   const heroBg=s.hero_background_image||'assets/hero-background-clean.webp';
   heroSection.style.setProperty('--hero-bg-image',`url("${heroBg}")`);
   heroSection.classList.remove('hero-no-bg');
 }
 const heroLiveText=document.getElementById('heroLiveText');
 if(heroLiveText){
   const eyebrow=document.getElementById('heroEyebrow');
   const title=document.getElementById('heroTitle');
   const desc=document.getElementById('heroDescription');
   const catBtn=document.getElementById('heroCatalogBtn');
   const aboutBtn=document.getElementById('heroAboutBtn');

   if(eyebrow) eyebrow.textContent=s.hero_eyebrow||'ОДЯГ З МИНУЛОГО. СТИЛЬ ПОЗА ЧАСОМ.';
   if(title) title.innerHTML=(s.hero_title||'VINTAGE\nHEDONISTA').replace(/\n/g,'<br>');
   if(desc) desc.innerHTML=(s.hero_description||'Добірний вінтажний одяг з Європи.\nУнікальні речі в єдиному екземплярі.').replace(/\n/g,'<br>');

   if(catBtn){
     catBtn.textContent=s.hero_catalog_button_text||'ДИВИТИСЬ КАТАЛОГ';
     catBtn.href=s.hero_catalog_button_url||'catalog.html';
   }
   if(aboutBtn){
     aboutBtn.textContent=s.hero_about_button_text||'ПРО НАС';
     aboutBtn.href=s.hero_about_button_url||'about.html';
   }

   const x=Number(s.hero_text_x ?? 7);
   const y=Number(s.hero_text_y ?? 18);
   const savedBx=Number(s.hero_buttons_x ?? 46);
   const bx=savedBx<25?46:savedBx;
   const by=Number(s.hero_buttons_y ?? 4);

   heroLiveText.style.setProperty('left',`${x}%`,'important');
   heroLiveText.style.setProperty('top',`${y}%`,'important');

   const buttons=document.querySelector('.hero-live-buttons');
   if(buttons){
     buttons.style.setProperty('left',`${bx}%`,'important');
     buttons.style.setProperty('bottom',`${by + 6}%`,'important');
   }
 }
 if($('heroKicker'))$('heroKicker').textContent=s.hero_kicker||'ОДЯГ З МИНУЛОГО. СТИЛЬ ПОЗА ЧАСОМ.';
 if($('heroTitle')&&s.hero_title)$('heroTitle').innerHTML=String(s.hero_title).replace(/\n/g,'<br>');
 if($('heroDesc')&&s.hero_description)$('heroDesc').textContent=s.hero_description;
 if($('heroPrimaryBtn')){$('heroPrimaryBtn').textContent=s.hero_primary_text||'ДИВИТИСЬ КАТАЛОГ';$('heroPrimaryBtn').href=s.hero_primary_url||'catalog.html'}
 if($('heroSecondaryBtn')){$('heroSecondaryBtn').textContent=s.hero_secondary_text||'ПРО НАС';$('heroSecondaryBtn').href=s.hero_secondary_url||'about.html'}

 const main=$('heroMain'),side1=$('heroSide1'),side2=$('heroSide2');
 const drawFixedHero=(el,url,label,size)=>{
   const isMain=el===main;
   el.innerHTML=url
     ? `<img src="${url}" alt="${label}" draggable="false" decoding="async" ${isMain?'fetchpriority="high" loading="eager"':'fetchpriority="low" loading="lazy"'}>`
     : placeholder(label,size)
 };
 drawFixedHero(main,s.hero_main_image,'Головне Hero фото','1200 × 1500 px · 4:5');
 drawFixedHero(side1,s.hero_top_image,'Верхнє праве Hero фото','1200 × 1200 px · 1:1');
 drawFixedHero(side2,s.hero_bottom_image,'Нижнє праве Hero фото','1200 × 1200 px · 1:1');

 if($('newArrivalsTitle'))$('newArrivalsTitle').textContent=s.homepage_new_title||'НОВІ НАДХОДЖЕННЯ';

 // V187 PERFORMANCE: independent homepage requests start together instead of waiting one-by-one.
 const [newRes,topRes,catsRes,newsRes]=await Promise.all([
   publicSb.from('products').select('id,name,slug,brand,price,size,cover_image,status,is_new,created_at').eq('status','published').eq('is_new',true).order('created_at',{ascending:false}).limit(12),
   publicSb.from('homepage_top_items').select('slot,image_url,caption,link_url').order('slot'),
   publicSb.from('categories').select('id,name,slug,cover_image,sort_order,created_at').eq('is_active',true).eq('show_on_home',true).order('sort_order',{ascending:true}).order('created_at',{ascending:true}),
   publicSb.from('news').select('id,title,slug,excerpt,cover_image,published_at,created_at').eq('status','published').eq('show_on_home',true).order('published_at',{ascending:false}).limit(3)
 ]);
 let newItems=newRes.data||[];
 if(newRes.error)console.error(newRes.error);
 if(!newItems.length){
   const r=await publicSb.from('products').select('id,name,slug,brand,price,size,cover_image,status,created_at').eq('status','published').order('created_at',{ascending:false}).limit(4);
   newItems=r.data||[];
 }
 $('newArrivals').innerHTML=newItems.length?newItems.map(productCard).join(''):'<div class="empty">Позначте товари як «Новинка» в адмінці</div>';
 initNewArrivalsCarousel();

 $('editorialKicker').textContent=s.homepage_editorial_kicker||'VINTAGE HEDONISTA';$('editorialTitle').textContent=s.homepage_editorial_title||'РЕЧІ, ЯКІ ПЕРЕЖИЛИ ТРЕНДИ.';$('editorialText').textContent=s.homepage_editorial_text||'';$('editorialBtn').textContent=s.homepage_editorial_button_text||'ПРО НАС';$('editorialBtn').href=s.homepage_editorial_button_url||'about.html';$('editorialMedia').innerHTML=s.homepage_editorial_image?`<img src="${s.homepage_editorial_image}" alt="" loading="lazy" decoding="async">`:placeholder('Editorial фото','1600 × 1200 px');

 $('topTitle').textContent=s.homepage_top_title||'ЗАРАЗ У ТОПІ';$('topLink').textContent=(s.homepage_top_link_text||'ДИВИТИСЬ ВСІ ТОВАРИ')+' →';
const {data:topItems,error:topItemsError}=topRes;
if(topItemsError)console.error(topItemsError);
const topSizes=['1000 × 1100 px','1600 × 700 px','1600 × 700 px','900 × 1100 px'];
const topMap=new Map((topItems||[]).map(x=>[Number(x.slot),x]));
$('topGrid').innerHTML=[1,2,3,4].map((slot,i)=>{
 const x=topMap.get(slot)||{};
 const inner=x.image_url?`<img src="${x.image_url}" alt="${x.caption||''}" loading="lazy" decoding="async">`:placeholder('Фото «Зараз у топі»',topSizes[i]);
 const cap=x.caption?`<span class="top-caption">${x.caption}</span>`:'';
 return x.link_url?`<a class="top-item" href="${x.link_url}">${inner}${cap}</a>`:`<div class="top-item">${inner}${cap}</div>`;
}).join('');

 $('categoriesTitle').textContent=s.homepage_categories_title||'КАТЕГОРІЇ';
 const {data:cats,error:catError}=catsRes;
 if(catError)console.error(catError);
 const categoryItems=cats||[];
 $('categoryGrid').innerHTML=categoryItems.length?categoryItems.map(c=>`<a class="category-card" href="catalog.html?category=${encodeURIComponent(c.slug)}">${c.cover_image?`<img src="${c.cover_image}" alt="${c.name}" loading="lazy" decoding="async">`:placeholder(c.name,'1600 × 800 px')}<div class="category-overlay"><div><h3>${c.name.toUpperCase()}</h3><small>ПЕРЕГЛЯНУТИ</small></div></div></a>`).join(''):'<div class="empty">Додайте активні категорії</div>';
 initCategoryCarousel();

 $('journalTitle').textContent=s.homepage_journal_title||'HEDONISTA JOURNAL';$('journalLink').textContent=(s.homepage_journal_link_text||'ВЕСЬ ЖУРНАЛ')+' →';const {data:news,error:newsError}=newsRes;if(newsError)console.error(newsError);$('homeNews').innerHTML=(news||[]).length?(news||[]).map(newsCard).join(''):'<div class="empty">Опублікуйте першу новину в адмінці</div>';
 initHomeJournalCarousel();


 $('brandStatementTitle').textContent=s.homepage_brand_title||'VINTAGE HEDONISTA';$('brandLine1').textContent=s.homepage_brand_line1||'Одяг з минулого.';$('brandLine2').textContent=s.homepage_brand_line2||'Стиль поза часом.';$('brandLocation').textContent=s.homepage_brand_location||'Odesa, Ukraine';
}


let NEW_ARRIVALS_TIMER=null;
function initNewArrivalsCarousel(){
 const track=$('newArrivals'),prev=$('newArrivalsPrev'),next=$('newArrivalsNext');
 if(!track||!prev||!next)return;
 const cards=[...track.children].filter(x=>!x.classList.contains('empty'));
 if(!cards.length){prev.classList.add('hidden');next.classList.add('hidden');return}

 // Mobile: exactly two cards in the viewport, swipe + arrows, no auto-scroll.
 if(window.innerWidth<=760){
   clearInterval(NEW_ARRIVALS_TIMER);
   track.style.transform='none';
   track.style.transition='none';

   const step=()=>Math.max(1,track.clientWidth);
   const update=()=>{
     const max=Math.max(0,track.scrollWidth-track.clientWidth-2);
     const hasOverflow=track.scrollWidth>track.clientWidth+4;
     prev.classList.toggle('hidden',!hasOverflow);
     next.classList.toggle('hidden',!hasOverflow);
     prev.disabled=track.scrollLeft<=2;
     next.disabled=track.scrollLeft>=max;
   };

   prev.onclick=()=>track.scrollBy({left:-step(),behavior:'smooth'});
   next.onclick=()=>track.scrollBy({left:step(),behavior:'smooth'});
   track.addEventListener('scroll',update,{passive:true});
   requestAnimationFrame(update);
   return;
 }

 let index=0;
 const visible=()=>window.innerWidth<=1050?2:4;
 const maxIndex=()=>Math.max(0,cards.length-visible());
 const draw=(animate=true)=>{
   const gap=parseFloat(getComputedStyle(track).gap)||16;
   const card=cards[0];
   const step=(card?.getBoundingClientRect().width||0)+gap;
   index=Math.min(Math.max(0,index),maxIndex());
   track.style.transition=animate?'transform .5s ease':'none';
   track.style.transform=`translateX(${-index*step}px)`;
   const noScroll=maxIndex()===0;
   prev.classList.toggle('hidden',noScroll);
   next.classList.toggle('hidden',noScroll)
 };
 const move=d=>{
   const max=maxIndex();
   if(!max)return;
   index=d>0?(index>=max?0:index+1):(index<=0?max:index-1);
   draw()
 };
 const restart=()=>{
   clearInterval(NEW_ARRIVALS_TIMER);
   if(maxIndex()>0)NEW_ARRIVALS_TIMER=setInterval(()=>move(1),2800)
 };
 prev.onclick=()=>{move(-1);restart()};
 next.onclick=()=>{move(1);restart()};
 const holder=track.closest('.new-arrivals-carousel');
 holder?.addEventListener('mouseenter',()=>clearInterval(NEW_ARRIVALS_TIMER));
 holder?.addEventListener('mouseleave',restart);
 window.addEventListener('resize',()=>{draw(false);restart()},{passive:true});
 draw(false);restart()
}

function initCategoryCarousel(){
 const grid=$('categoryGrid'),prev=$('categoryPrev'),next=$('categoryNext');
 if(!grid||!prev||!next)return;

 const step=()=>{
   const first=grid.querySelector('.category-card');
   if(!first)return grid.clientWidth;
   const gap=parseFloat(getComputedStyle(grid).columnGap||getComputedStyle(grid).gap||'0')||0;
   return first.getBoundingClientRect().width+gap;
 };

 const update=()=>{
   const max=Math.max(0,grid.scrollWidth-grid.clientWidth-2);
   prev.disabled=grid.scrollLeft<=2;
   next.disabled=grid.scrollLeft>=max;
   const hasOverflow=grid.scrollWidth>grid.clientWidth+4;
   prev.classList.toggle('hidden',!hasOverflow);
   next.classList.toggle('hidden',!hasOverflow);
 };

 prev.onclick=()=>grid.scrollBy({left:-step(),behavior:'smooth'});
 next.onclick=()=>grid.scrollBy({left:step(),behavior:'smooth'});
 grid.addEventListener('scroll',update,{passive:true});
 window.addEventListener('resize',update);
 requestAnimationFrame(update);
}

function newsCard(n){const href=`article.html?slug=${encodeURIComponent(n.slug)}`;return `<article class="story"><a class="story-image" href="${href}">${n.cover_image?`<img src="${n.cover_image}" alt="${n.title}" loading="lazy" decoding="async">`:placeholder('Обкладинка статті','1600 × 1000 px')}</a><small>${new Date(n.published_at||n.created_at).toLocaleDateString('uk-UA')}</small><h3><a href="${href}">${n.title}</a></h3><p>${n.excerpt||''}</p><a class="story-read" href="${href}">ЧИТАТИ →</a></article>`}

function initHomeJournalCarousel(){
 const track=$('homeNews'),prev=$('journalPrev'),next=$('journalNext');
 if(!track||!prev||!next)return;
 if(window.innerWidth>760){
   prev.classList.add('hidden');
   next.classList.add('hidden');
   return;
 }
 const cards=[...track.children].filter(x=>!x.classList.contains('empty'));
 if(!cards.length){
   prev.classList.add('hidden');
   next.classList.add('hidden');
   return;
 }
 const step=()=>{
   const card=cards[0];
   const gap=parseFloat(getComputedStyle(track).gap)||0;
   return (card?.getBoundingClientRect().width||track.clientWidth)+gap;
 };
 const update=()=>{
   const max=Math.max(0,track.scrollWidth-track.clientWidth-2);
   const hasOverflow=track.scrollWidth>track.clientWidth+4;
   prev.classList.toggle('hidden',!hasOverflow);
   next.classList.toggle('hidden',!hasOverflow);
   prev.disabled=track.scrollLeft<=2;
   next.disabled=track.scrollLeft>=max;
 };
 prev.onclick=()=>track.scrollBy({left:-step(),behavior:'smooth'});
 next.onclick=()=>track.scrollBy({left:step(),behavior:'smooth'});
 track.addEventListener('scroll',update,{passive:true});
 requestAnimationFrame(update);
}


let catalogProducts=[];
let catalogCategories=[];
let catalogFiltered=[];
let catalogVisibleCount=12;
const CATALOG_PAGE_SIZE=12;
const catalogState={
 category:null,
 brands:new Set(),
 sizes:new Set(),
 seasons:new Set(),
 colors:new Set(),
 minPrice:null,
 maxPrice:null,
 availability:'all',
 query:'',
 sort:'new'
};

function normalizeFilterValue(value){
 return String(value||'').trim().toLocaleLowerCase('uk-UA')
}
function uniqueFilterValues(values){
 return [...new Set(values.map(v=>String(v||'').trim()).filter(Boolean))]
   .sort((a,b)=>a.localeCompare(b,'uk-UA'))
}
function catalogPlural(n){
 const mod10=n%10,mod100=n%100;
 if(mod10===1&&mod100!==11)return 'товар';
 if([2,3,4].includes(mod10)&&![12,13,14].includes(mod100))return 'товари';
 return 'товарів'
}

async function initCatalog(){
 document.body.classList.add('vh-catalog-motion');

 const [, {data:productsData,error:productsError},{data:categoriesData,error:categoriesError}]=await Promise.all([
   loadSettings(),
   publicSb.from('products')
     .select('*,categories(id,name,slug),product_images(id,image_url,sort_order)')
     .in('status',['published','reserved','sold'])
     .order('created_at',{ascending:false}),
   publicSb.from('categories')
     .select('id,name,slug,sort_order,is_active')
     .eq('is_active',true)
     .order('sort_order',{ascending:true})
     .order('created_at',{ascending:true})
 ]);

 if(productsError){
   console.error('CATALOG LOAD ERROR:',productsError);
   $('catalogProducts').innerHTML=`<div class="empty">Не вдалося завантажити каталог<br><small>${productsError.message||productsError.code||'Помилка Supabase'}</small></div>`;
   return
 }
 if(categoriesError)console.error(categoriesError);

 catalogProducts=productsData||[];
 catalogCategories=categoriesData||[];

 const params=new URLSearchParams(location.search);
 catalogState.category=params.get('category')||null;

 // If URL contains an old/non-active category, return to all products.
 if(catalogState.category&&!catalogCategories.some(c=>c.slug===catalogState.category)){
   catalogState.category=null;
   updateCatalogUrl()
 }

 buildCatalogFilters();
 bindCatalogControls();
 applyCatalog(true)
}

function buildCatalogFilters(){
 const counts=new Map();
 catalogProducts.forEach(p=>{
   const slug=p.categories?.slug;
   if(slug)counts.set(slug,(counts.get(slug)||0)+1)
 });

 $('categoryFilters').innerHTML=
   `<label class="filter-option">
      <input type="checkbox" name="category" value="" ${!catalogState.category?'checked':''}>
      <span>Усі товари</span>
      <small class="filter-option-count">${catalogProducts.length}</small>
    </label>`+
   catalogCategories.map(c=>`
    <label class="filter-option">
      <input type="checkbox" name="category" value="${c.slug}" ${catalogState.category===c.slug?'checked':''}>
      <span>${c.name}</span>
      <small class="filter-option-count">${counts.get(c.slug)||0}</small>
    </label>`).join('');

 const brands=uniqueFilterValues(catalogProducts.map(p=>p.brand).filter(Boolean));
 $('brandFilters').innerHTML=brands.length
   ? brands.map(brand=>`<label class="filter-option"><input type="checkbox" value="${brand}"><span>${brand}</span><small class="filter-option-count">${catalogProducts.filter(p=>normalizeFilterValue(p.brand)===normalizeFilterValue(brand)).length}</small></label>`).join('')
   : '<div class="filter-empty">Бренди ще не вказані</div>';

 const sizes=uniqueFilterValues(
   catalogProducts.flatMap(p=>String(p.size||'').split(/[,/|;]/).map(x=>x.trim()))
 );
 $('sizeFilters').innerHTML=sizes.length
   ? sizes.map(size=>`<label class="filter-chip"><input type="checkbox" value="${size}"><span>${size}</span></label>`).join('')
   : '<div class="filter-empty">Розміри ще не вказані</div>';

 const seasonOrder=['Зима','Літо','Демісезон','Всесезон'];
 const seasons=seasonOrder.filter(season=>catalogProducts.some(p=>normalizeFilterValue(p.season)===normalizeFilterValue(season)));
 $('seasonFilters').innerHTML=seasons.length
   ? seasons.map(season=>`<label class="filter-option"><input type="checkbox" value="${season}"><span>${season}</span><small class="filter-option-count">${catalogProducts.filter(p=>normalizeFilterValue(p.season)===normalizeFilterValue(season)).length}</small></label>`).join('')
   : '<div class="filter-empty">Сезон ще не вказаний</div>';

 const colors=uniqueFilterValues(
   catalogProducts.flatMap(p=>String(p.color||'').split(/[,/|;]/).map(x=>x.trim()))
 );
 $('colorFilters').innerHTML=colors.length
   ? colors.map(color=>`<label class="filter-option"><input type="checkbox" value="${color}"><span>${color}</span></label>`).join('')
   : '<div class="filter-empty">Кольори ще не вказані</div>';

 const prices=catalogProducts.map(p=>Number(p.price||0)).filter(Number.isFinite);
 if(prices.length){
   $('priceMin').placeholder=String(Math.floor(Math.min(...prices)));
   $('priceMax').placeholder=String(Math.ceil(Math.max(...prices)));
 }
}

function bindCatalogControls(){
 const search=$('catalogSearch');
 const suggestions=$('catalogSearchSuggestions');
 const renderCatalogSuggestions=()=>{
   const q=normalizeFilterValue(search.value);
   $('clearCatalogSearch').classList.toggle('hidden',!q);
   if(!q){
     suggestions.classList.add('hidden');
     suggestions.innerHTML='';
     return
   }
   const matches=catalogProducts.filter(p=>{
     const hay=[p.name,p.brand,p.categories?.name,p.size,p.season,p.color].map(normalizeFilterValue).join(' ');
     return hay.includes(q)
   }).slice(0,6);
   suggestions.innerHTML=matches.length?matches.map(p=>`
     <a class="search-suggestion-row" href="product.html?slug=${encodeURIComponent(p.slug)}">
       ${p.cover_image?`<img src="${p.cover_image}" alt="" loading="lazy" decoding="async">`:'<span class="search-suggestion-placeholder"></span>'}
       <span><b>${p.name}</b><small>${p.brand||p.categories?.name||''}</small></span>
       <strong>${money(p.price)}</strong>
     </a>`).join(''):`<div class="search-no-results">Нічого не знайдено</div>`;
   suggestions.classList.remove('hidden')
 };
 search.addEventListener('input',renderCatalogSuggestions);
 search.addEventListener('focus',renderCatalogSuggestions);
 $('clearCatalogSearch').onclick=()=>{
   search.value='';
   suggestions.classList.add('hidden');
   suggestions.innerHTML='';
   $('clearCatalogSearch').classList.add('hidden');
   search.focus()
 };
 document.addEventListener('click',e=>{
   if(!e.target.closest('.catalog-search-box'))suggestions?.classList.add('hidden')
 });

 const sortWrap=$('catalogSortWrap');
 const sortTrigger=$('catalogSortTrigger');
 const sortMenu=$('catalogSortMenu');
 const sortCurrent=$('catalogSortCurrent');
 const sortNative=$('catalogSort');
 const sortLabels={
   'new':'Спочатку нові',
   'price-asc':'Ціна: від меншої',
   'price-desc':'Ціна: від більшої',
   'name-asc':'Назва: А–Я'
 };

 const closeSortMenu=()=>{
   sortMenu.classList.add('hidden');
   sortWrap.classList.remove('open');
   sortTrigger.setAttribute('aria-expanded','false');
 };
 sortTrigger.addEventListener('click',e=>{
   e.stopPropagation();
   const opening=sortMenu.classList.contains('hidden');
   sortMenu.classList.toggle('hidden',!opening);
   sortWrap.classList.toggle('open',opening);
   sortTrigger.setAttribute('aria-expanded',String(opening));
 });
 sortMenu.querySelectorAll('.catalog-sort-option').forEach(btn=>{
   btn.addEventListener('click',e=>{
     e.stopPropagation();
     const value=btn.dataset.sort;
     catalogState.sort=value;
     sortNative.value=value;
     sortCurrent.textContent=sortLabels[value];
     sortMenu.querySelectorAll('.catalog-sort-option').forEach(x=>x.classList.toggle('active',x===btn));
     closeSortMenu();
     applyCatalog(true);
   });
 });
 document.addEventListener('click',e=>{
   if(!sortWrap.contains(e.target))closeSortMenu();
 });
 document.addEventListener('keydown',e=>{
   if(e.key==='Escape')closeSortMenu();
 });

 $('categoryFilters').addEventListener('change',e=>{
   const input=e.target.closest('input[name="category"]');
   if(!input)return;

   const value=input.value||'';

   if(!value){
     // "Усі товари" always clears category selection.
     catalogState.category=null;
   }else if(input.checked){
     // Select this category and uncheck all others.
     catalogState.category=value;
   }else if(catalogState.category===value){
     // Tapping the selected category again cancels it.
     catalogState.category=null;
   }

   document.querySelectorAll('#categoryFilters input[name="category"]').forEach(x=>{
     x.checked = catalogState.category ? x.value===catalogState.category : x.value==='';
   });

   updateCatalogUrl();
   applyCatalog(true)
 });

 $('brandFilters').addEventListener('change',()=>{
   catalogState.brands=new Set([...$('brandFilters').querySelectorAll('input:checked')].map(x=>x.value));
   applyCatalog(true)
 });

 $('sizeFilters').addEventListener('change',()=>{
   catalogState.sizes=new Set([...$('sizeFilters').querySelectorAll('input:checked')].map(x=>x.value));
   applyCatalog(true)
 });

 $('seasonFilters').addEventListener('change',()=>{
   catalogState.seasons=new Set([...$('seasonFilters').querySelectorAll('input:checked')].map(x=>x.value));
   applyCatalog(true)
 });

 $('colorFilters').addEventListener('change',()=>{
   catalogState.colors=new Set([...$('colorFilters').querySelectorAll('input:checked')].map(x=>x.value));
   applyCatalog(true)
 });

 let priceTimer;
 const updatePrice=()=>{
   clearTimeout(priceTimer);
   priceTimer=setTimeout(()=>{
     catalogState.minPrice=$('priceMin').value===''?null:Number($('priceMin').value);
     catalogState.maxPrice=$('priceMax').value===''?null:Number($('priceMax').value);
     applyCatalog(true)
   },250)
 };
 $('priceMin').addEventListener('input',updatePrice);
 $('priceMax').addEventListener('input',updatePrice);

 document.querySelectorAll('input[name="availability"]').forEach(r=>r.addEventListener('change',e=>{
   catalogState.availability=e.target.value;
   applyCatalog(true)
 }));

 $('resetCatalogFilters').onclick=resetCatalogFilters;
 $('catalogLoadMore').onclick=()=>{
   catalogVisibleCount+=CATALOG_PAGE_SIZE;
   renderCatalogResults()
 };

 const setCatalogGrid=(columns)=>{
   catalogState.grid=columns===4?4:3;
   localStorage.setItem('vh_catalog_grid',String(catalogState.grid));
   $('catalogProducts').classList.toggle('catalog-grid-4',catalogState.grid===4);
   $('catalogView3').classList.toggle('active',catalogState.grid===3);
   $('catalogView4').classList.toggle('active',catalogState.grid===4);
 };
 $('catalogView3').onclick=()=>setCatalogGrid(3);
 $('catalogView4').onclick=()=>setCatalogGrid(4);
 setCatalogGrid(catalogState.grid);

 document.querySelectorAll('[data-filter-toggle]').forEach(btn=>btn.onclick=()=>{
   const body=btn.nextElementSibling;
   const collapsed=body.classList.toggle('collapsed');
   btn.lastElementChild.textContent=collapsed?'+':'−'
 });

 const openFilters=()=>{
   $('catalogSidebar').classList.add('open');
   $('catalogFilterOverlay').classList.add('show');
   document.body.classList.add('catalog-filter-open')
 };
 const closeFilters=()=>{
   $('catalogSidebar').classList.remove('open');
   $('catalogFilterOverlay').classList.remove('show');
   document.body.classList.remove('catalog-filter-open')
 };
 $('catalogFilterToggle').onclick=openFilters;
 $('catalogFilterClose').onclick=closeFilters;
 $('catalogFilterOverlay').onclick=closeFilters
}

function updateCatalogUrl(){
 const url=new URL(location.href);
 if(catalogState.category)url.searchParams.set('category',catalogState.category);
 else url.searchParams.delete('category');
 history.replaceState({},'',url)
}

function resetCatalogFilters(){
 catalogState.category=null;
 catalogState.brands.clear();
 catalogState.sizes.clear();
 catalogState.seasons.clear();
 catalogState.colors.clear();
 catalogState.minPrice=null;
 catalogState.maxPrice=null;
 catalogState.availability='all';

 document.querySelectorAll('input[name="category"]').forEach(x=>x.checked=x.value==='');
 document.querySelectorAll('#brandFilters input,#sizeFilters input,#seasonFilters input,#colorFilters input').forEach(x=>x.checked=false);
 document.querySelector('input[name="availability"][value="all"]').checked=true;
 $('priceMin').value='';
 $('priceMax').value='';
 updateCatalogUrl();
 applyCatalog(true)
}

function productMatchesMultiValue(productValue,selected){
 if(!selected.size)return true;
 const productTokens=String(productValue||'')
   .split(/[,/|;]/)
   .map(normalizeFilterValue)
   .filter(Boolean);
 return [...selected].some(v=>productTokens.includes(normalizeFilterValue(v)))
}


let CATALOG_MOTION_RENDER_ID=0;

function animateCatalogCardsV110(){
  if(((location.pathname||'').split('/').pop())!=='catalog.html')return;
  if(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches)return;

  const grid=$('catalogProducts');
  if(!grid)return;

  document.body.classList.add('vh-catalog-motion');
  const renderId=++CATALOG_MOTION_RENDER_ID;
  const cards=[...grid.querySelectorAll('.catalog-luxury-card')];

  cards.forEach((card,i)=>{
    card.classList.remove('vh-catalog-card-enter','is-visible');
    card.style.setProperty('--vh-catalog-card-delay',`${Math.min(i*48,280)}ms`);
  });

  requestAnimationFrame(()=>{
    if(renderId!==CATALOG_MOTION_RENDER_ID)return;
    grid.classList.add('vh-catalog-grid-ready');
    cards.forEach(card=>card.classList.add('vh-catalog-card-enter'));
    requestAnimationFrame(()=>{
      if(renderId!==CATALOG_MOTION_RENDER_ID)return;
      cards.forEach(card=>card.classList.add('is-visible'))
    })
  })
}

function pulseCatalogGridV110(){
  const grid=$('catalogProducts');
  if(!grid || !document.body.classList.contains('vh-catalog-motion'))return;
  grid.classList.remove('vh-catalog-filter-pulse');
  void grid.offsetWidth;
  grid.classList.add('vh-catalog-filter-pulse');
  setTimeout(()=>grid.classList.remove('vh-catalog-filter-pulse'),260)
}

function applyCatalog(resetVisible=false){
 if(resetVisible)catalogVisibleCount=CATALOG_PAGE_SIZE;

 const q=normalizeFilterValue(catalogState.query);

 catalogFiltered=catalogProducts.filter(p=>{
   if(catalogState.category&&p.categories?.slug!==catalogState.category)return false;
   if(catalogState.brands.size&&![...catalogState.brands].some(v=>normalizeFilterValue(v)===normalizeFilterValue(p.brand)))return false;
   if(!productMatchesMultiValue(p.size,catalogState.sizes))return false;
   if(catalogState.seasons.size&&![...catalogState.seasons].some(v=>normalizeFilterValue(v)===normalizeFilterValue(p.season)))return false;
   if(!productMatchesMultiValue(p.color,catalogState.colors))return false;

   const price=Number(p.price||0);
   if(catalogState.minPrice!==null&&price<catalogState.minPrice)return false;
   if(catalogState.maxPrice!==null&&price>catalogState.maxPrice)return false;
   if(catalogState.availability!=='all'&&p.status!==catalogState.availability)return false;

   if(q){
     const haystack=[
       p.name,p.brand,p.short_description,p.description,p.material,p.color,p.size,p.season,p.categories?.name
     ].map(normalizeFilterValue).join(' ');
     if(!haystack.includes(q))return false
   }
   return true
 });

 if(catalogState.sort==='price-asc')catalogFiltered.sort((a,b)=>Number(a.price)-Number(b.price));
 else if(catalogState.sort==='price-desc')catalogFiltered.sort((a,b)=>Number(b.price)-Number(a.price));
 else if(catalogState.sort==='name-asc')catalogFiltered.sort((a,b)=>String(a.name).localeCompare(String(b.name),'uk-UA'));
 else catalogFiltered.sort((a,b)=>new Date(b.created_at)-new Date(a.created_at));

 renderCatalogResults()
}

function renderCatalogResults(){
 const visible=catalogFiltered.slice(0,catalogVisibleCount);
 $('catalogProducts').innerHTML=visible.length
   ? visible.map(p=>catalogProductCard(p)).join('')
   : `<div class="catalog-no-results">
        <div class="catalog-no-results-title">НІЧОГО НЕ ЗНАЙДЕНО</div>
        <p>Спробуй змінити параметри фільтрації або очистити пошук.</p>
        <button type="button" onclick="resetCatalogFilters()">СКИНУТИ ФІЛЬТРИ</button>
      </div>`;

 const total=catalogFiltered.length;
 const shown=Math.min(visible.length,total);
 $('catalogCount').textContent=`${total} ${catalogPlural(total)}`;
 $('catalogResultText').textContent=total
   ? `Показано ${shown} з ${total}`
   : 'Немає результатів';

 $('catalogProgress').textContent=total&&shown<total?`${shown} / ${total}`:'';
 $('catalogLoadMore').classList.toggle('hidden',shown>=total||!total);

 renderActiveFilters();
 animateCatalogCardsV110();
 pulseCatalogGridV110()
}

function catalogProductCard(p){
 const href=`product.html?slug=${encodeURIComponent(p.slug)}`;
 const sold=p.status==='sold';
 const reserved=p.status==='reserved';
 const gallery=(Array.isArray(p.product_images)?p.product_images:[])
   .slice()
   .sort((a,b)=>Number(a.sort_order||0)-Number(b.sort_order||0))
   .map(x=>x.image_url)
   .filter(Boolean);
 const primaryImage=p.cover_image||gallery[0]||null;
 const secondImage=gallery.find(x=>x&&x!==primaryImage)||null;
 const hasSecond=!!secondImage;

 return `<article class="catalog-luxury-card ${sold?'catalog-card-sold':reserved?'catalog-card-reserved':''}">
   <a class="catalog-luxury-photo ${hasSecond?'has-second-photo':''}" href="${href}">
     <div class="catalog-photo-stack">
       ${primaryImage
         ? `<img class="catalog-photo-primary" src="${primaryImage}" alt="${p.name}">`
         : placeholder('Фото товару','1200 × 1500 px')}
       ${hasSecond?`<img class="catalog-photo-secondary" src="${secondImage}" alt="${p.name} — друге фото" loading="lazy">`:''}
     </div>

     <div class="catalog-card-badges">
       ${sold?'<span class="catalog-badge sold">ПРОДАНО</span>':reserved?'<span class="catalog-badge reserved">ЗАРЕЗЕРВОВАНО</span>':'<span class="catalog-badge one">1 / 1</span>'}
     </div>
   </a>

   <div class="catalog-luxury-info">
     <div class="catalog-luxury-main">
       ${p.brand?`<div class="catalog-luxury-brand">${p.brand}</div>`:''}
       <a class="catalog-luxury-name" href="${href}">${p.name}</a>
       ${p.size?`<div class="catalog-luxury-size">РОЗМІР ${p.size}</div>`:''}
     </div>
     <div class="catalog-luxury-bottom">
       <div class="catalog-luxury-price">${money(p.price)}</div>
       <button class="catalog-luxury-heart heart" type="button" aria-label="Додати в обране">♡</button>
     </div>
   </div>
 </article>`
}

function renderActiveFilters(){
 const chips=[];
 if(catalogState.category){
   const name=catalogProducts.find(p=>p.categories?.slug===catalogState.category)?.categories?.name||catalogState.category;
   chips.push({label:name,action:"category"})
 }
 catalogState.brands.forEach(v=>chips.push({label:`Бренд: ${v}`,action:`brand:${v}`}));
 catalogState.seasons.forEach(v=>chips.push({label:`Сезон: ${v}`,action:`season:${v}`}));
 catalogState.sizes.forEach(v=>chips.push({label:`Розмір ${v}`,action:`size:${v}`}));
 catalogState.colors.forEach(v=>chips.push({label:v,action:`color:${v}`}));
 if(catalogState.minPrice!==null)chips.push({label:`від ${money(catalogState.minPrice)}`,action:'minPrice'});
 if(catalogState.maxPrice!==null)chips.push({label:`до ${money(catalogState.maxPrice)}`,action:'maxPrice'});
 if(catalogState.availability==='published')chips.push({label:'В наявності',action:'availability'});
 if(catalogState.availability==='sold')chips.push({label:'Продані',action:'availability'});

 $('catalogActiveChips').innerHTML='';
 $('catalogActiveChips').classList.add('hidden');
 $('activeFilterCount').textContent=chips.length;
 $('activeFilterCount').classList.toggle('hidden',!chips.length);
}
window.resetCatalogFilters=resetCatalogFilters;


let currentProduct=null,currentImages=[],galleryIndex=0,lightboxIndex=0;

async function initProduct(){
 const slug=new URLSearchParams(location.search).get('slug');

 if(!slug){
   $('productRoot').innerHTML='<div class="empty">Товар не знайдено</div>';
   return
 }

 const [,{data,error}]=await Promise.all([
   loadSettings(),
   publicSb
   .from('products')
   .select('*,categories(name,slug),product_images(*)')
   .eq('slug',slug)
   .maybeSingle()
 ]);

 if(error||!data){
   console.error(error);
   $('productRoot').innerHTML='<div class="empty">Товар не знайдено</div>';
   return
 }

 currentProduct=data;
 currentImages=(data.product_images||[])
   .sort((a,b)=>(a.sort_order||0)-(b.sort_order||0))
   .map(x=>x.image_url);

 if(!currentImages.length&&data.cover_image)currentImages=[data.cover_image];

 renderProduct();

 let rec=[];

 // 1. Curated recommendations selected in admin.
 const {data:relatedRows,error:relatedError}=await publicSb
   .from('product_related_products')
   .select('related_product_id,sort_order')
   .eq('product_id',data.id)
   .order('sort_order',{ascending:true});

 if(relatedError && relatedError.code!=='42P01'){
   console.warn('Related products:',relatedError);
 }

 if(!relatedError && relatedRows?.length){
   const ids=relatedRows.map(x=>x.related_product_id);
   const {data:selectedProducts,error:selectedError}=await publicSb
     .from('products')
     .select('id,name,slug,brand,price,size,cover_image,status,product_images(image_url,sort_order)')
     .in('id',ids)
     .eq('status','published');

   if(!selectedError){
     const map=new Map((selectedProducts||[]).map(p=>[String(p.id),p]));
     rec=ids.map(id=>map.get(String(id))).filter(Boolean);
   }else{
     console.warn('Selected related products:',selectedError);
   }
 }

 // 2. Automatic fallback when no curated products are selected/available.
 if(!rec.length){
   const {data:fallback,error:fallbackError}=await publicSb
     .from('products')
     .select('id,name,slug,brand,price,size,cover_image,product_images(image_url,sort_order)')
     .eq('status','published')
     .neq('id',data.id)
     .order('created_at',{ascending:false})
     .limit(12);
   if(fallbackError)console.warn('Recommended products:',fallbackError);
   rec=fallback||[];
 }

 $('recommended').innerHTML=rec.map(recommendedProductCard).join('');
 initRecommendedCarousel();
 bindProductAccordions()
}

function recommendedProductCard(p){
 const href=`product.html?slug=${encodeURIComponent(p.slug)}`;
 const gallery=(p.product_images||[]).sort((a,b)=>(a.sort_order||0)-(b.sort_order||0));
 const image=p.cover_image||gallery[0]?.image_url||'';
 return `<article class="recommended-card">
   <a class="recommended-photo" href="${href}">
     ${image?`<img src="${image}" alt="${p.name}" loading="lazy" decoding="async">`:placeholder('Фото товару','1200 × 1200 px')}
   </a>
   <div class="recommended-info">
     ${p.brand?`<div class="recommended-brand">${p.brand}</div>`:''}
     <a href="${href}" class="recommended-name">${p.name}</a>
     ${p.size?`<div class="recommended-size">РОЗМІР ${p.size}</div>`:''}
     <div class="recommended-price">${money(p.price)}</div>
   </div>
 </article>`
}


function productMeasurementProfileV148(p){
 const text=`${p?.categories?.name||''} ${p?.categories?.slug||''}`.toLowerCase();

 if(/взут|shoe|boot|чоб|туф|черев|крос|босон/.test(text)){
   return [
     ['ДОВЖИНА УСТІЛКИ',p.measurement_insole]
   ]
 }
 if(/штан|брюк|джин|trouser|pant/.test(text)){
   return [
     ['ТАЛІЯ / ПОЯС',p.measurement_waist],
     ['СТЕГНА',p.measurement_hips],
     ['ЗАГАЛЬНА ДОВЖИНА',p.measurement_length],
     ['ВНУТРІШНІЙ ШОВ',p.measurement_inseam]
   ]
 }
 if(/спідниц|skirt/.test(text)){
   return [
     ['ТАЛІЯ / ПОЯС',p.measurement_waist],
     ['СТЕГНА',p.measurement_hips],
     ['ДОВЖИНА',p.measurement_length]
   ]
 }
 if(/сукн|dress/.test(text)){
   return [
     ['ПЛЕЧІ',p.measurement_shoulders],
     ['ГРУДИ',p.measurement_chest],
     ['ТАЛІЯ',p.measurement_waist],
     ['СТЕГНА',p.measurement_hips],
     ['ДОВЖИНА',p.measurement_length],
     ['РУКАВ',p.measurement_sleeve]
   ]
 }
 if(/голов|капелю|шап|берет|hat|headwear/.test(text)){
   return [['ОБХВАТ ГОЛОВИ',p.measurement_head]]
 }
 if(/сумк|аксес|bag|accessor/.test(text)){
   return [
     ['ШИРИНА',p.measurement_width],
     ['ВИСОТА',p.measurement_height],
     ['ГЛИБИНА',p.measurement_depth]
   ]
 }

 return [
   ['ПЛЕЧІ',p.measurement_shoulders||p.shoulders||p.measure_shoulders],
   ['ГРУДИ',p.measurement_chest||p.chest||p.measure_chest],
   ['ДОВЖИНА',p.measurement_length||p.length||p.measure_length],
   ['РУКАВ',p.measurement_sleeve||p.sleeve||p.measure_sleeve]
 ]
}

function renderProductMeasurementsV148(p){
 const host=$('productMeasurementsV148');
 if(!host)return;
 const rows=productMeasurementProfileV148(p);
 host.innerHTML=rows.map(([label,value])=>`
   <div><span>${label}</span><b>${value||'—'}</b></div>
 `).join('')
}

function renderProduct(){
 const p=currentProduct;
 $('productBreadcrumb').textContent=p.name||'ТОВАР';
 if($('productBrandFact'))$('productBrandFact').textContent=p.brand||'—';
 if($('productSeason'))$('productSeason').textContent=p.season||'—';
 $('productName').textContent=p.name;
 $('productPrice').textContent=money(p.price);
 $('productShortDescription').textContent=p.short_description||'';
 $('productShortDescription').classList.toggle('hidden',!p.short_description);
 $('productDesc').textContent=p.description||p.short_description||'Опис буде додано.';
 $('productSize').textContent=p.size||'Уточнюйте';
 $('productCondition').textContent=p.condition||'—';
 $('productColor').textContent=p.color||'—';
 $('productMaterial').textContent=p.material||'—';

 renderProductMeasurementsV148(p);
 $('productDetailsText').textContent=p.details_text||p.condition||'Деталі стану уточнюйте перед замовленням.';
 $('productShippingText').textContent=SITE_SETTINGS.shipping_text||'Доставка Новою поштою. Деталі оплати уточнюються після оформлення замовлення.';

 if(p.status==='sold'){
   $('buyBtn').textContent='ПРОДАНО';
   $('buyBtn').disabled=true
 }else if(p.status==='reserved'){
   $('buyBtn').textContent='ЗАРЕЗЕРВОВАНО';
   $('buyBtn').disabled=true
 }else{
   $('buyBtn').textContent='ЗАМОВИТИ';
   $('buyBtn').disabled=false
 }

 galleryIndex=0;
 renderGallery();
 setupSwipe()
}

function renderGallery(){
 const main=$('galleryMainImg'),thumbs=$('galleryThumbs'),count=$('galleryCount');
 if(!currentImages.length){
   main.removeAttribute('src');
   thumbs.innerHTML='';
   count.textContent='0 / 0';
   return
 }

 main.src=currentImages[galleryIndex];
 count.textContent=`${galleryIndex+1} / ${currentImages.length}`;

 thumbs.innerHTML=currentImages.map((u,i)=>`
   <button class="thumb ${i===galleryIndex?'active':''}" onclick="setGallery(${i})" type="button" aria-label="Фото ${i+1}">
     <img src="${u}" alt="">
   </button>`).join('');

 requestAnimationFrame(()=>{
   const active=thumbs.querySelector('.thumb.active');
   if(active)active.scrollIntoView({behavior:'smooth',block:'nearest',inline:'center'});
 })
}

function setGallery(i){
 galleryIndex=(i+currentImages.length)%currentImages.length;
 renderGallery()
}
window.setGallery=setGallery;

function shiftGallery(d){
 if(currentImages.length>1)setGallery(galleryIndex+d)
}
window.shiftGallery=shiftGallery;

function scrollThumbs(direction){
 const el=$('galleryThumbs');
 el.scrollBy({left:direction*260,behavior:'smooth'})
}
window.scrollThumbs=scrollThumbs;

function setupSwipe(){
 const el=$('galleryMain');
 let sx=0,sy=0;
 el.addEventListener('touchstart',e=>{
   sx=e.touches[0].clientX;sy=e.touches[0].clientY
 },{passive:true});
 el.addEventListener('touchend',e=>{
   const dx=e.changedTouches[0].clientX-sx,dy=e.changedTouches[0].clientY-sy;
   if(Math.abs(dx)>55&&Math.abs(dx)>Math.abs(dy)*1.2)shiftGallery(dx<0?1:-1)
 },{passive:true})
}


function initRecommendedCarousel(){
 const strip=$('recommended'),prev=$('recommendedPrev'),next=$('recommendedNext');
 if(!strip||!prev||!next)return;

 const section=strip.closest('.product-recommendations-v52');

 // V234: move arrow buttons OUT of the transformed heading/nav.
 // A transformed ancestor becomes the containing block for position:absolute,
 // which was the reason the arrows sat too low even with mathematically correct JS.
 if(section){
   section.appendChild(prev);
   section.appendChild(next);
 }

 const step=()=>{
   const card=strip.querySelector('.recommended-card');
   if(!card)return Math.max(1,strip.clientWidth);
   const styles=getComputedStyle(strip);
   const gap=parseFloat(styles.columnGap||styles.gap||'0')||0;
   return card.getBoundingClientRect().width+gap;
 };

 let raf=0;
 const alignArrows=()=>{
   cancelAnimationFrame(raf);
   raf=requestAnimationFrame(()=>{
     const photo=strip.querySelector('.recommended-photo');
     if(!section||!photo)return;

     const sectionRect=section.getBoundingClientRect();
     const photoRect=photo.getBoundingClientRect();

     // Exact visual midpoint of the square photo relative to the section.
     // Buttons are now direct children of section, so no transformed ancestor
     // can alter their containing block.
     const center=(photoRect.top-sectionRect.top)+(photoRect.height/2);
     prev.style.setProperty('top',`${center}px`,'important');
     next.style.setProperty('top',`${center}px`,'important');
   });
 };

 const update=()=>{
   const max=Math.max(0,strip.scrollWidth-strip.clientWidth);
   const mobile=window.matchMedia('(max-width:760px)').matches;

   // On mobile the controls must never disappear after repeated taps/reflow.
   if(mobile){
     prev.classList.remove('hidden');
     next.classList.remove('hidden');
   }else{
     const overflow=strip.scrollWidth>strip.clientWidth+4;
     prev.classList.toggle('hidden',!overflow);
     next.classList.toggle('hidden',!overflow);
   }

   prev.disabled=strip.scrollLeft<=2;
   next.disabled=strip.scrollLeft>=max-2;
   alignArrows();
 };

 const move=(direction)=>{
   const amount=step()*direction;
   strip.scrollBy({left:amount,behavior:'smooth'});
   // Recalculate during and after smooth scrolling.
   requestAnimationFrame(update);
   setTimeout(update,180);
   setTimeout(update,420);
 };

 prev.onclick=()=>move(-1);
 next.onclick=()=>move(1);

 strip.addEventListener('scroll',update,{passive:true});
 window.addEventListener('resize',update,{passive:true});
 window.addEventListener('orientationchange',()=>setTimeout(update,120),{passive:true});

 // Re-align when images actually finish loading.
 strip.querySelectorAll('img').forEach(img=>{
   if(img.complete)return;
   img.addEventListener('load',update,{once:true});
 });

 // Observe layout changes so the buttons stay centered even after late image/font reflow.
 if('ResizeObserver' in window){
   const ro=new ResizeObserver(()=>update());
   if(section)ro.observe(section);
   ro.observe(strip);
   strip.querySelectorAll('.recommended-photo').forEach(el=>ro.observe(el));
 }

 document.fonts?.ready?.then(update).catch(()=>{});

 requestAnimationFrame(()=>{
   update();
   setTimeout(update,80);
   setTimeout(update,300);
 });
}

function bindProductAccordions(){
 document.querySelectorAll('.product-accordion-head').forEach(btn=>{
   btn.onclick=()=>{
     const box=btn.closest('.product-accordion');
     const isOpen=box.classList.toggle('open');
     btn.querySelector('.accordion-symbol').textContent=isOpen?'−':'+'
   }
 })
}

/* Lightbox */
function openProductLightbox(){
 if(!currentImages.length)return;
 lightboxIndex=galleryIndex;
 renderLightbox();
 $('productLightbox').classList.remove('hidden');
 $('productLightbox').setAttribute('aria-hidden','false');
 document.body.classList.add('lightbox-open')
}
window.openProductLightbox=openProductLightbox;

function closeProductLightbox(){
 $('productLightbox').classList.add('hidden');
 $('productLightbox').setAttribute('aria-hidden','true');
 document.body.classList.remove('lightbox-open')
}
window.closeProductLightbox=closeProductLightbox;

function renderLightbox(){
 if(!currentImages.length)return;
 $('lightboxImage').src=currentImages[lightboxIndex];
 $('lightboxCount').textContent=`${lightboxIndex+1} / ${currentImages.length}`
}

function shiftLightbox(d){
 if(!currentImages.length)return;
 lightboxIndex=(lightboxIndex+d+currentImages.length)%currentImages.length;
 renderLightbox()
}
window.shiftLightbox=shiftLightbox;

document.addEventListener('keydown',e=>{
 const box=$('productLightbox');
 if(!box||box.classList.contains('hidden'))return;
 if(e.key==='Escape')closeProductLightbox();
 if(e.key==='ArrowLeft')shiftLightbox(-1);
 if(e.key==='ArrowRight')shiftLightbox(1)
});

document.addEventListener('click',e=>{
 const box=$('productLightbox');
 if(box&&!box.classList.contains('hidden')&&e.target===box)closeProductLightbox()
});

async function openOrder(){
 if(!currentProduct)return;
 if(currentProduct.status==='reserved')return toast('Цей товар уже зарезервовано');
 if(currentProduct.status==='sold')return toast('Цей товар уже продано');
 if(currentProduct.status!=='published')return toast('Цей товар зараз недоступний для замовлення');
 $('orderProduct').textContent=currentProduct.name;

 const {data:{user}}=await sb.auth.getUser();
 let profile=null;
 if(user){
   const {data,error}=await sb.from('customer_profiles').select('*').eq('id',user.id).maybeSingle();
   if(error)console.warn('order profile read',error);
   profile=data||null
 }

 let localProfile={};
 if(user){
   try{localProfile=JSON.parse(localStorage.getItem(VH_PROFILE_KEY)||'{}')||{}}catch{}
 }

 if(user){
   const meta=user.user_metadata||{};
   const full=profile?.full_name||meta.full_name||localProfile.name||'';
   const first=profile?.first_name||meta.first_name||String(full).split(' ')[0]||'';
   const last=profile?.last_name||meta.last_name||String(full).split(' ').slice(1).join(' ')||'';

   $('oFirstName').value=first;
   $('oLastName').value=last;
   $('oPhone').value=profile?.phone||meta.phone||user.phone||localProfile.phone||'';
   $('oCity').value=profile?.city||localProfile.city||'';
   $('oEmail').value=profile?.email||user.email||localProfile.email||'';
   $('oDelivery').value=profile?.delivery_address||localProfile.delivery_address||'';
   if($('oComment'))$('oComment').value='';
 }else{
   $('oFirstName').value='';
   $('oLastName').value='';
   $('oPhone').value='';
   $('oCity').value='';
   $('oEmail').value='';
   $('oDelivery').value='';
   if($('oComment'))$('oComment').value='';
 }

 $('orderCustomerState').innerHTML=user
   ? `<b>ВИ АВТОРИЗОВАНІ</b><span>Дані автоматично підставлено з особистого кабінету. За потреби їх можна змінити перед відправленням.</span>`
   : `<b>ЗАМОВЛЕННЯ БЕЗ АКАУНТА</b><span>Заповніть контактні дані, email для статусів замовлення та відділення Нової пошти.</span>`;

 $('orderModal').classList.remove('hidden');
 document.body.classList.add('vh-modal-open')
}
window.openOrder=openOrder;
function closeOrder(){$('orderModal').classList.add('hidden');document.body.classList.remove('vh-modal-open')}
window.closeOrder=closeOrder;

async function submitOrder(){
 const first_name=$('oFirstName').value.trim();
 const last_name=$('oLastName').value.trim();
 const phone=$('oPhone').value.trim();
 const city=$('oCity').value.trim();
 const email=$('oEmail').value.trim();
 const delivery_address=$('oDelivery').value.trim();
 const comment=$('oComment')?.value.trim()||null;
 if(!first_name||!last_name||!phone||!city||!email||!delivery_address)return toast('Заповніть ім’я, прізвище, телефон, email, місто та Нову пошту');
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return toast('Перевірте правильність email');
 const btn=$('orderSubmitBtn');
 if(btn){btn.disabled=true;btn.textContent='ПЕРЕВІРЯЄМО...'}
 try{
   // Re-check immediately before insert. DB trigger also locks the product,
   // so two buyers cannot reserve the same one-of-one item simultaneously.
   const {data:availability,error:availabilityError}=await publicSb.from('products').select('status').eq('id',currentProduct.id).maybeSingle();
   if(availabilityError)throw availabilityError;
   if(!availability||availability.status!=='published'){
     currentProduct.status=availability?.status||currentProduct.status;
     renderProduct();
     throw new Error(availability?.status==='reserved'?'Товар щойно зарезервував інший покупець':availability?.status==='sold'?'Товар уже продано':'Товар зараз недоступний')
   }
   if(btn)btn.textContent='НАДСИЛАЄМО...';
   const {data:{user}}=await sb.auth.getUser();
   const customer_name=`${first_name} ${last_name}`.trim();
   const payload={
     product_id:currentProduct.id,
     product_name:currentProduct.name,
     customer_name,
     first_name,
     last_name,
     phone,
     email,
     city,
     delivery_address,
     comment,
     amount:currentProduct.price,
     status:'new',
     user_id:user?.id||null
   };
   const {data:createdOrder,error}=await sb.from('orders').insert(payload).select('id').single();
   if(error){
     if(String(error.message||'').toLowerCase().includes('permission denied')){
       throw new Error('Не вдалося створити замовлення через налаштування доступу. Застосуйте SUPABASE_ORDER_PERMISSIONS_V250.sql у Supabase.');
     }
     throw error;
   }
   if(email&&createdOrder?.id){
     const emailResult=await vhSendOrderEmailV211(createdOrder.id,'created');
     if(emailResult?.ok)console.info('Order accepted email queued',createdOrder.id);
   }
   if(user){
     const profilePayload={
       email:email||user.email||null,first_name,last_name,full_name:customer_name,
       phone,city,delivery_address,updated_at:new Date().toISOString()
     };
     const {data:existing}=await sb.from('customer_profiles').select('id').eq('id',user.id).maybeSingle();
     const saveRes=existing
       ? await sb.from('customer_profiles').update(profilePayload).eq('id',user.id)
       : await sb.from('customer_profiles').insert({id:user.id,...profilePayload});
     if(saveRes.error)console.warn('order profile save',saveRes.error);
     await sb.auth.updateUser({data:{first_name,last_name,full_name:customer_name,phone}});
     localStorage.setItem(VH_PROFILE_KEY,JSON.stringify({
       name:customer_name,email:email||user.email||'',phone,city,delivery_address
     }))
   }
   toast('Замовлення надіслано');
   closeOrder()
  }catch(e){
   console.error(e);
   const msg=String(e?.message||'');
   if(msg.includes('PRODUCT_NOT_AVAILABLE'))toast('На жаль, цей товар уже зарезервовано або продано');
   else toast(msg||'Не вдалося надіслати замовлення')
 }
 finally{if(btn){btn.disabled=false;btn.textContent='НАДІСЛАТИ ЗАМОВЛЕННЯ'}}
}
window.submitOrder=submitOrder;

/* V249 — mobile keyboard: tap outside a field to dismiss it. */
document.addEventListener('pointerdown',e=>{
 const active=document.activeElement;
 if(!active || !/^(INPUT|TEXTAREA|SELECT)$/.test(active.tagName)) return;
 if(e.target.closest('input,textarea,select,[contenteditable="true"]')) return;
 active.blur();
},{capture:true});

let JOURNAL_ALL=[],JOURNAL_FILTER='all',JOURNAL_VISIBLE=5,JOURNAL_SORT='latest';

function journalDate(n){
  return new Date(n.published_at||n.created_at).toLocaleDateString('uk-UA',{day:'2-digit',month:'long',year:'numeric'}).toUpperCase()
}
function journalCategoryName(n){return n.category||'ІСТОРІЇ РЕЧЕЙ'}
function journalArticleHref(n){return `article.html?slug=${encodeURIComponent(n.slug)}`}
function journalCover(n,label='Обкладинка статті',size='1200 × 1200 px'){
  return n.cover_image?`<img src="${n.cover_image}" alt="${n.title}" loading="lazy" decoding="async">`:placeholder(label,size)
}
function journalSorted(items){
  return [...items].sort((a,b)=>{
    if(JOURNAL_SORT==='oldest'){
      const da=new Date(a.published_at||a.created_at).getTime();
      const db=new Date(b.published_at||b.created_at).getTime();
      return da-db;
    }
    // Default view respects the manual order from admin.
    const oa=Number(a.display_order||0),ob=Number(b.display_order||0);
    if(oa!==ob)return oa-ob;
    const da=new Date(a.published_at||a.created_at).getTime();
    const db=new Date(b.published_at||b.created_at).getTime();
    return db-da;
  })
}

function applyJournalPageSettings(s){
  const text=(id,val,fallback)=>{const e=$(id);if(e)e.textContent=val||fallback};
  text('journalPageTitle',s.journal_page_title,'ВІНТАЖНІ ХРОНІКИ');
  text('journalPageSubtitle',s.journal_page_subtitle,'Історії про вінтаж, стиль та речі поза часом');
  text('journalNewTitle',s.journal_new_title,'НОВЕ НА САЙТІ');
  text('journalGuideSubtitle',s.journal_guide_subtitle,'КОРИСНІ ГІДИ ТА ПОРАДИ');
  if($('journalGuideTitle')){
    const guideTitle=String(s.journal_guide_title||'HEDONISTA\nGUIDE').replace(/\\n/g,'\n');
    $('journalGuideTitle').innerHTML=guideTitle.replace(/\n/g,'<br>');
  }
  text('journalOtherTitle',s.journal_other_title,'ІНШІ ПУБЛІКАЦІЇ');
  text('journalCtaTitle',s.journal_cta_title,'ЗНАЙШЛИ НАТХНЕННЯ?');
  text('journalCtaText',s.journal_cta_text,'Відкрийте для себе вінтажні знахідки у нашому каталозі.');
  if($('journalCtaLink')){
    $('journalCtaLink').textContent=s.journal_cta_link_text||'ПЕРЕЙТИ ДО КАТАЛОГУ →';
    $('journalCtaLink').href=s.journal_cta_link_url||'catalog.html';
  }
  if($('journalCtaSection') && s.journal_cta_image){
    $('journalCtaSection').style.backgroundImage=`url("${s.journal_cta_image}")`;
    $('journalCtaSection').classList.add('has-bg');
  }
}


function animateJournalContentV108(){
  if(((location.pathname||'').split('/').pop())!=='journal.html')return;
  if(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches)return;

  const featured=document.querySelector('.journal-v37-feature');
  if(featured){
    featured.classList.remove('vh-journal-feature-enter');
    void featured.offsetWidth;
    featured.classList.add('vh-journal-feature-enter');
    requestAnimationFrame(()=>featured.classList.add('is-visible'))
  }

  const groups=[
    ['#journalNewGrid .journal-v37-new-card','--vh-news-delay',80],
    ['#journalGuideList .journal-v37-guide-card','--vh-news-delay',70],
    ['#journalOtherGrid .journal-v37-other-card','--vh-news-delay',65]
  ];

  groups.forEach(([selector,varName,step])=>{
    const items=[...document.querySelectorAll(selector)];
    items.forEach((item,i)=>{
      item.classList.remove('vh-journal-news-enter','is-visible');
      item.style.setProperty(varName,`${Math.min(i*step,320)}ms`)
    });
    requestAnimationFrame(()=>{
      items.forEach(item=>{
        item.classList.add('vh-journal-news-enter');
        requestAnimationFrame(()=>item.classList.add('is-visible'))
      })
    })
  })
}

function initJournalGuideCarouselV244(){
  const grid=$('journalGuideList');
  const prev=$('journalGuidePrev');
  const next=$('journalGuideNext');
  const counter=$('journalGuideCounter');
  if(!grid||!prev||!next||!counter)return;

  const cards=[...grid.querySelectorAll('.journal-v37-guide-card')];
  if(!cards.length){
    prev.disabled=true;
    next.disabled=true;
    counter.textContent='00 / 00';
    return;
  }

  const mobile=()=>window.matchMedia('(max-width: 600px)').matches;
  let index=0;
  let raf=0;

  const pad=n=>String(n).padStart(2,'0');
  const maxIndex=()=>Math.max(0,cards.length-1);
  const cardWidth=()=>grid.clientWidth||cards[0]?.getBoundingClientRect().width||1;
  const update=()=>{
    if(!mobile())index=0;
    else index=Math.max(0,Math.min(maxIndex(),Math.round(grid.scrollLeft/cardWidth())));
    counter.textContent=`${pad(index+1)} / ${pad(cards.length)}`;
    prev.disabled=index<=0;
    next.disabled=index>=maxIndex();
  };
  const go=idx=>{
    index=Math.max(0,Math.min(maxIndex(),idx));
    grid.scrollTo({left:index*cardWidth(),behavior:'smooth'});
    window.setTimeout(update,260);
    update();
  };

  prev.onclick=()=>go(index-1);
  next.onclick=()=>go(index+1);
  grid.onscroll=()=>{
    cancelAnimationFrame(raf);
    raf=requestAnimationFrame(update);
  };

  /* Preserve the same card after orientation/viewport changes. */
  const onResize=()=>{
    if(!mobile())grid.scrollLeft=0;
    else grid.scrollLeft=index*cardWidth();
    update();
  };
  if(!grid.dataset.v244ResizeBound){
    window.addEventListener('resize',onResize,{passive:true});
    grid.dataset.v244ResizeBound='1';
  }
  update();
}

function renderJournalV37(){
  const journalVisible=JOURNAL_ALL.filter(n=>n.show_in_journal!==false);
  let filtered=JOURNAL_FILTER==='all'
    ? journalVisible
    : journalVisible.filter(n=>(n.category||'ІСТОРІЇ РЕЧЕЙ')===JOURNAL_FILTER);
  filtered=journalSorted(filtered);

  const featured=filtered.find(n=>n.is_featured)||filtered[0]||null;
  $('journalFeatured').innerHTML=featured?`
    <article class="journal-v37-feature">
      <a class="journal-v37-feature-image" href="${journalArticleHref(featured)}">
        ${journalCover(featured,'Головна стаття','1600 × 1000 px')}
      </a>
      <div class="journal-v37-feature-copy">
        <div class="journal-v37-label">ГОЛОВНА СТАТТЯ</div>
        ${featured.is_guide?'<div class="journal-v37-guide-tag">HEDONISTA GUIDE</div>':''}
        <h2><a href="${journalArticleHref(featured)}">${featured.title}</a></h2>
        <div class="journal-v37-date">${journalDate(featured)}</div>
        ${featured.excerpt?`<p>${featured.excerpt}</p>`:''}
        <a class="journal-v37-read" href="${journalArticleHref(featured)}">ЧИТАТИ СТАТТЮ →</a>
      </div>
    </article>`:'<div class="empty">Опублікуйте першу статтю в адмінці</div>';

  const rest=featured?filtered.filter(n=>n.id!==featured.id):filtered;

  let newItems=rest.filter(n=>n.is_new_section)
    .sort((a,b)=>(a.new_order||0)-(b.new_order||0))
    .slice(0,3);
  // If nothing has been explicitly assigned yet, keep a useful fallback.
  if(!newItems.length)newItems=rest.filter(n=>!n.is_guide).slice(0,3);

  $('journalNewGrid').innerHTML=newItems.map(n=>`
    <article class="journal-v37-new-card">
      <a class="journal-v37-new-image" href="${journalArticleHref(n)}">${journalCover(n)}</a>
      <div class="journal-v37-card-copy">
        <div class="journal-v37-meta">${journalCategoryName(n)}　·　${journalDate(n)}</div>
        <h3><a href="${journalArticleHref(n)}">${n.title}</a></h3>
        ${n.excerpt?`<p>${n.excerpt}</p>`:''}
        <a class="journal-v37-read" href="${journalArticleHref(n)}">ЧИТАТИ →</a>
      </div>
    </article>`).join('');

  const guides=JOURNAL_ALL.filter(n=>n.is_guide===true)
    .sort((a,b)=>{
      const oa=Number(a.guide_order||0),ob=Number(b.guide_order||0);
      if(oa!==ob)return oa-ob;
      return new Date(b.published_at||b.created_at)-new Date(a.published_at||a.created_at);
    })
    .slice(0,4);
  $('journalGuideList').innerHTML=guides.length?guides.map((n,i)=>`
    <a class="journal-v37-guide-card" href="${journalArticleHref(n)}">
      <span>${String(i+1).padStart(2,'0')}</span>
      <h3>${n.title}</h3>
      <b>ЧИТАТИ →</b>
    </a>`).join(''):'<div class="journal-v37-guide-empty">Позначте статті як HEDONISTA GUIDE в адмінці.</div>';

  initJournalGuideCarouselV244();

  const used=new Set([featured?.id,...newItems.map(x=>x.id),...guides.map(x=>x.id)].filter(Boolean));
  const other=filtered.filter(n=>!used.has(n.id));
  const visible=other.slice(0,JOURNAL_VISIBLE);

  $('journalOtherGrid').innerHTML=visible.length?visible.map(n=>`
    <article class="journal-v37-other-card">
      <a class="journal-v37-other-image" href="${journalArticleHref(n)}">${journalCover(n)}</a>
      <div class="journal-v37-meta">${journalCategoryName(n)}　·　${journalDate(n)}</div>
      <h3><a href="${journalArticleHref(n)}">${n.title}</a></h3>
      <a class="journal-v37-read" href="${journalArticleHref(n)}">ЧИТАТИ →</a>
    </article>`).join(''):'<div class="journal-v37-empty">Інших публікацій поки немає.</div>';

  $('journalLoadMore').classList.toggle('hidden',JOURNAL_VISIBLE>=other.length);

  // Re-run entrance effects every time Journal content is rendered:
  // initial load, category filter, sort change, or "Показати ще".
  animateJournalContentV108();
}

async function initJournal(){
  const [s,{data,error}]=await Promise.all([
    loadSettings(),
    publicSb.from('news').select('id,title,slug,excerpt,content,category,cover_image,gallery_images,is_featured,is_new_section,is_guide,show_in_journal,display_order,new_order,guide_order,published_at,created_at').eq('status','published').order('display_order',{ascending:true}).order('published_at',{ascending:false})
  ]);
  applyJournalPageSettings(s||{});
  if(error){
    console.error(error);
    $('journalFeatured').innerHTML='<div class="empty">Не вдалося завантажити Journal</div>';
    return;
  }

  JOURNAL_ALL=data||[];
  const journalVisibleCategories=JOURNAL_ALL
    .filter(n=>n.show_in_journal!==false)
    .map(n=>String(n.category||'').trim().toUpperCase())
    .filter(Boolean);
  const cats=['all',...new Set(journalVisibleCategories)];
  $('journalCategories').innerHTML=cats.map(c=>`
    <button class="${c==='all'?'active':''}" data-journal-cat="${c}">
      ${c==='all'?'УСІ':c}
    </button>`).join('');

  $('journalCategories').querySelectorAll('button').forEach(btn=>btn.onclick=()=>{
    JOURNAL_FILTER=btn.dataset.journalCat;
    JOURNAL_VISIBLE=5;
    $('journalCategories').querySelectorAll('button').forEach(b=>b.classList.toggle('active',b===btn));
    renderJournalV37();
  });

  $('journalSort').onchange=e=>{JOURNAL_SORT=e.target.value;renderJournalV37()};
  $('journalLoadMore').onclick=()=>{JOURNAL_VISIBLE+=5;renderJournalV37()};
  renderJournalV37();
}

function escapeArticleHtml(value){
  return String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[ch]))
}

function articleNormalizedText(value){
 return String(value||'').replace(/\r/g,'').trim()
}
function articleSameText(a,b){
 const clean=v=>String(v||'').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim();
 return clean(a)===clean(b)
}
function renderEditorialArticleContent(content,title){
 const raw=String(content||'').trim();
 if(raw.startsWith('VH_BLOCKS_V1:')){
   try{
     const blocks=JSON.parse(raw.slice('VH_BLOCKS_V1:'.length));
     return (Array.isArray(blocks)?blocks:[]).map(b=>{
       if(b.type==='heading'&&!articleSameText(b.text,title))return `<section class="article-v71-section"><h2>${escapeArticleHtml(b.text||'')}</h2>${b.after?`<p>${escapeArticleHtml(b.after).replace(/\n/g,'<br>')}</p>`:''}</section>`;
       if(b.type==='image'&&b.url)return `<figure class="article-v185-inline-image"><img src="${b.url}" alt="${escapeArticleHtml(b.caption||'')}" loading="lazy" decoding="async">${b.caption?`<figcaption>${escapeArticleHtml(b.caption)}</figcaption>`:''}</figure>`;
       if(b.type==='paragraph'&&!articleSameText(b.text,title))return `<p>${escapeArticleHtml(b.text||'').replace(/\n/g,'<br>')}</p>`;
       return '';
     }).join('')||'<p>Текст статті буде додано.</p>';
   }catch(e){console.warn('Journal blocks parse failed',e)}
 }
 const blocks=articleNormalizedText(content).split(/\n\s*\n/).map(x=>x.trim()).filter(Boolean);
 if(!blocks.length)return '<p>Текст статті буде додано.</p>';
 return blocks.filter(block=>!articleSameText(block,title)).map(block=>{
   const lines=block.split('\n').map(x=>x.trim()).filter(Boolean);
   if(lines[0]?.startsWith('## ')){
     const heading=lines[0].slice(3).trim(),body=lines.slice(1).join('\n').trim();
     return `<section class="article-v71-section"><h2>${escapeArticleHtml(heading)}</h2>${body?`<p>${escapeArticleHtml(body).replace(/\n/g,'<br>')}</p>`:''}</section>`;
   }
   if(lines.length&&lines.every(x=>x.startsWith('- ')))return `<ul class="article-v71-list">${lines.map(x=>`<li>${escapeArticleHtml(x.slice(2))}</li>`).join('')}</ul>`;
   return `<p>${escapeArticleHtml(block).replace(/\n/g,'<br>')}</p>`;
 }).join('');
}

async function initArticle(){
 const slug=new URLSearchParams(location.search).get('slug');
 if(!slug){$('articleRoot').innerHTML='<div class="empty">Статтю не знайдено</div>';return}

 const [,{data,error}]=await Promise.all([
   loadSettings(),
   publicSb.from('news').select('id,title,slug,excerpt,content,category,cover_image,gallery_images,published_at,created_at').eq('slug',slug).eq('status','published').maybeSingle()
 ]);
 if(error||!data){
   $('articleRoot').innerHTML='<div class="empty">Статтю не знайдено або вона ще не опублікована</div>';
   return
 }

 document.title=`${data.title} — Vintage Hedonista`;

 const gallery=Array.isArray(data.gallery_images)?data.gallery_images:[];
 const bodyHtml=renderEditorialArticleContent(data.content,data.title);

 $('articleRoot').innerHTML=`
   <article class="article-v71">
     <section class="article-v71-cover-intro">
       <div class="article-v71-masthead">HEDONISTA JOURNAL</div>
       <h1>${escapeArticleHtml(data.title)}</h1>
     </section>

     ${data.cover_image?`
       <figure class="article-v71-cover">
         <img src="${data.cover_image}" alt="${escapeArticleHtml(data.title)}" fetchpriority="high" loading="eager" decoding="async">
       </figure>`:''}

     ${data.excerpt?`
       <div class="article-v71-deck">
         <p>${escapeArticleHtml(data.excerpt)}</p>
       </div>`:''}

     <div class="article-v71-content">
       ${bodyHtml}
     </div>

     ${gallery.length?`
       <section class="article-v71-gallery">
         ${gallery.map(u=>`<img src="${u}" alt="" loading="lazy" decoding="async">`).join('')}
       </section>`:''}

     <nav class="article-v71-bottom">
       <a href="journal.html">← ПОВЕРНУТИСЬ ДО ЖУРНАЛУ</a>
       <a href="catalog.html">ПЕРЕЙТИ ДО КАТАЛОГУ →</a>
     </nav>
   </article>`;
}

/* ==========================================================
   V42 — DELIVERY + CONTACTS
   ========================================================== */
function setServiceText(id,value,fallback){
 const el=$(id);if(el)el.textContent=value||fallback
}
async function initDeliveryPage(){
 const s=await loadSettings();
 setServiceText('deliveryKicker',s.delivery_page_kicker,'VINTAGE HEDONISTA · SERVICE');
 if($('deliveryTitle'))$('deliveryTitle').innerHTML=String(s.delivery_page_title||'ДОСТАВКА\nІ ОПЛАТА').replace(/\\n/g,'\n').replace(/\n/g,'<br>');
 setServiceText('deliveryIntro',s.delivery_page_intro,'Прості умови, щоб покупка вінтажної речі була зрозумілою від замовлення до отримання.');
 setServiceText('deliveryShippingTitle',s.delivery_shipping_title,'ДОСТАВКА');
 setServiceText('deliveryShippingText',s.delivery_shipping_text||s.shipping_text,'Доставка по Україні. Деталі та спосіб відправлення узгоджуємо під час підтвердження замовлення.');
 setServiceText('deliveryPaymentTitle',s.delivery_payment_title,'ОПЛАТА');
 setServiceText('deliveryPaymentText',s.delivery_payment_text||s.payment_text,'Умови оплати підтверджуємо перед відправленням, щоб усі деталі були зрозумілі заздалегідь.');
 setServiceText('deliveryExtraTitle',s.delivery_extra_title,'ПЕРЕД ВІДПРАВЛЕННЯМ');
 setServiceText('deliveryExtraText',s.delivery_extra_text,'За потреби надішлемо додаткові фото, відео, точні заміри та деталі стану речі.');
 setServiceText('deliveryProcessTitle',s.delivery_process_title,'ВІД ЗАМОВЛЕННЯ ДО ВІДПРАВЛЕННЯ');
 ['1','2','3'].forEach(i=>{
   setServiceText('deliveryStep'+i+'Title',s['delivery_step'+i+'_title'],['ЗАМОВЛЕННЯ','ПІДТВЕРДЖЕННЯ','ВІДПРАВЛЕННЯ'][i-1]);
   setServiceText('deliveryStep'+i+'Text',s['delivery_step'+i+'_text'],[
     'Обираєте річ та залишаєте заявку на сайті.',
     'Ми уточнюємо деталі, заміри, оплату та доставку.',
     'Після підтвердження готуємо річ та передаємо її на доставку.'
   ][i-1]);
 });
 setServiceText('deliveryCtaTitle',s.delivery_cta_title,'ЗАЛИШИЛИСЯ ПИТАННЯ?');
 setServiceText('deliveryCtaText',s.delivery_cta_text,'Напишіть нам — допоможемо з доставкою, оплатою або деталями конкретної речі.');
 if($('deliveryCtaLink')){
   $('deliveryCtaLink').textContent=s.delivery_cta_link_text||'ЗВ’ЯЗАТИСЯ З НАМИ →';
   $('deliveryCtaLink').href=s.delivery_cta_link_url||'contacts.html';
 }
}

function normalizeSocialUrl(value,type){
 const v=String(value||'').trim();
 if(!v)return '#';
 if(/^https?:\/\//i.test(v))return v;
 const clean=v.replace(/^@/,'');
 if(type==='instagram')return `https://instagram.com/${clean}`;
 if(type==='telegram')return `https://t.me/${clean.replace(/^t\.me\//,'')}`;
 return v;
}
async function initContactsPage(){
 const s=await loadSettings();
 setServiceText('contactsKicker',s.contacts_page_kicker,'VINTAGE HEDONISTA');
 setServiceText('contactsTitle',s.contacts_page_title,'КОНТАКТИ');
 setServiceText('contactsIntro',s.contacts_page_intro,'Потрібні точні заміри, додаткові фото або допомога з вибором — напишіть нам.');
 setServiceText('contactsListTitle',s.contacts_list_title,'ЗВ’ЯЗОК');

 const igText=s.contacts_instagram_text||s.instagram||'@vintage_hedonista';
 const tgText=s.contacts_telegram_text||s.telegram||'Vintage Hedonista';
 const email=s.contacts_email_text||s.email||'vintagedenis@gmail.com';
 const phone=s.contacts_phone_text||s.phone||'+380 99 999 99 99';

 setServiceText('contactsInstagramText',igText,'@vintage_hedonista');
 setServiceText('contactsTelegramText',tgText,'Vintage Hedonista');
 setServiceText('contactsEmailText',email,'vintagedenis@gmail.com');
 setServiceText('contactsPhoneText',phone,'+380 99 999 99 99');

 if($('contactsInstagramLink'))$('contactsInstagramLink').href=s.contacts_instagram_url||normalizeSocialUrl(igText,'instagram');
 if($('contactsTelegramLink'))$('contactsTelegramLink').href=s.contacts_telegram_url||normalizeSocialUrl(tgText,'telegram');
 if($('contactsEmailLink'))$('contactsEmailLink').href=email?`mailto:${email}`:'#';
 if($('contactsPhoneLink'))$('contactsPhoneLink').href=phone?`tel:${phone.replace(/[^\d+]/g,'')}`:'#';

 setServiceText('contactsHelpTitle',s.contacts_help_title,'ДОПОМОЖЕМО З ВИБОРОМ');
 setServiceText('contactsHelpText',s.contacts_help_text,'Розкажемо про стан речі, перевіримо заміри, надішлемо додаткові фото та допоможемо зорієнтуватися перед замовленням.');
 setServiceText('contactsTopicsTitle',s.contacts_topics_title,'МИ НА ЗВ’ЯЗКУ, ЯКЩО ПОТРІБНО БІЛЬШЕ ДЕТАЛЕЙ');
 ['1','2','3'].forEach(i=>{
   setServiceText('contactsTopic'+i+'Title',s['contacts_topic'+i+'_title'],['ЗАМІРИ','СТАН І ФОТО','ДОСТАВКА'][i-1]);
   setServiceText('contactsTopic'+i+'Text',s['contacts_topic'+i+'_text'],[
     'Перевіримо точні параметри конкретної речі.',
     'Покажемо деталі, фактуру та нюанси стану крупним планом.',
     'Допоможемо уточнити умови оплати, резерву та відправлення.'
   ][i-1]);
 });
}

/* V137: removed obsolete applyUnifiedFooter() call; footer is already rendered by current page code. */


/* ==========================================================
   V65 — HEADER SEARCH / PROFILE / CART / CHECKOUT
   ========================================================== */
const VH_CART_KEY='vh_cart_v1';
const VH_PROFILE_KEY='vh_profile_v1';

function vhGetCart(){
 try{return JSON.parse(localStorage.getItem(VH_CART_KEY)||'[]')}catch{return []}
}
function vhSetCart(items){
 localStorage.setItem(VH_CART_KEY,JSON.stringify(items));
 vhUpdateCartBadge();
}
function vhGetProfile(){
 try{return JSON.parse(localStorage.getItem(VH_PROFILE_KEY)||'null')}catch{return null}
}
function vhMoney(v){return new Intl.NumberFormat('uk-UA').format(Number(v||0))+' грн'}

function vhUpdateCartBadge(){
 const cart=vhGetCart();
 document.querySelectorAll('.bag-count').forEach(el=>{
   el.textContent=String(cart.length);
   el.classList.toggle('is-empty',cart.length===0)
 })
}

function vhEnsureGlobalUI(){
 if(document.getElementById('vhGlobalUi'))return;
 const wrap=document.createElement('div');
 wrap.id='vhGlobalUi';
 wrap.innerHTML=`
 <div class="vh-overlay hidden" id="vhSearchOverlay">
   <div class="vh-search-panel">
     <button class="vh-close" type="button" data-vh-close="search">×</button>
     <div class="vh-panel-kicker">VINTAGE HEDONISTA</div>
     <h2>ПОШУК</h2>
     <div class="vh-global-search-field">
       <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="6.5"></circle><path d="M16 16l4 4"></path></svg>
       <input id="vhGlobalSearchInput" type="search" autocomplete="off" placeholder="Назва, бренд або категорія">
     </div>
     <div id="vhGlobalSearchResults" class="vh-global-results"><div class="vh-search-hint">Почніть вводити назву речі або бренду.</div></div>
   </div>
 </div>

 <div class="vh125-login-overlay hidden" id="vh125LoginOverlay">
   <aside class="vh125-login-drawer" role="dialog" aria-modal="true" aria-label="Вхід до особистого кабінету">
     <button class="vh125-login-close" type="button" data-vh-close="profile" aria-label="Закрити">×</button>
     <div id="vh125LoginRoot"></div>
   </aside>
 </div>

 <div class="vh-cart-backdrop hidden" id="vhCartBackdrop"></div>
 <aside class="vh-cart-drawer" id="vhCartDrawer">
   <div class="vh-cart-head">
     <div><div class="vh-panel-kicker">VINTAGE HEDONISTA</div><h2>КОШИК</h2></div>
     <button class="vh-close" type="button" data-vh-close="cart">×</button>
   </div>
   <div id="vhCartItems" class="vh-cart-items"></div>
   <div class="vh-cart-footer">
     <div class="vh-cart-total"><span>РАЗОМ</span><b id="vhCartTotal">0 грн</b></div>
     <a class="vh-primary-btn vh-checkout-link" id="vhCheckoutLink" href="checkout.html">ПЕРЕЙТИ ДО ОФОРМЛЕННЯ →</a>
   </div>
 </aside>`;
 document.body.appendChild(wrap);

 document.querySelectorAll('[data-vh-close]').forEach(btn=>btn.addEventListener('click',()=>vhClosePanel(btn.dataset.vhClose)));
 $('vhCartBackdrop')?.addEventListener('click',()=>vhClosePanel('cart'));
 $('vhSearchOverlay')?.addEventListener('click',e=>{if(e.target.id==='vhSearchOverlay')vhClosePanel('search')});
 $('vh125LoginOverlay')?.addEventListener('click',e=>{if(e.target.id==='vh125LoginOverlay')vhClosePanel('profile')});




 let timer;
 $('vhGlobalSearchInput').addEventListener('input',()=>{
   clearTimeout(timer);
   timer=setTimeout(()=>vhRunGlobalSearch($('vhGlobalSearchInput').value),120)
 });
}

function vhOpenPanel(type){
 vhEnsureGlobalUI();
 if(type==='search'){
   $('vhSearchOverlay').classList.remove('hidden');
   document.body.classList.add('vh-modal-open');
   setTimeout(()=>$('vhGlobalSearchInput').focus(),30)
 }
 if(type==='profile'){
   vhGetCurrentUser().then(user=>{
     if(user){ location.href='account.html'; return }
     $('vh125LoginOverlay').classList.remove('hidden');
     document.body.classList.add('vh-modal-open');
     vhShowAuth('login')
   })
 }
 if(type==='cart'){
   vhRenderCart();
   $('vhCartBackdrop').classList.remove('hidden');
   $('vhCartDrawer').classList.add('open');
   document.body.classList.add('vh-modal-open')
 }
}
function vhClosePanel(type){
 if(type==='search')$('vhSearchOverlay')?.classList.add('hidden');
 if(type==='profile')$('vh125LoginOverlay')?.classList.add('hidden');
 if(type==='cart'){
   $('vhCartBackdrop')?.classList.add('hidden');
   $('vhCartDrawer')?.classList.remove('open')
 }
 if(!document.querySelector('.vh-overlay:not(.hidden)')&&!document.querySelector('.vh125-login-overlay:not(.hidden)')&&!$('vhCartDrawer')?.classList.contains('open'))document.body.classList.remove('vh-modal-open')
}

let VH_SEARCH_CACHE=null;
let VH_SEARCH_CACHE_AT=0;
async function vhRunGlobalSearch(raw){
 const q=normalizeFilterValue(raw);
 const box=$('vhGlobalSearchResults');
 if(!q){box.innerHTML='<div class="vh-search-hint">Почніть вводити назву речі або бренду.</div>';return}
 if(!VH_SEARCH_CACHE || Date.now()-VH_SEARCH_CACHE_AT>60000){
   const {data,error}=await publicSb.from('products')
     .select('id,name,slug,brand,price,cover_image,status,categories(name)')
     .eq('status','published')
     .order('created_at',{ascending:false})
     .limit(80);
   if(error){box.innerHTML='<div class="vh-search-hint">Не вдалося виконати пошук.</div>';return}
   VH_SEARCH_CACHE=data||[];
   VH_SEARCH_CACHE_AT=Date.now();
 }
 const matches=VH_SEARCH_CACHE.filter(p=>[p.name,p.brand,p.categories?.name].map(normalizeFilterValue).join(' ').includes(q)).slice(0,8);
 box.innerHTML=matches.length?matches.map(p=>`
   <a class="vh-search-result" href="product.html?slug=${encodeURIComponent(p.slug)}">
     ${p.cover_image?`<img src="${p.cover_image}" alt="" loading="lazy" decoding="async">`:'<span class="vh-result-placeholder"></span>'}
     <span><b>${p.name}</b><small>${p.brand||p.categories?.name||''}</small></span>
     <strong>${vhMoney(p.price)}</strong>
   </a>`).join(''):'<div class="vh-search-hint">Нічого не знайдено.</div>'
}

function vhRenderCart(){
 const cart=vhGetCart();
 const box=$('vhCartItems');
 const total=cart.reduce((s,x)=>s+Number(x.price||0),0);
 $('vhCartTotal').textContent=vhMoney(total);
 $('vhCheckoutLink').classList.toggle('disabled',!cart.length);
 box.innerHTML=cart.length?cart.map((item,i)=>`
   <div class="vh-cart-item">
     <a href="product.html?slug=${encodeURIComponent(item.slug)}">${item.cover_image?`<img src="${item.cover_image}" alt="" loading="lazy" decoding="async">`:'<span class="vh-cart-placeholder"></span>'}</a>
     <div class="vh-cart-item-copy">
       <small>${item.brand||'VINTAGE HEDONISTA'}</small>
       <a href="product.html?slug=${encodeURIComponent(item.slug)}"><b>${item.name}</b></a>
       <strong>${vhMoney(item.price)}</strong>
     </div>
     <button type="button" onclick="vhRemoveCartItem(${i})" aria-label="Видалити">×</button>
   </div>`).join(''):'<div class="vh-cart-empty"><b>КОШИК ПОРОЖНІЙ</b><span>Додайте річ зі сторінки товару.</span><a href="catalog.html">ПЕРЕЙТИ ДО КАТАЛОГУ →</a></div>'
}
window.vhRemoveCartItem=function(index){
 const cart=vhGetCart();cart.splice(index,1);vhSetCart(cart);vhRenderCart()
};

function addCurrentProductToCart(){
 if(!currentProduct||currentProduct.status==='sold')return toast('Ця річ вже продана');
 const cart=vhGetCart();
 if(cart.some(x=>x.id===currentProduct.id))return toast('Ця річ уже в кошику');
 cart.push({
   id:currentProduct.id,
   name:currentProduct.name,
   slug:currentProduct.slug,
   brand:currentProduct.brand||'',
   price:Number(currentProduct.price||0),
   cover_image:currentProduct.cover_image||currentImages?.[0]||''
 });
 vhSetCart(cart);
 toast('Додано в кошик')
}
window.addCurrentProductToCart=addCurrentProductToCart;

function vhInitHeaderActions(){
 vhEnsureGlobalUI();
 document.querySelectorAll('[data-header-search]').forEach(b=>b.onclick=()=>vhOpenPanel('search'));
 document.querySelectorAll('[data-header-profile]').forEach(b=>b.onclick=()=>vhOpenPanel('profile'));
 document.querySelectorAll('[data-header-cart]').forEach(b=>b.onclick=()=>vhOpenPanel('cart'));
 vhUpdateCartBadge();
}
document.addEventListener('DOMContentLoaded',vhInitHeaderActions);

async function initCheckoutPage(){
 await loadSettings();
 vhInitHeaderActions();
 const cart=vhGetCart();
 let profile=vhGetProfile();
 try{
   const {data:{user}}=await sb.auth.getUser();
   if(user){
     const {data:p}=await sb.from('customer_profiles').select('*').eq('id',user.id).maybeSingle();
     if(p)profile={name:p.full_name||'',email:user.email||'',phone:p.phone||''}
   }
 }catch(e){console.warn(e)}
 if(profile){
   $('checkoutName').value=profile.name||'';
   $('checkoutContact').value=profile.phone||'';
   if($('checkoutEmail'))$('checkoutEmail').value=profile.email||''
 }
 $('checkoutItems').innerHTML=cart.length?cart.map((x,i)=>`
   <div class="checkout-item">
     ${x.cover_image?`<img src="${x.cover_image}" alt="" loading="lazy" decoding="async">`:'<span class="checkout-placeholder"></span>'}
     <div><small>${x.brand||'VINTAGE HEDONISTA'}</small><b>${x.name}</b></div>
     <strong>${vhMoney(x.price)}</strong>
     <button type="button" onclick="checkoutRemoveItem(${i})">×</button>
   </div>`).join(''):'<div class="checkout-empty">Кошик порожній. <a href="catalog.html">Повернутися до каталогу →</a></div>';
 $('checkoutTotal').textContent=vhMoney(cart.reduce((s,x)=>s+Number(x.price||0),0))
}
window.initCheckoutPage=initCheckoutPage;
window.checkoutRemoveItem=function(i){
 const cart=vhGetCart();cart.splice(i,1);vhSetCart(cart);initCheckoutPage()
};

async function submitCartCheckout(){
 const cart=vhGetCart();
 if(!cart.length)return toast('Кошик порожній');
 const name=$('checkoutName').value.trim();
 const contact=$('checkoutContact').value.trim();
 const email=$('checkoutEmail').value.trim();
 const comment=$('checkoutComment').value.trim();
 if(!name||!contact||!email)return toast('Вкажіть ім’я, контакт та email');
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return toast('Перевірте правильність email');

 let phone=null,telegram=null,instagram=null;
 if(contact.includes('@'))telegram=contact;
 else phone=contact;

 const {data:{user}}=await sb.auth.getUser();
 const rows=cart.map(item=>({
   product_id:item.id,
   product_name:item.name,
   customer_name:name,
   phone,telegram,instagram,email,
   comment:comment||`Замовлення з кошика (${cart.length} реч.)`,
   amount:item.price,
   status:'new',
   user_id:user?.id||null
 }));
 const {data:createdOrders,error}=await sb.from('orders').insert(rows).select('id,email');
 if(error)return toast(error.message);
 for(const createdOrder of (createdOrders||[])){
   if(createdOrder.email){
     const emailResult=await vhSendOrderEmailV211(createdOrder.id,'created');
     if(emailResult?.ok)console.info('Cart order accepted email queued',createdOrder.id);
   }
 }
 vhSetCart([]);
 document.querySelector('.checkout-grid').innerHTML=`<div class="checkout-success"><div class="kicker">VINTAGE HEDONISTA</div><h2>ЗАМОВЛЕННЯ ПРИЙНЯТО</h2><p>Дякуємо. Ми зв’яжемося з вами для підтвердження деталей.</p><a href="catalog.html">ПОВЕРНУТИСЯ ДО КАТАЛОГУ →</a></div>`;
 toast('Замовлення надіслано')
}
window.submitCartCheckout=submitCartCheckout;

document.addEventListener('click',e=>{
 const wish=e.target.closest('.product-buyrow .wish');
 if(!wish)return;
 wish.classList.toggle('liked');
 const heart=wish.querySelector('.wish-heart');
 if(heart)heart.textContent=wish.classList.contains('liked')?'♥':'♡';
 toast(wish.classList.contains('liked')?'Додано до вподобаних':'Прибрано з вподобаних')
});

document.addEventListener('click',e=>{
 const head=e.target.closest('.product-accordion-head');
 if(head) requestAnimationFrame(()=>head.blur());
});


/* ==========================================================
   V95 — Vintage Hedonista intro
   First entry + browser refresh only.
   No replay when returning to Home from other site pages.
   ========================================================== */
(function(){
  const INTRO_SESSION_KEY='vh_intro_seen_v95';

  function isHomePage(){
    const path=(location.pathname||'').replace(/\\/g,'/');
    const file=path.split('/').pop();
    return file==='' || file==='index.html'
  }

  function navigationType(){
    try{
      return performance.getEntriesByType('navigation')?.[0]?.type || 'navigate'
    }catch(e){
      return 'navigate'
    }
  }

  function sessionHasSeenIntro(){
    try{return sessionStorage.getItem(INTRO_SESSION_KEY)==='1'}
    catch(e){return false}
  }

  function markIntroSeen(){
    try{sessionStorage.setItem(INTRO_SESSION_KEY,'1')}catch(e){}
  }

  function shouldRunIntro(){
    if(!isHomePage())return false;
    if(location.pathname.includes('/admin/'))return false;
    if(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches)return false;

    const type=navigationType();

    // Browser refresh on Home: always show.
    if(type==='reload')return true;

    // Browser Back/Forward cache navigation: don't replay.
    if(type==='back_forward')return false;

    // Normal navigation / first direct entry:
    // show only if this browser session hasn't already seen it.
    return !sessionHasSeenIntro()
  }

  function createIntro(){
    if(!shouldRunIntro())return;

    const overlay=document.createElement('div');
    overlay.className='vh-intro vh-intro-v97';
    overlay.setAttribute('aria-hidden','true');

    overlay.innerHTML=`
      <div class="vh-intro-stage">
        <div class="vh97-layer vh97-mannequin">
          <img class="vh-intro-logo" src="assets/vintage-hedonista-logo.png" alt="">
        </div>
        <div class="vh97-layer vh97-wordmark">
          <img class="vh-intro-logo" src="assets/vintage-hedonista-logo.png" alt="">
        </div>
        <div class="vh97-layer vh97-odesa">
          <img class="vh-intro-logo" src="assets/vintage-hedonista-logo.png" alt="">
        </div>
      </div>
    `;

    document.body.prepend(overlay);
    document.documentElement.classList.add('vh-intro-active');
    document.body.classList.add('vh-intro-active');
    markIntroSeen();

    requestAnimationFrame(()=>overlay.classList.add('is-running'));

    const finish=()=>{
      if(!overlay.isConnected)return;
      overlay.classList.add('is-leaving');
      setTimeout(()=>{
        overlay.remove();
        document.documentElement.classList.remove('vh-intro-active');
        document.body.classList.remove('vh-intro-active');
        document.dispatchEvent(new CustomEvent('vh:intro-finished'));
      },500)
    };

    setTimeout(finish,2550);

    overlay.addEventListener('click',finish,{once:true});
    document.addEventListener('keydown',function onIntroKey(e){
      if(e.key==='Escape'){
        document.removeEventListener('keydown',onIntroKey);
        finish()
      }
    });
  }

  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',createIntro,{once:true})
  }else{
    createIntro()
  }
})();


/* ==========================================================
   V100 — homepage motion only
   scroll reveal + light parallax + hover polish
   Layout, image sizes and spacing remain unchanged.
   ========================================================== */
(function(){
  function isHome(){
    const file=(location.pathname||'').split('/').pop();
    return file==='' || file==='index.html'
  }

  function initHomeMotion(){
    if(!isHome())return;
    if(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches)return;

    document.body.classList.add('vh-home-motion');

    /* V102 — Hero entrance.
       Only transforms/opacity are animated; layout and image dimensions stay untouched. */
    const heroMedia=document.querySelector('.hero-media');
    const heroMain=document.querySelector('.hero-main');
    const heroSides=[...document.querySelectorAll('.hero-small')];

    if(heroMedia){
      heroMedia.classList.add('vh-hero-entrance');

      const playHeroEntrance=()=>{
        if(heroMedia.classList.contains('is-entered'))return;
        requestAnimationFrame(()=>{
          requestAnimationFrame(()=>heroMedia.classList.add('is-entered'));
        });
      };

      const waitForHeroImages=()=>{
        const imgs=[heroMain,...heroSides]
          .filter(Boolean)
          .map(host=>host.querySelector('img'))
          .filter(Boolean);

        if(!imgs.length){
          setTimeout(waitForHeroImages,60);
          return;
        }

        const pending=imgs.filter(img=>!img.complete);
        if(!pending.length){
          if(document.body.classList.contains('vh-intro-active')){
            document.addEventListener('vh:intro-finished',playHeroEntrance,{once:true});
          }else{
            playHeroEntrance();
          }
          return;
        }

        let left=pending.length;
        const done=()=>{
          left--;
          if(left<=0){
            if(document.body.classList.contains('vh-intro-active')){
              document.addEventListener('vh:intro-finished',playHeroEntrance,{once:true});
            }else{
              playHeroEntrance();
            }
          }
        };
        pending.forEach(img=>{
          img.addEventListener('load',done,{once:true});
          img.addEventListener('error',done,{once:true});
        });
      };

      waitForHeroImages();
    }

    const revealSelectors=[
      '.section.paper .section-head:not(.category-head)',
      '.new-arrivals-carousel',
      '.editorial-media',
      '.editorial-copy',
      '.top-grid',
      '.category-viewport',
      '.journal-grid',
      '.brand-statement .wrap'
    ];

    const revealEls=[...document.querySelectorAll(revealSelectors.join(','))];
    revealEls.forEach((el,i)=>{
      el.classList.add('vh-home-reveal');
      el.style.setProperty('--vh-reveal-delay',`${Math.min((i%3)*70,140)}ms`);
    });

    if('IntersectionObserver' in window){
      const io=new IntersectionObserver(entries=>{
        entries.forEach(entry=>{
          if(entry.isIntersecting){
            entry.target.classList.add('is-visible');
            io.unobserve(entry.target)
          }
        })
      },{threshold:.08,rootMargin:'0px 0px -7% 0px'});
      revealEls.forEach(el=>io.observe(el))
    }else{
      revealEls.forEach(el=>el.classList.add('is-visible'))
    }

    // Parallax is restricted to editorial/hero imagery only.
    // Transform is visual-only and does not change element dimensions or layout.
    const parallaxHosts=[
      document.querySelector('.hero-main'),
      ...document.querySelectorAll('.hero-small'),
      document.querySelector('.editorial-media')
    ].filter(Boolean);

    const refreshParallaxTargets=()=>{
      parallaxHosts.forEach(host=>{
        const img=host.querySelector('img');
        if(img)img.classList.add('vh-home-parallax-img')
      })
    };

    refreshParallaxTargets();

    // Home content is filled asynchronously from Supabase.
    const mo=new MutationObserver(refreshParallaxTargets);
    parallaxHosts.forEach(host=>mo.observe(host,{childList:true,subtree:true}));

    let raf=0;
    const updateParallax=()=>{
      raf=0;
      if(window.innerWidth<820)return;

      const vh=window.innerHeight;
      parallaxHosts.forEach(host=>{
        const img=host.querySelector('.vh-home-parallax-img');
        if(!img)return;
        const r=host.getBoundingClientRect();
        if(r.bottom<0 || r.top>vh)return;

        const hostCenter=r.top+r.height/2;
        const viewportCenter=vh/2;
        const normalized=(hostCenter-viewportCenter)/vh;
        const offset=Math.max(-7,Math.min(7,-normalized*10));
        img.style.setProperty('--vh-parallax-y',`${offset}px`)
      })
    };

    const requestParallax=()=>{
      if(raf)return;
      raf=requestAnimationFrame(updateParallax)
    };
    window.addEventListener('scroll',requestParallax,{passive:true});
    window.addEventListener('resize',requestParallax,{passive:true});
    requestParallax()
  }

  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',initHomeMotion,{once:true})
  }else{
    initHomeMotion()
  }
})();


/* ==========================================================
   V103 — ABOUT PAGE MOTION
   Same visual language as Home:
   reveal + light photo movement + restrained hover.
   No layout/dimension changes.
   ========================================================== */
(function(){
  function isAbout(){
    return (location.pathname||'').split('/').pop()==='about.html'
  }

  function initAboutMotion(){
    if(!isAbout())return;
    if(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches)return;

    document.body.classList.add('vh-about-motion');

    const hero=document.querySelector('.about-hero');
    if(hero){
      hero.classList.add('vh-about-hero-enter');
      requestAnimationFrame(()=>requestAnimationFrame(()=>hero.classList.add('is-entered')));
    }

    const selectors=[
      '.about-philosophy',
      '.about-editorial',
      '.about-selection',
      '.about-manifest',
      '.about-origin',
      '.about-values',
      '.about-final'
    ];

    const revealEls=[...document.querySelectorAll(selectors.join(','))];
    revealEls.forEach((el,i)=>{
      el.classList.add('vh-about-reveal');
      el.style.setProperty('--vh-about-delay',`${Math.min((i%3)*65,130)}ms`)
    });

    if('IntersectionObserver' in window){
      const io=new IntersectionObserver(entries=>{
        entries.forEach(entry=>{
          if(entry.isIntersecting){
            entry.target.classList.add('is-visible');
            io.unobserve(entry.target)
          }
        })
      },{threshold:.09,rootMargin:'0px 0px -7% 0px'});
      revealEls.forEach(el=>io.observe(el))
    }else{
      revealEls.forEach(el=>el.classList.add('is-visible'))
    }

    /* Editorial photos appear one by one inside their existing boxes. */
    const editorial=document.querySelector('.about-editorial');
    if(editorial){
      const photos=[...editorial.querySelectorAll('.about-photo')];
      photos.forEach((photo,i)=>{
        photo.classList.add('vh-about-photo-enter');
        photo.style.setProperty('--vh-about-photo-delay',`${i*110}ms`)
      });

      const editorialIO=new IntersectionObserver(entries=>{
        entries.forEach(entry=>{
          if(entry.isIntersecting){
            photos.forEach(photo=>photo.classList.add('is-visible'));
            editorialIO.disconnect()
          }
        })
      },{threshold:.12});
      editorialIO.observe(editorial)
    }

    /* Light parallax through background-position only.
       It changes no box size, transform, grid or spacing. */
    const parallaxPhotos=[
      document.getElementById('aboutEditorial1'),
      document.getElementById('aboutEditorial2'),
      document.getElementById('aboutEditorial3'),
      document.getElementById('aboutOriginImage'),
      document.getElementById('aboutFinalImage')
    ].filter(Boolean);

    parallaxPhotos.forEach(el=>el.classList.add('vh-about-parallax'));

    let raf=0;
    const updateParallax=()=>{
      raf=0;
      if(window.innerWidth<820)return;
      const vh=window.innerHeight;

      parallaxPhotos.forEach(el=>{
        const r=el.getBoundingClientRect();
        if(r.bottom<0||r.top>vh)return;
        const center=r.top+r.height/2;
        const normalized=(center-vh/2)/vh;
        const y=Math.max(-5,Math.min(5,-normalized*8));
        el.style.setProperty('--vh-about-bg-y',`${y}px`)
      })
    };
    const requestParallax=()=>{
      if(!raf)raf=requestAnimationFrame(updateParallax)
    };

    window.addEventListener('scroll',requestParallax,{passive:true});
    window.addEventListener('resize',requestParallax,{passive:true});
    requestParallax()
  }

  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',initAboutMotion,{once:true})
  }else{
    initAboutMotion()
  }
})();


/* ==========================================================
   V107 — JOURNAL / DELIVERY / CONTACTS MOTION
   Same restrained motion language as Home + About.
   Catalog intentionally excluded.
   ========================================================== */
(function(){
  const file=()=>((location.pathname||'').split('/').pop()||'index.html');

  function revealGroup(selectors, bodyClass){
    if(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches)return;
    document.body.classList.add(bodyClass);

    const els=[...document.querySelectorAll(selectors.join(','))];
    els.forEach((el,i)=>{
      el.classList.add('vh-page-reveal');
      el.style.setProperty('--vh-page-delay',`${Math.min((i%3)*65,130)}ms`)
    });

    if('IntersectionObserver' in window){
      const io=new IntersectionObserver(entries=>{
        entries.forEach(entry=>{
          if(entry.isIntersecting){
            entry.target.classList.add('is-visible');
            io.unobserve(entry.target)
          }
        })
      },{threshold:.08,rootMargin:'0px 0px -7% 0px'});
      els.forEach(el=>io.observe(el))
    }else{
      els.forEach(el=>el.classList.add('is-visible'))
    }
  }

  function initJournalMotion(){
    if(file()!=='journal.html')return;

    document.body.classList.add('vh-journal-motion');

    const head=document.querySelector('.journal-v37-head .wrap');
    if(head){
      head.classList.add('vh-page-hero-enter');
      requestAnimationFrame(()=>requestAnimationFrame(()=>head.classList.add('is-entered')))
    }

    revealGroup([
      '.journal-v37-feature-section',
      '.journal-v37-new-section',
      '.journal-v37-guide-wrap',
      '.journal-v37-other-section',
      '.journal-v37-cta'
    ],'vh-journal-motion');
  }

  function initDeliveryMotion(){
    if(file()!=='delivery.html')return;

    document.body.classList.add('vh-delivery-motion');

    const hero=document.querySelector('.service-delivery .service-hero-grid');
    if(hero){
      hero.classList.add('vh-page-hero-enter');
      requestAnimationFrame(()=>requestAnimationFrame(()=>hero.classList.add('is-entered')))
    }

    revealGroup([
      '.service-delivery .service-cards-wrap',
      '.service-delivery .service-process .wrap',
      '.service-delivery .service-cta-inner'
    ],'vh-delivery-motion');

    /* Individual service cards appear with a tiny stagger. */
    const cards=[...document.querySelectorAll('.service-delivery .service-card')];
    cards.forEach((card,i)=>{
      card.classList.add('vh-card-stagger');
      card.style.setProperty('--vh-card-delay',`${i*95}ms`)
    });
    if(cards.length && 'IntersectionObserver' in window){
      const io=new IntersectionObserver(entries=>{
        if(entries.some(e=>e.isIntersecting)){
          cards.forEach(c=>c.classList.add('is-visible'));
          io.disconnect()
        }
      },{threshold:.12});
      io.observe(cards[0].closest('.service-cards-wrap')||cards[0])
    }else{
      cards.forEach(c=>c.classList.add('is-visible'))
    }
  }

  function initContactsMotion(){
    if(file()!=='contacts.html')return;

    document.body.classList.add('vh-contacts-motion');

    const hero=document.querySelector('.service-contacts .service-hero-grid');
    if(hero){
      hero.classList.add('vh-page-hero-enter');
      requestAnimationFrame(()=>requestAnimationFrame(()=>hero.classList.add('is-entered')))
    }

    revealGroup([
      '.service-contacts .contacts-main',
      '.service-contacts .contacts-topics .wrap'
    ],'vh-contacts-motion');

    const lines=[...document.querySelectorAll('.service-contacts .contact-line')];
    lines.forEach((line,i)=>{
      line.classList.add('vh-contact-stagger');
      line.style.setProperty('--vh-contact-delay',`${i*75}ms`)
    });
    if(lines.length && 'IntersectionObserver' in window){
      const io=new IntersectionObserver(entries=>{
        if(entries.some(e=>e.isIntersecting)){
          lines.forEach(line=>line.classList.add('is-visible'));
          io.disconnect()
        }
      },{threshold:.10});
      io.observe(document.querySelector('.contacts-main')||lines[0])
    }else{
      lines.forEach(line=>line.classList.add('is-visible'))
    }
  }

  function init(){
    initJournalMotion();
    initDeliveryMotion();
    initContactsMotion()
  }

  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',init,{once:true})
  }else{
    init()
  }
})();


/* ==========================================================
   V117 — CUSTOMER ACCOUNT / AUTH / FAVORITES / ORDERS
   ========================================================== */
let VH_ACCOUNT_USER=null;

function vhAccountStatusName(status){
 return ({
   new:'НОВЕ',
   contacted:'ПІДТВЕРДЖЕНО',
   confirmed:'ПІДТВЕРДЖЕНО',
   shipped:'ВІДПРАВЛЕНО',
   received:'ОТРИМАНО',
   completed:'ОТРИМАНО',
   cancelled:'СКАСОВАНО'
 })[status]||String(status||'').toUpperCase()
}

function vhAccountDate(value){
 if(!value)return '—';
 return new Date(value).toLocaleDateString('uk-UA',{day:'2-digit',month:'2-digit',year:'numeric'})
}

async function vhGetCurrentUser(){
 const {data:{user}}=await sb.auth.getUser();
 VH_ACCOUNT_USER=user||null;
 return VH_ACCOUNT_USER
}

function vhEscape(v){return String(v||'').replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c]))}
function vhAuthCredentials(login,password){
 const value=String(login||'').trim();
 return value.includes('@')?{email:value,password}:{phone:value.replace(/[\s()-]/g,''),password}
}
function vhAuthShell(mode='login'){
 const isLogin=mode==='login';
 return `
   <div class="vh125-auth">
     <div class="vh125-auth-kicker">VINTAGE HEDONISTA</div>
     <h2>${isLogin?'ВХІД':'РЕЄСТРАЦІЯ'}</h2>
     <p class="vh125-auth-subtitle">${isLogin?'Увійдіть до особистого кабінету.':'Створіть особистий кабінет покупця.'}</p>

     <form class="vh125-auth-form" id="vhAuthForm" onsubmit="event.preventDefault();${isLogin?'vhSignIn()':'vhSignUp()'}">
       ${!isLogin?`
       <div class="vh125-auth-two">
         <label>ІМ’Я
           <input id="vhAuthFirstName" type="text" autocomplete="given-name">
         </label>
         <label>ПРІЗВИЩЕ
           <input id="vhAuthLastName" type="text" autocomplete="family-name">
         </label>
       </div>`:''}

       <label>EMAIL АБО НОМЕР ТЕЛЕФОНУ
         <input id="vhAuthLogin" type="text" autocomplete="username">
       </label>

       <label>ПАРОЛЬ
         <input id="vhAuthPassword" type="password" autocomplete="${isLogin?'current-password':'new-password'}">
       </label>

       <button class="vh125-auth-submit" id="vhAuthSubmit" type="submit">
         ${isLogin?'УВІЙТИ':'ЗАРЕЄСТРУВАТИСЯ'}
       </button>
     </form>

     <div class="vh125-auth-switch">
       <span>${isLogin?'НЕ МАЄТЕ АКАУНТА?':'ВЖЕ МАЄТЕ АКАУНТ?'}</span>
       <button type="button" onclick="vhShowAuth('${isLogin?'register':'login'}')">
         ${isLogin?'ЗАРЕЄСТРУВАТИСЯ':'УВІЙТИ'}
       </button>
     </div>

     <div id="vhAuthMessage" class="vh125-auth-message"></div>
   </div>`
}
window.vhShowAuth=function(mode){const root=$('vh125LoginRoot');if(root)root.innerHTML=vhAuthShell(mode)}

window.vhSignIn=async function(){
 const login=$('vhAuthLogin')?.value.trim(), password=$('vhAuthPassword')?.value||'', msg=$('vhAuthMessage'), btn=$('vhAuthSubmit');
 if(!login||!password){if(msg)msg.textContent='Вкажіть email або номер телефону та пароль.';return}
 if(btn){btn.disabled=true;btn.textContent='ВХОДИМО...'}
 const {error}=await sb.auth.signInWithPassword(vhAuthCredentials(login,password));
 if(btn){btn.disabled=false;btn.textContent='УВІЙТИ'}
 if(error){if(msg)msg.textContent='Не вдалося увійти. Перевірте дані або підтвердження email/телефону.';console.error(error);return}
 toast('Вхід виконано'); location.href='account.html'
}

window.vhSignUp=async function(){
 const first_name=$('vhAuthFirstName')?.value.trim(), last_name=$('vhAuthLastName')?.value.trim(), login=$('vhAuthLogin')?.value.trim(), password=$('vhAuthPassword')?.value||'', msg=$('vhAuthMessage'), btn=$('vhAuthSubmit');
 if(!first_name||!last_name||!login||password.length<6){if(msg)msg.textContent='Заповніть ім’я, прізвище, email/телефон і пароль від 6 символів.';return}
 const full_name=`${first_name} ${last_name}`.trim();
 const creds=vhAuthCredentials(login,password);
 if(btn){btn.disabled=true;btn.textContent='СТВОРЮЄМО...'}
 const redirectTo=new URL('account.html',location.href).href;
 const {data,error}=await sb.auth.signUp({...creds,options:{data:{first_name,last_name,full_name,phone:creds.phone||null},emailRedirectTo:redirectTo}});
 if(btn){btn.disabled=false;btn.textContent='ЗАРЕЄСТРУВАТИСЯ'}
 if(error){if(msg)msg.textContent=error.message;return}
 if(data.user){
   const {error:pe}=await sb.from('customer_profiles').upsert({id:data.user.id,email:data.user.email||null,first_name,last_name,full_name,phone:data.user.phone||creds.phone||null});
   if(pe)console.warn(pe)
 }
 if(data.session){toast('Акаунт створено');location.href='account.html'}
 else if(msg)msg.textContent=creds.email?'Акаунт створено. Підтвердьте реєстрацію через лист на email.':'Акаунт створено. Підтвердьте номер телефону, якщо це вимагається налаштуваннями Supabase.'
}

window.vhResetPassword=async function(){
 const login=$('vhAuthLogin')?.value.trim(),msg=$('vhAuthMessage');
 if(!login||!login.includes('@')){if(msg)msg.textContent='Для відновлення пароля введіть email.';return}
 const {error}=await sb.auth.resetPasswordForEmail(login,{redirectTo:location.origin+location.pathname});
 if(msg)msg.textContent=error?error.message:'Посилання для відновлення надіслано на email.'
}
window.vhSignOut=async function(){await sb.auth.signOut();VH_ACCOUNT_USER=null;toast('Ви вийшли з акаунта');await vhRenderAccountPanel()}


async function vhEnsureCustomerProfile(user){
  if(!user)return null;
  const meta=user.user_metadata||{};
  const first=meta.first_name||'';
  const last=meta.last_name||'';
  const full=meta.full_name||[first,last].filter(Boolean).join(' ');
  const {data:existing}=await sb.from('customer_profiles').select('*').eq('id',user.id).maybeSingle();
  if(existing)return existing;
  const {data,error}=await sb.from('customer_profiles').upsert({
    id:user.id,
    email:user.email||null,
    first_name:first||null,
    last_name:last||null,
    full_name:full||null,
    phone:meta.phone||user.phone||null
  }).select('*').single();
  if(error){console.warn(error);return null}
  return data
}

function vhAccountIcon(name){
 const common='viewBox="0 0 24 24" aria-hidden="true" focusable="false"';
 const icons={
  profile:`<svg ${common}><circle cx="12" cy="7.5" r="3.25"/><path d="M5.5 19c.7-4 3-6 6.5-6s5.8 2 6.5 6"/></svg>`,
  contacts:`<svg ${common}><path d="M6.5 4.5h9a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2h-9a2 2 0 0 1-2-2v-11a2 2 0 0 1 2-2Z"/><circle cx="11" cy="9" r="2"/><path d="M7.8 15.8c.55-2.15 1.8-3.2 3.7-3.2s3.15 1.05 3.7 3.2M8 2.5v4M14 2.5v4"/></svg>`,
  orders:`<svg ${common}><path d="M5 7.5h14v12H5z"/><path d="M8 7.5V5.8A2.8 2.8 0 0 1 10.8 3h2.4A2.8 2.8 0 0 1 16 5.8v1.7M8.5 11.5h7"/></svg>`,
  favorites:`<svg ${common}><path d="M12 20s-7-4.35-7-10a4 4 0 0 1 7-2.65A4 4 0 0 1 19 10c0 5.65-7 10-7 10Z"/></svg>`,
  logout:`<svg ${common}><path d="M10 5H5.5A1.5 1.5 0 0 0 4 6.5v11A1.5 1.5 0 0 0 5.5 19H10M14.5 8l4 4-4 4M8 12h10"/></svg>`
 };
 return `<span class="vh-account-nav-icon">${icons[name]||''}</span>`;
}

async function initAccountPage(){
  const accountSettings=await loadSettings();
  vhInitHeaderActions();

  const mount=$('accountPageMount');
  if(!mount)return;

  const user=await vhGetCurrentUser();
  if(!user){location.href='index.html';return}

  await vhEnsureCustomerProfile(user);
  const {profile,orders,favorites}=await vhLoadAccountData(user);
  const p=profile||{};
  const first=p.first_name||user.user_metadata?.first_name||String(p.full_name||user.user_metadata?.full_name||'').split(' ')[0]||'';
  const last=p.last_name||user.user_metadata?.last_name||String(p.full_name||user.user_metadata?.full_name||'').split(' ').slice(1).join(' ')||'';
  const display=[first,last].filter(Boolean).join(' ')||user.email||'Клієнт';

  const renderOrders=(items)=>items.length?items.map(o=>{
    const product=o.products||{};
    const img=product.cover_image||'';
    return `<a class="vh128-order-card" href="${product.slug?`product.html?slug=${encodeURIComponent(product.slug)}`:'#'}">
      <div class="vh128-order-thumb">${img?`<img src="${img}" alt="" loading="lazy" decoding="async">`:'<span></span>'}</div>
      <div class="vh128-order-copy">
        <small>${vhAccountDate(o.created_at)} · #${vhEscape(String(o.id||'').slice(-6))}</small>
        <b>${vhEscape(o.product_name||product.name||'Товар')}</b>
        <em>${vhMoney(o.amount)}</em>
      </div>
      <strong class="vh128-order-status status-${o.status}">${vhAccountStatusName(o.status)}</strong>
    </a>`
  }).join(''):`<div class="vh124-empty">Замовлень ще немає.</div>`;

  const favCards=favorites.length?favorites.map(f=>{
    const x=f.products||{};
    return `<a class="vh129-fav-card" href="product.html?slug=${encodeURIComponent(x.slug||'')}">
      <div class="vh129-fav-thumb">${x.cover_image?`<img src="${x.cover_image}" alt="" loading="lazy" decoding="async">`:`<span></span>`}</div>
      <div class="vh129-fav-copy">
        <small>${vhEscape(x.brand||'VINTAGE HEDONISTA')}</small>
        <b>${vhEscape(x.name||'Товар')}</b>
        <strong>${vhMoney(x.price)}</strong>
      </div>
    </a>`
  }).join(''):`<div class="vh124-empty">Вподобаних товарів ще немає.</div>`;

  mount.innerHTML=`
    <section class="vh124-account-hero">
      <div class="wrap vh124-account-hero-inner">
        <div class="vh124-account-title">
          <div class="service-kicker">VINTAGE HEDONISTA · ACCOUNT</div>
          <h1>ОСОБИСТИЙ КАБІНЕТ</h1>
          <p>Вітаємо, <strong>${vhEscape(display)}</strong>!</p>
          <span>Дякуємо, що обрали Vintage Hedonista.</span>
        </div>
      </div>
    </section>

    <section class="wrap vh124-dashboard">
      <aside class="vh124-menu">
        <button class="active" data-account-tab="profile">${vhAccountIcon('profile')}<span>ПРОФІЛЬ</span></button>
        <button data-account-tab="contacts">${vhAccountIcon('contacts')}<span>КОНТАКТНІ ДАНІ</span></button>
        <button data-account-tab="orders">${vhAccountIcon('orders')}<span>ЗАМОВЛЕННЯ</span></button>
        <button data-account-tab="favorites">${vhAccountIcon('favorites')}<span>МОЇ ВПОДОБАННЯ</span></button>
        <button class="logout" type="button" onclick="vhSignOutFromAccount()">${vhAccountIcon('logout')}<span>ВИЙТИ З ПРОФІЛЮ</span></button>
      </aside>

      <div class="vh124-content">
        <section class="account-tab active" data-account-view="profile">
          <div class="vh124-section-title"><h2>ПРОФІЛЬ</h2></div>
          <div class="vh124-grid">
            <label>ІМ’Я<input id="vhAccountFirstName" value="${vhEscape(first)}"></label>
            <label>ПРІЗВИЩЕ<input id="vhAccountLastName" value="${vhEscape(last)}"></label>
          </div>
          <button class="vh124-save" onclick="vhSaveAccountProfile('profile')">ЗБЕРЕГТИ ЗМІНИ</button>

          <div class="vh124-divider"></div>
          <div class="vh124-section-title vh124-between"><h2>ОСТАННІ ЗАМОВЛЕННЯ</h2><button class="vh-account-more" data-account-jump="orders"><span>ПЕРЕГЛЯНУТИ ВСІ</span><i>→</i></button></div>
          <div class="vh128-order-list">${renderOrders(orders.slice(0,3))}</div>

          <div class="vh124-divider"></div>
          <div class="vh124-section-title vh124-between"><h2>МОЇ ВПОДОБАННЯ</h2><button class="vh-account-more" data-account-jump="favorites"><span>ПЕРЕГЛЯНУТИ ВСІ</span><i>→</i></button></div>
          <div class="vh129-favorites-list">${favCards}</div>
        </section>

        <section class="account-tab" data-account-view="contacts">
          <div class="vh124-section-title"><h2>КОНТАКТНІ ДАНІ</h2></div>
          <div class="vh128-profile-note">Ці дані автоматично підставляються при оформленні замовлення.</div>
          <div class="vh124-grid">
            <label>EMAIL<input value="${vhEscape(user.email||p.email||'')}" disabled></label>
            <label>ТЕЛЕФОН<input id="vhAccountPhone" value="${vhEscape(p.phone||user.phone||'')}"></label>
            <label>МІСТО<input id="vhAccountCity" value="${vhEscape(p.city||'')}"></label>
            <label>НОВА ПОШТА / ВІДДІЛЕННЯ<input id="vhAccountDelivery" value="${vhEscape(p.delivery_address||'')}"></label>
          </div>
          <button class="vh124-save" onclick="vhSaveAccountProfile('contacts')">ЗБЕРЕГТИ КОНТАКТИ</button>
        </section>

        <section class="account-tab" data-account-view="orders">
          <div class="vh124-section-title"><h2>МОЇ ЗАМОВЛЕННЯ</h2></div>
          <div class="vh128-order-list">${renderOrders(orders)}</div>
        </section>

        <section class="account-tab" data-account-view="favorites">
          <div class="vh124-section-title"><h2>МОЇ ВПОДОБАННЯ</h2></div>
          <div class="vh129-favorites-list">${favCards}</div>
        </section>
      </div>
    </section>`;

  const accountHero=mount.querySelector('.vh124-account-hero');
  if(accountHero && accountSettings?.account_header_image){
    accountHero.style.setProperty('background-image',`linear-gradient(90deg,rgba(29,22,17,.72),rgba(39,29,22,.46)),url("${accountSettings.account_header_image}")`,'important');
    accountHero.style.setProperty('background-size','cover','important');
    accountHero.style.setProperty('background-position','center center','important');
  }

  function openTab(name){
    mount.querySelectorAll('[data-account-tab]').forEach(x=>x.classList.toggle('active',x.dataset.accountTab===name));
    mount.querySelectorAll('[data-account-view]').forEach(v=>v.classList.toggle('active',v.dataset.accountView===name));
  }
  mount.querySelectorAll('[data-account-tab]').forEach(btn=>btn.onclick=()=>openTab(btn.dataset.accountTab));
  mount.querySelectorAll('[data-account-jump]').forEach(btn=>btn.onclick=()=>openTab(btn.dataset.accountJump));
}
window.initAccountPage=initAccountPage;
window.vhSignOutFromAccount=async()=>{await sb.auth.signOut();location.href='index.html'};

async function vhLoadAccountData(user){
 const [profileRes,ordersRes,favoritesRes]=await Promise.all([
   sb.from('customer_profiles').select('*').eq('id',user.id).maybeSingle(),
   sb.from('orders').select('*,products(id,name,slug,cover_image,brand)').eq('user_id',user.id).order('created_at',{ascending:false}),
   sb.from('customer_favorites').select('product_id,created_at,products(id,name,slug,brand,price,cover_image,status)').eq('user_id',user.id).order('created_at',{ascending:false})
 ]);
 return {profile:profileRes.data||{},orders:ordersRes.data||[],favorites:favoritesRes.data||[]}
}

function vhAccountDashboard(user,data){
 const p=data.profile||{}, orders=data.orders||[], favorites=data.favorites||[];
 const first=p.first_name||String(p.full_name||'').split(' ')[0]||'';
 const last=p.last_name||String(p.full_name||'').split(' ').slice(1).join(' ')||'';
 return `<div class="vh-account-dashboard">
   <div class="vh-account-head"><div><div class="vh-panel-kicker">VINTAGE HEDONISTA · ACCOUNT</div><h2>ОСОБИСТИЙ КАБІНЕТ</h2><p>${vhEscape([first,last].filter(Boolean).join(' ')||user.email||user.phone||'Клієнт')}</p></div></div>
   <div class="vh-account-nav">
     <button class="active" data-vh-account-tab="profile">ПРОФІЛЬ</button>
     <button data-vh-account-tab="contacts">КОНТАКТНІ ДАНІ</button>
     <button data-vh-account-tab="orders">ЗАМОВЛЕННЯ <span>${orders.length}</span></button>
     <button data-vh-account-tab="favorites">МОЇ ВПОДОБАННЯ <span>${favorites.length}</span></button>
     <button class="vh-account-exit-tab" type="button" onclick="vhSignOut()">ВИХІД</button>
   </div>
   <div class="vh-account-view active" data-vh-account-view="profile">
     <div class="vh-account-section-head"><b>ПРІЗВИЩЕ ТА ІМ’Я</b><span>Дані покупця для замовлень.</span></div>
     <div class="vh-account-profile-grid">
       <label>ІМ’Я<input id="vhAccountFirstName" value="${vhEscape(first)}" autocomplete="given-name"></label>
       <label>ПРІЗВИЩЕ<input id="vhAccountLastName" value="${vhEscape(last)}" autocomplete="family-name"></label>
       <label>EMAIL<input value="${vhEscape(user.email||p.email||'')}" disabled></label>
       <label>ТЕЛЕФОН<input id="vhAccountPhoneProfile" value="${vhEscape(p.phone||user.phone||'')}" autocomplete="tel"></label>
     </div>
     <button class="vh-primary-btn compact" type="button" onclick="vhSaveAccountProfile('profile')">ЗБЕРЕГТИ ЗМІНИ</button>
   </div>
   <div class="vh-account-view" data-vh-account-view="contacts">
     <div class="vh-account-section-head"><b>КОНТАКТНІ ДАНІ</b><span>Їх можна змінити у будь-який момент.</span></div>
     <div class="vh-account-profile-grid">
       <label>ТЕЛЕФОН<input id="vhAccountPhone" value="${vhEscape(p.phone||user.phone||'')}" autocomplete="tel"></label>
       <label>МІСТО<input id="vhAccountCity" value="${vhEscape(p.city||'')}" autocomplete="address-level2"></label>
       <label class="wide">НОВА ПОШТА / ВІДДІЛЕННЯ<input id="vhAccountDelivery" value="${vhEscape(p.delivery_address||'')}" placeholder="Наприклад: Відділення №12"></label>
     </div>
     <button class="vh-primary-btn compact" type="button" onclick="vhSaveAccountProfile('contacts')">ЗБЕРЕГТИ КОНТАКТИ</button>
   </div>
   <div class="vh-account-view" data-vh-account-view="orders"><div class="vh-account-section-head"><b>МОЇ ЗАМОВЛЕННЯ</b><span>Статус змінюється після обробки в адмінці.</span></div><div class="vh-account-orders">${orders.length?orders.map(o=>`<a class="vh-account-order" href="${o.products?.slug?`product.html?slug=${encodeURIComponent(o.products.slug)}`:'#'}">${o.products?.cover_image?`<img src="${o.products.cover_image}" alt="" loading="lazy" decoding="async">`:'<span class="vh-account-order-placeholder"></span>'}<span class="vh-account-order-main"><small>${vhAccountDate(o.created_at)} · #${o.order_number||String(o.id).slice(0,6)}</small><b>${vhEscape(o.product_name||o.products?.name||'Товар')}</b><em>${vhMoney(o.amount)}</em></span><strong class="vh-account-status status-${o.status}">${vhAccountStatusName(o.status)}</strong></a>`).join(''):'<div class="vh-account-empty">У вас ще немає замовлень.<a href="catalog.html">ПЕРЕЙТИ ДО КАТАЛОГУ →</a></div>'}</div></div>
   <div class="vh-account-view" data-vh-account-view="favorites"><div class="vh-account-section-head"><b>МОЇ ВПОДОБАННЯ</b><span>Збережені речі вашого акаунта.</span></div><div class="vh-account-favorites">${favorites.length?favorites.map(f=>{const x=f.products||{};return `<a class="vh-account-favorite" href="product.html?slug=${encodeURIComponent(x.slug||'')}">${x.cover_image?`<img src="${x.cover_image}" alt="" loading="lazy" decoding="async">`:'<span class="vh-account-favorite-placeholder"></span>'}<span><small>${vhEscape(x.brand||'VINTAGE HEDONISTA')}</small><b>${vhEscape(x.name||'Товар')}</b><strong>${vhMoney(x.price)}</strong></span></a>`}).join(''):'<div class="vh-account-empty">Ви ще нічого не зберегли.<a href="catalog.html">ПЕРЕЙТИ ДО КАТАЛОГУ →</a></div>'}</div></div>
 </div>`
}

async function vhRenderAccountPanel(){
 const root=$('vhAccountRoot');if(!root)return;root.innerHTML='<div class="vh-account-loading">Завантаження...</div>';
 try{const user=await vhGetCurrentUser();if(!user){root.innerHTML=vhAuthShell('login');return}const data=await vhLoadAccountData(user);root.innerHTML=vhAccountDashboard(user,data);root.querySelectorAll('[data-vh-account-tab]').forEach(btn=>{btn.onclick=()=>{root.querySelectorAll('[data-vh-account-tab]').forEach(x=>x.classList.toggle('active',x===btn));root.querySelectorAll('[data-vh-account-view]').forEach(v=>v.classList.toggle('active',v.dataset.vhAccountView===btn.dataset.vhAccountTab))}})}catch(e){console.error(e);root.innerHTML=`<div class="vh-account-error">Не вдалося завантажити кабінет.<br><small>${e.message||''}</small></div>`}
}

window.vhSaveAccountProfile=async function(section='profile'){
 const user=await vhGetCurrentUser();
 if(!user)return;

 const {data:old,error:readError}=await sb.from('customer_profiles').select('*').eq('id',user.id).maybeSingle();
 if(readError)console.warn('profile read',readError);

 const first=($('vhAccountFirstName')?.value ?? old?.first_name ?? user.user_metadata?.first_name ?? '').trim();
 const last=($('vhAccountLastName')?.value ?? old?.last_name ?? user.user_metadata?.last_name ?? '').trim();

 const profilePhone=$('vhAccountPhoneProfile')?.value;
 const contactPhone=$('vhAccountPhone')?.value;
 const phone=String(contactPhone ?? profilePhone ?? old?.phone ?? user.phone ?? '').trim();

 const city=String($('vhAccountCity')?.value ?? $('vhAccountCityProfile')?.value ?? old?.city ?? '').trim();
 const delivery=String($('vhAccountDelivery')?.value ?? $('vhAccountDeliveryProfile')?.value ?? old?.delivery_address ?? '').trim();

 const payload={
   email:user.email||old?.email||null,
   first_name:first||null,
   last_name:last||null,
   full_name:[first,last].filter(Boolean).join(' ')||null,
   phone:phone||null,
   city:city||null,
   delivery_address:delivery||null,
   updated_at:new Date().toISOString()
 };

 let error=null;
 if(old){
   ({error}=await sb.from('customer_profiles').update(payload).eq('id',user.id))
 }else{
   ({error}=await sb.from('customer_profiles').insert({id:user.id,...payload}))
 }
 if(error){console.error(error);return toast(error.message?.includes('permission denied')?'Немає доступу до профілю. Запустіть SQL V129 у Supabase.':'Не вдалося зберегти профіль: '+error.message)}

 // Keep first/last in Auth metadata too — reliable fallback after relogin.
 const {error:metaError}=await sb.auth.updateUser({
   data:{first_name:first,last_name:last,full_name:payload.full_name||'',phone:phone||''}
 });
 if(metaError)console.warn('auth metadata update',metaError);

 localStorage.setItem(VH_PROFILE_KEY,JSON.stringify({
   name:payload.full_name||'',
   email:user.email||'',
   phone:payload.phone||'',
   city:payload.city||'',
   delivery_address:payload.delivery_address||''
 }));

 toast('Дані збережено');
 if($('accountPageMount'))await initAccountPage();
}

/* Auth-backed favorites. Guests are invited to log in. */
async function vhToggleFavorite(productId){
 const user=await vhGetCurrentUser();
 if(!user){
   vhOpenPanel('profile');
   toast('Увійдіть, щоб зберігати вподобані речі');
   return null
 }
 const {data:existing}=await sb.from('customer_favorites').select('product_id').eq('user_id',user.id).eq('product_id',productId).maybeSingle();
 if(existing){
   const {error}=await sb.from('customer_favorites').delete().eq('user_id',user.id).eq('product_id',productId);
   if(error){toast(error.message?.includes('permission denied')?'Немає доступу до вподобань. Запустіть SQL V129 у Supabase.':error.message);return null}
   toast('Прибрано з вподобаних');
   return false
 }
 const {error}=await sb.from('customer_favorites').insert({user_id:user.id,product_id:productId});
 if(error){toast(error.message?.includes('permission denied')?'Немає доступу до вподобань. Запустіть SQL V129 у Supabase.':error.message);return null}
 toast('Додано до вподобаних');
 return true
}
window.vhToggleFavorite=vhToggleFavorite;

/* Product page wish button */
document.addEventListener('click',async e=>{
 const wish=e.target.closest('.product-buyrow .wish');
 if(!wish || !currentProduct)return;
 e.preventDefault();
 e.stopImmediatePropagation();
 const liked=await vhToggleFavorite(currentProduct.id);
 if(liked===null)return;
 wish.classList.toggle('liked',liked);
 const heart=wish.querySelector('.wish-heart');
 if(heart)heart.textContent=liked?'♥':'♡'
},true);

/* Catalog hearts */
document.addEventListener('click',async e=>{
 const heart=e.target.closest('.catalog-luxury-heart');
 if(!heart)return;
 const card=heart.closest('.catalog-luxury-card');
 const href=card?.querySelector('.catalog-luxury-photo')?.getAttribute('href')||'';
 const slug=new URL(href,location.href).searchParams.get('slug');
 const product=catalogProducts?.find?.(p=>p.slug===slug);
 if(!product)return;
 e.preventDefault();
 e.stopImmediatePropagation();
 const liked=await vhToggleFavorite(product.id);
 if(liked===null)return;
 heart.textContent=liked?'♥':'♡';
 heart.classList.toggle('liked',liked)
},true);

sb.auth.onAuthStateChange(()=>{vhUpdateAccountHeaderState()});

async function vhUpdateAccountHeaderState(){
 try{
   const user=await vhGetCurrentUser();
   if(user)await vhEnsureCustomerProfile(user);
   document.querySelectorAll('[data-header-profile]').forEach(btn=>btn.classList.toggle('is-authenticated',!!user))
 }catch{}
}
document.addEventListener('DOMContentLoaded',vhUpdateAccountHeaderState);
/* ==========================================================
   V211 — transactional order emails
   The Resend API key stays server-side inside Supabase Edge Functions.
   ========================================================== */
async function vhSendOrderEmailV211(orderId,type='created'){
  if(!orderId)return {ok:false};
  try{
    const {data,error}=await sb.functions.invoke('resend-email',{
      body:{order_id:orderId,type}
    });
    if(error)throw error;
    return data||{ok:true};
  }catch(e){
    console.warn('order email',e);
    return {ok:false,error:e};
  }
}



/* ==========================================================
   V237 — GLOBAL MOBILE DRAWER CONTROLLER
   Real backdrop = outside tap closes menu without activating page content.
   ========================================================== */
(function(){
  function closeDrawer(){
    const btn=document.querySelector('header .vh-mobile-menu-btn');
    document.body.classList.remove('vh-mobile-menu-open');
    if(btn) btn.setAttribute('aria-expanded','false');
  }

  function initGlobalDrawerV237(){
    const header=document.querySelector('header');
    const btn=header?.querySelector('.vh-mobile-menu-btn');
    const nav=header?.querySelector('.nav');
    if(!header || !btn || !nav) return;

    let backdrop=document.querySelector('.vh-menu-backdrop');
    if(!backdrop){
      backdrop=document.createElement('div');
      backdrop.className='vh-menu-backdrop';
      backdrop.setAttribute('aria-hidden','true');
      document.body.appendChild(backdrop);
    }

    backdrop.addEventListener('click',(e)=>{
      e.preventDefault();
      e.stopPropagation();
      closeDrawer();
    });

    /* Important: do NOT preventDefault on menu links.
       They must navigate normally on every page. */
    nav.addEventListener('click',(e)=>{
      const link=e.target.closest('a[href]');
      if(!link) return;
      closeDrawer();
    },true);

    document.addEventListener('keydown',(e)=>{
      if(e.key==='Escape' && document.body.classList.contains('vh-mobile-menu-open')){
        closeDrawer();
      }
    });

    /* If a legacy page forgot to bind the burger, provide a fallback.
       If it already has a handler, this one is skipped. */
    if(btn.dataset.vhGlobalFallback!=='1'){
      btn.dataset.vhGlobalFallback='1';

      btn.addEventListener('click',()=>{
        /* Legacy listeners run on the same click.
           Use a microtask to only repair aria/backdrop state, not double-toggle. */
        queueMicrotask(()=>{
          const open=document.body.classList.contains('vh-mobile-menu-open');
          btn.setAttribute('aria-expanded',String(open));
        });
      });
    }
  }

  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',initGlobalDrawerV237,{once:true});
  }else{
    initGlobalDrawerV237();
  }
})();


/* ==========================================================
   V239 — NON-HOME MOBILE DRAWER NAVIGATION FALLBACK
   Ensures menu links navigate even on pages with older local handlers.
   ========================================================== */
(function(){
  function initV239DrawerNavigation(){
    if(document.body.classList.contains('home-page')) return;

    const nav = document.querySelector('header .nav');
    if(!nav || nav.dataset.vhV239Nav === '1') return;
    nav.dataset.vhV239Nav = '1';

    nav.addEventListener('click', function(e){
      const link = e.target.closest('a[href]');
      if(!link || !nav.contains(link)) return;

      const href = link.getAttribute('href');
      if(!href || href === '#') return;

      document.body.classList.remove('vh-mobile-menu-open');
      const btn = document.querySelector('header .vh-mobile-menu-btn');
      if(btn) btn.setAttribute('aria-expanded','false');

      /* Normal browser navigation is preferred. If an old page-level
         handler has cancelled it, perform the same navigation explicitly. */
      setTimeout(function(){
        const current = location.href;
        const target = new URL(href, current).href;
        if(location.href === current && target !== current){
          location.assign(target);
        }
      }, 0);
    }, false);
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', initV239DrawerNavigation, {once:true});
  }else{
    initV239DrawerNavigation();
  }
})();
