
const sb=supabase.createClient(VH_CONFIG.supabaseUrl,VH_CONFIG.supabaseKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,storage:window.localStorage,storageKey:'vintage-hedonista-admin-auth'}});
const $=id=>document.getElementById(id);
let products=[],categories=[],orders=[],news=[],heroSlides=[],instagramFeed=[],editingProductId=null,editingNewsId=null,editingCategoryId=null;
let MEDIA_LIBRARY_V132=[];
let MEDIA_PICKER_TARGET_V132=null;
let NEWS_COVER_CURRENT=null;
let NEWS_GALLERY_CURRENT=[];
let existingImages=[]; let newImages=[];
function toast(msg){const t=$('toast');t.textContent=msg;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),2200)}
/* V211 — send order email from the server-side Edge Function */
async function sendOrderEmailV211(orderId,type){
 if(!orderId)return {ok:false};
 try{
   const {data,error}=await sb.functions.invoke('resend-email',{body:{order_id:orderId,type}});
   if(error)throw error;
   return data||{ok:true};
 }catch(e){
   console.error('order email',e);
   toast('Статус збережено, але email не вдалося надіслати');
   return {ok:false,error:e};
 }
}

function money(v){return '₴'+Number(v||0).toLocaleString('uk-UA')}
function fmtDate(v){return v?new Date(v).toLocaleDateString('uk-UA'):'—'}
function fmtDateTime(v){return v?new Date(v).toLocaleString('uk-UA',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}):'—'}
function orderContact(o){
 const parts=[];
 if(o.phone)parts.push(o.phone);
 if(o.email)parts.push(o.email);
 if(o.city)parts.push(o.city);
 if(o.delivery_address)parts.push(o.delivery_address);
 return parts.join(' · ')||'—'
}
function statusName(v){return({published:'Опубліковано',draft:'Чернетка',sold:'Продано',hidden:'Приховано',new:'Нове',contacted:'Зв’язались',confirmed:'Підтверджено',shipped:'Відправлено',received:'Отримано',completed:'Виконано',cancelled:'Скасовано'})[v]||v}
function productInventoryName(v){
 return ({
   published:'В наявності',
   reserved:'Зарезервовано',
   sold:'Продано',
   hidden:'Приховано',
   draft:'Чернетка'
 })[v]||v
}
function slugify(s){return s.toLowerCase().trim().replace(/[^\p{L}\p{N}]+/gu,'-').replace(/^-|-$/g,'')}

/* Автопідготовка фото без обрізання.
   Фото вписується повністю у рекомендований формат, а вільні поля заповнюються фоном. */
async function prepareImage(file,targetW,targetH,bg='#2a1d14',quality=.92){
  const bitmap=await createImageBitmap(file);
  const canvas=document.createElement('canvas');
  canvas.width=targetW; canvas.height=targetH;
  const ctx=canvas.getContext('2d',{alpha:false});
  ctx.fillStyle=bg; ctx.fillRect(0,0,targetW,targetH);

  const scale=Math.min(targetW/bitmap.width,targetH/bitmap.height);
  const w=Math.round(bitmap.width*scale), h=Math.round(bitmap.height*scale);
  const x=Math.round((targetW-w)/2), y=Math.round((targetH-h)/2);

  ctx.imageSmoothingEnabled=true;
  ctx.imageSmoothingQuality='high';
  ctx.drawImage(bitmap,x,y,w,h);
  bitmap.close();

  // V254 PERFORMANCE: even an already correctly-sized upload is re-encoded,
  // so a multi-megabyte camera JPEG never reaches Storage unchanged.
  // WebP gives materially smaller product/catalog images in modern Safari/Chrome.
  const webpQuality=Math.min(Number(quality)||.82,.82);
  let blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/webp',webpQuality));
  if(!blob || blob.type!=='image/webp') {
    blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',Math.min(webpQuality,.82)));
  }
  if(!blob)throw new Error('Не вдалося підготувати фото');
  const isWebp=blob.type==='image/webp';
  const ext=isWebp?'.webp':'.jpg';
  return new File([blob],(file.name.replace(/\.[^.]+$/,'')||'image')+ext,{type:blob.type});
}
async function uploadFile(file,path){
 // Keep Storage filename/content type consistent after automatic WebP conversion.
 if(file?.type==='image/webp')path=String(path).replace(/\.(?:jpe?g|png)$/i,'.webp');
 const {error}=await sb.storage.from(VH_CONFIG.storageBucket).upload(path,file,{upsert:false,contentType:file.type||'image/jpeg',cacheControl:'31536000'});
 if(error)throw error;
 const url=sb.storage.from(VH_CONFIG.storageBucket).getPublicUrl(path).data.publicUrl;
 try{
   await sb.from('media_library').upsert({
     bucket_id:VH_CONFIG.storageBucket,
     storage_path:path,
     url,
     name:path.split('/').pop()||file.name||'image',
     category:mediaCategoryFromPathV132(path),
     source:'upload',
     updated_at:new Date().toISOString()
   },{onConflict:'bucket_id,storage_path'})
 }catch(e){console.warn('media library register',e)}
 return url
}

let ADMIN_SITE_SETTINGS={};

async function loadSettings(){
 const {data,error}=await sb.from('site_settings').select('*').eq('id',1).maybeSingle();
 if(error){console.error(error);return}
 ADMIN_SITE_SETTINGS=data||{};
 const s=ADMIN_SITE_SETTINGS;
 const put=(id,val='')=>{if($(id))$(id).value=val??''};

 put('sInstagram',s.instagram);
 put('sTelegram',s.telegram);
 put('sPhone',s.phone);
 put('sEmail',s.email);
 put('sCity',s.city);
 put('sShipping',s.shipping_text);
 put('sPayment',s.payment_text);

 put('adDeliveryKicker',s.delivery_page_kicker||'VINTAGE HEDONISTA · SERVICE');
 put('adDeliveryTitle',String(s.delivery_page_title||'ДОСТАВКА\nІ ОПЛАТА').replace(/\\n/g,'\n'));
 put('adDeliveryIntro',s.delivery_page_intro||'Прості умови, щоб покупка вінтажної речі була зрозумілою від замовлення до отримання.');
 put('adDeliveryShippingTitle',s.delivery_shipping_title||'ДОСТАВКА');
 put('adDeliveryShippingText',s.delivery_shipping_text||s.shipping_text||'');
 put('adDeliveryPaymentTitle',s.delivery_payment_title||'ОПЛАТА');
 put('adDeliveryPaymentText',s.delivery_payment_text||s.payment_text||'');
 put('adDeliveryExtraTitle',s.delivery_extra_title||'ПЕРЕД ВІДПРАВЛЕННЯМ');
 put('adDeliveryExtraText',s.delivery_extra_text||'За потреби надішлемо додаткові фото, відео, точні заміри та деталі стану речі.');
 put('adDeliveryProcessTitle',s.delivery_process_title||'ВІД ЗАМОВЛЕННЯ ДО ВІДПРАВЛЕННЯ');
 put('adDeliveryStep1Title',s.delivery_step1_title||'ЗАМОВЛЕННЯ');
 put('adDeliveryStep1Text',s.delivery_step1_text||'Обираєте річ та залишаєте заявку на сайті.');
 put('adDeliveryStep2Title',s.delivery_step2_title||'ПІДТВЕРДЖЕННЯ');
 put('adDeliveryStep2Text',s.delivery_step2_text||'Ми уточнюємо деталі, заміри, оплату та доставку.');
 put('adDeliveryStep3Title',s.delivery_step3_title||'ВІДПРАВЛЕННЯ');
 put('adDeliveryStep3Text',s.delivery_step3_text||'Після підтвердження готуємо річ та передаємо її на доставку.');
 put('adDeliveryCtaTitle',s.delivery_cta_title||'ЗАЛИШИЛИСЯ ПИТАННЯ?');
 put('adDeliveryCtaText',s.delivery_cta_text||'Напишіть нам — допоможемо з доставкою, оплатою або деталями конкретної речі.');
 put('adDeliveryCtaLinkText',s.delivery_cta_link_text||'ЗВ’ЯЗАТИСЯ З НАМИ →');
 put('adDeliveryCtaLinkUrl',s.delivery_cta_link_url||'contacts.html');

 put('adContactsKicker',s.contacts_page_kicker||'VINTAGE HEDONISTA');
 put('adContactsTitle',s.contacts_page_title||'КОНТАКТИ');
 put('adContactsIntro',s.contacts_page_intro||'Потрібні точні заміри, додаткові фото або допомога з вибором — напишіть нам.');
 put('adContactsListTitle',s.contacts_list_title||'ЗВ’ЯЗОК');
 put('adContactsInstagramText',s.contacts_instagram_text||s.instagram||'@vintage_hedonista');
 put('adContactsInstagramUrl',s.contacts_instagram_url||'');
 put('adContactsTelegramText',s.contacts_telegram_text||s.telegram||'Vintage Hedonista');
 put('adContactsTelegramUrl',s.contacts_telegram_url||'');
 put('adContactsEmailText',s.contacts_email_text||s.email||'');
 put('adContactsPhoneText',s.contacts_phone_text||s.phone||'');
 put('adContactsHelpTitle',s.contacts_help_title||'ДОПОМОЖЕМО З ВИБОРОМ');
 put('adContactsHelpText',s.contacts_help_text||'Розкажемо про стан речі, перевіримо заміри, надішлемо додаткові фото та допоможемо зорієнтуватися перед замовленням.');
 put('adContactsTopicsTitle',s.contacts_topics_title||'МИ НА ЗВ’ЯЗКУ, ЯКЩО ПОТРІБНО БІЛЬШЕ ДЕТАЛЕЙ');
 put('adContactsTopic1Title',s.contacts_topic1_title||'ЗАМІРИ');
 put('adContactsTopic1Text',s.contacts_topic1_text||'Перевіримо точні параметри конкретної речі.');
 put('adContactsTopic2Title',s.contacts_topic2_title||'СТАН І ФОТО');
 put('adContactsTopic2Text',s.contacts_topic2_text||'Покажемо деталі, фактуру та нюанси стану крупним планом.');
 put('adContactsTopic3Title',s.contacts_topic3_title||'ДОСТАВКА');
 put('adContactsTopic3Text',s.contacts_topic3_text||'Допоможемо уточнити умови оплати, резерву та відправлення.');
 if($('accountHeaderPreview')){
   $('accountHeaderPreview').innerHTML=s.account_header_image?`<img src="${s.account_header_image}" alt="">`:'<span>Фото ще не додано</span>';
   $('removeAccountHeaderBtn')?.classList.toggle('hidden',!s.account_header_image)
 }
}


function initAccountHeaderAdmin(){
 const panel=$('accountHeaderAdmin'),toggle=$('accountHeaderToggle');
 if(panel&&toggle&&!toggle.dataset.bound){
   toggle.dataset.bound='1';
   toggle.onclick=()=>{
     const collapsed=panel.classList.toggle('collapsed');
     toggle.textContent=collapsed?'РОЗГОРНУТИ ＋':'ЗГОРНУТИ −';
     toggle.setAttribute('aria-expanded',String(!collapsed))
   }
 }
 const save=$('saveAccountHeaderBtn');
 if(save&&!save.dataset.bound){
   save.dataset.bound='1';
   save.onclick=async()=>{
     const file=$('accountHeaderImageInput')?.files?.[0];
     if(!file)return toast('Оберіть фото');
     save.disabled=true;save.textContent='ЗБЕРІГАЄМО...';
     try{
       const ext=(file.name.split('.').pop()||'jpg').toLowerCase();
       const url=await uploadFile(file,`account/header-${Date.now()}.${ext}`);
       const {error}=await sb.from('site_settings').update({account_header_image:url}).eq('id',1);
       if(error)throw error;
       toast('Фото шапки збережено');
       await loadSettings()
     }catch(e){console.error(e);toast(e.message||'Помилка збереження')}
     finally{save.disabled=false;save.textContent='ЗБЕРЕГТИ ФОТО'}
   }
 }
 const remove=$('removeAccountHeaderBtn');
 if(remove&&!remove.dataset.bound){
   remove.dataset.bound='1';
   remove.onclick=async()=>{
     const {error}=await sb.from('site_settings').update({account_header_image:null}).eq('id',1);
     if(error)return toast(error.message);
     toast('Фото шапки видалено');await loadSettings()
   }
 }
}

async function boot(){
 const {data:{session},error:sessionError}=await sb.auth.getSession();
 if(sessionError){
   console.error(sessionError);
   await sb.auth.signOut().catch(()=>{});
   location.replace('index.html?reason=session-error');
   return
 }
 if(!session){
   location.replace('index.html');
   return
 }

 const {data:isAdmin,error}=await sb.rpc('is_admin');
 if(error||isAdmin!==true){
   console.error(error||new Error('Not admin'));
   // Clear ONLY the admin client session. Customer auth uses another storageKey.
   await sb.auth.signOut().catch(()=>{});
   location.replace('index.html?reason=not-admin');
   return
 }

 window.VH_ADMIN_USER_ID=session.user.id;
 $('adminName').textContent='Admin';
 $('loading').classList.add('hidden');
 $('app').classList.remove('hidden');
 await loadProducts();
 await Promise.all([loadCategories(),loadOrders(),loadCustomers(),loadNews(),loadSettings(),loadHomepageSettings()]);
 await loadMediaLibraryV132();
 initMediaLibraryV132();
 initAccountHeaderAdmin();

 // Restore the same admin section after F5 / browser refresh.
 const savedPage=localStorage.getItem(VH_ADMIN_PAGE_KEY)||'dashboard';
 if(savedPage==='productForm'){
   const editId=localStorage.getItem(VH_ADMIN_EDIT_PRODUCT_KEY);
   if(editId && products.some(p=>p.id===editId)) editProduct(editId);
   else { resetProductForm(); goPage('productForm',{remember:false}) }
 }else if(savedPage==='newsForm'){
   const editId=localStorage.getItem(VH_ADMIN_EDIT_NEWS_KEY);
   if(editId && news.some(n=>n.id===editId)) editNews(editId);
   else { resetNewsForm?.(); goPage('newsForm',{remember:false}) }
 }else if($(savedPage)){
   goPage(savedPage,{remember:false})
 }else{
   goPage('dashboard',{remember:false})
 }
}
const VH_ADMIN_PAGE_KEY='vh-admin-current-page-v135';
const VH_ADMIN_EDIT_PRODUCT_KEY='vh-admin-edit-product-v135';
const VH_ADMIN_EDIT_NEWS_KEY='vh-admin-edit-news-v135';

function goPage(id,{remember=true}={}){
 document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
 const page=$(id);
 if(page)page.classList.add('active');
 document.querySelectorAll('.nav-item[data-page]').forEach(n=>n.classList.toggle('active',n.dataset.page===id));
 const names={dashboard:'Панель керування',homepage:'Головна сторінка',products:'Товари',productForm:'Товар',categories:'Категорії',orders:'Замовлення',customers:'Клієнти',news:'Вінтажні хроніки',newsForm:'Стаття',aboutPage:'Про нас',deliveryPage:'Доставка і оплата',contactsPage:'Контакти',media:'Медіатека',settings:'Налаштування'};
 $('pageTitle').textContent=names[id]||'Vintage Hedonista';
 if(remember)localStorage.setItem(VH_ADMIN_PAGE_KEY,id);
 if(innerWidth<760)$('sidebar').classList.remove('open')
}
window.goPage=goPage;
document.querySelectorAll('[data-order-quick]').forEach(btn=>btn.addEventListener('click',()=>{
 const status=btn.dataset.orderQuick;
 if($('orderStatusFilter'))$('orderStatusFilter').value=status;
 goPage('orders');
 applyOrderFilters()
}));
document.querySelectorAll('.nav-item[data-page]').forEach(n=>n.onclick=()=>goPage(n.dataset.page));$('menuBtn').onclick=()=>$('sidebar').classList.toggle('open');$('logout').onclick=async()=>{await sb.auth.signOut();location.href='index.html'};

/* ==========================================================
   V132 — MEDIA LIBRARY
   ========================================================== */
function mediaCategoryFromPathV132(path=''){
 const p=String(path).toLowerCase();
 if(/product|товар/.test(p))return 'products';
 if(/categor/.test(p))return 'categories';
 if(/news|journal|article/.test(p))return 'journal';
 if(/instagram/.test(p))return 'instagram';
 if(/hero|about|banner|homepage|page|account|cta|top/.test(p))return 'pages';
 return 'storage'
}

function mediaUrlV132(item){
 if(item.url)return item.url;
 if(item.bucket_id&&item.storage_path){
   return sb.storage.from(item.bucket_id).getPublicUrl(item.storage_path).data.publicUrl
 }
 return ''
}

function mediaNameV132(item){
 return item.name||item.storage_path?.split('/').pop()||'Фото'
}

async function loadMediaLibraryV132(){
 const {data,error}=await sb.from('media_library').select('*').order('created_at',{ascending:false}).limit(1500);
 if(error){
   console.warn('media_library',error);
   MEDIA_LIBRARY_V132=[];
   if($('mediaLibraryGrid'))$('mediaLibraryGrid').innerHTML='<div class="empty">Медіатека ще не налаштована. Запустіть SQL V132 у Supabase.</div>';
   return
 }
 MEDIA_LIBRARY_V132=data||[];
 renderMediaLibraryV132();
 renderMediaPickerV132()
}

function renderMediaLibraryV132(){
 if(!$('mediaLibraryGrid'))return;
 const q=($('mediaSearchInput')?.value||'').toLowerCase().trim();
 const category=$('mediaCategoryFilter')?.value||'';
 const dateFilter=$('mediaDateFilter')?.value||'';
 const sort=$('mediaSortFilter')?.value||'newest';
 const now=Date.now();
 let items=MEDIA_LIBRARY_V132.filter(item=>{
   if(category&&item.category!==category)return false;
   if(q && ![mediaNameV132(item),item.storage_path,item.source,item.category].filter(Boolean).join(' ').toLowerCase().includes(q))return false;
   if(dateFilter){
     const d=new Date(item.created_at||item.updated_at||0).getTime();
     const days=(now-d)/86400000;
     if(dateFilter==='today' && days>1)return false;
     if(dateFilter==='7' && days>7)return false;
     if(dateFilter==='30' && days>30)return false;
     if(dateFilter==='older' && days<=30)return false;
   }
   return true
 });
 items=[...items].sort((a,b)=>{
   if(sort==='name')return mediaNameV132(a).localeCompare(mediaNameV132(b),'uk');
   const da=new Date(a.created_at||a.updated_at||0).getTime();
   const db=new Date(b.created_at||b.updated_at||0).getTime();
   return sort==='oldest'?da-db:db-da
 });
 if($('mediaLibraryCount'))$('mediaLibraryCount').textContent=`${items.length} фото`;
 $('mediaLibraryGrid').innerHTML=items.length?items.map(item=>`
   <div class="media-card-v132">
     <button class="media-card-image-v132" type="button" onclick="previewMediaV132('${item.id}')">
       <img src="${mediaUrlV132(item)}" alt="" loading="lazy">
     </button>
     <div class="media-card-copy-v132">
       <b title="${mediaNameV132(item)}">${mediaNameV132(item)}</b>
       <small>${item.category||'storage'} · ${item.source||'archive'}</small>
     </div>
     <div class="media-card-meta-v133">${new Date(item.created_at||item.updated_at||Date.now()).toLocaleDateString('uk-UA')}</div>
     <div class="media-card-actions-v132">
       <button class="btn tiny" type="button" onclick="copyMediaUrlV132('${item.id}')">URL</button>
       <button class="btn tiny" type="button" onclick="downloadMediaV132('${item.id}')">↗</button>
       <button class="btn tiny danger" type="button" onclick="deleteMediaV133('${item.id}')">ВИДАЛИТИ</button>
     </div>
   </div>`).join(''):'<div class="empty">Нічого не знайдено</div>'
}

function renderMediaPickerV132(){
 if(!$('mediaPickerGrid'))return;
 const q=($('mediaPickerSearch')?.value||'').toLowerCase().trim();
 const items=MEDIA_LIBRARY_V132.filter(item=>!q||[mediaNameV132(item),item.storage_path,item.category].filter(Boolean).join(' ').toLowerCase().includes(q));
 $('mediaPickerGrid').innerHTML=items.length?items.map(item=>`
   <button class="media-picker-item-v132" type="button" onclick="chooseMediaV132('${item.id}')">
     <img src="${mediaUrlV132(item)}" alt="" loading="lazy">
     <span>${mediaNameV132(item)}</span>
   </button>`).join(''):'<div class="empty">Фото не знайдено</div>'
}

async function syncMediaLibraryV132(){
 const btn=$('syncMediaLibraryBtn');
 if(btn){btn.disabled=true;btn.textContent='СИНХРОНІЗАЦІЯ...'}
 try{
   const {data,error}=await sb.rpc('admin_sync_media_storage_v132',{p_bucket:VH_CONFIG.storageBucket});
   if(error)throw error;
   await indexCurrentMediaUrlsV132();
   await loadMediaLibraryV132();
   toast(`Медіатеку синхронізовано${Number.isFinite(data)?`: ${data} файлів`:''}`)
 }catch(e){console.error(e);toast('Помилка синхронізації: '+(e.message||e))}
 finally{if(btn){btn.disabled=false;btn.textContent='↻ СИНХРОНІЗУВАТИ ІСНУЮЧІ'}}
}
window.syncMediaLibraryV132=syncMediaLibraryV132;

async function indexCurrentMediaUrlsV132(){
 const roots=[products,categories,news,heroSlides,instagramFeed,ADMIN_SITE_SETTINGS];
 const urls=new Set();
 const walk=v=>{
   if(!v)return;
   if(typeof v==='string'){
     if(/^https?:\/\//i.test(v)&&/\.(jpe?g|png|webp|gif|avif)(\?|$)/i.test(v))urls.add(v);
     return
   }
   if(Array.isArray(v)){v.forEach(walk);return}
   if(typeof v==='object')Object.values(v).forEach(walk)
 };
 roots.forEach(walk);
 const rows=[...urls].map(url=>({
   url,
   name:decodeURIComponent(url.split('?')[0].split('/').pop()||'image'),
   category:mediaCategoryFromPathV132(url),
   source:'site-reference',
   updated_at:new Date().toISOString()
 }));
 if(rows.length){
   const {error}=await sb.from('media_library').upsert(rows,{onConflict:'url',ignoreDuplicates:true});
   if(error)console.warn('media current urls',error)
 }
}

async function uploadMediaFilesV132(files){
 if(!files?.length)return;
 for(const original of files){
   try{
     const safe=(original.name||'image').replace(/[^\p{L}\p{N}._-]+/gu,'-');
     const path=`media-library/${Date.now()}-${Math.random().toString(36).slice(2,7)}-${safe}`;
     await uploadFile(original,path)
   }catch(e){console.error(e);toast('Не вдалося завантажити '+original.name)}
 }
 await loadMediaLibraryV132();
 toast('Фото додано до медіатеки')
}

function openMediaPickerV132(input){
 MEDIA_PICKER_TARGET_V132=input;
 $('mediaPickerV132')?.classList.remove('hidden');
 document.body.classList.add('modal-open');
 renderMediaPickerV132()
}
window.openMediaPickerV132=openMediaPickerV132;

function closeMediaPickerV132(){
 $('mediaPickerV132')?.classList.add('hidden');
 MEDIA_PICKER_TARGET_V132=null
}

async function chooseMediaV132(id){
 const item=MEDIA_LIBRARY_V132.find(x=>String(x.id)===String(id));
 const input=MEDIA_PICKER_TARGET_V132;
 if(!item||!input)return;
 const url=mediaUrlV132(item);
 try{
   const res=await fetch(url);
   if(!res.ok)throw new Error('Не вдалося завантажити фото з архіву');
   const blob=await res.blob();
   const name=mediaNameV132(item);
   const file=new File([blob],name,{type:blob.type||'image/jpeg'});
   const dt=new DataTransfer();
   if(input.multiple){
     [...(input.files||[])].forEach(f=>dt.items.add(f))
   }
   dt.items.add(file);
   input.files=dt.files;
   input.dispatchEvent(new Event('change',{bubbles:true}));
   closeMediaPickerV132();
   toast('Фото обрано з медіатеки')
 }catch(e){console.error(e);toast(e.message||'Не вдалося обрати фото')}
}
window.chooseMediaV132=chooseMediaV132;

function attachMediaButtonsV132(){
 document.querySelectorAll('input[type="file"][accept*="image"]').forEach(input=>{
   if(input.dataset.mediaBound)return;
   input.dataset.mediaBound='1';

   const btn=document.createElement('button');
   btn.type='button';
   btn.className='btn media-select-btn-v132';
   btn.textContent='▧ ОБРАТИ З МЕДІАТЕКИ';
   btn.onclick=()=>openMediaPickerV132(input);

   const fileLabel=input.closest('label.btn, label.about-file-btn');
   if(input.hidden && fileLabel){
     let actions=fileLabel.parentElement;
     if(!actions || !actions.classList.contains('v208-media-actions')){
       const wrapper=document.createElement('div');
       wrapper.className='v208-media-actions';
       fileLabel.parentNode.insertBefore(wrapper,fileLabel);
       wrapper.appendChild(fileLabel);
       actions=wrapper;
     }
     actions.appendChild(btn);
     return
   }

   if(input.hidden){
     const host=input.closest('.field,.hero-fixed-card,.subpanel,.panel')||input.parentElement;
     host?.appendChild(btn)
   }else{
     input.insertAdjacentElement('afterend',btn)
   }
 })
}

function previewMediaV132(id){
 const item=MEDIA_LIBRARY_V132.find(x=>String(x.id)===String(id));if(!item)return;
 window.open(mediaUrlV132(item),'_blank')
}
window.previewMediaV132=previewMediaV132;
async function copyMediaUrlV132(id){
 const item=MEDIA_LIBRARY_V132.find(x=>String(x.id)===String(id));if(!item)return;
 await navigator.clipboard.writeText(mediaUrlV132(item));toast('URL скопійовано')
}
window.copyMediaUrlV132=copyMediaUrlV132;
function downloadMediaV132(id){
 const item=MEDIA_LIBRARY_V132.find(x=>String(x.id)===String(id));if(item)window.open(mediaUrlV132(item),'_blank')
}

async function deleteMediaV133(id){
 const item=MEDIA_LIBRARY_V132.find(x=>String(x.id)===String(id));
 if(!item)return;
 if(!confirm(`Видалити "${mediaNameV132(item)}" з медіатеки?`))return;

 try{
   // Remove physical Storage object only when this record points to our bucket/path.
   if(item.bucket_id&&item.storage_path){
     const {error:storageError}=await sb.storage.from(item.bucket_id).remove([item.storage_path]);
     if(storageError)console.warn('storage delete',storageError);
   }
   const {error}=await sb.from('media_library').delete().eq('id',id);
   if(error)throw error;
   MEDIA_LIBRARY_V132=MEDIA_LIBRARY_V132.filter(x=>String(x.id)!==String(id));
   renderMediaLibraryV132();
   renderMediaPickerV132();
   toast('Фото видалено з медіатеки')
 }catch(e){console.error(e);toast('Не вдалося видалити фото: '+(e.message||e))}
}
window.deleteMediaV133=deleteMediaV133;

window.downloadMediaV132=downloadMediaV132;

function initMediaLibraryV132(){
 attachMediaButtonsV132();
 new MutationObserver(()=>attachMediaButtonsV132()).observe(document.body,{childList:true,subtree:true});
 $('mediaSearchInput')?.addEventListener('input',renderMediaLibraryV132);
 $('mediaCategoryFilter')?.addEventListener('change',renderMediaLibraryV132);
 $('mediaDateFilter')?.addEventListener('change',renderMediaLibraryV132);
 $('mediaSortFilter')?.addEventListener('change',renderMediaLibraryV132);
 $('mediaPickerSearch')?.addEventListener('input',renderMediaPickerV132);
 $('syncMediaLibraryBtn')?.addEventListener('click',syncMediaLibraryV132);
 $('uploadMediaLibraryBtn')?.addEventListener('click',()=>$('mediaLibraryUploadInput')?.click());
 $('mediaLibraryUploadInput')?.addEventListener('change',async e=>{await uploadMediaFilesV132([...e.target.files]);e.target.value=''});
 $('mediaPickerUploadBtn')?.addEventListener('click',()=>$('mediaPickerUploadInput')?.click());
 $('mediaPickerUploadInput')?.addEventListener('change',async e=>{await uploadMediaFilesV132([...e.target.files]);e.target.value='';renderMediaPickerV132()});
 document.querySelectorAll('[data-media-close]').forEach(x=>x.addEventListener('click',closeMediaPickerV132))
}
async function loadCategories(){
 const {data,error}=await sb.from('categories').select('*').order('sort_order');
 if(error){console.error(error);return}
 categories=data||[];

 $('pCategory').innerHTML='<option value="">Без категорії</option>'+categories.map(c=>`<option value="${c.id}">${c.name}</option>`).join('');
 if($('productCategoryFilter')){
   const current=$('productCategoryFilter').value;
   $('productCategoryFilter').innerHTML='<option value="">Всі категорії</option>'+categories.map(c=>`<option value="${c.id}">${c.name}</option>`).join('');
   if([...$('productCategoryFilter').options].some(o=>o.value===current))$('productCategoryFilter').value=current
 }

 $('categoriesTable').innerHTML=categories.length?`<div class="table-wrap"><table class="table category-sort-table">
 <thead><tr><th class="category-drag-col"></th><th>ОБКЛАДИНКА</th><th>НАЗВА</th><th>SLUG</th><th>ПОРЯДОК</th><th>АКТИВНА</th><th>ГОЛОВНА</th><th>ДІЇ</th></tr></thead>
 <tbody>${categories.map(c=>`<tr class="category-sort-row" draggable="true" data-category-id="${c.id}">
   <td class="category-drag-cell"><button class="category-drag-handle" type="button" title="Перетягніть категорію">⋮⋮</button></td>
   <td>${c.cover_image?`<img class="thumb" src="${c.cover_image}">`:`<div class="thumb"></div>`}</td>
   <td><div class="pname">${c.name}</div></td>
   <td>${c.slug}</td>
   <td><div class="category-order-actions"><button class="btn tiny" type="button" onclick="moveCategory('${c.id}',-1)" title="Підняти вище">↑</button><button class="btn tiny" type="button" onclick="moveCategory('${c.id}',1)" title="Опустити нижче">↓</button></div></td>
   <td>${c.is_active?'Так':'Ні'}</td>
   <td>${c.show_on_home?'Так':'Ні'}</td>
   <td><button class="btn small-action" onclick="editCategory('${c.id}')">Редагувати</button></td>
 </tr>`).join('')}</tbody></table></div>`:'<div class="empty">Категорій немає</div>';

 bindCategoryDragAndDrop()
}

function resetCategoryForm(){
 editingCategoryId=null;
 $('categoryFormTitle').textContent='Додати категорію';
 $('catName').value='';
 $('catSlug').value='';
 $('catActive').checked=true;
 $('catShowHome').checked=true;
 $('catImage').value='';
 $('catImagePreview').innerHTML='';
 $('saveCategoryBtn').textContent='ДОДАТИ';
 $('cancelCategoryEditBtn').classList.add('hidden');
 $('deleteCategoryBtn').classList.add('hidden');
}

function editCategory(id){
 const c=categories.find(x=>x.id===id);if(!c)return;
 editingCategoryId=id;
 $('categoryFormTitle').textContent='Редагувати категорію';
 $('catName').value=c.name||'';
 $('catSlug').value=c.slug||'';
 $('catActive').checked=!!c.is_active;
 $('catShowHome').checked=!!c.show_on_home;
 $('catImage').value='';
 $('catImagePreview').innerHTML=c.cover_image?`<img src="${c.cover_image}">`:'';
 $('saveCategoryBtn').textContent='ЗБЕРЕГТИ';
 $('cancelCategoryEditBtn').classList.remove('hidden');
 $('deleteCategoryBtn').classList.remove('hidden');
}
window.editCategory=editCategory;
window.moveCategory=async function(id,direction){
 const ordered=[...categories].sort((a,b)=>Number(a.sort_order||0)-Number(b.sort_order||0));
 const index=ordered.findIndex(c=>c.id===id);
 const target=index+direction;
 if(index<0||target<0||target>=ordered.length)return;

 const current=ordered[index],other=ordered[target];
 let currentOrder=Number(current.sort_order||0),otherOrder=Number(other.sort_order||0);

 // If equal values exist, normalize all rows first.
 if(currentOrder===otherOrder){
   const normalized=ordered.map((c,i)=>({id:c.id,sort_order:(i+1)*10}));
   for(const row of normalized){
     const {error}=await sb.from('categories').update({sort_order:row.sort_order}).eq('id',row.id);
     if(error){console.error(error);return toast(error.message)}
   }
   await loadCategories();
   return moveCategory(id,direction);
 }

 const {error:e1}=await sb.from('categories').update({sort_order:otherOrder}).eq('id',current.id);
 if(e1){console.error(e1);return toast(e1.message)}
 const {error:e2}=await sb.from('categories').update({sort_order:currentOrder}).eq('id',other.id);
 if(e2){console.error(e2);return toast(e2.message)}

 toast('Порядок категорій змінено');
 await loadCategories()
};



async function persistCategoryOrder(ids){
 const ordered=ids.map(id=>categories.find(c=>c.id===id)).filter(Boolean);
 for(let i=0;i<ordered.length;i++){
   const sort_order=(i+1)*10;
   if(Number(ordered[i].sort_order||0)===sort_order)continue;
   const {error}=await sb.from('categories').update({sort_order}).eq('id',ordered[i].id);
   if(error)throw error
 }
}

function bindCategoryDragAndDrop(){
 const tbody=document.querySelector('#categoriesTable tbody');
 if(!tbody)return;

 let dragged=null;
 tbody.querySelectorAll('.category-sort-row').forEach(row=>{
   row.addEventListener('dragstart',e=>{
     dragged=row;
     row.classList.add('is-dragging');
     if(e.dataTransfer){
       e.dataTransfer.effectAllowed='move';
       e.dataTransfer.setData('text/plain',row.dataset.categoryId||'')
     }
   });
   row.addEventListener('dragend',async()=>{
     row.classList.remove('is-dragging');
     tbody.querySelectorAll('.category-sort-row').forEach(r=>r.classList.remove('drag-over'));
     if(!dragged)return;
     dragged=null;
     try{
       const ids=[...tbody.querySelectorAll('.category-sort-row')].map(r=>r.dataset.categoryId);
       await persistCategoryOrder(ids);
       toast('Порядок категорій збережено');
       await loadCategories()
     }catch(e){
       console.error(e);
       toast(e.message||'Не вдалося змінити порядок');
       await loadCategories()
     }
   });
   row.addEventListener('dragover',e=>{
     e.preventDefault();
     if(!dragged||dragged===row)return;
     const rect=row.getBoundingClientRect();
     const after=e.clientY>rect.top+rect.height/2;
     tbody.insertBefore(dragged,after?row.nextSibling:row);
     row.classList.add('drag-over')
   });
   row.addEventListener('dragleave',()=>row.classList.remove('drag-over'))
 })
}
window.bindCategoryDragAndDrop=bindCategoryDragAndDrop;

$('catName').oninput=e=>{if(!editingCategoryId&&!$('catSlug').value)$('catSlug').value=slugify(e.target.value)};
$('catImage').onchange=e=>{const f=e.target.files[0];$('catImagePreview').innerHTML=f?`<img src="${URL.createObjectURL(f)}">`:''};

$('saveCategoryBtn').onclick=async()=>{
 const btn=$('saveCategoryBtn');btn.disabled=true;btn.textContent='ЗБЕРЕЖЕННЯ...';
 try{
   const name=$('catName').value.trim();
   const slug=$('catSlug').value.trim()||slugify(name);
   if(!name||!slug)throw new Error('Вкажи назву і slug');

   const current=editingCategoryId?categories.find(x=>x.id===editingCategoryId):null;
   let cover=current?.cover_image||null;

   const original=$('catImage').files[0];
   if(original){
     const f=await prepareImage(original,1200,600,'#35291d',.82);
     cover=await uploadFile(f,`categories/${editingCategoryId||crypto.randomUUID()}-${Date.now()}.jpg`)
   }

   const maxCategoryOrder=categories.length?Math.max(...categories.map(c=>Number(c.sort_order||0))):0;
   const payload={
     name,
     slug,
     sort_order:current?Number(current.sort_order||0):maxCategoryOrder+10,
     is_active:$('catActive').checked,
     show_on_home:$('catShowHome').checked,
     cover_image:cover
   };

   if(editingCategoryId){
     const {error}=await sb.from('categories').update(payload).eq('id',editingCategoryId);if(error)throw error;
     toast('Категорію оновлено')
   }else{
     const {error}=await sb.from('categories').insert(payload);if(error)throw error;
     toast('Категорію додано')
   }

   resetCategoryForm();
   await loadCategories()
 }catch(e){
   console.error(e);toast(e.message)
 }finally{
   btn.disabled=false;
   if(editingCategoryId)btn.textContent='ЗБЕРЕГТИ';else btn.textContent='ДОДАТИ'
 }
};

$('cancelCategoryEditBtn').onclick=resetCategoryForm;

$('deleteCategoryBtn').onclick=async()=>{
 if(!editingCategoryId)return;
 if(!confirm('Видалити категорію? Товари в ній залишаться без категорії.'))return;
 const {error}=await sb.from('categories').delete().eq('id',editingCategoryId);
 if(error)return toast(error.message);
 toast('Категорію видалено');
 resetCategoryForm();
 await loadCategories()
};

async function loadProducts(){
 const {data,error}=await sb.from('products').select('*,categories(name),product_images(*)').order('created_at',{ascending:false});
 if(error){console.error(error);return}
 products=(data||[]).map(p=>({...p,product_images:(p.product_images||[]).sort((a,b)=>(a.sort_order||0)-(b.sort_order||0))}));
 renderProducts(products);renderRecentProducts();$('statProducts').textContent=products.filter(p=>p.status==='published').length;
 renderRelatedProductsV197()
}
function row(p,edit=true){return `<tr><td><div class="product-cell">${p.cover_image?`<img class="thumb" src="${p.cover_image}">`:`<div class="thumb"></div>`}<div><div class="pname">${p.name}</div><div class="pid">ID: ${String(p.id).slice(0,8)}</div></div></div></td><td>${p.categories?.name||'—'}</td><td>${money(p.price)}</td><td><span class="status ${p.status}">${productInventoryName(p.status)}</span></td><td>${fmtDate(p.created_at)}</td>${edit?`<td><button class="btn small-action" onclick="editProduct('${p.id}')">Редагувати</button></td>`:''}</tr>`}
function renderProducts(list){$('productsTable').innerHTML=list.length?`<div class="table-wrap"><table class="table"><thead><tr><th>ТОВАР</th><th>КАТЕГОРІЯ</th><th>ЦІНА</th><th>СТАТУС</th><th>ДАТА</th><th></th></tr></thead><tbody>${list.map(p=>row(p,true)).join('')}</tbody></table></div>`:'<div class="empty">Товарів ще немає</div>'}
function renderRecentProducts(){const list=products.slice(0,5);$('recentProducts').innerHTML=list.length?`<div class="table-wrap"><table class="table"><thead><tr><th>ТОВАР</th><th>КАТЕГОРІЯ</th><th>ЦІНА</th><th>СТАТУС</th><th>ДАТА</th></tr></thead><tbody>${list.map(p=>row(p,false)).join('')}</tbody></table></div>`:'<div class="empty">Ще немає товарів</div>'}

/* ==========================================================
   V41 — PRODUCT CRUD RESTORED
   ========================================================== */
let PRODUCT_GALLERY=[];
let RELATED_PRODUCT_IDS_V197=[];


function productField(id,val=''){
 const el=$(id);if(el)el.value=val??''
}
function productCheck(id,val=false){
 const el=$(id);if(el)el.checked=!!val
}
function normalizeProductGallery(){
 PRODUCT_GALLERY.forEach((x,i)=>x.sort_order=i);
}
function productGalleryUrl(item){
 return item.local_url||item.image_url||''
}
function renderProductAdminGallery(){
 normalizeProductGallery();
 const box=$('productGallery');
 if(!box)return;
 $('galleryCount').textContent=String(PRODUCT_GALLERY.length);

 box.innerHTML=PRODUCT_GALLERY.length?PRODUCT_GALLERY.map((img,i)=>`
   <div class="admin-product-photo ${i===0?'is-main':''}" draggable="true" data-gallery-index="${i}">
     <div class="admin-product-photo-img">
       <img src="${productGalleryUrl(img)}" alt="">
       ${i===0?'<span class="admin-main-badge">ГОЛОВНЕ</span>':''}
     </div>
     <div class="admin-product-photo-actions">
       ${i!==0?`<button type="button" class="btn tiny" onclick="makeProductImageMain(${i})">Головне</button>`:''}
       <button type="button" class="btn tiny" onclick="moveProductImage(${i},-1)" ${i===0?'disabled':''}>←</button>
       <button type="button" class="btn tiny" onclick="moveProductImage(${i},1)" ${i===PRODUCT_GALLERY.length-1?'disabled':''}>→</button>
       <button type="button" class="btn tiny danger" onclick="removeProductImage(${i})">×</button>
     </div>
   </div>`).join(''):'<div class="empty product-gallery-empty">Фото ще не додані</div>';

 let dragIndex=null;
 box.querySelectorAll('.admin-product-photo').forEach(card=>{
   card.addEventListener('dragstart',()=>{dragIndex=Number(card.dataset.galleryIndex);card.classList.add('dragging')});
   card.addEventListener('dragend',()=>{card.classList.remove('dragging');dragIndex=null});
   card.addEventListener('dragover',e=>e.preventDefault());
   card.addEventListener('drop',e=>{
     e.preventDefault();
     const target=Number(card.dataset.galleryIndex);
     if(dragIndex===null||dragIndex===target)return;
     const [moved]=PRODUCT_GALLERY.splice(dragIndex,1);
     PRODUCT_GALLERY.splice(target,0,moved);
     renderProductAdminGallery()
   });
 });
}

window.makeProductImageMain=function(index){
 if(index<=0||index>=PRODUCT_GALLERY.length)return;
 const [img]=PRODUCT_GALLERY.splice(index,1);
 PRODUCT_GALLERY.unshift(img);
 renderProductAdminGallery()
};
window.moveProductImage=function(index,dir){
 const target=index+dir;
 if(target<0||target>=PRODUCT_GALLERY.length)return;
 [PRODUCT_GALLERY[index],PRODUCT_GALLERY[target]]=[PRODUCT_GALLERY[target],PRODUCT_GALLERY[index]];
 renderProductAdminGallery()
};
window.removeProductImage=function(index){
 const img=PRODUCT_GALLERY[index];
 if(img?.local_url)URL.revokeObjectURL(img.local_url);
 PRODUCT_GALLERY.splice(index,1);
 renderProductAdminGallery()
};


/* ==========================================================
   V148 — SMART PRODUCT MEASUREMENTS BY CATEGORY
   ========================================================== */
const MEASUREMENT_PROFILES_V148={
  upper:{
    keys:['shoulders','chest','length','sleeve'],
    hint:'Для верхнього одягу, жакетів, сорочок, блуз, кардиганів та іншого верху.'
  },
  dress:{
    keys:['shoulders','chest','waist','hips','length','sleeve'],
    hint:'Для суконь: плечі, груди, талія, стегна, довжина виробу та рукав.'
  },
  pants:{
    keys:['waist','hips','length','inseam'],
    hint:'Для штанів і джинсів: талія/пояс, стегна, загальна довжина та внутрішній шов.'
  },
  skirt:{
    keys:['waist','hips','length'],
    hint:'Для спідниць: талія/пояс, стегна та довжина виробу.'
  },
  footwear:{
    keys:['insole'],
    hint:'Для взуття достатньо вказати довжину устілки в сантиметрах.'
  },
  headwear:{
    keys:['head'],
    hint:'Для головних уборів вкажіть обхват голови.'
  },
  accessory:{
    keys:['width','height','depth'],
    hint:'Для сумок та аксесуарів: ширина, висота і глибина.'
  }
};

function measurementProfileKeyV148(category){
 const text=`${category?.name||''} ${category?.slug||''}`.toLowerCase();
 if(/взут|shoe|boot|чоб|туф|черев|крос|босон/.test(text))return 'footwear';
 if(/штан|брюк|джин|trouser|pant/.test(text))return 'pants';
 if(/спідниц|skirt/.test(text))return 'skirt';
 if(/сукн|dress/.test(text))return 'dress';
 if(/голов|капелю|шап|берет|hat|headwear/.test(text))return 'headwear';
 if(/сумк|аксес|bag|accessor/.test(text))return 'accessory';
 return 'upper';
}

function currentProductCategoryV148(){
 const id=$('pCategory')?.value||'';
 return categories.find(c=>String(c.id)===String(id))||null
}

function updateMeasurementFieldsV148(){
 const category=currentProductCategoryV148();
 const profile=MEASUREMENT_PROFILES_V148[measurementProfileKeyV148(category)]||MEASUREMENT_PROFILES_V148.upper;
 const active=new Set(profile.keys);

 document.querySelectorAll('#measurementFieldsV148 [data-measure-key]').forEach(field=>{
   field.classList.toggle('hidden',!active.has(field.dataset.measureKey))
 });

 const hint=$('measurementHintV148');
 if(hint)hint.textContent=category
   ? profile.hint
   : 'Оберіть категорію — набір замірів автоматично підлаштується під тип товару.';
}
window.updateMeasurementFieldsV148=updateMeasurementFieldsV148;

$('pCategory')?.addEventListener('change',updateMeasurementFieldsV148);


/* ==========================================================
   V197 — CURATED RELATED PRODUCTS
   ========================================================== */
function relatedEscapeV197(value){
 return String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[ch]))
}
function relatedProductCandidateTextV197(p){
 return [p.name,p.brand,p.categories?.name,p.slug].filter(Boolean).join(' ').toLowerCase()
}

function selectedRelatedProductsV197(){
 const map=new Map(products.map(p=>[String(p.id),p]));
 return RELATED_PRODUCT_IDS_V197.map(id=>map.get(String(id))).filter(Boolean)
}

function renderRelatedProductsV197(){
 const grid=$('relatedProductsGridV197');
 const selectedHost=$('relatedProductsSelectedV197');
 const count=$('relatedProductCountV197');
 if(!grid||!selectedHost||!count)return;

 const query=($('relatedProductSearchV197')?.value||'').trim().toLowerCase();
 const currentId=String(editingProductId||'');
 const chosen=new Set(RELATED_PRODUCT_IDS_V197.map(String));

 count.textContent=String(RELATED_PRODUCT_IDS_V197.length);

 const selected=selectedRelatedProductsV197();
 selectedHost.innerHTML=selected.length
   ? `<div class="related-products-selected-title-v197">ВИБРАНІ ТОВАРИ</div>
      <div class="related-products-selected-list-v197">
       ${selected.map((p,i)=>`
        <button class="related-selected-chip-v197" type="button" onclick="toggleRelatedProductV197('${p.id}')">
          <span>${String(i+1).padStart(2,'0')}</span>
          <b>${relatedEscapeV197(p.name||'Товар')}</b>
          <i>×</i>
        </button>`).join('')}
      </div>`
   : '';

 // Do not show the full catalog by default.
 if(query.length<2){
   grid.innerHTML='<div class="related-products-search-empty-v198">Введіть щонайменше 2 символи для пошуку товару.</div>';
   return;
 }

 const list=products
   .filter(p=>String(p.id)!==currentId)
   .filter(p=>relatedProductCandidateTextV197(p).includes(query))
   .slice(0,12);

 grid.innerHTML=list.length?list.map(p=>{
   const isSelected=chosen.has(String(p.id));
   const selectedIndex=RELATED_PRODUCT_IDS_V197.map(String).indexOf(String(p.id));
   return `<button type="button"
     class="related-product-card-v197 ${isSelected?'is-selected':''}"
     onclick="toggleRelatedProductV197('${p.id}')">
       <span class="related-product-check-v197">${isSelected?String(selectedIndex+1).padStart(2,'0'):'＋'}</span>
       <span class="related-product-image-v197">
         ${p.cover_image?`<img src="${p.cover_image}" alt="" loading="lazy">`:'<i>Немає фото</i>'}
       </span>
       <span class="related-product-copy-v197">
         ${p.brand?`<small>${relatedEscapeV197(p.brand)}</small>`:''}
         <b>${relatedEscapeV197(p.name||'Товар')}</b>
         <em>${money(p.price)}</em>
       </span>
     </button>`
 }).join(''):'<div class="related-products-search-empty-v198">Нічого не знайдено.</div>';
}

window.toggleRelatedProductV197=function(id){
 id=String(id);
 const index=RELATED_PRODUCT_IDS_V197.map(String).indexOf(id);
 if(index>=0){
   RELATED_PRODUCT_IDS_V197.splice(index,1);
 }else{
   RELATED_PRODUCT_IDS_V197.push(id);
   if($('relatedProductSearchV197'))$('relatedProductSearchV197').value='';
 }
 renderRelatedProductsV197();
};

async function loadRelatedProductsV197(productId){
 RELATED_PRODUCT_IDS_V197=[];
 if(productId){
   const {data,error}=await sb.from('product_related_products')
     .select('related_product_id,sort_order')
     .eq('product_id',productId)
     .order('sort_order',{ascending:true});
   if(error){
     console.warn('product_related_products',error);
     if(error.code!=='42P01')toast('Супутні товари: '+error.message);
   }else{
     RELATED_PRODUCT_IDS_V197=(data||[]).map(x=>String(x.related_product_id));
   }
 }
 renderRelatedProductsV197();
}

async function saveRelatedProductsV197(productId){
 const {error:deleteError}=await sb.from('product_related_products')
   .delete()
   .eq('product_id',productId);
 if(deleteError)throw new Error('Супутні товари: '+deleteError.message);

 if(!RELATED_PRODUCT_IDS_V197.length)return;

 const rows=RELATED_PRODUCT_IDS_V197
   .filter(id=>String(id)!==String(productId))
   .map((relatedId,index)=>({
      product_id:productId,
      related_product_id:relatedId,
      sort_order:index
   }));

 if(!rows.length)return;
 const {error}=await sb.from('product_related_products').insert(rows);
 if(error)throw new Error('Супутні товари: '+error.message);
}

$('relatedProductSearchV197')?.addEventListener('input',renderRelatedProductsV197);

function resetProductForm(){
 editingProductId=null;
 localStorage.removeItem(VH_ADMIN_EDIT_PRODUCT_KEY);
 PRODUCT_GALLERY=[];
 RELATED_PRODUCT_IDS_V197=[];
 $('productFormTitle').textContent='Новий товар';

 productField('pName');
 productField('pBrand');
 productField('pSlug');
 productField('pPrice');
 productField('pOldPrice');
 productField('pCategory');
 productField('pStatus','draft');
 productField('pSize');
 productField('pSeason');
 productField('pColor');
 productField('pMaterial');
 productField('pCondition');
 productField('pShort');
 productField('pDescription');
 productField('pMeasureShoulders');
 productField('pMeasureChest');
 productField('pMeasureWaist');
 productField('pMeasureHips');
 productField('pMeasureLength');
 productField('pMeasureSleeve');
 productField('pMeasureInseam');
 productField('pMeasureInsole');
 productField('pMeasureHead');
 productField('pMeasureWidth');
 productField('pMeasureHeight');
 productField('pMeasureDepth');
 productField('pDetailsText');

 productCheck('pNew',false);
 productCheck('pTop',false);
 productCheck('pHome',true);

 $('pImages').value='';
 $('deleteProductBtn').classList.add('hidden');
 $('saveProductBtn').textContent='ЗБЕРЕГТИ';
 renderProductAdminGallery();
 updateMeasurementFieldsV148();
 renderRelatedProductsV197()
}

function openProductForm(){
 resetProductForm();
 goPage('productForm')
}
window.openProductForm=openProductForm;

async function editProduct(id){
 const p=products.find(x=>x.id===id);
 if(!p){toast('Товар не знайдено');return}

 editingProductId=id;
 localStorage.setItem(VH_ADMIN_EDIT_PRODUCT_KEY,id);
 $('productFormTitle').textContent='Редагувати товар';

 productField('pName',p.name);
 productField('pBrand',p.brand);
 productField('pSlug',p.slug);
 productField('pPrice',p.price);
 productField('pOldPrice',p.old_price);
 productField('pCategory',p.category_id);
 productField('pStatus',p.status||'draft');
 productField('pSize',p.size);
 productField('pSeason',p.season);
 productField('pColor',p.color);
 productField('pMaterial',p.material);
 productField('pCondition',p.condition);
 productField('pShort',p.short_description);
 productField('pDescription',p.description);
 productField('pMeasureShoulders',p.measurement_shoulders||p.shoulders||p.measure_shoulders);
 productField('pMeasureChest',p.measurement_chest||p.chest||p.measure_chest);
 productField('pMeasureWaist',p.measurement_waist);
 productField('pMeasureHips',p.measurement_hips);
 productField('pMeasureLength',p.measurement_length||p.length||p.measure_length);
 productField('pMeasureSleeve',p.measurement_sleeve||p.sleeve||p.measure_sleeve);
 productField('pMeasureInseam',p.measurement_inseam);
 productField('pMeasureInsole',p.measurement_insole);
 productField('pMeasureHead',p.measurement_head);
 productField('pMeasureWidth',p.measurement_width);
 productField('pMeasureHeight',p.measurement_height);
 productField('pMeasureDepth',p.measurement_depth);
 productField('pDetailsText',p.details_text);

 productCheck('pNew',p.is_new);
 productCheck('pTop',p.is_top);
 productCheck('pHome',p.show_on_home);

 PRODUCT_GALLERY=(p.product_images||[])
   .sort((a,b)=>(a.sort_order||0)-(b.sort_order||0))
   .map(x=>({
     id:x.id,
     image_url:x.image_url,
     sort_order:Number(x.sort_order||0),
     existing:true
   }));

 if(!PRODUCT_GALLERY.length&&p.cover_image){
   PRODUCT_GALLERY=[{id:null,image_url:p.cover_image,sort_order:0,existing:false,coverOnly:true}]
 }

 $('pImages').value='';
 $('deleteProductBtn').classList.remove('hidden');
 renderProductAdminGallery();
 updateMeasurementFieldsV148();
 goPage('productForm');
 await loadRelatedProductsV197(id)
}
window.editProduct=editProduct;

$('pName')?.addEventListener('input',e=>{
 if(!editingProductId&&!$('pSlug').value)$('pSlug').value=slugify(e.target.value)
});

$('pImages')?.addEventListener('change',e=>{
 const files=[...e.target.files];
 files.forEach(file=>{
   PRODUCT_GALLERY.push({
     id:null,
     file,
     local_url:URL.createObjectURL(file),
     sort_order:PRODUCT_GALLERY.length,
     existing:false
   })
 });
 e.target.value='';
 renderProductAdminGallery()
});

function applyProductFilters(){
 const q=($('productSearch')?.value||'').trim().toLowerCase();
 const status=$('productStatus')?.value||'';
 const category=$('productCategoryFilter')?.value||'';
 const season=$('productSeasonFilter')?.value||'';
 const list=products.filter(p=>{
   const hay=[p.name,p.brand,p.slug,p.categories?.name,p.size,p.season,p.color,p.material].filter(Boolean).join(' ').toLowerCase();
   return (!q||hay.includes(q))
     &&(!status||p.status===status)
     &&(!category||String(p.category_id||p.categories?.id||'')===String(category))
     &&(!season||p.season===season)
 });
 renderProducts(list)
}
$('productSearch')?.addEventListener('input',applyProductFilters);
$('productCategoryFilter')?.addEventListener('change',applyProductFilters);
$('productSeasonFilter')?.addEventListener('change',applyProductFilters);
$('productStatus')?.addEventListener('change',applyProductFilters);

async function saveProductImages(productId){
 const finalImages=[];

 for(let i=0;i<PRODUCT_GALLERY.length;i++){
   const item=PRODUCT_GALLERY[i];

   if(item.file){
     const prepared=await prepareImage(item.file,1200,1200,'#35291d',.93);
     const url=await uploadFile(prepared,`products/${productId}-${Date.now()}-${i}-${crypto.randomUUID()}.jpg`);
     finalImages.push({image_url:url,sort_order:i})
   }else if(item.image_url){
     finalImages.push({image_url:item.image_url,sort_order:i})
   }
 }

 const {error:deleteError}=await sb.from('product_images').delete().eq('product_id',productId);
 if(deleteError)throw deleteError;

 if(finalImages.length){
   const rows=finalImages.map((x,i)=>({
     product_id:productId,
     image_url:x.image_url,
     sort_order:i
   }));
   const {error:imagesError}=await sb.from('product_images').insert(rows);
   if(imagesError)throw imagesError
 }

 return finalImages.map(x=>x.image_url)
}

$('saveProductBtn').onclick=async()=>{
 const btn=$('saveProductBtn');
 btn.disabled=true;
 btn.textContent='ЗБЕРЕЖЕННЯ...';

 try{
   const name=$('pName').value.trim();
   const slug=$('pSlug').value.trim()||slugify(name);
   const price=Number($('pPrice').value||0);

   if(!name)throw new Error('Вкажи назву товару');
   if(!slug)throw new Error('Вкажи slug');
   if(!Number.isFinite(price)||price<0)throw new Error('Перевір ціну');

   const payload={
     name,
     brand:$('pBrand').value.trim()||null,
     slug,
     price,
     old_price:$('pOldPrice').value===''?null:Number($('pOldPrice').value),
     category_id:$('pCategory').value||null,
     status:$('pStatus').value||'draft',
     size:$('pSize').value.trim()||null,
     season:$('pSeason').value||null,
     color:$('pColor').value.trim()||null,
     material:$('pMaterial').value.trim()||null,
     condition:$('pCondition').value.trim()||null,
     short_description:$('pShort').value.trim()||null,
     description:$('pDescription').value.trim()||null,
     measurement_shoulders:$('pMeasureShoulders').value.trim()||null,
     measurement_chest:$('pMeasureChest').value.trim()||null,
     measurement_waist:$('pMeasureWaist').value.trim()||null,
     measurement_hips:$('pMeasureHips').value.trim()||null,
     measurement_length:$('pMeasureLength').value.trim()||null,
     measurement_sleeve:$('pMeasureSleeve').value.trim()||null,
     measurement_inseam:$('pMeasureInseam').value.trim()||null,
     measurement_insole:$('pMeasureInsole').value.trim()||null,
     measurement_head:$('pMeasureHead').value.trim()||null,
     measurement_width:$('pMeasureWidth').value.trim()||null,
     measurement_height:$('pMeasureHeight').value.trim()||null,
     measurement_depth:$('pMeasureDepth').value.trim()||null,
     details_text:$('pDetailsText').value.trim()||null,
     is_new:$('pNew').checked,
     is_top:$('pTop').checked,
     show_on_home:$('pHome').checked
   };

   let productId=editingProductId;

   if(editingProductId){
     const {data,error}=await sb.from('products').update(payload).eq('id',editingProductId).select('id').maybeSingle();
     if(error)throw error;
     if(!data)throw new Error('Не вдалося оновити товар. Перевір права Supabase.');
   }else{
     const {data,error}=await sb.from('products').insert(payload).select('id').single();
     if(error)throw error;
     productId=data.id
   }

   const imageUrls=await saveProductImages(productId);
   const cover=imageUrls[0]||null;

   const {error:coverError}=await sb.from('products').update({cover_image:cover}).eq('id',productId);
   if(coverError)throw coverError;

   await saveRelatedProductsV197(productId);

   toast(editingProductId?'Товар оновлено':'Товар додано');
   resetProductForm();
   await loadProducts();
   goPage('products')
 }catch(e){
   console.error(e);
   toast(e.message||'Помилка збереження товару')
 }finally{
   btn.disabled=false;
   btn.textContent='ЗБЕРЕГТИ'
 }
};

$('deleteProductBtn').onclick=async()=>{
 if(!editingProductId)return;
 if(!confirm('Видалити цей товар?'))return;

 const id=editingProductId;
 const {error:imgError}=await sb.from('product_images').delete().eq('product_id',id);
 if(imgError)console.error(imgError);

 const {error}=await sb.from('products').delete().eq('id',id);
 if(error)return toast(error.message);

 toast('Товар видалено');
 resetProductForm();
 await loadProducts();
 goPage('products')
};



async function loadOrders(){
 const {data,error}=await sb.from('orders')
   .select('*,products(id,name,slug,cover_image)')
   .order('created_at',{ascending:false});
 if(error){console.error(error);toast(error.message);return}
 orders=data||[];
 const start=new Date();start.setHours(0,0,0,0);
 const today=orders.filter(o=>new Date(o.created_at)>=start);
 $('statOrders').textContent=today.length;
 $('statNewOrders').textContent=orders.filter(o=>o.status==='new').length;
 $('ordersBadge').textContent=orders.filter(o=>o.status==='new').length;
 $('statRevenue').textContent=money(today.filter(o=>o.status==='received').reduce((s,o)=>s+Number(o.amount||0),0));
 if($('orderKpiNew'))$('orderKpiNew').textContent=orders.filter(o=>o.status==='new').length;
 if($('orderKpiConfirmed'))$('orderKpiConfirmed').textContent=orders.filter(o=>o.status==='confirmed').length;
 if($('orderKpiShipped'))$('orderKpiShipped').textContent=orders.filter(o=>o.status==='shipped').length;
 if($('orderKpiRevenue'))$('orderKpiRevenue').textContent=money(orders.filter(o=>o.status==='received').reduce((s,o)=>s+Number(o.amount||0),0));
 renderRecentOrders();
 applyOrderFilters()
}
function statusClass(status){return 'status-'+status}
function renderRecentOrders(){
 const list=orders.slice(0,5);
 $('recentOrders').innerHTML=list.length?list.map(o=>`
 <div class="dashboard-order-row" onclick="openOrderModal('${o.id}')" style="cursor:pointer">
   ${o.products?.cover_image?`<img src="${o.products.cover_image}" alt="">`:`<div class="no-img"></div>`}
   <div><b>#${o.order_number||''} · ${o.customer_name||'Клієнт'}</b><small>${o.product_name||o.products?.name||'Товар'} · ${statusName(o.status)}</small></div>
   <div class="right">${money(o.amount)}<small>${fmtDate(o.created_at)}</small></div>
 </div>`).join(''):'<div class="empty">Замовлень ще немає</div>'
}
function renderOrders(list){
 $('ordersCount').textContent=`${list.length} замовлень`;
 $('ordersTable').innerHTML=list.length?`<div class="order-list-v135">${list.map(o=>`
   <article class="order-card-v135" onclick="openOrderModal('${o.id}')">
     <div class="order-product-v135">
       ${o.products?.cover_image?`<img src="${o.products.cover_image}" alt="">`:`<span class="order-no-photo-v135">◇</span>`}
       <div>
         <small>#${o.order_number||String(o.id).slice(0,6)} · ${fmtDate(o.created_at)}</small>
         <b>${o.product_name||o.products?.name||'Товар'}</b>
         <em>${money(o.amount)}</em>
       </div>
     </div>
     <div class="order-client-v135">
       <small>КЛІЄНТ</small>
       <b>${o.customer_name||'—'}</b>
       <span>${o.phone||o.email||'Контакт не вказано'}</span>
     </div>
     <div class="order-delivery-v135">
       <small>ДОСТАВКА</small>
       <b>${o.city||'—'}</b>
       <span>${o.delivery_address||'Відділення не вказано'}</span>
     </div>
     <div class="order-status-wrap-v135" onclick="event.stopPropagation()">
       <select class="order-status-select ${statusClass(o.status)}" onchange="changeOrderStatus('${o.id}',this.value)">
         ${['new','confirmed','shipped','received','cancelled'].map(s=>`<option value="${s}" ${o.status===s?'selected':''}>${statusName(s)}</option>`).join('')}
       </select>
       <button class="btn order-open-v135" type="button" onclick="openOrderModal('${o.id}')">ДЕТАЛІ</button>
       <button class="btn order-delete-v143" type="button" onclick="deleteOrderV143('${o.id}')">ВИДАЛИТИ</button>
     </div>
   </article>`).join('')}</div>`:'<div class="empty">Замовлень не знайдено</div>'
}

function applyOrderFilters(){
 const q=($('orderSearch')?.value||'').toLowerCase().trim();
 const status=$('orderStatusFilter')?.value||'';
 const date=$('orderDateFilter')?.value||'';
 const sort=$('orderSortFilter')?.value||'newest';
 const now=Date.now();

 let list=orders.filter(o=>{
   const hay=[o.customer_name,o.product_name,o.products?.name,o.phone,o.email,o.city,o.delivery_address,o.ttn,o.admin_note,String(o.order_number||'')].filter(Boolean).join(' ').toLowerCase();
   if(q&&!hay.includes(q))return false;
   if(status&&o.status!==status)return false;
   if(date){
     const created=new Date(o.created_at);
     if(date==='today'){
       const start=new Date(); start.setHours(0,0,0,0);
       if(created<start)return false;
     }
     if(date==='7' && (now-created.getTime())>7*86400000)return false;
     if(date==='30' && (now-created.getTime())>30*86400000)return false
   }
   return true
 });

 list=[...list].sort((a,b)=>{
   if(sort==='oldest')return new Date(a.created_at)-new Date(b.created_at);
   if(sort==='amount_desc')return Number(b.amount||0)-Number(a.amount||0);
   if(sort==='amount_asc')return Number(a.amount||0)-Number(b.amount||0);
   return new Date(b.created_at)-new Date(a.created_at)
 });
 renderOrders(list)
}

function updateOrderKpisV135(){
 if($('orderKpiNew'))$('orderKpiNew').textContent=orders.filter(o=>o.status==='new').length;
 if($('orderKpiConfirmed'))$('orderKpiConfirmed').textContent=orders.filter(o=>o.status==='confirmed').length;
 if($('orderKpiShipped'))$('orderKpiShipped').textContent=orders.filter(o=>o.status==='shipped').length;
 if($('orderKpiRevenue'))$('orderKpiRevenue').textContent=money(orders.filter(o=>o.status==='received').reduce((s,o)=>s+Number(o.amount||0),0))
}

async function changeOrderStatus(id,status){
 const o=orders.find(x=>x.id===id);
 const previous=o?.status||null;
 if(previous===status)return;

 const modalOpen=!$('orderModal').classList.contains('hidden') && $('orderModal').dataset.id===id;
 const typedTtn=modalOpen?($('odTtn')?.value?.trim()||''):'';
 const typedAdminNote=modalOpen?($('odAdminNote')?.value?.trim()||''):'';

 // Для статусу «Відправлено» ТТН обов'язкова.
 // Якщо картка відкрита — беремо актуальне значення з поля.
 // Якщо статус міняють зі списку — допускаємо вже збережену ТТН із замовлення.
 const effectiveTtn=typedTtn || o?.ttn || '';
 if(status==='shipped' && !effectiveTtn){
   toast('Вкажіть ТТН перед відправленням замовлення');
   if(modalOpen)$('odTtn')?.focus();
   // Повертаємо select у попередній статус, якщо зміна була зі списку.
   document.querySelectorAll(`select.order-status-select`).forEach(sel=>{
     if(sel.getAttribute('onchange')?.includes(`'${id}'`))sel.value=previous||'new';
   });
   return;
 }

 const patch={status};
 if(modalOpen){
   patch.ttn=typedTtn||null;
   patch.admin_note=typedAdminNote||null;
 }else if(status==='shipped' && effectiveTtn){
   // Гарантуємо, що при «Відправлено» у записі точно є ТТН.
   patch.ttn=effectiveTtn;
 }

 // Чекаємо не просто update, а повернення вже ЗБЕРЕЖЕНОГО рядка з БД.
 // Лист запускається тільки після цього.
 const {data:savedOrder,error}=await sb.from('orders')
   .update(patch)
   .eq('id',id)
   .select('id,status,ttn,admin_note,email')
   .single();

 if(error)return toast(error.message);

 if(o){
   o.status=savedOrder?.status||status;
   o.ttn=savedOrder?.ttn??o.ttn??null;
   o.admin_note=savedOrder?.admin_note??o.admin_note??null;
 }

 // Додаткова страховка: не надсилаємо лист «Відправлено» без ТТН.
 if(status==='shipped' && !savedOrder?.ttn){
   toast('ТТН не збереглася. Лист не надіслано');
   return;
 }

 toast('Статус оновлено');

 if(savedOrder?.email || o?.email){
   const emailResult=await sendOrderEmailV211(id,'status_changed');
   if(emailResult?.ok){
     toast(status==='shipped'
       ? 'Відправлено · ТТН збережено · лист надіслано'
       : 'Статус оновлено · лист надіслано');
   }
 }

 // Product inventory is synchronized in Supabase trigger.
 await loadProducts();
 renderRecentOrders();
 applyOrderFilters();
 updateOrderKpisV135();
 $('statNewOrders').textContent=orders.filter(o=>o.status==='new').length;
 $('ordersBadge').textContent=orders.filter(o=>o.status==='new').length;

 if(!$('orderModal').classList.contains('hidden') && $('orderModal').dataset.id===id){
   fillOrderModal(o);
   loadOrderHistoryV135(id)
 }
}
window.changeOrderStatus=changeOrderStatus;

async function deleteOrderV143(id){
 const o=orders.find(x=>x.id===id);
 if(!o)return;
 const label=o.order_number?'#'+o.order_number:'#'+String(id).slice(0,6);
 if(!confirm(`Видалити замовлення ${label}?\n\nТовар автоматично повернеться у статус «В наявності». Цю дію неможливо скасувати.`))return;
 const {error}=await sb.from('orders').delete().eq('id',id);
 if(error)return toast('Не вдалося видалити замовлення: '+error.message);
 orders=orders.filter(x=>x.id!==id);
 closeOrderModal();
 await loadProducts();
 renderRecentOrders();
 applyOrderFilters();
 updateOrderKpisV135();
 $('statNewOrders').textContent=orders.filter(o=>o.status==='new').length;
 $('ordersBadge').textContent=orders.filter(o=>o.status==='new').length;
 toast('Замовлення видалено. Товар знову в наявності.');
}
window.deleteOrderV143=deleteOrderV143;

function fillOrderModal(o){
 if(!o)return;
 $('orderModal').dataset.id=o.id;
 $('orderModalTitle').textContent=`Замовлення #${o.order_number||''}`;
 $('orderModalProduct').innerHTML=o.products?.cover_image?`<img src="${o.products.cover_image}" alt="">`:`<div class="no-img">Немає фото</div>`;
 $('odCustomer').textContent=o.customer_name||'—';
 $('odContact').textContent=o.phone||'—';
 $('odProduct').textContent=o.product_name||o.products?.name||'—';
 $('odAmount').textContent=money(o.amount);
 $('odDate').textContent=fmtDateTime(o.created_at);
 $('odStatus').textContent=statusName(o.status);
 $('odCity').textContent=o.city||'—';
 $('odDelivery').textContent=o.delivery_address||'—';
 $('odComment').textContent=o.comment||'Без коментаря';
 $('odTtn').value=o.ttn||'';
 $('odAdminNote').value=o.admin_note||'';
 $('orderStatusActions').innerHTML=['new','confirmed','shipped','received','cancelled'].map(s=>`
   <button class="${o.status===s?'active':''}" onclick="changeOrderStatus('${o.id}','${s}')">${statusName(s)}</button>`).join('')
}
async function saveOrderMetaV145(){
 const id=$('orderModal')?.dataset.id;
 const o=orders.find(x=>x.id===id);
 if(!o)return;
 const payload={ttn:($('odTtn')?.value||'').trim(),admin_note:($('odAdminNote')?.value||'').trim()};
 const {error}=await sb.from('orders').update(payload).eq('id',id);
 if(error)return toast('Не вдалося зберегти: '+error.message);
 Object.assign(o,payload);
 toast('Дані замовлення збережено');
 applyOrderFilters();
}
window.saveOrderMetaV145=saveOrderMetaV145;

async function openOrderModal(id){
 const o=orders.find(x=>x.id===id);if(!o)return;
 fillOrderModal(o);
 $('orderModal').classList.remove('hidden');
 await loadOrderHistoryV135(id)
}
async function loadOrderHistoryV135(orderId){
 const host=$('orderStatusHistoryV135');
 if(!host)return;
 host.innerHTML='<div class="order-history-empty-v135">Завантаження...</div>';
 const {data,error}=await sb.from('order_status_history').select('*').eq('order_id',orderId).order('created_at',{ascending:false});
 if(error){
   console.warn(error);
   host.innerHTML='<div class="order-history-empty-v135">Історія стане доступною після запуску SQL V135.</div>';
   return
 }
 host.innerHTML=(data||[]).length?(data||[]).map(x=>`
   <div class="order-history-row-v135">
     <span>${fmtDateTime(x.created_at)}</span>
     <b>${x.from_status?statusName(x.from_status)+' → ':''}${statusName(x.to_status)}</b>
   </div>`).join(''):'<div class="order-history-empty-v135">Змін статусу ще не було.</div>'
}

function closeOrderModal(){$('orderModal').classList.add('hidden');delete $('orderModal').dataset.id}
window.openOrderModal=openOrderModal;window.closeOrderModal=closeOrderModal;


const JOURNAL_CATEGORY_STORAGE='vh_journal_categories_v2';
const JOURNAL_CATEGORY_HIDDEN_STORAGE='vh_journal_categories_hidden_v2';
const JOURNAL_DEFAULT_CATEGORIES=['НОВІ НАДХОДЖЕННЯ','ІСТОРІЇ РЕЧЕЙ','СТИЛЬ','ГІД'];
const JOURNAL_DELETED_DEFAULTS_KEY='vh_journal_deleted_default_categories_v1';

function deletedJournalDefaultCategories(){
 try{
  const raw=JSON.parse(localStorage.getItem(JOURNAL_DELETED_DEFAULTS_KEY)||'[]');
  return Array.isArray(raw)?raw.map(v=>String(v||'').trim()).filter(Boolean):[];
 }catch(_){ return []; }
}
function persistDeletedJournalDefaultCategories(values){
 localStorage.setItem(JOURNAL_DELETED_DEFAULTS_KEY,JSON.stringify([...new Set(values)]));
}


function escapeJournalCategoryHtml(value){
 return String(value??'')
   .replace(/&/g,'&amp;')
   .replace(/</g,'&lt;')
   .replace(/>/g,'&gt;')
   .replace(/"/g,'&quot;')
   .replace(/'/g,'&#039;');
}

function normalizeJournalCategory(v){
 return String(v||'').trim().replace(/\s+/g,' ').toUpperCase();
}
function readLocalArray(key){
 try{
   const value=JSON.parse(localStorage.getItem(key)||'[]');
   return Array.isArray(value)?value:[];
 }catch(_){ return []; }
}
function storedJournalCategories(){
 return readLocalArray(JOURNAL_CATEGORY_STORAGE).map(normalizeJournalCategory).filter(Boolean);
}
function hiddenJournalCategories(){
 return readLocalArray(JOURNAL_CATEGORY_HIDDEN_STORAGE).map(normalizeJournalCategory).filter(Boolean);
}
function persistJournalCategories(values){
 localStorage.setItem(JOURNAL_CATEGORY_STORAGE,JSON.stringify([...new Set(values.map(normalizeJournalCategory).filter(Boolean))]));
}
function allJournalCategories(){
 const deleted=new Set(deletedJournalDefaultCategories());
 const defaults=JOURNAL_DEFAULT_CATEGORIES.filter(v=>!deleted.has(v));
 return [...new Set([...defaults,...storedJournalCategories()])].filter(Boolean);
}
function refreshJournalCategorySuggestions(selected){
 const select=$('nCategory'), manager=$('journalCategoryManager');
 if(!select)return;
 const current=normalizeJournalCategory(selected||select.value);
 const values=allJournalCategories();
 select.innerHTML='<option value="">ВИБЕРІТЬ КАТЕГОРІЮ</option>'+values.map(v=>`<option value="${escapeJournalCategoryHtml(v)}">${escapeJournalCategoryHtml(v)}</option>`).join('');
 if(current && values.includes(current)) select.value=current;
 if(manager){
   manager.innerHTML=values.map(v=>`
     <span class="journal-category-chip">
       <span>${escapeJournalCategoryHtml(v)}</span>
       <button type="button" class="journal-category-delete" data-journal-category-delete="${escapeJournalCategoryHtml(v)}" title="Видалити категорію" aria-label="Видалити ${escapeJournalCategoryHtml(v)}">×</button>
     </span>`).join('');
 }
}
function openJournalCategoryModal(){
 const modal=$('journalCategoryModal'), input=$('newJournalCategoryName');
 if(!modal)return;
 modal.hidden=false;
 requestAnimationFrame(()=>modal.classList.add('is-open'));
 setTimeout(()=>input&&input.focus(),50);
}
function closeJournalCategoryModal(){
 const modal=$('journalCategoryModal');
 if(!modal)return;
 modal.classList.remove('is-open');
 setTimeout(()=>{modal.hidden=true; const i=$('newJournalCategoryName'); if(i)i.value='';},150);
}
function addJournalCategory(){
 const input=$('newJournalCategoryName');
 const name=normalizeJournalCategory(input&&input.value);
 if(!name){ if(input)input.focus(); return; }
 const hidden=hiddenJournalCategories().filter(v=>v!==name);
 localStorage.setItem(JOURNAL_CATEGORY_HIDDEN_STORAGE,JSON.stringify(hidden));
 if(JOURNAL_DEFAULT_CATEGORIES.includes(name)){
  persistDeletedJournalDefaultCategories(deletedJournalDefaultCategories().filter(v=>v!==name));
 }
 if(!allJournalCategories().includes(name)) persistJournalCategories([...storedJournalCategories(),name]);
 refreshJournalCategorySuggestions(name);
 closeJournalCategoryModal();
 try{toast('Категорію додано')}catch(_){}
}
function deleteJournalCategory(name){
 name=normalizeJournalCategory(name);
 const used=(Array.isArray(news)?news:[]).some(n=>normalizeJournalCategory(n&&n.category)===name);
 if(used){
   alert('Ця категорія використовується у статті. Спочатку змініть категорію цієї статті, а потім видаліть її.');
   return;
 }
 persistJournalCategories(storedJournalCategories().filter(v=>v!==name));
 if(JOURNAL_DEFAULT_CATEGORIES.includes(name)){
  persistDeletedJournalDefaultCategories([...deletedJournalDefaultCategories(),name]);
 }
 const hidden=[...new Set([...hiddenJournalCategories(),name])];
 localStorage.setItem(JOURNAL_CATEGORY_HIDDEN_STORAGE,JSON.stringify(hidden));
 refreshJournalCategorySuggestions();
}


async function loadNews(){
 const {data,error}=await sb.from('news').select('*')
   .order('display_order',{ascending:true})
   .order('created_at',{ascending:false});
 if(error){console.error(error);toast(error.message);return}
 news=data||[];
 try{ refreshJournalCategorySuggestions(); }catch(err){ console.warn('Category UI:',err); }

 $('newsTable').innerHTML=news.length?`<div class="table-wrap journal37-table-wrap"><table class="table journal37-table">
 <thead><tr><th>ОБКЛАДИНКА</th><th>СТАТТЯ</th><th>КАТЕГОРІЯ</th><th>ПОРЯДОК</th><th>РОЗМІЩЕННЯ</th><th>СТАТУС</th><th></th></tr></thead>
 <tbody>${news.map(n=>`<tr>
   <td>${n.cover_image?`<img class="thumb news-thumb" src="${n.cover_image}">`:`<div class="thumb"></div>`}</td>
   <td><div class="pname">${n.title}</div><div class="pid">${n.slug}</div></td>
   <td>${n.category||'—'}</td>
   <td><b>${Number(n.display_order||0)}</b></td>
   <td><div class="journal37-tags">
     ${n.is_featured?'<span class="tag-featured">ГОЛОВНА</span>':''}
     ${n.is_new_section?'<span>НОВЕ</span>':''}
     ${n.is_guide?'<span>GUIDE</span>':''}
     ${n.show_in_journal===false?'<span class="tag-off">НЕ В JOURNAL</span>':'<span>JOURNAL</span>'}
     ${n.show_on_home!==false?'<span>НА ГОЛОВНІЙ</span>':''}
   </div></td>
   <td>${statusName(n.status)}</td>
   <td><button class="btn small-action" onclick="editNews('${n.id}')">РЕДАГУВАТИ</button></td>
 </tr>`).join('')}</tbody></table></div>`:'<div class="empty">Статей ще немає</div>'
}


function renderNewsCoverPreview(){
 const box=$('newsImagePreview');
 if(!box)return;
 const file=$('nImage')?.files?.[0];
 if(file){
   const url=URL.createObjectURL(file);
   box.innerHTML=`<div class="news-photo-admin-card">
     <img src="${url}" alt="">
     <button type="button" class="news-photo-remove v208-single-photo-remove" onclick="removeNewsCoverImage()" title="Видалити фото">×</button>
   </div>`;
   return
 }
 box.innerHTML=NEWS_COVER_CURRENT?`<div class="news-photo-admin-card">
   <img src="${NEWS_COVER_CURRENT}" alt="">
   <button type="button" class="news-photo-remove v208-single-photo-remove" onclick="removeNewsCoverImage()" title="Видалити фото">×</button>
 </div>`:''
}

function renderNewsGalleryPreview(){
 const box=$('newsGalleryPreview');
 if(!box)return;
 const existing=NEWS_GALLERY_CURRENT.map((u,i)=>{
   const src=(u&&typeof u==='object'&&u.__previewUrl)?u.__previewUrl:u;
   return `
   <div class="news-photo-admin-card">
     <img src="${src}" alt="">
     <button type="button" class="news-photo-remove v208-single-photo-remove" onclick="removeNewsGalleryImage(${i})" title="Видалити фото">×</button>
   </div>`
 }).join('');
 const pending=[...($('nGallery')?.files||[])].map((f,i)=>{
   const url=URL.createObjectURL(f);
   return `<div class="news-photo-admin-card">
     <img src="${url}" alt="">
     <button type="button" class="news-photo-remove v208-single-photo-remove" onclick="removePendingNewsGalleryImage(${i})" title="Видалити фото">×</button>
   </div>`
 }).join('');
 box.innerHTML=existing+pending
}

window.removeNewsCoverImage=function(){
 NEWS_COVER_CURRENT=null;
 if($('nImage'))$('nImage').value='';
 renderNewsCoverPreview()
};


window.replaceNewsGalleryImage=function(index){
 const picker=document.createElement('input');
 picker.type='file';
 picker.accept='image/*';
 picker.style.display='none';
 document.body.appendChild(picker);
 picker.onchange=()=>{
   const file=picker.files?.[0];
   if(!file){picker.remove();return}
   // Store File directly in the gallery state; saveNews handles it below.
   NEWS_GALLERY_CURRENT[index]={__replacementFile:file,__previewUrl:URL.createObjectURL(file)};
   renderNewsGalleryPreview();
   picker.remove()
 };
 picker.click()
};

window.removeNewsGalleryImage=function(index){
 NEWS_GALLERY_CURRENT.splice(index,1);
 renderNewsGalleryPreview()
};

window.removePendingNewsGalleryImage=function(index){
 const input=$('nGallery');
 if(!input)return;
 const dt=new DataTransfer();
 [...input.files].forEach((file,i)=>{if(i!==index)dt.items.add(file)});
 input.files=dt.files;
 renderNewsGalleryPreview()
};


/* V185 — structured Journal blocks, stored inside the existing news.content field */
const VH_JOURNAL_BLOCKS_PREFIX='VH_BLOCKS_V1:';
let JOURNAL_BLOCKS=[];
function journalLegacyToBlocks(raw){
 const text=String(raw||'').trim(); if(!text)return [];
 if(text.startsWith(VH_JOURNAL_BLOCKS_PREFIX)){
   try{const v=JSON.parse(text.slice(VH_JOURNAL_BLOCKS_PREFIX.length));return Array.isArray(v)?v:[]}catch(e){return []}
 }
 return text.split(/\n\s*\n/).map(x=>x.trim()).filter(Boolean).map(x=>{
   if(x.startsWith('## ')){const lines=x.split('\n');return {type:'heading',text:lines.shift().slice(3).trim(),after:lines.join('\n').trim()}}
   return {type:'paragraph',text:x}
 });
}
function journalBlockId(){return 'jb_'+Date.now().toString(36)+Math.random().toString(36).slice(2,7)}
function normalizeJournalBlocks(blocks){return (blocks||[]).map(b=>({...b,id:b.id||journalBlockId()}))}
function renderJournalBlocks(){
 const root=$('journalBlockEditor');if(!root)return;
 if(!JOURNAL_BLOCKS.length){root.innerHTML='<div class="journal-block-empty">Додай перший абзац, підзаголовок або фото.</div>';return}
 root.innerHTML=JOURNAL_BLOCKS.map((b,i)=>`<div class="journal-block" draggable="true" data-journal-index="${i}" data-type="${b.type}">
   <div class="journal-block-handle" title="Перетягнути">⋮⋮</div>
   <div class="journal-block-main">
    <label>${b.type==='heading'?'Підзаголовок':b.type==='image'?'Фото':'Абзац'}</label>
    ${b.type==='image'?`${b.url||b.preview?`<img class="journal-block-image-preview" src="${b.preview||b.url}" alt="">`:''}<input type="file" accept="image/*" data-journal-image="${i}"><input type="text" data-journal-caption="${i}" value="${String(b.caption||'').replace(/"/g,'&quot;')}" placeholder="Підпис до фото — необов’язково">`:`<textarea data-journal-text="${i}" placeholder="${b.type==='heading'?'Напиши підзаголовок':'Напиши абзац'}">${String(b.text||'').replace(/</g,'&lt;')}</textarea>${b.type==='heading'&&b.after?`<textarea data-journal-after="${i}" placeholder="Текст після підзаголовка">${String(b.after).replace(/</g,'&lt;')}</textarea>`:''}`}
   </div>
   <div class="journal-block-actions"><button type="button" data-journal-up="${i}" title="Вище">↑</button><button type="button" data-journal-down="${i}" title="Нижче">↓</button><button type="button" data-journal-remove="${i}" title="Видалити">×</button></div>
 </div>`).join('');
 bindJournalBlockEvents();
}
function syncJournalBlockInputs(){
 document.querySelectorAll('[data-journal-text]').forEach(el=>{const b=JOURNAL_BLOCKS[+el.dataset.journalText];if(b)b.text=el.value});
 document.querySelectorAll('[data-journal-after]').forEach(el=>{const b=JOURNAL_BLOCKS[+el.dataset.journalAfter];if(b)b.after=el.value});
 document.querySelectorAll('[data-journal-caption]').forEach(el=>{const b=JOURNAL_BLOCKS[+el.dataset.journalCaption];if(b)b.caption=el.value});
}
function bindJournalBlockEvents(){
 document.querySelectorAll('[data-journal-text],[data-journal-after],[data-journal-caption]').forEach(el=>el.addEventListener('input',syncJournalBlockInputs));
 document.querySelectorAll('[data-journal-image]').forEach(el=>el.onchange=()=>{const f=el.files?.[0];if(!f)return;const b=JOURNAL_BLOCKS[+el.dataset.journalImage];b.file=f;b.preview=URL.createObjectURL(f);renderJournalBlocks()});
 document.querySelectorAll('[data-journal-remove]').forEach(el=>el.onclick=()=>{syncJournalBlockInputs();JOURNAL_BLOCKS.splice(+el.dataset.journalRemove,1);renderJournalBlocks()});
 document.querySelectorAll('[data-journal-up]').forEach(el=>el.onclick=()=>{syncJournalBlockInputs();const i=+el.dataset.journalUp;if(i>0){[JOURNAL_BLOCKS[i-1],JOURNAL_BLOCKS[i]]=[JOURNAL_BLOCKS[i],JOURNAL_BLOCKS[i-1]];renderJournalBlocks()}});
 document.querySelectorAll('[data-journal-down]').forEach(el=>el.onclick=()=>{syncJournalBlockInputs();const i=+el.dataset.journalDown;if(i<JOURNAL_BLOCKS.length-1){[JOURNAL_BLOCKS[i+1],JOURNAL_BLOCKS[i]]=[JOURNAL_BLOCKS[i],JOURNAL_BLOCKS[i+1]];renderJournalBlocks()}});
 let from=null;document.querySelectorAll('.journal-block').forEach(el=>{el.ondragstart=()=>{syncJournalBlockInputs();from=+el.dataset.journalIndex;el.classList.add('is-dragging')};el.ondragend=()=>el.classList.remove('is-dragging');el.ondragover=e=>e.preventDefault();el.ondrop=e=>{e.preventDefault();const to=+el.dataset.journalIndex;if(from===null||from===to)return;const [m]=JOURNAL_BLOCKS.splice(from,1);JOURNAL_BLOCKS.splice(to,0,m);from=null;renderJournalBlocks()}});
}
document.querySelectorAll('[data-add-journal-block]').forEach(btn=>btn.onclick=()=>{syncJournalBlockInputs();JOURNAL_BLOCKS.push({id:journalBlockId(),type:btn.dataset.addJournalBlock,text:''});renderJournalBlocks()});
async function serializeJournalBlocks(){
 syncJournalBlockInputs();const clean=[];
 for(const b of JOURNAL_BLOCKS){
   if(b.type==='image'){
     let url=b.url||'';
     if(b.file){const f=await prepareImage(b.file,1600,1200,'#eadbc7',.92);url=await uploadFile(f,`news/article-${Date.now()}-${crypto.randomUUID()}.jpg`)}
     if(url)clean.push({type:'image',url,caption:String(b.caption||'').trim()});
   }else if(String(b.text||'').trim()) clean.push({type:b.type,text:String(b.text).trim(),...(b.after?{after:String(b.after).trim()}:{})});
 }
 return VH_JOURNAL_BLOCKS_PREFIX+JSON.stringify(clean);
}

function resetNewsForm(){
 editingNewsId=null;

 $('newsFormTitle').textContent='Нова стаття';
 $('nTitle').value='';$('nSlug').value='';$('nExcerpt').value='';$('nContent').value=''; JOURNAL_BLOCKS=[]; renderJournalBlocks();
 $('nCategory').value='СТИЛЬ';refreshJournalCategorySuggestions('СТИЛЬ');
 $('nStatus').value='draft';
 $('nFeatured').checked=false;
 $('nNewSection').checked=false;
 $('nGuide').checked=false;
 $('nShowJournal').checked=true;
 $('nShowHome').checked=true;

 const maxOrder=news.length?Math.max(...news.map(x=>Number(x.display_order||0))):0;
 $('nDisplayOrder').value=maxOrder+10;
 $('nNewOrder').value='0';
 $('nGuideOrder').value='0';

 $('nImage').value='';$('nGallery').value='';
 NEWS_COVER_CURRENT=null;NEWS_GALLERY_CURRENT=[];
 renderNewsCoverPreview();renderNewsGalleryPreview();
 $('deleteNewsBtn').classList.add('hidden')
}

function openNewsForm(){resetNewsForm();goPage('newsForm')}
window.openNewsForm=openNewsForm;

$('nTitle').oninput=e=>{if(!editingNewsId)$('nSlug').value=slugify(e.target.value)};
$('nImage').onchange=()=>renderNewsCoverPreview();
$('nGallery').onchange=()=>renderNewsGalleryPreview();

function editNews(id){
 const n=news.find(x=>x.id===id);if(!n)return;
 editingNewsId=id;
 localStorage.setItem(VH_ADMIN_EDIT_NEWS_KEY,id);
 $('newsFormTitle').textContent='Редагувати статтю';
 $('nTitle').value=n.title||'';
 $('nSlug').value=n.slug||'';
 $('nExcerpt').value=n.excerpt||'';
 $('nContent').value=n.content||''; JOURNAL_BLOCKS=normalizeJournalBlocks(journalLegacyToBlocks(n.content)); renderJournalBlocks();
 refreshJournalCategorySuggestions(n.category||'СТИЛЬ');
 $('nStatus').value=n.status||'draft';

 $('nFeatured').checked=!!n.is_featured;
 $('nNewSection').checked=!!n.is_new_section;
 $('nGuide').checked=!!n.is_guide;
 $('nShowJournal').checked=n.show_in_journal!==false;
 $('nShowHome').checked=n.show_on_home!==false;

 $('nDisplayOrder').value=Number(n.display_order||0);
 $('nNewOrder').value=Number(n.new_order||0);
 $('nGuideOrder').value=Number(n.guide_order||0);

 $('nImage').value='';$('nGallery').value='';
 NEWS_COVER_CURRENT=n.cover_image||null;
 NEWS_GALLERY_CURRENT=Array.isArray(n.gallery_images)?[...n.gallery_images]:[];
 renderNewsCoverPreview();renderNewsGalleryPreview();
 $('deleteNewsBtn').classList.remove('hidden');
 goPage('newsForm')
}
window.editNews=editNews;

$('saveNewsBtn').onclick=async()=>{
 const btn=$('saveNewsBtn');btn.disabled=true;btn.textContent='ЗБЕРЕЖЕННЯ...';
 try{
   const old=editingNewsId?news.find(x=>x.id===editingNewsId):null;
   let cover=NEWS_COVER_CURRENT;
   let gallery=[...NEWS_GALLERY_CURRENT];

   const original=$('nImage').files[0];
   if(original){
     const f=await prepareImage(original,1200,750,'#eadbc7',.82);
     cover=await uploadFile(f,`news/${Date.now()}-${crypto.randomUUID()}.jpg`)
   }

   for(let i=0;i<gallery.length;i++){
     const item=gallery[i];
     if(item&&typeof item==='object'&&item.__replacementFile){
       const f=await prepareImage(item.__replacementFile,1200,1200,'#eadbc7',.92);
       gallery[i]=await uploadFile(f,`news/gallery-${Date.now()}-${crypto.randomUUID()}.jpg`)
     }
   }

   for(const originalGallery of [...$('nGallery').files]){
     const f=await prepareImage(originalGallery,1200,1200,'#eadbc7',.92);
     gallery.push(await uploadFile(f,`news/gallery-${Date.now()}-${crypto.randomUUID()}.jpg`))
   }

   const status=$('nStatus').value;
   const payload={
     title:$('nTitle').value.trim(),
     slug:$('nSlug').value.trim(),
     excerpt:$('nExcerpt').value.trim()||null,
     content:await serializeJournalBlocks(),
     status,
     category:$('nCategory').value.trim().toUpperCase()||'СТИЛЬ',
     is_featured:$('nFeatured').checked,
     is_new_section:$('nNewSection').checked,
     is_guide:$('nGuide').checked,
     show_in_journal:$('nShowJournal').checked,
     show_on_home:$('nShowHome').checked,
     display_order:Number($('nDisplayOrder').value||0),
     new_order:Number($('nNewOrder').value||0),
     guide_order:Number($('nGuideOrder').value||0),
     cover_image:cover,
     gallery_images:gallery
   };

   if(!payload.title||!payload.slug)throw new Error('Вкажи заголовок і slug');

   // If this article is selected as MAIN, make it the only main article.
   // If it is NOT selected as main, do not touch the current main article.
   if(payload.is_featured){
     const q=sb.from('news').update({is_featured:false});
     const {error:featureError}=editingNewsId
       ? await q.neq('id',editingNewsId)
       : await q;
     if(featureError)throw featureError;
   }

   if(status==='published'&&!old?.published_at)payload.published_at=new Date().toISOString();

   let savedRow=null;
   if(editingNewsId){
     const {data,error}=await sb.from('news').update(payload).eq('id',editingNewsId).select('*').maybeSingle();
     if(error)throw error;
     if(!data)throw new Error('Supabase не повернув оновлену статтю. Перевір RLS для таблиці news.');
     savedRow=data;
   }else{
     if(status==='published')payload.published_at=new Date().toISOString();
     const {data,error}=await sb.from('news').insert(payload).select('*').single();
     if(error)throw error;
     savedRow=data;
   }

   if(payload.is_guide && savedRow?.is_guide!==true){
     throw new Error('Позначка HEDONISTA GUIDE не збереглася в Supabase.');
   }
   if(payload.is_new_section && savedRow?.is_new_section!==true){
     throw new Error('Позначка «НОВЕ НА САЙТІ» не збереглася в Supabase.');
   }

   // Stay in the editor after save.
   // If this was a new article, continue editing the newly created row.
   if(savedRow?.id){
     editingNewsId=savedRow.id;
     try{localStorage.setItem(VH_ADMIN_EDIT_NEWS_KEY,String(savedRow.id))}catch(_){}
     if($('newsFormTitle'))$('newsFormTitle').textContent='Редагувати статтю';
   }
   toast(payload.is_featured?'Статтю збережено як головну':payload.is_guide?'Статтю додано в HEDONISTA GUIDE':'Статтю збережено');
   await loadNews();
   refreshJournalCategorySuggestions(savedRow?.category||payload.category);
   goPage('newsForm',{remember:true})
 }catch(e){
   console.error(e);toast(e.message||'Помилка збереження статті')
 }finally{
   btn.disabled=false;btn.textContent='ЗБЕРЕГТИ СТАТТЮ'
 }
};

$('deleteNewsBtn').onclick=async()=>{
 if(!editingNewsId)return;
 if(!confirm('Видалити статтю?'))return;
 const {error}=await sb.from('news').delete().eq('id',editingNewsId);
 if(error)return toast(error.message);
 toast('Статтю видалено');await loadNews();goPage('news')
};


$('saveDeliveryPageBtn')?.addEventListener('click',async()=>{
 const btn=$('saveDeliveryPageBtn');btn.disabled=true;btn.textContent='ЗБЕРЕЖЕННЯ...';
 try{
  const payload={
   delivery_page_kicker:$('adDeliveryKicker').value.trim()||null,
   delivery_page_title:$('adDeliveryTitle').value.replace(/\\n/g,'\n').trim()||null,
   delivery_page_intro:$('adDeliveryIntro').value.trim()||null,
   delivery_shipping_title:$('adDeliveryShippingTitle').value.trim()||null,
   delivery_shipping_text:$('adDeliveryShippingText').value.trim()||null,
   delivery_payment_title:$('adDeliveryPaymentTitle').value.trim()||null,
   delivery_payment_text:$('adDeliveryPaymentText').value.trim()||null,
   delivery_extra_title:$('adDeliveryExtraTitle').value.trim()||null,
   delivery_extra_text:$('adDeliveryExtraText').value.trim()||null,
   delivery_process_title:$('adDeliveryProcessTitle').value.trim()||null,
   delivery_step1_title:$('adDeliveryStep1Title').value.trim()||null,
   delivery_step1_text:$('adDeliveryStep1Text').value.trim()||null,
   delivery_step2_title:$('adDeliveryStep2Title').value.trim()||null,
   delivery_step2_text:$('adDeliveryStep2Text').value.trim()||null,
   delivery_step3_title:$('adDeliveryStep3Title').value.trim()||null,
   delivery_step3_text:$('adDeliveryStep3Text').value.trim()||null,
   delivery_cta_title:$('adDeliveryCtaTitle').value.trim()||null,
   delivery_cta_text:$('adDeliveryCtaText').value.trim()||null,
   delivery_cta_link_text:$('adDeliveryCtaLinkText').value.trim()||null,
   delivery_cta_link_url:$('adDeliveryCtaLinkUrl').value.trim()||'contacts.html'
  };
  const {error}=await sb.from('site_settings').update(payload).eq('id',1);if(error)throw error;
  toast('Сторінку «Доставка і оплата» збережено');await loadSettings()
 }catch(e){console.error(e);toast(e.message||'Помилка збереження')}
 finally{btn.disabled=false;btn.textContent='ЗБЕРЕГТИ СТОРІНКУ'}
});

$('saveContactsPageBtn')?.addEventListener('click',async()=>{
 const btn=$('saveContactsPageBtn');btn.disabled=true;btn.textContent='ЗБЕРЕЖЕННЯ...';
 try{
  const payload={
   contacts_page_kicker:$('adContactsKicker').value.trim()||null,
   contacts_page_title:$('adContactsTitle').value.trim()||null,
   contacts_page_intro:$('adContactsIntro').value.trim()||null,
   contacts_list_title:$('adContactsListTitle').value.trim()||null,
   contacts_instagram_text:$('adContactsInstagramText').value.trim()||null,
   contacts_instagram_url:$('adContactsInstagramUrl').value.trim()||null,
   contacts_telegram_text:$('adContactsTelegramText').value.trim()||null,
   contacts_telegram_url:$('adContactsTelegramUrl').value.trim()||null,
   contacts_email_text:$('adContactsEmailText').value.trim()||null,
   contacts_phone_text:$('adContactsPhoneText').value.trim()||null,
   contacts_help_title:$('adContactsHelpTitle').value.trim()||null,
   contacts_help_text:$('adContactsHelpText').value.trim()||null,
   contacts_topics_title:$('adContactsTopicsTitle').value.trim()||null,
   contacts_topic1_title:$('adContactsTopic1Title').value.trim()||null,
   contacts_topic1_text:$('adContactsTopic1Text').value.trim()||null,
   contacts_topic2_title:$('adContactsTopic2Title').value.trim()||null,
   contacts_topic2_text:$('adContactsTopic2Text').value.trim()||null,
   contacts_topic3_title:$('adContactsTopic3Title').value.trim()||null,
   contacts_topic3_text:$('adContactsTopic3Text').value.trim()||null
  };
  const {error}=await sb.from('site_settings').update(payload).eq('id',1);if(error)throw error;
  toast('Сторінку «Контакти» збережено');await loadSettings()
 }catch(e){console.error(e);toast(e.message||'Помилка збереження')}
 finally{btn.disabled=false;btn.textContent='ЗБЕРЕГТИ СТОРІНКУ'}
});

$('saveSettingsBtn').onclick=async()=>{const payload={instagram:$('sInstagram').value.trim()||null,telegram:$('sTelegram').value.trim()||null,phone:$('sPhone').value.trim()||null,email:$('sEmail').value.trim()||null,city:$('sCity').value.trim()||null,shipping_text:$('sShipping').value.trim()||null,payment_text:$('sPayment').value.trim()||null};const {error}=await sb.from('site_settings').update(payload).eq('id',1);if(error)return toast(error.message);toast('Налаштування збережено')};
let HOMEPAGE_SETTINGS={};
let HOMEPAGE_TOP_ITEMS=[];

function setFixedHeroPreview(previewId,url,removeButtonId){
 const preview=$(previewId),btn=$(removeButtonId);
 if(!preview||!btn)return;
 preview.innerHTML=url
   ? `<img src="${url}" alt="" draggable="false">`
   : '<div class="hero-photo-empty">Фото ще не додано</div>';
 btn.classList.toggle('hidden',!url)
}

async function loadHomepageSettings(){
 const {data,error}=await sb.from('site_settings').select('*').eq('id',1).maybeSingle();
 if(error){console.error(error);return}
 HOMEPAGE_SETTINGS=data||{};
 const h=HOMEPAGE_SETTINGS;
 const put=(id,val='')=>{if($(id))$(id).value=val??''};

 put('hpHeroKicker',h.hero_kicker);
 put('hpHeroTitle',h.hero_title);
 put('hpHeroDescription',h.hero_description);
 put('hpHeroPrimaryText',h.hero_primary_text);
 put('hpHeroPrimaryUrl',h.hero_primary_url);
 put('hpHeroSecondaryText',h.hero_secondary_text);
 put('hpHeroSecondaryUrl',h.hero_secondary_url);

 $('hpHeroBackgroundPreview').innerHTML=h.hero_background_image?`<img src="${h.hero_background_image}" alt="">`:'';
 $('removeHeroBackgroundBtn').classList.toggle('hidden',!h.hero_background_image);

 setFixedHeroPreview('hpHeroMainPreview',h.hero_main_image,'removeHeroMainBtn');
 setFixedHeroPreview('hpHeroTopPreview',h.hero_top_image,'removeHeroTopBtn');
 setFixedHeroPreview('hpHeroBottomPreview',h.hero_bottom_image,'removeHeroBottomBtn');

 put('hpNewTitle',h.homepage_new_title);
 put('hpNewLinkText',h.homepage_new_link_text);
 put('hpEditorialKicker',h.homepage_editorial_kicker);
 put('hpEditorialTitle',h.homepage_editorial_title);
 put('hpEditorialText',h.homepage_editorial_text);
 put('hpEditorialButtonText',h.homepage_editorial_button_text);
 put('hpEditorialButtonUrl',h.homepage_editorial_button_url);
 $('hpEditorialPreview').innerHTML=h.homepage_editorial_image?`<img src="${h.homepage_editorial_image}">`:'';

 put('hpTopTitle',h.homepage_top_title);
 put('hpTopLinkText',h.homepage_top_link_text);
 put('hpCategoriesTitle',h.homepage_categories_title);
 put('hpJournalTitle',h.homepage_journal_title);
 put('hpJournalLinkText',h.homepage_journal_link_text);
 put('hpInstagramTitle',h.homepage_instagram_title);
 put('hpInstagramLinkText',h.homepage_instagram_link_text);
 put('hpInstagramUrl',h.homepage_instagram_url);
 put('hpBrandTitle',h.homepage_brand_title);
 put('hpBrandLine1',h.homepage_brand_line1);
 put('hpBrandLine2',h.homepage_brand_line2);
 put('hpBrandLocation',h.homepage_brand_location)

 await loadHomepageTopItems();
}

async function loadHomepageTopItems(){
 const {data,error}=await sb.from('homepage_top_items').select('*').order('slot');
 if(error){console.error(error);return}
 HOMEPAGE_TOP_ITEMS=data||[];
 for(let i=1;i<=4;i++){
   const x=HOMEPAGE_TOP_ITEMS.find(v=>Number(v.slot)===i)||{};
   $('topCaption'+i).value=x.caption||'';
   $('topLink'+i).value=x.link_url||'';
   $('topPreview'+i).innerHTML=x.image_url?`<img src="${x.image_url}" alt="">`:'';
 }
}
window.saveTopSlot=async function(slot){
 try{
   const current=HOMEPAGE_TOP_ITEMS.find(v=>Number(v.slot)===slot)||{};
   let imageUrl=current.image_url||null;
   const input=$('topImage'+slot);
   const original=input.files[0];
   if(original){
     const dims={1:[1000,1100],2:[1600,700],3:[1600,700],4:[900,1100]}[slot];
     const f=await prepareImage(original,dims[0],dims[1],'#3b2b20',.93);
     imageUrl=await uploadFile(f,`homepage/top-${slot}-${Date.now()}.jpg`);
   }
   const payload={slot,image_url:imageUrl,link_url:$('topLink'+slot).value.trim()||null,caption:$('topCaption'+slot).value.trim()||null,updated_at:new Date().toISOString()};
   const {error}=await sb.from('homepage_top_items').upsert(payload,{onConflict:'slot'});
   if(error)throw error;
   input.value='';
   toast('Фото «Зараз у топі» збережено');
   await loadHomepageTopItems();
 }catch(e){console.error(e);toast(e.message||'Помилка збереження')}
};
for(let i=1;i<=4;i++){
 $('topImage'+i).onchange=e=>{const f=e.target.files[0];if(f)$('topPreview'+i).innerHTML=`<img src="${URL.createObjectURL(f)}" alt="">`};
}

$('hpEditorialImage').onchange=e=>{
 const f=e.target.files[0];
 if(f)$('hpEditorialPreview').innerHTML=`<img src="${URL.createObjectURL(f)}">`
};
$('hpHeroBackgroundImage').onchange=e=>{
 const f=e.target.files[0];
 if(f)$('hpHeroBackgroundPreview').innerHTML=`<img src="${URL.createObjectURL(f)}">`
};
$('hpHeroMainImage').onchange=e=>{
 const f=e.target.files[0];
 if(f)$('hpHeroMainPreview').innerHTML=`<img src="${URL.createObjectURL(f)}" alt="">`
};
$('hpHeroTopImage').onchange=e=>{
 const f=e.target.files[0];
 if(f)$('hpHeroTopPreview').innerHTML=`<img src="${URL.createObjectURL(f)}" alt="">`
};
$('hpHeroBottomImage').onchange=e=>{
 const f=e.target.files[0];
 if(f)$('hpHeroBottomPreview').innerHTML=`<img src="${URL.createObjectURL(f)}" alt="">`
};

$('saveHomepageTextBtn').onclick=async()=>{
 const btn=$('saveHomepageTextBtn');
 btn.disabled=true;btn.textContent='ЗБЕРЕЖЕННЯ...';
 try{
   let editorialImage=HOMEPAGE_SETTINGS.homepage_editorial_image||null;
   const editorialOriginal=$('hpEditorialImage').files[0];
   if(editorialOriginal){
     const f=await prepareImage(editorialOriginal,1200,900,'#493522',.82);
     editorialImage=await uploadFile(f,`homepage/editorial-${Date.now()}.jpg`)
   }

   let heroBackground=HOMEPAGE_SETTINGS.hero_background_image||null;
   const bgOriginal=$('hpHeroBackgroundImage').files[0];
   if(bgOriginal){
     const f=await prepareImage(bgOriginal,1440,675,'#0e0c09',.80);
     heroBackground=await uploadFile(f,`homepage/hero-background-${Date.now()}.jpg`)
   }

   let heroMain=HOMEPAGE_SETTINGS.hero_main_image||null;
   let heroTop=HOMEPAGE_SETTINGS.hero_top_image||null;
   let heroBottom=HOMEPAGE_SETTINGS.hero_bottom_image||null;

   const mainOriginal=$('hpHeroMainImage').files[0];
   const topOriginal=$('hpHeroTopImage').files[0];
   const bottomOriginal=$('hpHeroBottomImage').files[0];

   if(mainOriginal){
     const f=await prepareImage(mainOriginal,960,1200,'#35291d',.82);
     heroMain=await uploadFile(f,`homepage/hero-main-${Date.now()}.jpg`)
   }
   if(topOriginal){
     const f=await prepareImage(topOriginal,720,720,'#35291d',.80);
     heroTop=await uploadFile(f,`homepage/hero-top-${Date.now()}.jpg`)
   }
   if(bottomOriginal){
     const f=await prepareImage(bottomOriginal,720,720,'#35291d',.80);
     heroBottom=await uploadFile(f,`homepage/hero-bottom-${Date.now()}.jpg`)
   }

   const payload={
     hero_kicker:$('hpHeroKicker').value.trim()||null,
     hero_title:$('hpHeroTitle').value.trim()||null,
     hero_description:$('hpHeroDescription').value.trim()||null,
     hero_primary_text:$('hpHeroPrimaryText').value.trim()||null,
     hero_primary_url:$('hpHeroPrimaryUrl').value.trim()||null,
     hero_secondary_text:$('hpHeroSecondaryText').value.trim()||null,
     hero_secondary_url:$('hpHeroSecondaryUrl').value.trim()||null,
     hero_background_image:heroBackground,
     hero_main_image:heroMain,
     hero_top_image:heroTop,
     hero_bottom_image:heroBottom,

     homepage_new_title:$('hpNewTitle').value.trim()||null,
     homepage_new_link_text:$('hpNewLinkText').value.trim()||null,
     homepage_editorial_kicker:$('hpEditorialKicker').value.trim()||null,
     homepage_editorial_title:$('hpEditorialTitle').value.trim()||null,
     homepage_editorial_text:$('hpEditorialText').value.trim()||null,
     homepage_editorial_button_text:$('hpEditorialButtonText').value.trim()||null,
     homepage_editorial_button_url:$('hpEditorialButtonUrl').value.trim()||null,
     homepage_editorial_image:editorialImage,
     homepage_top_title:$('hpTopTitle').value.trim()||null,
     homepage_top_link_text:$('hpTopLinkText').value.trim()||null,
     homepage_categories_title:$('hpCategoriesTitle').value.trim()||null,
     homepage_journal_title:$('hpJournalTitle').value.trim()||null,
     homepage_journal_link_text:$('hpJournalLinkText').value.trim()||null,
     homepage_instagram_title:HOMEPAGE_SETTINGS.homepage_instagram_title||null,
     homepage_instagram_link_text:HOMEPAGE_SETTINGS.homepage_instagram_link_text||null,
     homepage_instagram_url:HOMEPAGE_SETTINGS.homepage_instagram_url||null,
     homepage_brand_title:$('hpBrandTitle').value.trim()||null,
     homepage_brand_line1:$('hpBrandLine1').value.trim()||null,
     homepage_brand_line2:$('hpBrandLine2').value.trim()||null,
     homepage_brand_location:$('hpBrandLocation').value.trim()||null,
hero_eyebrow:$('hpHeroKicker').value.trim()||null,
hero_catalog_button_text:$('hpHeroPrimaryText').value.trim()||null,
hero_catalog_button_url:$('hpHeroPrimaryUrl').value.trim()||'catalog.html',
hero_about_button_text:$('hpHeroSecondaryText').value.trim()||null,
hero_about_button_url:$('hpHeroSecondaryUrl').value.trim()||'about.html',
hero_text_x:Number(HOMEPAGE_SETTINGS.hero_text_x??7),
hero_text_y:Number(HOMEPAGE_SETTINGS.hero_text_y??18),
hero_buttons_x:Number(HOMEPAGE_SETTINGS.hero_buttons_x??46),
hero_buttons_y:Number(HOMEPAGE_SETTINGS.hero_buttons_y??4)
   };

   const {error}=await sb.from('site_settings').update(payload).eq('id',1);
   if(error)throw error;

   $('hpHeroMainImage').value='';
   $('hpHeroTopImage').value='';
   $('hpHeroBottomImage').value='';
   $('hpHeroBackgroundImage').value='';
   $('hpEditorialImage').value='';

   toast('Головну сторінку збережено');
   await loadHomepageSettings()
 }catch(e){
   console.error(e);toast(e.message)
 }finally{
   btn.disabled=false;btn.textContent='ЗБЕРЕГТИ ГОЛОВНУ'
 }
};

$('removeHeroBackgroundBtn').onclick=async()=>{
 if(!confirm('Повернути стандартний фон Hero?'))return;
 const {error}=await sb.from('site_settings').update({hero_background_image:null}).eq('id',1);
 if(error)return toast(error.message);
 $('hpHeroBackgroundImage').value='';
 toast('Повернуто стандартний фон Hero');
 await loadHomepageSettings()
};

async function removeFixedHero(field,inputId){
 if(!confirm('Прибрати це Hero-фото?'))return;
 const payload={};payload[field]=null;
 const {error}=await sb.from('site_settings').update(payload).eq('id',1);
 if(error)return toast(error.message);
 $(inputId).value='';
 toast('Hero-фото прибрано');
 await loadHomepageSettings()
}
$('removeHeroMainBtn').onclick=()=>removeFixedHero('hero_main_image','hpHeroMainImage');
$('removeHeroTopBtn').onclick=()=>removeFixedHero('hero_top_image','hpHeroTopImage');
$('removeHeroBottomBtn').onclick=()=>removeFixedHero('hero_bottom_image','hpHeroBottomImage');

async function loadInstagramFeed(){
 if(!$('instagramAdminGrid')){instagramFeed=[];return}
 const {data,error}=await sb.from('instagram_feed').select('*').order('sort_order');
 if(error){console.error(error);return}
 instagramFeed=data||[];
 renderInstagramAdmin()
}
function renderInstagramAdmin(){const host=$('instagramAdminGrid');if(!host)return;host.innerHTML=instagramFeed.length?instagramFeed.map((x,i)=>`<div class="gallery-item"><div class="gallery-img-wrap"><img src="${x.image_url}"></div><div class="instagram-admin-fields"><input class="input tiny-input" id="inst-link-${x.id}" value="${x.link_url||''}" placeholder="Instagram URL"><button class="btn small-action" onclick="saveInstagramLink('${x.id}')">Зберегти URL</button></div><div class="gallery-actions"><div class="gallery-actions-row"><button onclick="moveInstagramItem('${x.id}',-1)">←</button><button onclick="moveInstagramItem('${x.id}',1)">→</button></div><button class="remove-img" onclick="deleteInstagramItem('${x.id}')">Видалити</button></div><div class="gallery-order">Позиція ${i+1}</div></div>`).join(''):'<div class="empty">Instagram-стрічка ще порожня</div>'}
$('addInstagramItemBtn')?.addEventListener('click',async()=>{const original=$('instImage').files[0];if(!original)return toast('Вибери фото');const btn=$('addInstagramItemBtn');btn.disabled=true;btn.textContent='ЗАВАНТАЖЕННЯ...';try{const f=await prepareImage(original,1000,1000,'#493522',.92),url=await uploadFile(f,`instagram/${Date.now()}-${crypto.randomUUID()}.jpg`);const next=instagramFeed.length?Math.max(...instagramFeed.map(x=>Number(x.sort_order||0)))+1:0;const {error}=await sb.from('instagram_feed').insert({image_url:url,link_url:$('instLink').value.trim()||null,sort_order:next,is_active:true});if(error)throw error;$('instImage').value='';$('instLink').value='';toast('Фото додано в Instagram-стрічку');await loadInstagramFeed()}catch(e){toast(e.message)}finally{btn.disabled=false;btn.textContent='＋ ДОДАТИ В СТРІЧКУ'}});
async function saveInstagramLink(id){const value=$(`inst-link-${id}`).value.trim()||null;const {error}=await sb.from('instagram_feed').update({link_url:value}).eq('id',id);if(error)return toast(error.message);toast('Посилання збережено')}
async function deleteInstagramItem(id){if(!confirm('Видалити фото зі стрічки?'))return;const {error}=await sb.from('instagram_feed').delete().eq('id',id);if(error)return toast(error.message);await loadInstagramFeed()}
async function moveInstagramItem(id,delta){const idx=instagramFeed.findIndex(x=>x.id===id),to=idx+delta;if(idx<0||to<0||to>=instagramFeed.length)return;[instagramFeed[idx],instagramFeed[to]]=[instagramFeed[to],instagramFeed[idx]];for(let i=0;i<instagramFeed.length;i++)await sb.from('instagram_feed').update({sort_order:i}).eq('id',instagramFeed[i].id);renderInstagramAdmin()}
window.saveInstagramLink=saveInstagramLink;window.deleteInstagramItem=deleteInstagramItem;window.moveInstagramItem=moveInstagramItem;

$('orderSearch').addEventListener('input',applyOrderFilters);
 $('orderStatusFilter').addEventListener('change',applyOrderFilters);
 $('orderDateFilter')?.addEventListener('change',applyOrderFilters);
 $('orderSortFilter')?.addEventListener('change',applyOrderFilters);
 $('saveOrderMetaV145')?.addEventListener('click',saveOrderMetaV145);
$('orderModal').addEventListener('click',e=>{if(e.target===$('orderModal'))closeOrderModal()});
boot();

/* V24 ABOUT ADMIN */
const ABOUT_KEYS={
 aHeroTitle:'about_hero_title',aHeroText:'about_hero_text',
 aPhilTitle:'about_philosophy_title',aPhilText:'about_philosophy_text',
 aP1Title:'about_p1_title',aP1Text:'about_p1_text',
 aP2Title:'about_p2_title',aP2Text:'about_p2_text',
 aP3Title:'about_p3_title',aP3Text:'about_p3_text',
 aP4Title:'about_p4_title',aP4Text:'about_p4_text',
 aManifestTitle:'about_manifest_title',aManifestText:'about_manifest_text',
 aOriginTitle:'about_origin_title',aOriginText:'about_origin_text',
 aFinalTitle:'about_final_title',aFinalText:'about_final_text'
};

const ABOUT_DEFAULT={
 about_hero_title:'ОДЯГ З МИНУЛОГО.\nСТИЛЬ ПОЗА ЧАСОМ.',
 about_hero_text:'Ми відбираємо вінтажні речі з Європи — речі з характером, історією та власною естетикою.',
 about_philosophy_title:'МИ НЕ ШУКАЄМО\nПРОСТО СТАРІ РЕЧІ.',
 about_philosophy_text:'Vintage Hedonista — це речі, які вже мали життя до нас і заслуговують на наступне. Ми відбираємо не за віком, а за характером, якістю матеріалів, кроєм та тим відчуттям, яке річ створює.',
 about_p1_title:'ХАРАКТЕР',about_p1_text:'Річ повинна мати власний образ.',
 about_p2_title:'ЯКІСТЬ',about_p2_text:'Матеріали, пошиття та стан проходять відбір.',
 about_p3_title:'УНІКАЛЬНІСТЬ',about_p3_text:'Ми віддаємо перевагу речам, які складно зустріти вдруге.',
 about_p4_title:'ONE OF ONE',about_p4_text:'Більшість позицій існує у нас лише в одному екземплярі.',
 about_manifest_title:'НЕ МАС-МАРКЕТ.\nНЕ КОЛЕКЦІЯ З ТИСЯЧІ\nОДНАКОВИХ РЕЧЕЙ.',
 about_manifest_text:'ONE PIECE. ONE STORY. ONE OWNER.',
 about_origin_title:'ВІД ЄВРОПИ\nДО ВАШОГО ГАРДЕРОБУ',
 about_origin_text:'Ми шукаємо речі, які зберегли характер і якість. Кожна позиція проходить візуальний відбір та перевірку стану перед тим, як потрапити до каталогу Vintage Hedonista.',
 about_final_title:'ЗНАЙДІТЬ СВОЮ РІЧ.',
 about_final_text:'Кожна з них чекає лише одного власника.'
};

const ABOUT_MEDIA = {
 aHeroImage:{key:'about_hero_image',preview:'aHeroImagePreview',w:1500,h:1400},
 aEd1:{key:'about_editorial_1',preview:'aEd1Preview',w:1200,h:1500},
 aEd2:{key:'about_editorial_2',preview:'aEd2Preview',w:1200,h:800},
 aEd3:{key:'about_editorial_3',preview:'aEd3Preview',w:1200,h:800},
 aOriginImage:{key:'about_origin_image',preview:'aOriginImagePreview',w:1200,h:1200},
 aFinalImage:{key:'about_final_image',preview:'aFinalImagePreview',w:1920,h:900}
};
let ABOUT_ROW={};

function setAboutPreview(previewId,url){
 const box=$(previewId); if(!box)return;
 box.innerHTML=url?`<img src="${url}" alt="">`:'<span>Фото не завантажено</span>';
}
function setAboutSaveState(mode='saved'){
 const el=$('aboutSaveState'); if(!el)return;
 el.classList.remove('is-dirty','is-saving');
 if(mode==='dirty'){el.classList.add('is-dirty');el.innerHTML='<span></span>Є незбережені зміни'}
 else if(mode==='saving'){el.classList.add('is-saving');el.innerHTML='<span></span>Збереження...'}
 else el.innerHTML='<span></span>Зміни збережені';
}
async function loadAboutPageAdmin(){
 if(!$('aHeroTitle'))return;
 const {data,error}=await sb.from('site_settings').select('*').eq('id',1).maybeSingle();
 if(error){console.error(error);toast(error.message);return}
 const row=data||{}; ABOUT_ROW=row;
 Object.entries(ABOUT_KEYS).forEach(([id,key])=>{if($(id))$(id).value=row[key]||ABOUT_DEFAULT[key]||''});
 Object.entries(ABOUT_MEDIA).forEach(([id,cfg])=>setAboutPreview(cfg.preview,row[cfg.key]||''));
 setAboutSaveState('saved');
}
async function uploadAboutFile(id,key,w,h){
 const input=$(id);
 if(!input?.files?.[0])return null;
 const f=await prepareImage(input.files[0],w,h,'#35291d',.93);
 return await uploadFile(f,`about/${key}-${Date.now()}.jpg`)
}
const ABOUT_SECTION_CONFIG={
  1:{
    fields:['aHeroTitle','aHeroText'],
    media:['aHeroImage']
  },
  2:{
    fields:['aPhilTitle','aPhilText'],
    media:[]
  },
  3:{
    fields:[],
    media:['aEd1','aEd2','aEd3']
  },
  4:{
    fields:['aP1Title','aP1Text','aP2Title','aP2Text','aP3Title','aP3Text','aP4Title','aP4Text'],
    media:[]
  },
  5:{
    fields:['aManifestTitle','aManifestText'],
    media:[]
  },
  6:{
    fields:['aOriginTitle','aOriginText'],
    media:['aOriginImage']
  },
  7:{
    fields:['aFinalTitle','aFinalText'],
    media:['aFinalImage']
  }
};

function aboutSectionStatus(section,mode='saved'){
 const el=section.querySelector('.about-section-status');
 if(!el)return;
 el.classList.remove('is-dirty','is-saving');
 if(mode==='dirty'){
   el.classList.add('is-dirty');
   el.textContent='Є незбережені зміни';
 }else if(mode==='saving'){
   el.classList.add('is-saving');
   el.textContent='Збереження...';
 }else{
   el.textContent='Зміни збережені';
 }
}

async function saveAboutSection(sectionNumber){
 const cfg=ABOUT_SECTION_CONFIG[sectionNumber];
 const section=document.querySelector(`#aboutPage .about-builder-card[data-about-section="${sectionNumber}"]`);
 if(!cfg||!section)return;

 const btn=section.querySelector('.about-section-save');
 if(btn){btn.disabled=true;btn.textContent='ЗБЕРЕЖЕННЯ...'}
 aboutSectionStatus(section,'saving');

 try{
   const payload={};

   cfg.fields.forEach(id=>{
     const key=ABOUT_KEYS[id];
     if(key&&$(id))payload[key]=$(id).value.trim()||null;
   });

   for(const id of cfg.media){
     const mediaCfg=ABOUT_MEDIA[id];
     if(!mediaCfg)continue;
     const input=$(id);
     const url=await uploadAboutFile(id,mediaCfg.key,mediaCfg.w,mediaCfg.h);
     if(url)payload[mediaCfg.key]=url;
     else if(input?.dataset?.mediaUrl)payload[mediaCfg.key]=input.dataset.mediaUrl;
   }

   const {error}=await sb.from('site_settings').update(payload).eq('id',1);
   if(error)throw error;

   cfg.media.forEach(id=>{
     const input=$(id);
     if(input){
       input.value='';
       if(input.dataset)delete input.dataset.mediaUrl;
     }
   });

   toast(`Блок ${String(sectionNumber).padStart(2,'0')} збережено`);
   await loadAboutPageAdmin();
   aboutSectionStatus(section,'saved');
 }catch(e){
   console.error(e);
   toast(e.message||'Помилка збереження');
   aboutSectionStatus(section,'dirty');
 }finally{
   if(btn){btn.disabled=false;btn.textContent='ЗБЕРЕГТИ БЛОК'}
 }
}

function initAboutAdminUX(){
 const page=$('aboutPage');
 if(!page)return;

 const cards=[...page.querySelectorAll('.about-builder-card')];

 cards.forEach((card,index)=>{
   const number=index+1;
   card.dataset.aboutSection=String(number);

   const head=card.querySelector('.about-builder-head');
   if(!head)return;

   /* Wrap section content below the heading into one accordion body. */
   let body=card.querySelector('.about-builder-body');
   if(!body){
     body=document.createElement('div');
     body.className='about-builder-body';
     const nodes=[...card.children].filter(n=>n!==head);
     nodes.forEach(n=>body.appendChild(n));
     card.appendChild(body);
   }

   /* Save button inside every block. */
   if(!body.querySelector('.about-section-savebar')){
     const bar=document.createElement('div');
     bar.className='about-section-savebar';
     bar.innerHTML=`
       <span class="about-section-status">Зміни збережені</span>
       <button class="btn primary about-section-save" type="button">ЗБЕРЕГТИ БЛОК</button>
     `;
     body.appendChild(bar);
     bar.querySelector('.about-section-save').addEventListener('click',()=>saveAboutSection(number));
   }

   head.setAttribute('role','button');
   head.setAttribute('tabindex','0');
   const toggle=()=>{
     card.classList.toggle('is-collapsed');
   };
   head.addEventListener('click',toggle);
   head.addEventListener('keydown',e=>{
     if(e.key==='Enter'||e.key===' '){e.preventDefault();toggle()}
   });

   /* Compact default view: first block open, remaining blocks collapsed. */
   if(index>0)card.classList.add('is-collapsed');

   const markDirty=()=>aboutSectionStatus(card,'dirty');
   body.querySelectorAll('input:not([type=file]),textarea').forEach(el=>el.addEventListener('input',markDirty));
   body.querySelectorAll('input[type=file]').forEach(el=>el.addEventListener('change',markDirty));
 });

 Object.entries(ABOUT_MEDIA).forEach(([id,cfg])=>{
   $(id)?.addEventListener('change',e=>{
     const f=e.target.files?.[0];
     if(f)setAboutPreview(cfg.preview,URL.createObjectURL(f));
   });
 });

 /* If the project-wide media picker helper is available, use only that.
    No extra manual "Медіатека" buttons are added here. */
 page.querySelectorAll('[data-about-media]').forEach(btn=>{
   btn.remove();
 });
}

document.addEventListener('DOMContentLoaded',()=>{
 initAboutAdminUX();
 setTimeout(loadAboutPageAdmin,400);
});


/* V30 — Hero text/button position controls */
function updateHeroPositionLabels(){
 if($('heroTextXValue')&&$('heroTextX'))$('heroTextXValue').textContent=$('heroTextX').value+'%';
 if($('heroTextYValue')&&$('heroTextY'))$('heroTextYValue').textContent=$('heroTextY').value+'%';
 if($('heroButtonsXValue')&&$('heroButtonsX'))$('heroButtonsXValue').textContent=$('heroButtonsX').value+'%';
 if($('heroButtonsYValue')&&$('heroButtonsY'))$('heroButtonsYValue').textContent=$('heroButtonsY').value+'%';
}
document.addEventListener('DOMContentLoaded',()=>{
 ['heroTextX','heroTextY','heroButtonsX','heroButtonsY'].forEach(id=>{
   $(id)?.addEventListener('input',updateHeroPositionLabels)
 });
 $('heroButtonsResetPosition')?.addEventListener('click',()=>{
   $('heroButtonsX').value=46;
   $('heroButtonsY').value=4;
   updateHeroPositionLabels();
 });
 setTimeout(updateHeroPositionLabels,300)
});

/* V35 JOURNAL SETTINGS */
async function loadJournalPageSettings(){
 const {data,error}=await sb.from('site_settings').select('*').eq('id',1).maybeSingle();
 if(error){console.error(error);return}
 const s=data||{},put=(id,val)=>{if($(id))$(id).value=val??''};

 put('jPageTitle',s.journal_page_title||'ВІНТАЖНІ ХРОНІКИ');
 put('jPageSubtitle',s.journal_page_subtitle||'Історії про вінтаж, стиль та речі поза часом');
 put('jNewTitle',s.journal_new_title||'НОВЕ НА САЙТІ');
 put('jGuideTitle',String(s.journal_guide_title||'HEDONISTA\nGUIDE').replace(/\\n/g,'\n'));
 put('jGuideSubtitle',s.journal_guide_subtitle||'КОРИСНІ ГІДИ ТА ПОРАДИ');
 put('jOtherTitle',s.journal_other_title||'ІНШІ ПУБЛІКАЦІЇ');
 put('jCtaTitle',s.journal_cta_title||'ЗНАЙШЛИ НАТХНЕННЯ?');
 put('jCtaText',s.journal_cta_text||'Відкрийте для себе вінтажні знахідки у нашому каталозі.');
 put('jCtaLinkText',s.journal_cta_link_text||'ПЕРЕЙТИ ДО КАТАЛОГУ →');
 put('jCtaLinkUrl',s.journal_cta_link_url||'catalog.html');

 if($('journalCtaPreview'))$('journalCtaPreview').innerHTML=s.journal_cta_image?`<img src="${s.journal_cta_image}">`:'';
}

$('jCtaImage')?.addEventListener('change',e=>{
 const f=e.target.files?.[0];
 if($('journalCtaPreview'))$('journalCtaPreview').innerHTML=f?`<img src="${URL.createObjectURL(f)}">`:'';
});

$('saveJournalSettingsBtn')?.addEventListener('click',async()=>{
 const btn=$('saveJournalSettingsBtn');btn.disabled=true;btn.textContent='ЗБЕРЕЖЕННЯ...';
 try{
   const payload={
     journal_page_title:$('jPageTitle').value.trim()||null,
     journal_page_subtitle:$('jPageSubtitle').value.trim()||null,
     journal_new_title:$('jNewTitle').value.trim()||null,
     journal_guide_title:$('jGuideTitle').value.replace(/\\n/g,'\n').trim()||null,
     journal_guide_subtitle:$('jGuideSubtitle').value.trim()||null,
     journal_other_title:$('jOtherTitle').value.trim()||null,
     journal_cta_title:$('jCtaTitle').value.trim()||null,
     journal_cta_text:$('jCtaText').value.trim()||null,
     journal_cta_link_text:$('jCtaLinkText').value.trim()||null,
     journal_cta_link_url:$('jCtaLinkUrl').value.trim()||'catalog.html'
   };

   const file=$('jCtaImage').files?.[0];
   if(file){
     const prepared=await prepareImage(file,1920,600,'#2a1d14',.93);
     payload.journal_cta_image=await uploadFile(prepared,`journal/cta-${Date.now()}-${crypto.randomUUID()}.jpg`);
   }

   const {error}=await sb.from('site_settings').update(payload).eq('id',1);
   if(error)throw error;
   $('jCtaImage').value='';
   toast('Сторінку Journal збережено');
   await loadJournalPageSettings();
 }catch(e){
   console.error(e);toast(e.message||'Помилка збереження')
 }finally{
   btn.disabled=false;btn.textContent='ЗБЕРЕГТИ СТОРІНКУ'
 }
});
document.addEventListener('DOMContentLoaded',()=>setTimeout(loadJournalPageSettings,350));


/* ==========================================================
   V79 — clearer product editor UX
   ========================================================== */
function updateProductEditorState(dirty){
 const el=$('productSaveState');
 if(!el)return;
 el.classList.toggle('dirty',!!dirty);
 el.innerHTML=dirty?'<span></span>Є незбережені зміни':'<span></span>Зміни збережені';
}

document.addEventListener('input',e=>{
 if(e.target.closest('#productForm'))updateProductEditorState(true)
});
document.addEventListener('change',e=>{
 if(e.target.closest('#productForm'))updateProductEditorState(true)
});

$('saveProductTopBtn')?.addEventListener('click',()=>$('saveProductBtn')?.click());

$('previewProductBtn')?.addEventListener('click',()=>{
 const slug=$('pSlug')?.value?.trim();
 if(!slug)return toast('Спочатку вкажіть slug товару');
 window.open(`../product.html?slug=${encodeURIComponent(slug)}`,'_blank')
});

const originalResetProductForm=resetProductForm;
resetProductForm=function(){
 originalResetProductForm();
 updateProductEditorState(false)
};

const originalEditProduct=editProduct;
editProduct=function(id){
 originalEditProduct(id);
 updateProductEditorState(false)
};
window.editProduct=editProduct;
window.openProductForm=function(){
 resetProductForm();
 goPage('productForm');
 updateProductEditorState(false)
};

$('saveProductBtn')?.addEventListener('click',()=>setTimeout(()=>updateProductEditorState(false),700));


/* ==========================================================
   V80 — consistent editor UX for all admin sections
   ========================================================== */

// Fix dashboard/content alignment after the V79 grid + fixed sidebar combination.
document.documentElement.classList.add('admin-v80');

// Article editor top controls.
$('saveNewsTopBtn')?.addEventListener('click',()=>$('saveNewsBtn')?.click());
$('previewNewsTopBtn')?.addEventListener('click',()=>{
  const slug=$('nSlug')?.value?.trim();
  if(!slug)return toast('Спочатку вкажіть slug статті');
  window.open(`../article.html?slug=${encodeURIComponent(slug)}`,'_blank')
});

// Small persistent context label in the page title.
const V80_PAGE_CONTEXT={
 dashboard:'Огляд',
 homepage:'Сторінка · Головна',
 aboutPage:'Сторінка · Про нас',
 products:'Магазин · Товари',
 productForm:'Редактор · Товар',
 categories:'Магазин · Категорії',
 orders:'Магазин · Замовлення',
 news:'Контент · Журнал',
 newsForm:'Редактор · Стаття',
 deliveryPage:'Сторінка · Доставка і оплата',
 contactsPage:'Сторінка · Контакти',
 settings:'Система · Налаштування'
};

document.addEventListener('click',e=>{
  const nav=e.target.closest('.nav-item[data-page]');
  if(!nav)return;
  const key=nav.dataset.page;
  setTimeout(()=>{
    const title=$('pageTitle');
    if(title&&V80_PAGE_CONTEXT[key])title.textContent=V80_PAGE_CONTEXT[key]
  },0)
});

// Mark page settings sections as locally dirty while the user types.
document.addEventListener('input',e=>{
  const page=e.target.closest('.page');
  if(!page||['productForm','newsForm'].includes(page.id))return;
  page.classList.add('has-local-changes')
});
document.addEventListener('change',e=>{
  const page=e.target.closest('.page');
  if(!page||['productForm','newsForm'].includes(page.id))return;
  page.classList.add('has-local-changes')
});

// Give every file-input preview area a consistent mini-preview treatment.
document.querySelectorAll('input[type="file"]').forEach(input=>{
  input.addEventListener('change',()=>{
    input.closest('.panel,.admin-builder-section,.journal-editor-group')?.classList.add('editor-section-touched')
  })
});


/* ==========================================================
   V81 — CONSTRUCTOR UX
   Collapsible sections + section navigator + live preview
   ========================================================== */

const CONSTRUCTOR_PREVIEW_MAP={
  homepage:'../index.html',
  aboutPage:'../about.html',
  products:'../catalog.html',
  categories:'../catalog.html',
  orders:'../admin/admin.html',
  news:'../journal.html',
  deliveryPage:'../delivery.html',
  contactsPage:'../contacts.html',
  settings:'../index.html'
};

function constructorActivePage(){
  return document.querySelector('.page.active')
}

function constructorPreviewUrl(){
  const page=constructorActivePage();
  if(!page)return '../index.html';

  if(page.id==='productForm'){
    const slug=$('pSlug')?.value?.trim();
    return slug?`../product.html?slug=${encodeURIComponent(slug)}`:'../catalog.html'
  }
  if(page.id==='newsForm'){
    const slug=$('nSlug')?.value?.trim();
    return slug?`../article.html?slug=${encodeURIComponent(slug)}`:'../journal.html'
  }
  return CONSTRUCTOR_PREVIEW_MAP[page.id]||'../index.html'
}

function constructorPreviewLabel(){
  const page=constructorActivePage();
  const labels={
    dashboard:'Панель керування',
    homepage:'Головна сторінка',
    aboutPage:'Про нас',
    products:'Каталог',
    productForm:'Товар',
    categories:'Каталог / категорії',
    orders:'Адмінка замовлень',
    news:'Hedonista Journal',
    newsForm:'Стаття',
    deliveryPage:'Доставка і оплата',
    contactsPage:'Контакти',
    settings:'Сайт'
  };
  return labels[page?.id]||'Сторінка'
}

function constructorOpenPreview(){
  const drawer=$('constructorPreviewDrawer');
  const backdrop=$('constructorBackdrop');
  const frame=$('constructorPreviewFrame');
  const url=constructorPreviewUrl();
  $('constructorPreviewTitle').textContent=constructorPreviewLabel();
  frame.src=url;
  drawer.classList.add('open');
  backdrop.classList.add('open');
  document.body.classList.add('constructor-open')
}

function constructorCloseAll(){
  $('constructorPreviewDrawer')?.classList.remove('open');
  $('constructorNavDrawer')?.classList.remove('open');
  $('constructorBackdrop')?.classList.remove('open');
  document.body.classList.remove('constructor-open')
}

function constructorRefreshPreview(){
  const frame=$('constructorPreviewFrame');
  if(frame)frame.src=constructorPreviewUrl()+(
    constructorPreviewUrl().includes('?')?'&':'?'
  )+`preview_ts=${Date.now()}`
}

$('constructorPreviewBtn')?.addEventListener('click',constructorOpenPreview);
$('closeConstructorPreview')?.addEventListener('click',constructorCloseAll);
$('refreshConstructorPreview')?.addEventListener('click',constructorRefreshPreview);
$('openConstructorPreview')?.addEventListener('click',()=>window.open(constructorPreviewUrl(),'_blank'));
$('constructorBackdrop')?.addEventListener('click',constructorCloseAll);

function constructorSectionTitle(section,index){
  const head=section.querySelector(
    '.builder-section-head h2,.panel-head .panel-title,.journal-editor-group-title,.product-admin-subtitle'
  );
  let text=head?.textContent?.trim()||`Секція ${String(index+1).padStart(2,'0')}`;
  text=text.replace(/^\d+\s*[·.\-–—]\s*/,'').trim();
  return text
}

function constructorCanCollapse(section){
  if(section.closest('#dashboard,#products,#orders,#newsForm'))return false;
  if(section.classList.contains('admin-danger-zone'))return false;
  return true
}

function constructorBodyNodes(section){
  const direct=[...section.children];
  return direct.filter(el=>
    !el.classList.contains('panel-head') &&
    !el.classList.contains('builder-section-head') &&
    !el.classList.contains('constructor-section-toggle')
  )
}

function constructorSetCollapsed(section,collapsed){
  section.classList.toggle('constructor-collapsed',collapsed);
  const toggle=section.querySelector(':scope > .constructor-section-toggle') ||
    section.querySelector(':scope > .panel-head .constructor-section-toggle') ||
    section.querySelector(':scope > .builder-section-head .constructor-section-toggle');
  if(toggle){
    toggle.textContent=collapsed?'＋':'−';
    toggle.setAttribute('aria-expanded',String(!collapsed))
  }
}

function constructorEnhanceSection(section,index){
  if(section.dataset.constructorReady==='1'||!constructorCanCollapse(section))return;
  section.dataset.constructorReady='1';
  section.dataset.constructorIndex=String(index);

  const head=section.querySelector(':scope > .panel-head,:scope > .builder-section-head');
  const button=document.createElement('button');
  button.type='button';
  button.className='constructor-section-toggle';
  button.textContent='−';
  button.setAttribute('aria-label','Згорнути або розгорнути секцію');
  button.setAttribute('aria-expanded','true');

  if(head){
    head.classList.add('constructor-section-head');
    head.appendChild(button);
  }else{
    section.prepend(button)
  }

  button.addEventListener('click',e=>{
    e.preventDefault();
    e.stopPropagation();
    constructorSetCollapsed(section,!section.classList.contains('constructor-collapsed'));
    constructorBuildNavigator()
  });

  // V82: every constructor section starts collapsed for a compact overview.
  constructorSetCollapsed(section,true);
}

function constructorSectionsForPage(){
  const page=constructorActivePage();
  if(!page)return [];
  return [...page.querySelectorAll(
    ':scope .admin-builder-section,:scope .home-admin-section,:scope .journal-editor-group'
  )].filter((el,i,arr)=>arr.indexOf(el)===i)
}

function constructorBuildNavigator(){
  const list=$('constructorSectionList');
  if(!list)return;
  const sections=constructorSectionsForPage();
  if(!sections.length){
    list.innerHTML='<div class="constructor-empty">На цій сторінці немає окремих секцій конструктора.</div>';
    return
  }
  list.innerHTML=sections.map((section,i)=>`
    <button type="button" class="constructor-nav-item" data-constructor-jump="${i}">
      <span>${String(i+1).padStart(2,'0')}</span>
      <b>${constructorSectionTitle(section,i)}</b>
      <small>${section.classList.contains('constructor-collapsed')?'ЗГОРНУТО':'ВІДКРИТО'}</small>
    </button>
  `).join('');
  list.querySelectorAll('[data-constructor-jump]').forEach(btn=>{
    btn.onclick=()=>{
      const section=sections[Number(btn.dataset.constructorJump)];
      if(!section)return;
      constructorSetCollapsed(section,false);
      section.scrollIntoView({behavior:'smooth',block:'start'});
      if(innerWidth<1100)constructorCloseAll()
    }
  })
}

function constructorEnhanceActivePage(){
  const sections=constructorSectionsForPage();
  sections.forEach(constructorEnhanceSection);
  constructorBuildNavigator()
}

$('constructorSectionsBtn')?.addEventListener('click',()=>{
  constructorEnhanceActivePage();
  $('constructorNavDrawer').classList.add('open');
  $('constructorBackdrop').classList.add('open');
  document.body.classList.add('constructor-open')
});
$('closeConstructorNav')?.addEventListener('click',constructorCloseAll);

// ALT-click a section toggle is a useful editor shortcut:
// collapse every other section and leave only this one open.
document.addEventListener('click',e=>{
  const btn=e.target.closest('.constructor-section-toggle');
  if(!btn||!e.altKey)return;
  const target=btn.closest('.admin-builder-section,.home-admin-section,.journal-editor-group');
  constructorSectionsForPage().forEach(section=>constructorSetCollapsed(section,section!==target));
  constructorBuildNavigator()
},true);

// Enhance every time navigation changes.
const V81_ORIGINAL_GO_PAGE=window.goPage;
window.goPage=function(id){
  V81_ORIGINAL_GO_PAGE(id);
  requestAnimationFrame(()=>{
    constructorEnhanceActivePage();
    constructorCloseAll()
  })
};
document.querySelectorAll('.nav-item[data-page]').forEach(n=>{
  n.onclick=()=>window.goPage(n.dataset.page)
});

// Product/news functions in old code call the lexical goPage(), so watch class changes too.
const constructorPageObserver=new MutationObserver(()=>{
  requestAnimationFrame(constructorEnhanceActivePage)
});
document.querySelectorAll('.page').forEach(page=>{
  constructorPageObserver.observe(page,{attributes:true,attributeFilter:['class']})
});

document.addEventListener('DOMContentLoaded',()=>{
  setTimeout(constructorEnhanceActivePage,50)
});


/* V82 — delegated constructor controls.
   The drawer markup is located after admin.js, so direct bindings from V81
   could be null during script execution. Delegation works regardless of DOM order. */
document.addEventListener('click',e=>{
 const id=e.target?.id;
 if(!id)return;

 if(id==='closeConstructorNav'||id==='closeConstructorPreview'){
   e.preventDefault();e.stopPropagation();
   constructorCloseAll();
   return
 }
 if(id==='constructorSectionsBtn'){
   e.preventDefault();e.stopPropagation();
   constructorEnhanceActivePage();
   $('constructorNavDrawer')?.classList.add('open');
   $('constructorPreviewDrawer')?.classList.remove('open');
   $('constructorBackdrop')?.classList.add('open');
   document.body.classList.add('constructor-open');
   return
 }
 if(id==='constructorPreviewBtn'){
   e.preventDefault();e.stopPropagation();
   $('constructorNavDrawer')?.classList.remove('open');
   constructorOpenPreview();
   return
 }
 if(id==='refreshConstructorPreview'){
   e.preventDefault();e.stopPropagation();
   constructorRefreshPreview();
   return
 }
 if(id==='openConstructorPreview'){
   e.preventDefault();e.stopPropagation();
   window.open(constructorPreviewUrl(),'_blank');
   return
 }
 if(id==='constructorBackdrop'){
   constructorCloseAll()
 }
});

// Escape always closes any constructor drawer.
document.addEventListener('keydown',e=>{
 if(e.key==='Escape')constructorCloseAll()
});


/* ==========================================================
   V84 — Journal page: only section 01 is collapsible
   ========================================================== */
function setJournalSettingsCollapsed(collapsed){
 const section=document.querySelector('#news .journal37-settings');
 const toggle=$('journalSettingsToggle');
 if(!section||!toggle)return;
 section.classList.toggle('journal-settings-collapsed',collapsed);
 toggle.textContent=collapsed?'＋':'−';
 toggle.setAttribute('aria-expanded',String(!collapsed));
 toggle.title=collapsed?'Розгорнути секцію':'Згорнути секцію'
}

document.addEventListener('click',e=>{
 if(e.target?.id!=='journalSettingsToggle')return;
 e.preventDefault();
 e.stopPropagation();
 const section=document.querySelector('#news .journal37-settings');
 setJournalSettingsCollapsed(!section?.classList.contains('journal-settings-collapsed'))
});

document.addEventListener('DOMContentLoaded',()=>{
 setTimeout(()=>setJournalSettingsCollapsed(true),80)
});


/* V186 — reliable article editor accordions */
function setArticleEditorGroupState(group,collapsed){
  if(!group)return;
  group.classList.toggle('article-step-collapsed',!!collapsed);
  const btn=group.querySelector(':scope > .journal-editor-group-title .article-step-toggle');
  if(btn){btn.textContent=collapsed?'＋':'−';btn.setAttribute('aria-expanded',String(!collapsed));}
}
function initArticleEditorAccordions(){
 const groups=[...document.querySelectorAll('#newsForm .journal-editor-main > .journal-editor-group')];
 groups.forEach((group,index)=>{
   const title=group.querySelector(':scope > .journal-editor-group-title');
   if(!title)return;
   if(!title.querySelector('.article-step-toggle')){
     const label=title.textContent.trim();
     title.innerHTML=`<span class="article-step-title">${label}</span><button type="button" class="article-step-toggle" aria-expanded="true">−</button>`;
   }
   setArticleEditorGroupState(group,false);
 });
}
document.addEventListener('click',e=>{
 const title=e.target.closest('#newsForm .journal-editor-main > .journal-editor-group > .journal-editor-group-title');
 if(!title)return;
 e.preventDefault();
 const group=title.parentElement;
 setArticleEditorGroupState(group,!group.classList.contains('article-step-collapsed'));
});
document.addEventListener('DOMContentLoaded',()=>setTimeout(initArticleEditorAccordions,120));

/* V87: normalize any remaining text-only Vintage Hedonista brand marks. */
document.addEventListener('DOMContentLoaded', () => {
  const isAdmin = location.pathname.includes('/admin/');
  const logoPath = isAdmin ? '../assets/vintage-hedonista-logo.png' : 'assets/vintage-hedonista-logo.png';
  const candidates = document.querySelectorAll('a, .brand, .logo, .site-logo, .footer-logo, .admin-brand, .sidebar-brand');
  candidates.forEach(el => {
    if (el.querySelector('img')) return;
    const t = (el.textContent || '').replace(/\s+/g,' ').trim().toLowerCase();
    if (t === 'vintage hedonista') {
      el.innerHTML = `<img class="${isAdmin ? 'vh-admin-logo' : 'vh-site-logo'}" src="${logoPath}" alt="Vintage Hedonista">`;
    }
  });
});


/* ==========================================================
   V117 — ADMIN CUSTOMER ACCOUNTS
   ========================================================== */
let customers=[];

async function loadCustomers(){
 const {data,error}=await sb.rpc('admin_list_customers_v131');
 if(error){
   console.error('admin_list_customers_v131',error);
   if($('customersTable'))$('customersTable').innerHTML=
     `<div class="empty">Не вдалося завантажити клієнтів.<br><small>${error.message||''}</small><br><br>Запустіть файл supabase_v128_customer_fix.sql у Supabase SQL Editor.</div>`;
   if($('customersBadge'))$('customersBadge').textContent='!';
   return
 }

 const {data:{session:adminSession}}=await sb.auth.getSession();
 const adminId=adminSession?.user?.id||window.VH_ADMIN_USER_ID||null;
 customers=(data||[])
   .filter(p=>!adminId || p.id!==adminId)
   .map(p=>({
     ...p,
     stats:{
       count:Number(p.orders_count||0),
       total:Number(p.orders_total||0),
       last:p.last_order_at||null
     }
   }));
 $('customersBadge').textContent=String(customers.length);
 renderCustomers(customers);

 if($('customerSearch')&&!$('customerSearch').dataset.bound){
   $('customerSearch').dataset.bound='1';
   $('customerSearch').addEventListener('input',applyCustomerFilters)
 }
}

function renderCustomers(list){
 if(!$('customersTable'))return;
 $('customersCount').textContent=`${list.length} клієнтів`;
 $('customersTable').innerHTML=list.length?`<div class="customer-list">${list.map(c=>`
   <div class="customer-row customer-row-v130">
     <div class="customer-avatar">${String(c.full_name||c.first_name||'К').trim().charAt(0).toUpperCase()}</div>
     <div class="customer-main">
       <b>${[c.first_name,c.last_name].filter(Boolean).join(' ')||c.full_name||'Без імені'}</b>
       <small>${c.email||c.id}</small>
     </div>
     <div class="customer-contact">
       ${c.phone||'—'}
       <small>${c.city||'Місто не вказано'}</small>
     </div>
     <div class="customer-stat">
       <b>${c.stats.count}</b>
       <small>замовлень</small>
     </div>
     <div class="customer-stat">
       <b>${money(c.stats.total)}</b>
       <small>${c.stats.last?`останнє ${fmtDate(c.stats.last)}`:'без покупок'}</small>
     </div>
     <div class="customer-actions-v130">
       <button class="btn customer-view-btn" type="button" onclick="openCustomerProfile('${c.id}')">ПЕРЕГЛЯНУТИ</button>
       <button class="customer-delete-x" type="button" onclick="deleteCustomerProfile('${c.id}')" title="Видалити профіль">×</button>
     </div>
   </div>`).join('')}</div>`:'<div class="empty">Зареєстрованих клієнтів ще немає</div>'
}

async function openCustomerProfile(id){
 const c=customers.find(x=>x.id===id);
 if(!c)return;

 let modal=$('customerProfileModalV130');
 if(!modal){
   modal=document.createElement('div');
   modal.id='customerProfileModalV130';
   modal.className='customer-profile-modal-v130 hidden';
   modal.innerHTML=`<div class="customer-profile-backdrop-v130" data-close-customer></div>
     <div class="customer-profile-panel-v130">
       <button class="customer-profile-close-v130" type="button" data-close-customer>×</button>
       <div id="customerProfileContentV130"></div>
     </div>`;
   document.body.appendChild(modal);
   modal.querySelectorAll('[data-close-customer]').forEach(el=>el.onclick=()=>modal.classList.add('hidden'))
 }
 const content=$('customerProfileContentV130');
 content.innerHTML='<div class="customer-profile-loading-v130">Завантаження...</div>';
 modal.classList.remove('hidden');

 const {data:orders,error}=await sb.from('orders')
   .select('id,product_name,amount,status,created_at,product_id,products(name,slug,cover_image)')
   .eq('user_id',id)
   .order('created_at',{ascending:false});
 if(error)console.error(error);

 const name=[c.first_name,c.last_name].filter(Boolean).join(' ')||c.full_name||'Без імені';
 const orderRows=(orders||[]).length?(orders||[]).map(o=>`
   <div class="customer-profile-order-v130">
     <div class="customer-profile-order-img-v130">${o.products?.cover_image?`<img src="${o.products.cover_image}" alt="">`:'<span></span>'}</div>
     <div>
       <small>${fmtDate(o.created_at)}</small>
       <b>${o.product_name||o.products?.name||'Товар'}</b>
       <em>${money(o.amount)}</em>
     </div>
     <strong>${String(o.status||'new').toUpperCase()}</strong>
   </div>`).join(''):'<div class="empty">Замовлень немає</div>';

 content.innerHTML=`
   <div class="customer-profile-kicker-v130">КЛІЄНТ · CRM</div>
   <h2>${name}</h2>
   <div class="customer-profile-grid-v130">
     <div><small>EMAIL</small><b>${c.email||'—'}</b></div>
     <div><small>ТЕЛЕФОН</small><b>${c.phone||'—'}</b></div>
     <div><small>МІСТО</small><b>${c.city||'—'}</b></div>
     <div><small>НОВА ПОШТА</small><b>${c.delivery_address||'—'}</b></div>
     <div><small>ЗАМОВЛЕНЬ</small><b>${c.stats.count}</b></div>
     <div><small>СУМА ПОКУПОК</small><b>${money(c.stats.total)}</b></div>
   </div>
   <div class="customer-profile-section-v130">
     <h3>ЗАМОВЛЕННЯ</h3>
     <div class="customer-profile-orders-v130">${orderRows}</div>
   </div>`;
}
window.openCustomerProfile=openCustomerProfile;

async function deleteCustomerProfile(id){
 const {data:{session}}=await sb.auth.getSession();
 if(session?.user?.id===id){
   return toast('Адміністратора не можна видалити зі списку клієнтів')
 }
 const c=customers.find(x=>x.id===id);
 const name=[c?.first_name,c?.last_name].filter(Boolean).join(' ')||c?.full_name||c?.email||'цей профіль';
 if(!confirm(`Видалити ${name}? Це видалить акаунт покупця та його вподобання.`))return;
 const {error}=await sb.rpc('admin_delete_customer_v131',{p_user_id:id});
 if(error){console.error(error);return toast('Не вдалося видалити профіль: '+error.message)}
 toast('Профіль видалено');
 await loadCustomers()
}
window.deleteCustomerProfile=deleteCustomerProfile;


function applyCustomerFilters(){
 const q=($('customerSearch')?.value||'').toLowerCase().trim();
 const list=!q?customers:customers.filter(c=>
   [c.first_name,c.last_name,c.full_name,c.email,c.phone,c.city,c.delivery_address].filter(Boolean).join(' ').toLowerCase().includes(q)
 );
 renderCustomers(list)
}
window.loadCustomers=loadCustomers;


// V190 Journal category manager
document.addEventListener('click',e=>{
 if(e.target.closest('#addJournalCategoryBtn')) openJournalCategoryModal();
 if(e.target.closest('#saveJournalCategoryBtn')) addJournalCategory();
 if(e.target.closest('[data-close-journal-category]')) closeJournalCategoryModal();
 const del=e.target.closest('[data-journal-category-delete]');
 if(del) deleteJournalCategory(del.dataset.journalCategoryDelete);
});
document.addEventListener('keydown',e=>{
 if(e.key==='Escape' && $('journalCategoryModal') && !$('journalCategoryModal').hidden) closeJournalCategoryModal();
 if(e.key==='Enter' && e.target && e.target.id==='newJournalCategoryName'){
   e.preventDefault(); addJournalCategory();
 }
});


// V191 — restore the last opened admin section after a browser refresh.
window.addEventListener('load',()=>{
  setTimeout(()=>{
    try{
      const last=localStorage.getItem('vh_admin_last_section');
      if(last && document.getElementById(last)) showSection(last);
    }catch(_){}
  },0);
});


/* ==========================================================
   V205 — unified accordion + section saving for site pages
   ========================================================== */
(function(){
  function wrapSection(section){
    if(!section || section.classList.contains('v205-builder-section')) return;
    const head=section.querySelector(':scope > .panel-head');
    if(!head) return;

    section.classList.add('v205-builder-section');

    let body=document.createElement('div');
    body.className='v205-builder-body';
    [...section.children].filter(n=>n!==head).forEach(n=>body.appendChild(n));
    section.appendChild(body);

    const toggle=document.createElement('span');
    toggle.className='page-builder-toggle-v205';
    toggle.textContent='−';
    head.appendChild(toggle);

    const doToggle=()=>{
      const collapsed=section.classList.toggle('is-collapsed');
      toggle.textContent=collapsed?'+':'−';
    };
    head.setAttribute('role','button');
    head.setAttribute('tabindex','0');
    head.addEventListener('click',e=>{
      if(e.target.closest('button,a,input,select,textarea,label')) return;
      doToggle();
    });
    head.addEventListener('keydown',e=>{
      if((e.key==='Enter'||e.key===' ') && e.target===head){
        e.preventDefault();doToggle();
      }
    });
  }

  function addSaveBar(section, masterButton, label){
    const body=section.querySelector(':scope > .v205-builder-body');
    if(!body || body.querySelector(':scope > .v205-section-savebar')) return;

    const bar=document.createElement('div');
    bar.className='v205-section-savebar';
    bar.innerHTML='<span class="v205-section-status">Зміни збережені</span><button class="btn primary v205-section-save" type="button">'+label+'</button>';
    body.appendChild(bar);

    const status=bar.querySelector('.v205-section-status');
    const btn=bar.querySelector('.v205-section-save');

    const dirty=()=>{
      status.classList.remove('is-saving');
      status.classList.add('is-dirty');
      status.textContent='Є незбережені зміни';
    };
    body.querySelectorAll('input,textarea,select').forEach(el=>{
      el.addEventListener(el.type==='file'?'change':'input',dirty);
      if(el.tagName==='SELECT')el.addEventListener('change',dirty);
    });

    btn.addEventListener('click',async()=>{
      const master=document.getElementById(masterButton);
      if(!master){ return; }
      btn.disabled=true;
      status.classList.remove('is-dirty');
      status.classList.add('is-saving');
      status.textContent='Збереження...';
      master.click();

      /* Existing handlers are async but do not expose their promise.
         Watch the master button state and mirror completion. */
      const started=Date.now();
      const timer=setInterval(()=>{
        if(!master.disabled && Date.now()-started>150){
          clearInterval(timer);
          btn.disabled=false;
          status.classList.remove('is-saving','is-dirty');
          status.textContent='Зміни збережені';
        }
        if(Date.now()-started>30000){
          clearInterval(timer);btn.disabled=false;
        }
      },120);
    });
  }

  function initPage(pageId, masterButton, saveLabel){
    const page=document.getElementById(pageId);
    if(!page)return;
    const sections=[...page.querySelectorAll('.home-admin-stack > .home-admin-section')];
    sections.forEach((section,index)=>{
      wrapSection(section);
      addSaveBar(section,masterButton,saveLabel);
      if(index>0){
        section.classList.add('is-collapsed');
        const t=section.querySelector('.page-builder-toggle-v205');
        if(t)t.textContent='+';
      }
    });
  }

  document.addEventListener('DOMContentLoaded',()=>{
    /* V206: replaced by stable accordion */
    /* V206: replaced by stable accordion */
  });
})();


/* ==========================================================
   V206 — targeted admin QA fixes
   ========================================================== */
(function(){
  function stableBuilder(pageId, masterButtonId){
    const page=document.getElementById(pageId);
    if(!page)return;
    const sections=[...page.querySelectorAll('.home-admin-stack > .home-admin-section')];
    sections.forEach((section,index)=>{
      /* Undo any V205 runtime wrappers if a browser cache happens to run both. */
      const oldBody=section.querySelector(':scope > .v205-builder-body');
      if(oldBody){
        [...oldBody.children].forEach(n=>section.appendChild(n));
        oldBody.remove();
      }
      section.querySelectorAll(':scope > .panel-head .page-builder-toggle-v205').forEach(n=>n.remove());
      section.classList.remove('v205-builder-section','is-collapsed');

      const head=section.querySelector(':scope > .panel-head');
      if(!head)return;

      const body=document.createElement('div');
      body.className='v206-builder-body';
      [...section.children].filter(n=>n!==head).forEach(n=>body.appendChild(n));
      section.appendChild(body);

      const toggle=document.createElement('button');
      toggle.type='button';
      toggle.className='v206-builder-toggle';
      toggle.setAttribute('aria-label','Розгорнути або згорнути блок');
      head.appendChild(toggle);

      const setOpen=(open)=>{
        section.classList.toggle('v206-open',open);
        toggle.textContent=open?'−':'+';
        toggle.setAttribute('aria-expanded',String(open));
      };
      setOpen(index===0);
      toggle.addEventListener('click',e=>{e.stopPropagation();setOpen(!section.classList.contains('v206-open'))});
      head.addEventListener('click',e=>{
        if(e.target.closest('button,a,input,select,textarea,label'))return;
        setOpen(!section.classList.contains('v206-open'));
      });

      /* One clean save bar per section. */
      body.querySelectorAll(':scope > .v205-section-savebar').forEach(n=>n.remove());
      const existingGlobal=body.querySelector(':scope > .form-actions #'+masterButtonId);
      if(existingGlobal) existingGlobal.closest('.form-actions').classList.add('v206-master-save-hidden');

      const bar=document.createElement('div');
      bar.className='v206-savebar';
      bar.innerHTML='<span class="v206-save-status">Зміни збережені</span><button class="btn primary v206-save-btn" type="button">ЗБЕРЕГТИ БЛОК</button>';
      body.appendChild(bar);
      const status=bar.querySelector('.v206-save-status');
      const save=bar.querySelector('.v206-save-btn');

      const dirty=()=>{
        status.textContent='Є незбережені зміни';
        status.classList.add('dirty');
      };
      body.querySelectorAll('input,textarea,select').forEach(el=>{
        el.addEventListener('input',dirty);
        el.addEventListener('change',dirty);
      });
      save.addEventListener('click',()=>{
        const master=document.getElementById(masterButtonId);
        if(!master)return;
        save.disabled=true;status.textContent='Збереження...';status.classList.remove('dirty');
        master.click();
        const t0=Date.now();
        const watcher=setInterval(()=>{
          if((!master.disabled && Date.now()-t0>200)||Date.now()-t0>30000){
            clearInterval(watcher);save.disabled=false;status.textContent='Зміни збережені';
          }
        },120);
      });
    });
  }

  function removeDuplicateArticleDeleteButtons(){
    /* Keep the explicit overlay delete control and hide/remove any duplicate injected into preview wrappers. */
    document.querySelectorAll('#newsForm .gallery-remove, #newsForm .image-remove, #newsForm .preview-remove, #newsForm [data-remove-image]').forEach((btn)=>{
      const preview=btn.closest('.gallery-item,.preview-item,.image-preview,.news-image-preview');
      if(preview){
        const all=[...preview.querySelectorAll('.gallery-remove,.image-remove,.preview-remove,[data-remove-image],button')].filter(b=>{
          const txt=(b.textContent||'').trim();
          return txt==='×'||txt==='✕'||txt==='X'||b.matches('.gallery-remove,.image-remove,.preview-remove,[data-remove-image]');
        });
        all.slice(1).forEach(x=>x.remove());
      }
    });
  }

  document.addEventListener('DOMContentLoaded',()=>{
    stableBuilder('homepage','saveHomepageTextBtn');
    stableBuilder('deliveryPage','saveDeliveryPageBtn');
    stableBuilder('contactsPage','saveContactsPageBtn');
    setTimeout(removeDuplicateArticleDeleteButtons,500);
  });

  /* Article previews are re-rendered after file changes. */
  document.addEventListener('change',e=>{
    if(e.target.closest('#newsForm'))setTimeout(removeDuplicateArticleDeleteButtons,120);
  });
})();

/* V209 — save order TTN/admin note automatically when modal closes */
(function(){
  async function persistOpenOrderMetaV209(){
    const modal=document.getElementById('orderModal');
    const id=modal?.dataset?.id;
    if(!id || typeof sb==='undefined')return;
    const ttn=document.getElementById('odTtn')?.value?.trim()||null;
    const admin_note=document.getElementById('odAdminNote')?.value?.trim()||null;
    try{
      await sb.from('orders').update({ttn,admin_note}).eq('id',id);
    }catch(e){console.error(e)}
  }
  const original=window.closeOrderModal;
  if(typeof original==='function'){
    window.closeOrderModal=async function(){
      await persistOpenOrderMetaV209();
      return original.apply(this,arguments);
    }
  }
})();
