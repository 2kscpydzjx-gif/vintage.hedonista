(()=>{'use strict';
const $=id=>document.getElementById(id);
const cloud=window.supabase&&window.VH_CONFIG?window.supabase.createClient(VH_CONFIG.supabaseUrl,VH_CONFIG.supabaseKey,{auth:{persistSession:true,autoRefreshToken:true,storage:window.localStorage,storageKey:'vintage-hedonista-admin-auth'}}):null;
const reviewOnly=location.hostname.endsWith('.vercel.app');
let cloudReady=false;
const revisionTokens=new Map(),remoteDrafts=new Map();
const draftStore=window.VHCMSDraftStore.create(localStorage);
let hydrating=false,cloudOperation=false,pageLoadEpoch=0,uploadsInFlight=0;
const histories=new Map();let restoringHistory=false;
function rememberHistory(){if(restoringHistory)return;const value=pageSnapshot(),text=stableCmsJSON(value),h=histories.get(pageId);if(!h){histories.set(pageId,{current:value,past:[],future:[]});return}if(stableCmsJSON(h.current)===text)return;h.past.push(h.current);h.past=h.past.slice(-60);h.current=structuredClone(value);h.future=[];}
function moveHistory(direction){if(cloudOperation||uploadsInFlight)return;const h=histories.get(pageId);if(!h)return;const source=direction==='undo'?h.past:h.future,dest=direction==='undo'?h.future:h.past;if(!source.length)return;dest.push(h.current);h.current=source.pop();restoringHistory=true;try{draftStore.restore(pageId,h.current);draftStore.touch(pageId);restoreVisibleState();$('status').textContent=direction==='undo'?'Останню зміну скасовано':'Зміну повторено';}finally{restoringHistory=false}}
window.VHCMSHistory={undo:()=>moveHistory('undo'),redo:()=>moveHistory('redo')};

function markDirty(){if(!hydrating){rememberHistory();draftStore.touch(pageId);$('status').textContent='Зміни збережено в цьому браузері · є незбережена серверна чернетка';}syncCloudButtons()}
function syncCloudButtons(){const blocked=!cloudReady||cloudOperation||uploadsInFlight>0||!revisionTokens.has(pageId==='shared'?'home':pageId)||draftStore.meta(pageId).conflict;$('save').disabled=blocked;$('publish').disabled=blocked||reviewOnly;if(reviewOnly)$('publish').title='Публікацію вимкнено в тестовій версії';}
function pageSnapshot(page=pageId){return draftStore.snapshot(page)}
function downloadJSON(value,name){const url=URL.createObjectURL(new Blob([JSON.stringify(value,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500)}
function restoreVisibleState(){blocks=getBlocks();selected=blocks[0]?.id||null;selectedExisting=null;render();loadLivePage()}
function installRecoveryActions(){
 const host=document.createElement('div');host.className='cms-recovery-actions';
 const backup=document.createElement('button');backup.type='button';backup.className='secondary';backup.textContent='Резервна копія';backup.id='cmsBackup';
 backup.onclick=async()=>{backup.disabled=true;try{let revisions=[];if(cloudReady){const result=await cloud.from('vh_page_revisions').select('page_key,revision_status,blocks,shared,updated_at');if(result.error)throw result.error;revisions=result.data||[]}downloadJSON({format:'vh-cms-backup',version:1,exportedAt:new Date().toISOString(),local:draftStore.exportLocal(),revisions},'vintage-hedonista-cms-backup-'+Date.now()+'.json');$('status').textContent=cloudReady?'Резервну копію локальних даних і серверних версій завантажено':'Локальну копію завантажено. Для копії серверних версій увійдіть в адмінку.'}catch(e){downloadJSON({format:'vh-cms-backup',version:1,local:draftStore.exportLocal(),serverError:e.message},'vintage-hedonista-local-backup-'+Date.now()+'.json');$('status').textContent='Завантажено локальну копію. Серверні дані не отримано: '+e.message}finally{backup.disabled=false}};
 const server=document.createElement('button');server.type='button';server.className='secondary';server.textContent='Завантажити серверну чернетку';server.id='cmsUseServer';
 server.onclick=async()=>{if(!cloudReady||cloudOperation||uploadsInFlight)return;const page=pageId,key=page==='shared'?'home':page;try{const result=await cloud.from('vh_page_revisions').select('blocks,shared,updated_at').eq('page_key',key).eq('revision_status','draft').maybeSingle();if(result.error)throw result.error;if(pageId!==page)return;if(!confirm('Завантажити серверну версію? Поточні локальні зміни залишаться в резервній копії цього браузера.'))return;draftStore.useServer(page,result.data);revisionTokens.set(key,result.data?.updated_at||null);restoreVisibleState();syncCloudButtons();$('status').textContent='Серверну чернетку завантажено. Попередні локальні зміни збережено в резервній копії.'}catch(e){$('status').textContent=e.message}};
 const local=document.createElement('button');local.type='button';local.className='secondary';local.textContent='Працювати з локальною версією';local.id='cmsKeepLocal';
 local.onclick=async()=>{if(!cloudReady||cloudOperation||uploadsInFlight)return;const page=pageId,key=page==='shared'?'home':page;try{const result=await cloud.from('vh_page_revisions').select('blocks,shared,updated_at').eq('page_key',key).eq('revision_status','draft').maybeSingle();if(result.error)throw result.error;if(page!==pageId)return;draftStore.backup(page,'keep-local-version',result.data);localStorage.setItem(window.VHCMSDraftStore.keys(page).meta,JSON.stringify({loaded:true,dirty:true,base:result.data?.updated_at||null,conflict:false}));revisionTokens.set(key,result.data?.updated_at||null);remoteDrafts.set(page,result.data);syncCloudButtons();$('status').textContent='Вибрано локальні зміни. Серверну версію збережено в резервній копії. Натисніть «Зберегти чернетку», щоб замінити її.'}catch(e){$('status').textContent=e.message}};
 const recovery=document.createElement('details');recovery.className='cms-recovery-history';const summary=document.createElement('summary');summary.textContent='Відновлення змін';recovery.append(summary,server,local);
 const versions=document.createElement('select');versions.setAttribute('aria-label','Попередні локальні версії');
 const refreshVersions=()=>{versions.replaceChildren();const entries=JSON.parse(localStorage.getItem('vh-cms-recovery-v1-'+pageId)||'[]');entries.forEach((entry,i)=>versions.add(new Option(new Date(entry.at).toLocaleString('uk-UA')+' · '+({'before-server-load':'Перед завантаженням','before-server-save':'Перед збереженням','before-publish':'Перед публікацією','before-page-switch':'Перед зміною сторінки','before-import':'Перед імпортом','before-recovery':'Перед відновленням','use-server-version':'Перед вибором серверної версії','keep-local-version':'Перед вибором локальної версії','concurrent-server-change':'Зміна іншого адміністратора'}[entry.reason]||'Локальна копія'),String(i))));};
 recovery.addEventListener('toggle',()=>{if(recovery.open)refreshVersions()});
 const restore=document.createElement('button');restore.type='button';restore.textContent='Відновити вибрану версію';restore.onclick=()=>{if(uploadsInFlight||cloudOperation)return;const entries=JSON.parse(localStorage.getItem('vh-cms-recovery-v1-'+pageId)||'[]'),value=entries[Number(versions.value)]?.local;if(!value)return;draftStore.backup(pageId,'before-recovery');draftStore.restore(pageId,value);draftStore.touch(pageId);restoreVisibleState();$('status').textContent='Локальну версію відновлено · серверна чернетка не змінена';};
 const importButton=document.createElement('button');importButton.type='button';importButton.textContent='Імпортувати резервну копію';const input=document.createElement('input');input.type='file';input.accept='application/json,.json';input.hidden=true;importButton.onclick=()=>input.click();input.onchange=async()=>{if(!input.files[0]||uploadsInFlight||cloudOperation)return;const page=pageId;try{const data=JSON.parse(await input.files[0].text());if(data.format!=='vh-cms-backup'||data.version!==1)throw Error('Непідтримуваний формат резервної копії');if(page!==pageId)return;const k=window.VHCMSDraftStore.keys(page);let value;if(data.local){const local=data.local;value=page==='shared'&&local[sharedStorageKey]?{shared:local[sharedStorageKey]}:Array.isArray(local[k.blocks])?{blocks:local[k.blocks],existing:local[k.existing]||{},order:local[k.order]||[]}:null;}if(!value){const revision=data.revisions?.find(r=>r.page_key===(page==='shared'?'home':page)&&r.revision_status==='draft');if(revision)value=draftStore.fromRevision(page,revision);else{const published=data.revisions?.find(r=>r.page_key===(page==='shared'?'home':page)&&r.revision_status==='published');if(published)value=draftStore.fromRevision(page,published)}}if(!value)throw Error('У копії немає даних для вибраної сторінки');draftStore.backup(page,'before-import');draftStore.restore(page,value);draftStore.touch(page);restoreVisibleState();$('status').textContent='Дані вибраної сторінки відновлено з копії · збережіть чернетку після перевірки';}catch(e){$('status').textContent='Помилка імпорту: '+e.message}finally{input.value=''}};
 recovery.append(versions,restore,importButton,input);host.append(backup,recovery);$('existingBlocks').before(host);
 window.addEventListener('beforeunload',e=>{if(draftStore.meta(pageId).dirty||uploadsInFlight){e.preventDefault();e.returnValue=''}});
}

function backupLocalDraft(){
 const snapshot={page:pageId,savedAt:new Date().toISOString(),blocks:pageId==='shared'?[]:blocks,existing:pageId==='shared'?{}:readExisting(),order:pageId==='shared'?[]:mergedOrder(),shared:pageId==='shared'?sharedDraft():null};
 const blob=new Blob([JSON.stringify(snapshot,null,2)],{type:'application/json'});
 const url=URL.createObjectURL(blob);
 const link=document.createElement('a');link.href=url;link.download='vintage-hedonista-'+pageId+'-backup-'+new Date().toISOString().slice(0,19).replace(/:/g,'-')+'.json';
 document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);
}
function conflictError(){backupLocalDraft();return Error('Інший адміністратор зберіг новішу чернетку. Ваші зміни не перезаписані; резервну копію JSON завантажено. Оновіть сторінку, щоб побачити актуальну версію.');}

async function requireAdmin(){
 if(!cloud)throw Error('Не вдалося завантажити Supabase');
 const {data:{session},error}=await cloud.auth.getSession();
 if(error||!session)throw Error('Потрібно увійти в адмінку');
 const check=await cloud.rpc('is_admin');
 if(check.error||check.data!==true)throw Error('Немає прав адміністратора');
 cloudReady=true;
}
async function loadCloudDraft(){
 if(!cloudReady)return;
 const requestedPage=pageId,epoch=++pageLoadEpoch,key=requestedPage==='shared'?'home':requestedPage;
 revisionTokens.delete(key);syncCloudButtons();
 let {data,error}=await cloud.from('vh_page_revisions').select('blocks,shared,updated_at').eq('page_key',key).eq('revision_status','draft').maybeSingle();
 if(error)throw error;
 if(pageId!==requestedPage||epoch!==pageLoadEpoch)return;
 // If no draft exists, start from the publication rather than empty/demo blocks.
 const draftToken=data?.updated_at||null;
 if(!data){const published=await cloud.from('vh_page_revisions').select('blocks,shared,updated_at').eq('page_key',key).eq('revision_status','published').maybeSingle();if(published.error)throw published.error;data=published.data?{...published.data,updated_at:null}:null;}
 if(pageId!==requestedPage||epoch!==pageLoadEpoch)return;
 remoteDrafts.set(requestedPage,data);
 hydrating=true;
 let result;
 try{result=draftStore.hydrate(requestedPage,data);revisionTokens.set(key,result.token??draftToken);blocks=getBlocks();selected=blocks[0]?.id||null;histories.set(pageId,{current:pageSnapshot(),past:[],future:[]});render();
 const doc=frame.contentDocument;if(doc&&doc.readyState!=='loading'&&livePage===pageId){detectSections(doc);applyExistingDrafts();applyImageDrafts()}scheduleLivePreview();}
 finally{hydrating=false;syncCloudButtons()}
 $('status').textContent=result.conflict?'Серверна чернетка змінилася. Ваші локальні зміни збережено. Завантажте резервну копію та виберіть серверну версію для продовження.':result.recovered?'Відновлено локальні зміни попереднього редактора. Серверну версію також збережено в резервній копії.':'Чернетку завантажено · зміни сайту застосовуються після публікації';
}
function stableCmsJSON(value){return JSON.stringify(value,(key,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.entries(v).sort(([a],[b])=>a.localeCompare(b))):v)}
function assertCmsRevision(actual,expected,label){
 if(!actual||stableCmsJSON(actual.blocks||[])!==stableCmsJSON(expected.blocks||[])||
 stableCmsJSON(actual.shared||{})!==stableCmsJSON(expected.shared||{})){
  backupLocalDraft();
  throw Error(label+' не пройшла перевірку. Дані не підтверджені сервером; резервну копію JSON завантажено.');
 }
}
async function verifyCmsRevision(key,status,expected){
 const {data,error}=await cloud.from('vh_page_revisions').select('blocks,shared').eq('page_key',key).eq('revision_status',status).single();
 if(error)throw error;
 assertCmsRevision(data,expected,status==='draft'?'Чернетка':'Публікація');
}
async function saveCloudDraft(){
 if(!cloudReady)throw Error('Немає з’єднання з адмінкою');
 if(uploadsInFlight)throw Error('Дочекайтеся завершення завантаження фотографій');
 const page=pageId,key=page==='shared'?'home':page;
 if(!revisionTokens.has(key))throw Error('Дочекайтеся завантаження чернетки з Supabase.');
 if(draftStore.meta(page).conflict)throw Error('Спочатку узгодьте локальну й серверну версії.');
 const expected=revisionTokens.get(key),snapshot=structuredClone(pageSnapshot(page));
 // Capture the page and all inputs BEFORE awaiting. Navigation cannot change this write.
 const {data:old,error:readError}=await cloud.from('vh_page_revisions').select('blocks,shared,updated_at').eq('page_key',key).eq('revision_status','draft').maybeSingle();
 if(readError)throw readError;
 if((old?.updated_at||null)!==expected){draftStore.backup(page,'concurrent-server-change',old);throw Error('Інший адміністратор змінив чернетку. Ваші зміни збережено локально. Завантажте серверну версію або резервну копію.');}
 draftStore.backup(page,'before-server-save',old);
 const base=old||remoteDrafts.get(page)||{};
 const {cmsPageDraft:ignoredPageDraft,...shellValues}=snapshot.shared||{};void ignoredPageDraft;
 const savedShared=page==='shared'?{...(base.shared||{}),...shellValues}:{...(base.shared||{}),cmsPageDraft:{...(base.shared?.cmsPageDraft||{}),existing:snapshot.existing,order:snapshot.order}};
 const payload={page_key:key,revision_status:'draft',blocks:page==='shared'?(base.blocks||[]):snapshot.blocks,shared:savedShared,updated_at:new Date().toISOString()};
 let token;
 if(old){const result=await cloud.from('vh_page_revisions').update(payload).eq('page_key',key).eq('revision_status','draft').eq('updated_at',expected).select('updated_at');if(result.error)throw result.error;if(!result.data?.length)throw Error('Чернетку змінено паралельно. Локальні зміни збережено.');token=result.data[0].updated_at;}
 else{const result=await cloud.from('vh_page_revisions').insert(payload).select('updated_at');if(result.error)throw result.error;token=result.data?.[0]?.updated_at||payload.updated_at;}
 await verifyCmsRevision(key,'draft',payload);
 remoteDrafts.set(page,payload);revisionTokens.set(key,token);const dirty=draftStore.saved(page,snapshot,token);
 if(pageId===page)$('status').textContent=dirty?'Серверну чернетку збережено · є нові локальні зміни':'Чернетку збережено й перевірено на сервері · сайт не опубліковано';
 return {page,key,payload};
}
async function publishCloudPage(){
 if(reviewOnly)throw Error('Публікацію вимкнено в тестовій версії. Використовуйте основну адмінку після приймання змін.');
 if(!cloudReady)throw Error('Немає прав адміністратора');
 const requestedPage=pageId;
 if(!confirm('Опублікувати поточні зміни цієї сторінки? Попередню версію буде збережено в резервній копії браузера.'))return;
 const saved=await saveCloudDraft();
 if(saved.page!==requestedPage)throw Error('Сторінка змінилася. Повторіть публікацію.');
 const previous=await cloud.from('vh_page_revisions').select('blocks,shared,updated_at').eq('page_key',saved.key).eq('revision_status','published').maybeSingle();
 if(previous.error)throw previous.error;
 draftStore.backup(saved.page,'before-publish',previous.data);
 const published={...saved.payload,revision_status:'published',updated_at:new Date().toISOString(),published_at:new Date().toISOString()};
 let result;if(previous.data){result=await cloud.from('vh_page_revisions').update(published).eq('page_key',saved.key).eq('revision_status','published').eq('updated_at',previous.data.updated_at).select('updated_at');if(!result.error&&!result.data?.length)throw Error('Публікація змінилася паралельно. Повторіть після перевірки серверної версії.');}else result=await cloud.from('vh_page_revisions').insert(published);if(result.error)throw result.error;
 await verifyCmsRevision(saved.key,'published',published);
 if(pageId===saved.page)$('status').textContent='Публікацію перевірено на сервері · сторінку оновлено';
}
async function loadPageSeo(){
 const panel=$('pageSeoPanel');if(panel)panel.hidden=pageId==='shared';
 if(pageId==='shared'||!cloudReady)return;
 $('cmsSeoTitle').value='';$('cmsSeoDescription').value='';$('cmsSeoStatus').textContent='Завантаження SEO…';
 const key=pageId;
 const {data,error}=await cloud.from('vh_seo_metadata').select('seo_title,meta_description').eq('entity_type','page').eq('entity_id',key).maybeSingle();
 if(pageId!==key)return;
 if(error){$('cmsSeoStatus').textContent='Помилка: '+error.message;return}
 $('cmsSeoTitle').value=data?.seo_title||'';$('cmsSeoDescription').value=data?.meta_description||'';$('cmsSeoStatus').textContent='SEO завантажено';
}
async function savePageSeo(){
 if(!cloudReady||pageId==='shared')return;
 const key=pageId;
 $('cmsSeoStatus').textContent='Збереження…';
 const {error}=await cloud.from('vh_seo_metadata').upsert({entity_type:'page',entity_id:key,seo_title:$('cmsSeoTitle').value.trim(),meta_description:$('cmsSeoDescription').value.trim()},{onConflict:'entity_type,entity_id'});
 $('cmsSeoStatus').textContent=error?'Помилка: '+error.message:'SEO сторінки збережено';
}
$('cmsSeoSave').addEventListener('click',()=>void savePageSeo());
async function switchCloudPage(){
 const requested=pageId;void loadPageSeo();
 try{await loadCloudDraft()}catch(e){if(pageId===requested)$('status').textContent='Не вдалося завантажити чернетку: '+e.message}
}

const pages=[
{id:'home',name:'Головна сторінка',description:'HERO, надходження, капсули та редакційні блоки',url:'index.html',editor:'homepage'},
{id:'catalog',name:'Каталог',description:'Оформлення каталогу; товари редагуються окремо',url:'catalog.html',editor:'categories'},
{id:'capsules',name:'Капсули',description:'Головна сторінка капсул',url:'capsule.html',editor:'capsules'},
{id:'about',name:'Про нас',description:'Редакційні блоки, фотографії та текст',url:'about.html',editor:'aboutPage'},
{id:'journal',name:'Журнал',description:'Вінтажні хроніки та анонси статей',url:'journal.html',editor:'news'},
{id:'delivery',name:'Доставка і оплата',description:'Інформаційні блоки та умови доставки',url:'delivery.html',editor:'delivery'},
{id:'contacts',name:'Контакти',description:'Контактна інформація та текстові блоки',url:'contacts.html',editor:'contacts'},
{id:'shared',name:'Шапка та підвал · усі сторінки',description:'Спільне оформлення, навігація, текст підвалу та соцмережі',url:'index.html',editor:'settings'}
];
const sharedStorageKey='vh-cms-shared-shell-step71';
function sharedDraft(){try{return {...JSON.parse(localStorage.getItem(sharedStorageKey)||'{}')}}catch{return {}}}
function saveShared(d){localStorage.setItem(sharedStorageKey,JSON.stringify(d));markDirty()}
function applySharedPreview(doc){
 const d=sharedDraft();
 const header=doc.querySelector('body > header'),footer=doc.querySelector('footer.site-footer-v64,body > footer');
 if(header){const logo=header.querySelector('.vh-header-logo,.brand img');if(logo&&d.headerLogo)logo.src=d.headerLogo;
 const nav=header.querySelector('nav.nav,nav');if(nav){[...nav.querySelectorAll('a')].forEach((a,i)=>{const n=d.nav?.[String(i)];if(!n)return;if(n.label)a.textContent=n.label;if(n.href)a.href=n.href})}}
 if(footer){const logo=footer.querySelector('.vh-footer-logo-img,.footer-v64-logo img');if(logo&&d.footerLogo)logo.src=d.footerLogo;
 const text=footer.querySelector('.footer-v64-center p,.footer-v64-center');if(text&&typeof d.footerText==='string')text.textContent=d.footerText;
 const copyright=footer.querySelector('.footer-v64-copy');if(copyright&&typeof d.footerCopyright==='string')copyright.textContent=d.footerCopyright;
 const ig=footer.querySelector('[data-footer-instagram]'),tg=footer.querySelector('[data-footer-telegram]');
 if(ig&&d.instagram)ig.href=d.instagram;if(tg&&d.telegram)tg.href=d.telegram;
 }
}
function renderSharedEditor(){
 let previewDoc;try{previewDoc=frame.contentDocument}catch{}
 const display={headerLogo:previewDoc?.querySelector('.vh-header-logo')?.src||'',footerLogo:previewDoc?.querySelector('.vh-footer-logo-img')?.src||'',footerText:previewDoc?.querySelector('.footer-v64-center p,.footer-v64-center')?.textContent||'',footerCopyright:previewDoc?.querySelector('.footer-v64-copy')?.textContent||''};
 const host=$('sharedEditor');if(!host)return;const inspector=$('existingEditor')?.parentElement;if(inspector&&host.parentElement!==inspector)inspector.append(host);host.replaceChildren();const d=sharedDraft();
 const title=document.createElement('h3');title.textContent='ШАПКА ТА ПІДВАЛ';host.append(title);
 const note=document.createElement('p');note.className='muted';note.textContent='Один набір налаштувань для всіх сторінок. Зміни видно в прев’ю одразу; на сайті — після «Зберегти чернетку» та «Опублікувати».';host.append(note);
 const add=(label,key,placeholder,kind='text')=>{const box=document.createElement('div');box.className='field';const lab=document.createElement('label');lab.textContent=label;const inp=document.createElement(kind==='textarea'?'textarea':'input');inp.value=d[key]??display[key]??'';inp.placeholder=placeholder||'';inp.addEventListener('input',()=>{const next=sharedDraft();next[key]=inp.value;saveShared(next);updateLivePreview()});inp.addEventListener('change',()=>{if((key==='instagram'||key==='telegram')&&inp.value&&!safeLink(inp.value,false)){inp.setCustomValidity('Вкажіть повне посилання https://');inp.reportValidity();return}inp.setCustomValidity('')});box.append(lab,inp);if(key==='headerLogo'||key==='footerLogo'){const file=cmsPhotoUploadField(async file=>{const url=await uploadExistingCmsPhoto(file,key);const next=sharedDraft();next[key]=url;saveShared(next);inp.value=url;updateLivePreview()},'image/jpeg,image/png,image/webp,image/avif');file.hidden=true;const upload=document.createElement('button');upload.type='button';upload.textContent='Завантажити логотип';upload.onclick=()=>file.click();box.append(upload,file)}host.append(box);return inp};
 const sub=document.createElement('h3');sub.textContent='ВЕРХНЯ ШАПКА';host.append(sub);
 add('ЛОГОТИП У ШАПЦІ · URL / ШЛЯХ','headerLogo','assets/your-logo.webp');
 const navTitle=document.createElement('p');navTitle.className='muted';navTitle.textContent='Пункти меню (назва і адреса)';host.append(navTitle);
 const navDefaults=[['ГОЛОВНА','index.html'],['КАТАЛОГ','catalog.html'],['ПРО НАС','about.html'],['ЖУРНАЛ','journal.html'],['ДОСТАВКА І ОПЛАТА','delivery.html'],['КОНТАКТИ','contacts.html']];
 navDefaults.forEach(([label,url],i)=>{const row=document.createElement('div');row.className='cms-nav-edit';const name=document.createElement('input');name.value=d.nav?.[String(i)]?.label||label;name.setAttribute('aria-label','Назва '+label);const link=document.createElement('input');link.value=d.nav?.[String(i)]?.href||url;link.setAttribute('aria-label','Адреса '+label);const change=()=>{link.setCustomValidity('');const next=sharedDraft();next.nav={...(next.nav||{}),[String(i)]:{label:name.value,href:link.value}};saveShared(next);updateLivePreview()};name.addEventListener('input',change);link.addEventListener('input',change);row.append(name,link);host.append(row)});
 const foot=document.createElement('h3');foot.textContent='ПІДВАЛ САЙТУ';host.append(foot);
 add('ЛОГОТИП У ПІДВАЛІ · URL / ШЛЯХ','footerLogo','assets/your-logo.webp');
 add('ОПИС БРЕНДУ','footerText','Вінтажний одяг з історією, відібраний зі смаком.','textarea');
 add('КОПІРАЙТ У ПІДВАЛІ','footerCopyright','© 2026 Vintage Hedonista');
 const socialTitle=document.createElement('p');socialTitle.className='muted';socialTitle.textContent='КНОПКИ СОЦМЕРЕЖ · URL ПОЧИНАЄТЬСЯ З HTTPS://';host.append(socialTitle);
 const instagram=add('ПОСИЛАННЯ INSTAGRAM','instagram','https://www.instagram.com/...');
 const telegram=add('ПОСИЛАННЯ TELEGRAM','telegram','https://t.me/...');
 for(const input of [instagram,telegram])input.addEventListener('change',()=>{if(input.value&&!safeLink(input.value,false)){input.setCustomValidity('Вкажіть повне посилання https://');input.reportValidity()}else input.setCustomValidity('')});
 const previewActions=document.createElement('div');previewActions.className='vh-shared-preview-actions';
 for(const [label,selector] of [['Переглянути шапку','body > header'],['Переглянути підвал','footer.site-footer-v64,body > footer']]){
  const button=document.createElement('button');button.type='button';button.className='secondary';button.textContent=label;
  button.onclick=()=>{try{const target=frame.contentDocument?.querySelector(selector);target?.scrollIntoView({behavior:'smooth',block:'start'})}catch{}};
  previewActions.append(button);
 }
 host.append(previewActions);
 const reset=document.createElement('button');reset.className='secondary';reset.textContent='Скинути спільні налаштування';reset.onclick=()=>{if(confirm('Скинути спільну локальну чернетку шапки й підвалу?')){draftStore.backup(pageId,'before-shell-reset');localStorage.removeItem(sharedStorageKey);markDirty();renderSharedEditor();frame.src=frame.src}};host.append(reset);
}
function safeLink(v,relative){if(!v)return true;return relative?/^(https?:\/\/|\/|\.\.?\/|[a-z0-9_-]+\.html(?:[?#].*)?|#)/i.test(v):/^https:\/\/[^\s]+$/i.test(v)}
const animationOptions=[['system','СИСТЕМНИЙ · як на сайті'],['fade-up','Плавна поява знизу'],['fade-left','Поява зліва'],['fade-right','Поява справа'],['zoom','Легкий зум'],['fade','Плавна поява'],['none','Без анімації']];
const systemAnimation='fade-up';
function actualAnimation(v){return !v||v==='system'?systemAnimation:v}
const pageFromUrl=new URLSearchParams(location.search).get('page');
let pageId=pages.some(p=>p.id===pageFromUrl)?pageFromUrl:(sessionStorage.getItem('vh-cms-active-page')||'home');
if(!pages.some(p=>p.id===pageId))pageId='home';
const storageKey=()=>pageId==='home'?'vh-cms-lab-step55-v1':'vh-cms-lab-step56-'+pageId;
const getBlocks=()=>{try{const x=JSON.parse(localStorage.getItem(storageKey()));return Array.isArray(x)?x:(pageId==='home'?structuredClone(defaults):[])}catch{return pageId==='home'?structuredClone(defaults):[]}};
const defaults=[];
let blocks=getBlocks(),selected=blocks[0]?.id||null;
function renderPages(){const shared=pageId==='shared';document.body.classList.toggle('cms-shared-mode',shared);if(shared)renderSharedEditor();const wrap=$('pageNav');wrap.replaceChildren();pages.forEach(p=>{const btn=document.createElement('button');btn.className='nav'+(p.id===pageId?' active':'');btn.textContent=p.name;btn.onclick=()=>{if(p.id===pageId)return;if(uploadsInFlight||cloudOperation){$('status').textContent='Дочекайтеся завершення збереження або завантаження фото';return;}draftStore.backup(pageId,'before-page-switch');selectedExisting=null;sectionTargets=[];$('existingEditor').hidden=true;$('editorFields').hidden=false;pageId=p.id;sessionStorage.setItem('vh-cms-active-page',pageId);history.replaceState(null,'','?page='+encodeURIComponent(pageId));blocks=getBlocks();selected=blocks[0]?.id||null;render();void switchCloudPage()};wrap.append(btn)});const p=pages.find(x=>x.id===pageId);$('currentPageName').textContent=p.name;$('currentPageDescription').textContent=p.description;/* Legacy editor link removed: native CMS is the only editor. */$('publicPageLink').href='../'+p.url}
const clean=html=>window.VHCMSModel.clean(html);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const persist=()=>{try{localStorage.setItem(storageKey(),JSON.stringify(blocks));$('status').textContent='Є незбережені зміни · натисніть «Зберегти чернетку в Supabase»'}catch{$('status').textContent='Не вдалося зберегти чернетку в браузері';throw Error('Браузер не зберіг зміни. Завантажте резервну копію.')}markDirty()};
const current=()=>blocks.find(b=>b.id===selected);
function renderList(){$('blocks').replaceChildren()}
function field(label,kind,value,onchange,options){const holder=document.createElement('div');holder.className='field';const lab=document.createElement('label');lab.textContent=label;holder.append(lab);let el=document.createElement(kind==='select'?'select':kind==='textarea'?'textarea':'input');if(kind==='select')options.forEach(([v,t])=>{const opt=document.createElement('option');opt.value=v;opt.textContent=t;el.append(opt)});else if(kind==='number'){el.type='number';el.step='any'}else el.type='text';el.value=value;el.addEventListener('input',()=>onchange(el.value));holder.append(el);return holder}
function makeRichEditor(initial,onChange){
 const shell=document.createElement('div');shell.className='vh-rte';
 const heading=document.createElement('div');heading.className='vh-rte-heading';heading.innerHTML='<strong>Редактор тексту</strong>';
 const more=document.createElement('button');more.type='button';more.className='vh-rte-more';more.textContent='···';more.title='Додаткові інструменти';heading.append(more);
 const bar=document.createElement('div');bar.className='vh-rte-toolbar';
 const editor=document.createElement('div');editor.className='vh-rte-content';editor.contentEditable='true';editor.setAttribute('role','textbox');editor.setAttribute('aria-multiline','true');editor.innerHTML=clean(initial||'');
 const source=document.createElement('textarea');source.className='vh-rte-source';source.spellcheck=false;source.hidden=true;source.style.display='none';
 let htmlMode=false;
 const commit=()=>onChange(clean(htmlMode?source.value:editor.innerHTML));
 const tools=[['B','Жирний','bold'],['I','Курсив','italic'],['🔗','Додати посилання','createLink'],['↩','Прибрати посилання','unlink'],['☰','Маркований список','insertUnorderedList'],['H2','Заголовок H2','formatBlock'],['H3','Підзаголовок H3','formatBlockH3']];
 tools.forEach(([symbol,title,command])=>{const btn=document.createElement('button');btn.type='button';btn.className='vh-rte-tool';btn.textContent=symbol;
 if(command==='createLink'){btn.innerHTML='<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 13a5 5 0 0 0 7.1 0l3-3a5 5 0 0 0-7.1-7.1l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.1 0l-3 3a5 5 0 0 0 7.1 7.1l1.7-1.7"/></svg>'}
 if(command==='insertUnorderedList'){btn.innerHTML='<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" aria-hidden="true"><circle cx="4" cy="6" r="1" fill="currentColor" stroke="none"/><circle cx="4" cy="12" r="1" fill="currentColor" stroke="none"/><circle cx="4" cy="18" r="1" fill="currentColor" stroke="none"/><path d="M9 6h12M9 12h12M9 18h12"/></svg>'}
 btn.title=title;btn.setAttribute('aria-label',title);if(symbol==='I')btn.style.fontStyle='italic';btn.onmousedown=e=>e.preventDefault();btn.onclick=()=>{if(htmlMode)return;editor.focus();if(command==='createLink'){
 const sel=window.getSelection(),a=sel?.anchorNode?.parentElement?.closest('a');
 const url=prompt('Введіть URL або внутрішнє посилання:',a?.getAttribute('href')||'');if(url===null)return;
 if(!url.trim()){if(a&&editor.contains(a))a.replaceWith(...a.childNodes);commit();return}
 if(!/^(https?:\/\/|mailto:|tel:|\/(?!\/)|\.\/|\.\.\/|#)/i.test(url.trim())){alert('Некоректне посилання');return}
 if(a&&editor.contains(a))a.setAttribute('href',url.trim());else document.execCommand('createLink',false,url.trim());
 }else if(command==='unlink'){
 const sel=window.getSelection(),a=sel?.anchorNode?.parentElement?.closest('a');
 if(a&&editor.contains(a))a.replaceWith(...a.childNodes);else document.execCommand('unlink',false,null);
 }else document.execCommand(command==='formatBlockH3'?'formatBlock':command,false,command==='formatBlock'?'h2':command==='formatBlockH3'?'h3':null);commit()};bar.append(btn)});
 const tabs=document.createElement('div');tabs.className='vh-rte-tabs';const visual=document.createElement('button');visual.type='button';visual.textContent='Візуально';const html=document.createElement('button');html.type='button';html.textContent='HTML';
 const setMode=next=>{if(next===htmlMode)return;if(next){source.value=clean(editor.innerHTML)}else{editor.innerHTML=clean(source.value)}htmlMode=next;source.hidden=!next;editor.hidden=next;source.style.display=next?'block':'none';editor.style.display=next?'none':'block';visual.classList.toggle('active',!next);html.classList.toggle('active',next);for(const b of bar.querySelectorAll('.vh-rte-tool'))b.disabled=next;if(!next)commit()};visual.onclick=()=>setMode(false);html.onclick=()=>setMode(true);tabs.append(visual,html);visual.classList.add('active');bar.append(tabs);
 const extra=document.createElement('div');extra.className='vh-rte-extra';extra.hidden=true;[['Нумерований список','insertOrderedList'],['Прибрати форматування','removeFormat'],['Абзац','formatBlock']].forEach(([label,cmd])=>{const b=document.createElement('button');b.type='button';b.textContent=label;b.onclick=()=>{if(htmlMode)return;editor.focus();document.execCommand(cmd,false,cmd==='formatBlock'?'p':null);commit()};extra.append(b)});more.onclick=()=>{extra.hidden=!extra.hidden};
 editor.addEventListener('input',commit);editor.addEventListener('blur',()=>{editor.innerHTML=clean(editor.innerHTML)});source.addEventListener('input',commit);
 shell.append(heading,bar,extra,editor,source);return shell;
}
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
 const url=raw&&raw!=='__removed__'&&(/^(https?:|data:image\/|blob:|\/|\.\/|\.\.\/)/i.test(raw))?raw:'';
 const image=url?'url('+JSON.stringify(url)+')':'none';
 // Keep the image on a real CSS background layer, independent of storefront image nodes.
 const nextBackground=url?'linear-gradient(90deg,rgba(12,8,6,.90),rgba(12,8,6,.65) 38%,rgba(12,8,6,.10)),'+image:'none';
 // Preserve the image layer across repeated preview reconciliation passes.
 if(layer.dataset.cmsSource!==url){
  layer.style.setProperty('background-image',nextBackground,'important');
  layer.dataset.cmsSource=url;
  layer.dataset.cmsImage=url?'set':'empty';
  if(url){
   const test=new Image();
   test.onerror=()=>{if(layer.dataset.cmsSource===url){console.warn('[Vintage CMS] Banner photo failed to load:',url);layer.dataset.cmsImage='error'}};
   test.src=new URL(url,doc.baseURI).href;
  }
 }
}
function cmsApplyEditorialPreset(el,d,media,copy){
 const preset=d.photoPreset||'original';
 const layout=d.layout||'original';
 const active=preset==='framed';
 const doc=el.ownerDocument;
 let style=doc.getElementById('vh-cms-editorial-layout-css');
 if(!style){style=doc.createElement('style');style.id='vh-cms-editorial-layout-css';doc.head.append(style)}
 style.textContent=`
 .vh-cms-editorial-layout{height:500px!important;min-height:0!important;max-height:500px!important;overflow:hidden!important;display:grid!important;grid-template-columns:var(--vh-cms-editorial-columns,1fr 1fr)!important;align-items:stretch!important}
 .vh-cms-editorial-layout>.editorial-media{height:100%!important;min-height:0!important;overflow:hidden!important;display:block!important;grid-column:var(--vh-cms-media-column,1)!important;grid-row:1!important;min-width:0!important;width:100%!important;max-width:none!important}
 .vh-cms-editorial-layout>.editorial-copy{height:100%!important;min-height:0!important;box-sizing:border-box!important;padding:16px clamp(12px,1.5vw,24px)!important;overflow:hidden!important;display:flex!important;flex-direction:column!important;justify-content:center!important;grid-column:var(--vh-cms-copy-column,2)!important;grid-row:1!important;min-width:0!important;width:100%!important;max-width:none!important}
 .vh-cms-editorial-layout.vh-cms-editorial-stacked>.editorial-media{grid-column:1!important;grid-row:1!important}
 .vh-cms-editorial-layout.vh-cms-editorial-stacked>.editorial-copy{grid-column:1!important;grid-row:2!important}
 .vh-cms-editorial-layout.vh-cms-editorial-text-only>.editorial-media{display:none!important}
 .vh-cms-editorial-layout.vh-cms-editorial-text-only>.editorial-copy{grid-column:1!important}
 .vh-cms-editorial-layout>.vh-cms-editorial-second-photo{height:100%!important;min-height:0!important;grid-column:3!important;grid-row:1!important;min-width:0!important;background-size:cover!important;background-position:center!important}
 @media(max-width:760px){.vh-cms-editorial-layout{grid-template-columns:1fr!important}.vh-cms-editorial-layout>.editorial-media{grid-column:1!important;grid-row:1!important}.vh-cms-editorial-layout>.editorial-copy{grid-column:1!important;grid-row:2!important}.vh-cms-editorial-layout>.vh-cms-editorial-second-photo{grid-column:1!important;grid-row:3!important;min-height:260px!important}}
 `;
 // Inline important overrides the storefront's more-specific legacy editorial rules.
 if(active){
  el.style.setProperty('display','grid','important');
  media.style.setProperty('display',preset==='text-only'?'none':'block','important');
  copy.style.setProperty('display','flex','important');
  media.style.setProperty('order','0','important');
  copy.style.setProperty('order','0','important');
 }else{
  for(const node of [el,media,copy])for(const key of ['display','grid-template-columns','grid-column','grid-row','order'])node.style.removeProperty(key);
 }
 el.classList.toggle('vh-cms-editorial-layout',active);
 el.classList.toggle('vh-cms-editorial-stacked',active&&layout==='stacked');
 el.classList.toggle('vh-cms-editorial-text-only',active&&preset==='text-only');
 let second=el.querySelector(':scope > .vh-cms-editorial-second-photo');
 if(!active||preset!=='framed'){second?.remove();second=null}
 if(!active){for(const key of ['--vh-cms-editorial-columns','--vh-cms-media-column','--vh-cms-copy-column'])el.style.removeProperty(key);return}
 const w=Math.max(25,Math.min(75,Number(d.photoWidth)||50));
 const framed=preset==='framed';
 const left=framed?Math.max(20,Math.min(45,Number(d.capsuleLeftWidth)||38)):w;
 const right=framed?Math.max(20,Math.min(45,Number(d.capsuleRightWidth)||38)):100-w;
 const center=100-left-right;
 el.style.setProperty('--vh-cms-editorial-columns',layout==='stacked'||preset==='text-only'?'1fr':framed?left+'% '+center+'% '+right+'%':preset==='wide'?'65% 35%':w+'% '+(100-w)+'%');
 el.style.setProperty('--vh-cms-media-column',layout==='photo-right'&&!framed?'2':'1');
 el.style.setProperty('--vh-cms-copy-column',framed?'2':layout==='photo-right'?'1':'2');
 el.style.setProperty('grid-template-columns',layout==='stacked'||preset==='text-only'?'1fr':framed?left+'% '+center+'% '+right+'%':preset==='wide'?'65% 35%':w+'% '+(100-w)+'%','important');
 media.style.setProperty('grid-column',layout==='stacked'?'1':layout==='photo-right'&&!framed?'2':'1','important');
 media.style.setProperty('grid-row','1','important');
 copy.style.setProperty('grid-column',layout==='stacked'||preset==='text-only'?'1':framed?'2':layout==='photo-right'?'1':'2','important');
 copy.style.setProperty('grid-row',layout==='stacked'?'2':'1','important');
 if(framed){
  if(!second){second=doc.createElement('div');second.className='vh-cms-editorial-second-photo';second.setAttribute('aria-label','Друге фото макета (попередній перегляд)');el.append(second)}
  const target=sectionTargets.find(t=>t.el===el);
  const secondUrl=target?readExisting()?.[target.id]?.capsuleSecondImage:'';
  second.style.backgroundImage=secondUrl&&secondUrl!=='__removed__'?'url('+JSON.stringify(secondUrl)+')':'none';
  second.style.aspectRatio='auto';second.style.height='100%';second.style.minHeight='0';
  second.style.backgroundSize='cover';
  second.style.backgroundPosition=(Number(d.capsuleRightX)||50)+'% '+(Number(d.capsuleRightY)||50)+'%';
  second.style.transform='none';
 }
}
function applyBlockDesign(el,d){if(!el||!d)return;if(d.layoutVersion===1){if(!el.children.length)return;const target=sectionTargets.find(t=>t.el===el);const edit=target?readExisting()[target.id]||{}:{};window.VHCMSModel.applyDesign(el,d,pageId,edit);return;}
 const currentTarget=sectionTargets.find(t=>t.el===el);
 const currentDraft=currentTarget?readExisting()?.[currentTarget.id]:null;
 const hasMappedPhoto=cmsFieldsFor(el).some(field=>field.type==='image');
 // Gradient HERO uses the currently selected mapped image as its full-bleed background.
 // Never fall back to obsolete template images or the old three-slot collage.
 const heroGradient=pageId==='home'&&el.matches('.hero')&&d.photoPreset==='gradient-hero';
 if(heroGradient){
  const mapped=currentDraft?.mapped||{};
  const heroMain=el.querySelector('#heroMain');
  const heroMedia=el.querySelector('.hero-media');
  const heroUrl=mapped['static:#heroMain:0'];
  const fromBackground=(node)=>{const value=node?.style?.backgroundImage||node?.ownerDocument?.defaultView?.getComputedStyle(node)?.backgroundImage||'';return value.match(/url\(["']?(.+?)["']?\)/)?.[1]||''};
  const photo=typeof heroUrl==='string'&&heroUrl!=='__removed__'&&heroUrl?heroUrl:(fromBackground(heroMain)||fromBackground(heroMedia));
  cmsApplyExistingLayout(el,d,photo);
  const media=el.querySelector('.hero-media');
  if(media)media.style.setProperty('display','none','important');
 }else if(!hasMappedPhoto&&!el.matches('.hero'))cmsApplyExistingLayout(el,d,currentDraft?.templateImage);
 else {
  el.classList.remove('vh-existing-gradient-hero','vh-existing-two-photo');
  el.querySelector(':scope > .vh-cms-gradient-layer')?.remove();
  if(el.matches('.hero')){
   const media=el.querySelector('.hero-media');
   if(media)media.style.removeProperty('display');
  }
 }
 if(d.backgroundMode){el.style.setProperty('background-color',d.backgroundMode==='transparent'?'transparent':'#0d0c09','important')}
 if(d.textTone){el.style.setProperty('color',({light:'#f2e5d5',gold:'#b7956d',dark:'#211a15'})[d.textTone]||'#f2e5d5','important')}
 // Apply identical typography rules to existing page sections and new CMS cards.
 const bounded=(value,min,max)=>Number.isFinite(Number(value))?Math.max(min,Math.min(max,Number(value))):null;
 const headingSize=bounded(d.headingSize,16,96),bodySize=bounded(d.bodySize,12,32),tracking=bounded(d.letterSpacing,-1,5);
 const textRoot=el.querySelector('.copy,.editorial-copy,.vh-lab-copy,.hero-copy')||el;
 if(d.align&&['left','center','right'].includes(d.align))textRoot.style.setProperty('text-align',d.align,'important');
 for(const heading of textRoot.querySelectorAll('h1,h2,h3,h4'))if(headingSize!==null)heading.style.setProperty('font-size',headingSize+'px','important');
 for(const copy of textRoot.querySelectorAll('p,.vh-rte-content,.vh-lab-copy > div,.copy > div'))if(bodySize!==null)copy.style.setProperty('font-size',bodySize+'px','important');
 if(tracking!==null)for(const textEl of textRoot.querySelectorAll('h1,h2,h3,h4,p'))textEl.style.setProperty('letter-spacing',tracking+'px','important');

 if(el.matches('.homepage-capsules')){
  if(d.backgroundMode==='transparent'){el.style.setProperty('background-image','none','important')}
  const copy=el.querySelector(':scope > .editorial-copy');
  if(copy){
   if(d.backgroundMode==='transparent'||d.surface==='transparent'){
    copy.style.setProperty('background','transparent','important');copy.style.setProperty('background-image','none','important');
   }else if(d.surface==='white'){copy.style.setProperty('background','#fff','important')}
   else if(d.surface==='cream'){copy.style.setProperty('background','#f3eadf','important')}
   else if(d.backgroundMode==='dark'){copy.style.removeProperty('background');copy.style.removeProperty('background-image')}
   if(d.textTone){const tone=({light:'#f2e5d5',gold:'#b7956d',dark:'#211a15'})[d.textTone];if(tone){copy.style.setProperty('color',tone,'important');copy.querySelectorAll('h1,h2,h3,p,.eyebrow').forEach(n=>n.style.setProperty('color',tone,'important'))}}
  }
  const capsuleBtn=el.querySelector('#homeCapsulesBtn');
  if(capsuleBtn){
   const lightPanel=d.surface==='white'||d.surface==='cream'||d.textTone==='dark';
   capsuleBtn.style.setProperty('background-color',lightPanel?'#211a15':'#f2e5d5','important');
   capsuleBtn.style.setProperty('border-color',lightPanel?'#211a15':'#f2e5d5','important');
   capsuleBtn.style.setProperty('color',lightPanel?'#ffffff':'#211a15','important');
  }
  const media=el.querySelector('#homeCapsulesMedia'),photo=media?.querySelector('img');
  if(media)for(const key of ['desktop','tablet','mobile']){
   const crop={fit:d.photoFit||'cover',x:d.photoX??50,y:d.photoY??50,zoom:100,...(d.cropDevices?.[key]||{})};
   media.style.setProperty('--vh-crop-'+key+'-fit',crop.fit==='contain'?'contain':'cover');
   media.style.setProperty('--vh-crop-'+key+'-x',Math.max(0,Math.min(100,Number(crop.x)||0))+'%');
   media.style.setProperty('--vh-crop-'+key+'-y',Math.max(0,Math.min(100,Number(crop.y)||0))+'%');
   media.style.setProperty('--vh-crop-'+key+'-zoom',Math.max(0.5,Math.min(2,(Number(crop.zoom)||100)/100)));
   media.style.setProperty('--vh-crop-'+key+'-effective-zoom',crop.fit==='contain'?Math.max(0.5,Math.min(2,(Number(crop.zoom)||100)/100)):Math.max(1,Math.min(2,(Number(crop.zoom)||100)/100)));
   media.style.setProperty('--vh-crop-'+key+'-pan-x',((Math.max(0,Math.min(100,Number.isFinite(Number(crop.x))?Number(crop.x):50))-50)/2)+'%');
   media.style.setProperty('--vh-crop-'+key+'-pan-y',((Math.max(0,Math.min(100,Number.isFinite(Number(crop.y))?Number(crop.y):50))-50)/2)+'%');
  }
  if(photo){photo.style.objectFit=d.photoFit==='contain'?'contain':'cover';photo.style.objectPosition=`${Number.isFinite(+d.photoX)?+d.photoX:50}% ${Number.isFinite(+d.photoY)?+d.photoY:50}%`}
  if(media&&copy){
   const layout=d.layout||'original';
   el.dataset.cmsCapsulesLayout=layout;
   el.style.setProperty('--vh-capsules-photo-width',Math.max(25,Math.min(75,Number(d.photoWidth)||50))+'%');
   // Existing editorial sections have their own fixed layout CSS; make presets effective in preview.
   cmsApplyEditorialPreset(el,d,media,copy);
  }
 }
 if(d.photoPreset&&el.classList.contains('vh-lab-card')){const preset=d.photoPreset;el.style.gridTemplateColumns=preset==='framed'?'minmax(0,1fr) minmax(0,1.35fr) minmax(0,1fr)':preset==='framed'?'minmax(0,1fr) minmax(0,1.35fr) minmax(0,1fr)':preset==='wide'?'60% 40%':'50% 50%';const ph=el.querySelector('.vh-lab-photo');if(ph){ph.style.aspectRatio=preset==='square'?'1 / 1':'auto';ph.style.height=preset==='square'?'auto':'100%';ph.style.minHeight='0';ph.style.maxWidth='100%';ph.style.margin=preset==='square'?'28px':'0';ph.style.alignSelf='center';ph.style.width='calc(100% - '+(preset==='square'?'56px':'0px')+')';ph.style.boxSizing='border-box';}}
if(!d.backgroundMode&&d.background)el.style.setProperty('background-color',d.background);if(!d.textTone&&d.color)el.style.setProperty('color',d.color);
 const layout=d.layout||'original';
 el.dataset.cmsLayout=layout;
 if(!el.classList.contains('vh-lab-card')&&!el.classList.contains('preview-card')&&layout!=='original'){
 const img=el.querySelector('img'),text=el.querySelector('h1,h2,h3');
 if(img&&text){const photoBox=img.closest('picture')||img.parentElement,copyBox=text.parentElement;
 if(photoBox&&copyBox&&photoBox!==copyBox&&photoBox.parentElement===copyBox.parentElement){
 const container=photoBox.parentElement;
 container.style.display='flex';container.style.flexDirection=layout==='stacked'?'column':layout==='photo-right'?'row-reverse':'row';
 photoBox.style.flex='1 1 50%';copyBox.style.flex='1 1 50%';
 } }
 }
 if(el.classList.contains('vh-lab-card')||el.classList.contains('preview-card')){
 const onlyText=d.photoPreset==='text-only';
 const width=Math.max(25,Math.min(75,Number(d.photoWidth)||50));
 el.style.display=layout==='stacked'||onlyText?'flex':'grid';
 el.style.flexDirection=layout==='stacked'?'column':'';
 el.style.gridTemplateColumns=layout==='stacked'||onlyText?'1fr':d.photoPreset==='framed'?'minmax(0,1fr) minmax(0,1.35fr) minmax(0,1fr)':`${width}% ${100-width}%`;
 const photo=el.querySelector('.vh-lab-photo,.photo'),copy=el.querySelector('.vh-lab-copy,.copy');
 if(photo)photo.style.display=onlyText?'none':'';
 if(copy&&onlyText){copy.style.width='100%';copy.style.flex='1'}
 if(photo)photo.style.order=layout==='photo-right'?'2':'0';
 if(copy)copy.style.order=layout==='photo-right'?'1':'1';
 }
 el.style.setProperty('--cms-radius',d.radius==='rounded'?'18px':d.radius==='soft'?'7px':'0px');
 el.style.borderRadius='var(--cms-radius)';

 el.classList.toggle('cms-white-copy',d.surface==='white');
 el.classList.toggle('cms-cream-copy',d.surface==='cream');
 el.classList.toggle('cms-transparent-copy',d.surface==='transparent');
 if(el.classList.contains('vh-lab-card')){const photo=el.querySelector('.vh-lab-photo');const copy=el.querySelector('.vh-lab-copy');const pct=(v,def,min,max)=>Math.max(min,Math.min(max,Number.isFinite(Number(v))?Number(v):def));if(photo){const w=pct(d.photoWidth,50,20,80);const inset=pct(d.photoInset,0,0,120);el.style.gridTemplateColumns=layout==='stacked'?'1fr':`${w}% ${100-w}%`;photo.style.margin=inset+'px';photo.style.minHeight='0';photo.style.aspectRatio=d.photoRatio&&d.photoRatio!=='auto'?d.photoRatio:'';photo.style.backgroundSize=d.photoFit==='contain'?'contain':'cover';photo.style.backgroundRepeat='no-repeat';photo.style.backgroundPosition=`${pct(d.photoX,50,0,100)}% ${pct(d.photoY,50,0,100)}%`;if(d.photoFit==='contain')photo.style.backgroundColor='transparent';}if(copy&&(d.surface==='transparent'||d.backgroundMode==='transparent')){copy.style.setProperty('background','transparent','important');copy.style.setProperty('background-color','transparent','important')}if(d.surface==='transparent'||d.backgroundMode==='transparent')el.style.setProperty('background-color','transparent','important');}
el.style.setProperty('text-align',d.align||'left');const copyAlign=el.querySelector('.vh-lab-copy,.copy');if(copyAlign)copyAlign.style.textAlign=d.align||'left';
 if(d.photoPreset&&el.classList.contains('vh-lab-card')){const p=el.querySelector('.vh-lab-photo');const preset=d.photoPreset;const width=Math.max(25,Math.min(75,Number(d.photoWidth)||50));el.style.gridTemplateColumns=el.dataset.cmsLayout==='stacked'?'1fr':preset==='framed'?'minmax(0,1fr) minmax(0,1.35fr) minmax(0,1fr)':preset==='wide'?'60% 40%':`${width}% ${100-width}%`;if(p){p.style.margin=preset==='square'?'28px':'0';p.style.width=preset==='square'?'calc(100% - 56px)':'100%';p.style.height=preset==='square'?'auto':'100%';p.style.minHeight='0';p.style.aspectRatio=preset==='square'?'1 / 1':'auto';p.style.alignSelf='center';p.style.boxSizing='border-box'}}
 if(d.backgroundMode)el.style.setProperty('background-color',d.backgroundMode==='transparent'?'transparent':'#0d0c09','important');
 if(d.textTone)el.style.setProperty('color',({light:'#f2e5d5',gold:'#b7956d',dark:'#211a15'})[d.textTone]||'#f2e5d5','important');
 }
// STEP 88: Shared dimensions for builder preview and published blocks.
function applyCmsSpacing(el,design){
 const d=design||{};
 const clamp=(value,min,max,fallback)=>{const n=Number(value);return Number.isFinite(n)?Math.max(min,Math.min(max,n)):fallback};
 const presetSpacing={compact:12,normal:28,wide:64};
 const base=presetSpacing[d.spacing]??28;
 const top=clamp(d.marginTop,0,160,base),bottom=clamp(d.marginBottom,0,160,base);
 const height=clamp(d.minHeight,100,1100,320);
 el.style.setProperty('--vh-cms-mt',top+'px');el.style.setProperty('--vh-cms-mb',bottom+'px');
 el.style.setProperty('--vh-cms-height',height+'px');
 el.style.setProperty('margin-top',top+'px','important');el.style.setProperty('margin-bottom',bottom+'px','important');
 el.style.setProperty('min-height',height+'px','important');
}
async function uploadExistingCmsPhoto(file,photoKey){
 if(!file)return '';
 if(!cloudReady||!cloud)throw Error('Увійдіть в адмінку, щоб завантажити фото в Supabase');
 const types={'image/jpeg':'jpg','image/png':'png','image/webp':'webp','image/avif':'avif','image/gif':'gif'};
 const ext=types[file.type];
 if(!ext)throw Error('Підтримуються JPG, PNG, WEBP, AVIF та GIF');
 if(file.size>25*1024*1024)throw Error('Фото понад 25 МБ. Стисніть файл перед завантаженням');
 const bucket=window.VH_CONFIG?.storageBucket;
 if(!bucket)throw Error('Не налаштовано Supabase Storage bucket');
 const safe=String(photoKey||'photo').replace(/[^a-z0-9_-]/gi,'-').slice(0,90);
 const path='cms/'+pageId+'/existing-'+safe+'/'+Date.now()+'-'+Math.random().toString(36).slice(2,9)+'.'+ext;
 uploadsInFlight++;syncCloudButtons();
 let error;try{({error}=await cloud.storage.from(bucket).upload(path,file,{contentType:file.type,upsert:false,cacheControl:'31536000'}))}finally{uploadsInFlight--;syncCloudButtons()}
 if(error)throw error;
 const url=cloud.storage.from(bucket).getPublicUrl(path).data?.publicUrl;
 if(!url)throw Error('Не вдалося отримати URL завантаженого фото');
 return url;
}
async function uploadCmsImage(file,block,button,slot=0){
 if(!file)return;
 if(!cloudReady)throw Error('Спочатку увійдіть в адмінку');
 if(!['image/jpeg','image/png','image/webp','image/avif'].includes(file.type))throw Error('Дозволені JPG, PNG, WEBP, AVIF');
 if(file.size>25*1024*1024)throw Error('Максимальний розмір фото — 25 МБ');
 const bucket=window.VH_CONFIG?.storageBucket;
 if(!bucket)throw Error('Не вказано Storage bucket у VH_CONFIG');
 const ext={'image/jpeg':'jpg','image/png':'png','image/webp':'webp','image/avif':'avif'}[file.type];
 const safeId=String(block.id).replace(/[^a-z0-9_-]/gi,'-');
 const path='cms/'+pageId+'/'+safeId+'/'+Date.now()+'-'+Math.random().toString(36).slice(2,9)+'.'+ext;
 button.disabled=true;button.textContent='Завантаження…';
 try{
  uploadsInFlight++;syncCloudButtons();
 let error;try{({error}=await cloud.storage.from(bucket).upload(path,file,{contentType:file.type,upsert:false,cacheControl:'31536000'}))}finally{uploadsInFlight--;syncCloudButtons()}
  if(error)throw error;
  const url=cloud.storage.from(bucket).getPublicUrl(path).data?.publicUrl;
  if(!url)throw Error('Не вдалося отримати URL фото');
  if(slot===0)block.image=url;else block.images={...(block.images||{}),[slot]:url};persist();renderEditor();renderPreview();
  $('status').textContent='Фото завантажено. Збережіть чернетку в Supabase.';
 }finally{button.disabled=false;button.textContent='Завантажити фото'}
}
function addDesignControls(host,id,initial,onChange,isCapsules=false,blockType=null,onBlockType=null){
 const d={...initial};const details=document.createElement('div');details.className='cms-design cms91-design';
 const commit=()=>{d.layoutVersion=1;onChange({...d})};
 const label=(txt)=>{const el=document.createElement('label');el.textContent=txt;return el};
 const select=(parent,key,txt,options,def)=>{const row=document.createElement('div');row.className='cms91-field';row.append(label(txt));const el=document.createElement('select');options.forEach(([v,t])=>el.add(new Option(t,v)));el.value=d[key]??def;el.onchange=()=>{d[key]=el.value;commit()};row.append(el);parent.append(row);return el};
 const content=document.createElement('div');content.className='cms91-panel';content.dataset.tab='design';
 select(content,'backgroundMode','ФОН ПІД ТЕКСТОМ',[['dark','Темний · Vintage Hedonista'],['transparent','Прозорий']],d.backgroundMode||'dark');
 select(content,'textTone','КОЛІР ТЕКСТУ',[['light','Світлий'],['gold','Золотистий'],['dark','Темний']],d.textTone||'light');
 select(content,'spacing','ШВИДКИЙ ПРЕСЕТ ВІДСТУПІВ',[['compact','Компактні'],['normal','Стандартні'],['wide','Великі']],d.spacing||'normal');
 const margins=document.createElement('div');margins.className='cms92-margins';
 const addMargin=(key,title)=>{const row=document.createElement('label');row.className='cms92-margin';const name=document.createElement('span');name.textContent=title;const input=document.createElement('input');input.type='range';input.min='0';input.max='120';input.step='4';input.value=d[key]??({compact:12,normal:28,wide:64}[d.spacing]??28);const value=document.createElement('output');value.textContent=input.value+' px';input.oninput=()=>{d[key]=Number(input.value);value.textContent=input.value+' px';commit()};row.append(name,input,value);margins.append(row);return input};
 const topMargin=addMargin('marginTop','Зверху'),bottomMargin=addMargin('marginBottom','Знизу');
 content.append(margins);
 const presetSelect=[...content.querySelectorAll('select')].find(el=>[...el.options].some(o=>o.value==='compact'));
 if(presetSelect){const prev=presetSelect.onchange;presetSelect.onchange=()=>{const n={compact:12,normal:28,wide:64}[presetSelect.value];d.spacing=presetSelect.value;d.marginTop=n;d.marginBottom=n;topMargin.value=n;bottomMargin.value=n;topMargin.dispatchEvent(new Event('input'));bottomMargin.dispatchEvent(new Event('input'));}};
 select(content,'align','ВИРІВНЮВАННЯ ТЕКСТУ',[['left','Ліворуч'],['center','По центру'],['right','Праворуч']],d.align||'left');
 // Shared typography controls for native sections and newly created blocks.
 const typography=document.createElement('div');typography.className='cms91-field';
 const typographyLabel=document.createElement('label');typographyLabel.textContent='ТИПОГРАФІКА · РОЗМІР ТА ІНТЕРВАЛ';
 typography.append(typographyLabel);
 for(const [key,name,min,max,defaultValue,unit] of [['headingSize','Заголовок',16,96,40,'px'],['bodySize','Основний текст',12,32,16,'px'],['letterSpacing','Інтервал між літерами',-1,5,0,'px']]){
  const row=document.createElement('label');row.className='vh-design-dimension';
  const title=document.createElement('span');title.textContent=name;
  const input=document.createElement('input');input.type='range';input.min=min;input.max=max;input.step=key==='letterSpacing'?0.25:1;input.value=d[key]??defaultValue;
  const output=document.createElement('output');output.textContent=input.value+unit;
  input.oninput=()=>{d[key]=Number(input.value);output.textContent=input.value+unit;commit()};
  row.append(title,input,output);typography.append(row);
 }
 content.append(typography);
 select(content,'textPosition','ПОЛОЖЕННЯ ТЕКСТУ ПО ВЕРТИКАЛІ',[['top','Вгорі'],['center','Посередині'],['bottom','Внизу']],d.textPosition||'center');
 select(content,'mobileOrder','ПОРЯДОК НА ТЕЛЕФОНІ',[['layout','Як у вибраному макеті'],['photo-first','Спочатку фото, потім текст'],['text-first','Спочатку текст, потім фото']],d.mobileOrder||'layout');

 const photo=document.createElement('div');photo.className='cms91-panel';photo.dataset.tab='design';
  if(!isCapsules){const note=document.createElement('p');note.className='cms96-help';note.textContent='Готові шаблони: «Hero на всю ширину» (1920 × 900 px) та «Три фото» (1600 × 1200 + 900 × 900 + 900 × 900 px) вибираються у полі «ТИП МАКЕТУ» на вкладці «Контент». Підказки під кожним фото змінюються автоматично.';photo.append(note)}
 const title=document.createElement('div');title.className='cms91-caption';title.textContent='МАКЕТ БЛОКУ · виберіть готову композицію';photo.append(title);
 const grid=document.createElement('div');grid.className='cms91-layout-grid';
 const presets=[['original','Оригінальний макет','Чинна композиція'],['left','Фото ліворуч','Фото · текст'],['right','Фото праворуч','Текст · фото'],['stacked','Фото зверху','Фото зверху · текст знизу'],['text-top','Текст зверху','Текст зверху · фото знизу'],['text-only','Тільки текст','Без фотографії'],['wide','Акцент на фото','65 / 35'],['framed','Два фото','Фото · текст · фото'],['gradient-hero','Фото з градієнтом','Банер на всю ширину'],['three-photos','Три фото','Велике фото + два менших']];
 for(const [value,name,hint] of presets){const btn=document.createElement('button');btn.type='button';btn.className='cms91-preset';btn.dataset.preset=value;btn.innerHTML='<span class="cms91-mini cms91-mini-'+value+'"><i></i><b></b></span><strong>'+name+'</strong><small>'+hint+'</small>';btn.onclick=()=>{d.photoPreset=value;d.layout=value==='stacked'||value==='text-top'?value:value==='right'?'photo-right':'photo-left';d.photoWidth=value==='wide'?65:50;update();commit();if(onBlockType)onBlockType(({"gradient-hero":'banner',"three-photos":'gallery',"text-only":'text'})[value]||'editorial');else renderExistingEditor();};grid.append(btn)}photo.append(grid);
 // Unified compact proportions and height controls for every editable block.
 const proportion=document.createElement('div');proportion.className='vh-design-proportions';
 const proportionTitle=document.createElement('h4');proportionTitle.textContent='ПРОПОРЦІЇ ТА ВИСОТА';proportion.append(proportionTitle);
 const addDimension=(key,caption,min,max,step,fallback,unit)=>{
  const row=document.createElement('label');row.className='vh-design-dimension';
  const name=document.createElement('span');name.textContent=caption;
  const range=document.createElement('input');range.type='range';range.min=min;range.max=max;range.step=step;range.value=d[key]??fallback;
  const output=document.createElement('output');output.textContent=range.value+unit;
  range.oninput=()=>{d[key]=Number(range.value);output.textContent=range.value+unit;commit()};
  row.append(name,range,output);proportion.append(row);return {range,output};
 };
 const widthControl=addDimension('photoWidth','Фото / текст',25,75,5,50,'%');
 addDimension('minHeight','Мінімальна висота',120,900,20,320,' px');
 const ratioHints=document.createElement('div');ratioHints.className='vh-design-ratios';
 for(const [ratio,name] of [[35,'35 / 65'],[50,'50 / 50'],[65,'65 / 35']]){
  const btn=document.createElement('button');btn.type='button';btn.textContent=name;btn.onclick=()=>{d.photoWidth=ratio;widthControl.range.value=ratio;widthControl.output.textContent=ratio+'%';commit()};ratioHints.append(btn)
 }
 proportion.append(ratioHints);
 photo.append(proportion);
 if(isCapsules){const row=document.createElement('label');row.className='cms96-slider';row.textContent='ШИРИНА ФОТО · %';const range=document.createElement('input');range.type='range';range.min='25';range.max='75';range.step='5';range.value=d.photoWidth??50;const output=document.createElement('output');output.textContent=range.value+'%';range.oninput=()=>{d.photoWidth=Number(range.value);output.textContent=range.value+'%';commit()};row.append(range,output);photo.append(row)}
const crop=document.createElement('details');crop.className='cms91-crop';crop.innerHTML='<summary>Кадрування фото</summary>';const cropBody=document.createElement('div');cropBody.className='cms91-crop-body';
 select(cropBody,'photoFit','ВІДОБРАЖЕННЯ',[['cover','Заповнити область'],['contain','Показати повністю']],d.photoFit||'cover');
 for(const [key,text] of [['photoX','Горизонталь'],['photoY','Вертикаль']]){const row=document.createElement('div');row.className='cms91-field';row.append(label(text));const range=document.createElement('input');range.type='range';range.min='0';range.max='100';range.step='5';range.value=d[key]??50;range.oninput=()=>{d[key]=Number(range.value);commit()};row.append(range);cropBody.append(row)}crop.append(cropBody);if(!isCapsules)photo.append(crop);
 {
  const panel=document.createElement('div');panel.className='cms129-device-crop';
  panel.innerHTML='<h4>КАДРУВАННЯ ЗА ПРИСТРОЯМИ</h4><p>Рухайте фото мишкою та змінюйте масштаб кнопками − / +. Для показу всього оригіналу виберіть «Показати повністю». Ширина фото не змінюється.</p>';
  const tabs=document.createElement('div');tabs.className='cms129-tabs';const fields=document.createElement('div');panel.append(tabs,fields);
  let active='desktop';
  const defaults={fit:d.photoFit||'cover',x:Number(d.photoX??50),y:Number(d.photoY??50),zoom:100,...d.crop0};
  const state=key=>({...defaults,...(d.cropDevices?.[key]||{})});
  const save=patch=>{d.cropDevices={...(d.cropDevices||{}),[active]:{...state(active),...patch}};commit()};
  const render=()=>{
   tabs.querySelectorAll('button').forEach(b=>b.classList.toggle('active',b.dataset.device===active));
   fields.replaceChildren();
   const current=state(active);
   const row=document.createElement('label');row.textContent='РЕЖИМ ПОКАЗУ';const fit=document.createElement('select');
   [['cover','Заповнити (обрізати)'],['contain','Показати повністю']].forEach(([v,t])=>fit.add(new Option(t,v)));
   fit.value=current.fit;fit.onchange=()=>{save({fit:fit.value});render()};row.append(fit);fields.append(row);
   // STEP 132: visual drag crop, using the same persisted cropDevices fields.
   // STEP 133: true visual editor. Render the full original image in a crop viewport,
   // with the same object-fit/object-position/scale rules as the published site.
   const cropStage=document.createElement('div');cropStage.className='cms132-stage';
   const cropImage=document.createElement('img');cropImage.alt='Кадрування капсули';cropImage.draggable=false;
   const cropHint=document.createElement('span');cropHint.className='cms132-hint';cropHint.textContent='Затисніть та перетягніть фото';
   cropStage.append(cropImage,cropHint);fields.append(cropStage);
   const selectedTarget=sectionTargets.find(t=>t.id===selectedExisting);
   const selectedSection=selectedTarget?.el;
   const source=selectedSection?.querySelector('#homeCapsulesMedia img, .editorial-media img, .hero-media img, img[src]');
   const mappedPhoto=selectedSection?cmsFieldsFor(selectedSection).find(field=>field.type==='image'):null;
   const selectedDraft=selectedTarget?readExisting()?.[selectedTarget.id]:null;
   const mappedUrl=mappedPhoto&&selectedDraft?.mapped?.[mappedPhoto.id];
   const sourceUrl=selectedDraft?.layoutImages?.[0]||(!selectedTarget?blocks.find(block=>block.id===selected)?.image:'')||(typeof mappedUrl==='string'&&mappedUrl!=='__removed__'?mappedUrl:'')||source?.currentSrc||source?.src||'';
   if(sourceUrl)cropImage.src=sourceUrl;else{cropHint.textContent='Спочатку завантажте фото';cropStage.classList.add('cms132-empty')}
   // Use the actual image panel proportions when available, not an arbitrary 16:9 crop.
   const media=selectedSection?.querySelector('#homeCapsulesMedia, .editorial-media, .hero-media, .vh-lab-photo')||source?.parentElement;
   const measured=media?.getBoundingClientRect();
   const ratio=active==='mobile'?3/4:active==='tablet'?4/3:measured?.width>0&&measured?.height>0?measured.width/measured.height:16/9;
   cropStage.style.aspectRatio=String(Math.max(.45,Math.min(3,ratio)));
   const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
   const paint=()=>{
    const c=state(active),x=clamp(Number(c.x)||0,0,100),y=clamp(Number(c.y)||0,0,100);
    cropImage.style.objectFit=c.fit==='contain'?'contain':'cover';
    cropImage.style.objectPosition=x+'% '+y+'%';
    cropImage.style.transformOrigin=x+'% '+y+'%';
    cropImage.style.transform='scale('+(c.fit==='contain'?clamp(Number(c.zoom)/100,.5,2):clamp(Number(c.zoom)/100,1,2))+')';
   };
   cropImage.addEventListener('load',paint);paint();
   let drag=null;
   cropStage.addEventListener('pointerdown',ev=>{
    if(!sourceUrl||ev.button!==0||!cropImage.naturalWidth)return;
    ev.preventDefault();cropStage.setPointerCapture(ev.pointerId);
    const c=state(active);drag={pointerId:ev.pointerId,x:ev.clientX,y:ev.clientY,startX:Number(c.x),startY:Number(c.y)};
   });
   cropStage.addEventListener('pointermove',ev=>{
    if(!drag||ev.pointerId!==drag.pointerId)return;
    const rect=cropStage.getBoundingClientRect(),iw=cropImage.naturalWidth,ih=cropImage.naturalHeight;
    if(!iw||!ih||!rect.width||!rect.height)return;
    const c=state(active),base=c.fit==='contain'?Math.min(rect.width/iw,rect.height/ih):Math.max(rect.width/iw,rect.height/ih);
    const zoom=c.fit==='contain'?clamp(Number(c.zoom)/100,.5,2):clamp(Number(c.zoom)/100,1,2);
    // Object-position is a percentage of the overflow, not of the whole photo.
    const excessX=Math.max(0,iw*base*zoom-rect.width),excessY=Math.max(0,ih*base*zoom-rect.height);
    const x=excessX?clamp(drag.startX-(ev.clientX-drag.x)/excessX*100,0,100):50;
    const y=excessY?clamp(drag.startY-(ev.clientY-drag.y)/excessY*100,0,100):50;
    d.cropDevices={...(d.cropDevices||{}),[active]:{...state(active),x:Math.round(x),y:Math.round(y)}};
    paint();
   });
   const finish=ev=>{if(!drag||ev.pointerId!==drag.pointerId)return;drag=null;commit();};
   cropStage.addEventListener('pointerup',finish);cropStage.addEventListener('pointercancel',finish);
   const zoomRow=document.createElement('div');zoomRow.className='cms133-zoom';
   const minus=document.createElement('button');minus.type='button';minus.textContent='−';minus.title='Віддалити';
   const zoomRange=document.createElement('input');zoomRange.type='range';zoomRange.min='50';zoomRange.max='200';zoomRange.step='5';
   const plus=document.createElement('button');plus.type='button';plus.textContent='+';plus.title='Наблизити';
   const zoomLabel=document.createElement('output');
   const updateZoom=v=>{const value=clamp(v,50,200);d.cropDevices={...(d.cropDevices||{}),[active]:{...state(active),zoom:value}};zoomRange.value=value;zoomLabel.textContent=value+'%';paint();commit()};
   zoomRange.value=state(active).zoom;zoomLabel.textContent=zoomRange.value+'%';
   minus.onclick=()=>updateZoom(Number(zoomRange.value)-5);plus.onclick=()=>updateZoom(Number(zoomRange.value)+5);
   zoomRange.oninput=()=>updateZoom(Number(zoomRange.value));
   zoomRow.append(minus,zoomRange,plus,zoomLabel);fields.append(zoomRow);
   const advanced=document.createElement('details');advanced.className='cms133-advanced';
   const advancedTitle=document.createElement('summary');advancedTitle.textContent='Точне позиціонування (необов’язково)';advanced.append(advancedTitle);
   for(const [key,title] of [['x','Горизонталь'],['y','Вертикаль']]){
    const line=document.createElement('label');line.className='cms96-slider';line.textContent=title;
    const slider=document.createElement('input');slider.type='range';slider.min='0';slider.max='100';slider.step='1';slider.value=state(active)[key];
    slider.oninput=()=>{save({[key]:Number(slider.value)});paint()};
    line.append(slider);advanced.append(line);
   }
   fields.append(advanced);
   const reset=document.createElement('button');reset.type='button';reset.textContent='Скинути для цього екрана';
   reset.onclick=()=>{const next={...(d.cropDevices||{})};delete next[active];d.cropDevices=next;commit();render()};fields.append(reset);
  };
  [['desktop','Комп’ютер'],['tablet','Планшет'],['mobile','Телефон']].forEach(([key,title])=>{
   const btn=document.createElement('button');btn.type='button';btn.dataset.device=key;btn.textContent=title;
   btn.onclick=()=>{active=key;render()};tabs.append(btn);
  });render();photo.append(panel);
 }
 // STEP 96: independent photo crop controls, stored in block design.
 const slots=document.createElement('div');slots.className='cms96-slots';
 const slotsTitle=document.createElement('h4');slotsTitle.textContent='КАДРУВАННЯ КОЖНОГО ФОТО';slots.append(slotsTitle);
 const captions=['Основне фото','Друге фото / праворуч','Третє фото галереї'];
 captions.forEach((caption,i)=>{
  const group=document.createElement('details');group.className='cms96-slot';if(i===0)group.open=true;
  const summary=document.createElement('summary');summary.textContent=caption;group.append(summary);
  const note=document.createElement('p');note.className='cms96-help';note.textContent=i===0?'Квадрат: 1200 × 1200 · Банер: 1920 × 900':'Рекомендовано від 1200 px за шириною. Фото не змінює розмір контейнера.';
  group.append(note);
  const positionKey='crop'+i;
  const state=d[positionKey]&&typeof d[positionKey]==='object'?d[positionKey]:{x:50,y:50,zoom:100};
  const slider=(name,key,min,max,step)=>{const line=document.createElement('label');line.className='cms96-slider';const text=document.createElement('span');text.textContent=name;const range=document.createElement('input');range.type='range';range.min=min;range.max=max;range.step=step;range.value=state[key]??(key==='zoom'?100:50);const output=document.createElement('output');output.textContent=range.value+(key==='zoom'?'%':'%');range.oninput=()=>{d[positionKey]={...(d[positionKey]||state),[key]:Number(range.value)};output.textContent=range.value+'%';commit()};line.append(text,range,output);group.append(line)};
  slider('Ліворуч / праворуч','x',0,100,5);
  slider('Вгору / вниз','y',0,100,5);
  slider('Масштаб','zoom',100,200,5);
  slots.append(group)
 });
 photo.append(slots);
 const update=()=>grid.querySelectorAll('button').forEach(x=>x.classList.toggle('active',x.dataset.preset===(d.photoPreset||(blockType==='banner'?'gradient-hero':blockType==='gallery'?'three-photos':'original'))));update();

 // STEP 94: visually group related controls without changing their save callbacks.
 const section=(title,nodes)=>{const panel=document.createElement('section');panel.className='cms94-design-section';const heading=document.createElement('h4');heading.className='cms94-section-heading';heading.textContent=title;panel.append(heading);for(const node of nodes)if(node)panel.append(node);return panel};
 const contentFields=[...content.children];
 if(contentFields.length>=6){
   const appearance=section('КОЛЬОРИ БЛОКУ',contentFields.slice(0,2));
   const space=section('ВІДСТУПИ МІЖ БЛОКАМИ',contentFields.slice(2,4));
   const typography=section('РОЗТАШУВАННЯ ТЕКСТУ',contentFields.slice(4));
   content.replaceChildren(appearance,space,typography);
 }
 const photoFields=[...photo.children];
 if(photoFields.length>=3){photo.replaceChildren(section('МАКЕТ І КОМПОЗИЦІЯ',photoFields.slice(0,2)),section('ТОЧНЕ КАДРУВАННЯ',photoFields.slice(2)))}
 details.append(content,photo);host.append(details);return details;
}
function cmsValidPhotoUrl(value){
 const url=String(value||'').trim();
 return !url||/^(https?:\/\/|\/|\.\/|\.\.\/)/i.test(url);
}
function cmsPhotoUrlField(value,onSave,placeholder){
 const input=document.createElement('input');
 input.type='url';input.placeholder=placeholder||'Посилання на фото';input.value=value||'';
 input.onchange=()=>{
  const url=input.value.trim();
  if(!cmsValidPhotoUrl(url)){alert('Вкажіть коректне посилання на фото');input.value=value||'';return}
  onSave(url);
 };
 return input;
}
function cmsPhotoUploadField(onUpload,accept){
 const input=document.createElement('input');input.type='file';
 input.accept=accept||'image/jpeg,image/png,image/webp';
 input.onchange=async()=>{
  const file=input.files?.[0];if(!file)return;
  input.disabled=true;
  try{await onUpload(file)}catch(error){
   const message='Помилка завантаження фото: '+(error?.message||error);
   const status=document.getElementById('status');if(status)status.textContent=message;
   alert(message);
  }finally{input.disabled=false;input.value=''}
 };
 return input;
}
function cmsSharedTextFields(host,model){
 if(model.title!==null){
  host.append(field('ЗАГОЛОВОК','input',model.title||'',value=>model.onTitle(value)));
 }
 if(model.body!==null){
  const wrap=document.createElement('div');wrap.className='field';
  const label=document.createElement('label');label.textContent='ОПИС';wrap.append(label);
  wrap.append(makeRichEditor(model.body||'',value=>model.onBody(value)));host.append(wrap);
 }
}
let cms91ActiveTab='content';
function cms91Tabs(holder,b){
 const content=document.createElement('div'),design=document.createElement('div'),motion=document.createElement('div');
 for(const [el,key] of [[content,'content'],[design,'design'],[motion,'animation']]){el.className='cms91-tab-panel';el.dataset.cms91Tab=key}
 for(const el of [...holder.children]){
  if(el.classList.contains('cms93-type-control')||el.classList.contains('cms-capsule-widths')){design.append(el);continue}
  if(el.classList.contains('cms91-design')){for(const part of [...el.children])design.append(part);el.remove();continue}
  const t=el.textContent||'';
  if(/АНІМАЦІЯ|ТРИВАЛІСТЬ/.test(t)&&!el.classList.contains('cms-mapped-field'))motion.append(el);
  else content.append(el);
 }
 const bar=document.createElement('div');bar.className='cms91-tabs';const panels={content,design,animation:motion};
 const switchTo=key=>{cms91ActiveTab=key;for(const [k,v] of Object.entries(panels))v.hidden=k!==key;bar.querySelectorAll('button').forEach(x=>x.classList.toggle('active',x.dataset.tab===key))};
 for(const [key,name] of [['content','Контент'],['design','Дизайн'],['animation','Анімація']]){const btn=document.createElement('button');btn.type='button';btn.dataset.tab=key;btn.textContent=name;btn.onclick=()=>switchTo(key);bar.append(btn)}
 const headings={content:'Тексти та фотографії',design:'Макет, кольори та відступи',animation:'Анімація появи'};
 for(const [key,panel] of Object.entries(panels)){const h=document.createElement('div');h.className='cms98-panel-heading';h.textContent=headings[key];panel.prepend(h)}
 holder.prepend(bar);holder.append(content,design,motion);switchTo(cms91ActiveTab);
}
function renderEditor(){if(pageId==='shared')return;if(selectedExisting)return;const holder=$('editorFields');holder.replaceChildren();const b=current();if(!b){holder.textContent='Додайте або оберіть блок';return}cmsSharedTextFields(holder,{title:b.title,body:b.body,onTitle:v=>{b.title=v;persist();renderExistingList();renderPreview()},onBody:v=>{b.body=v;persist();renderPreview()}});
if(b.type!=='text'){
 const media=document.createElement('div');media.className='cms93-media';
 const caption=document.createElement('h4');caption.textContent='ФОТОГРАФІЇ БЛОКУ';media.append(caption);
 const slotCount=b.type==='gallery'?3:b.type==='banner'?1:2;
 const descriptions=b.type==='gallery'?[['Велике фото','Рекомендовано 1600 × 1200 px · 4:3; розташовується зверху'],['Мале фото ліворуч','Рекомендовано 900 × 900 px · 1:1'],['Мале фото праворуч','Рекомендовано 900 × 900 px · 1:1']]:b.type==='banner'?[['Фонове фото банера','Рекомендовано 1920 × 900 px · широкий кадр, текст і градієнт зліва'],['Друге фото (не використовується)','Для банера потрібне одне фонове фото']]:[['Основне фото','Рекомендовано 1600 × 1200 px · 4:3; для квадратного макета 1200 × 1200 px'],['Друге фото','Для макета «Фото · текст · фото» · 1200 × 1500 px']];
 for(let i=0;i<slotCount;i++){
  const wrap=document.createElement('div');wrap.className='cms93-media-slot';
  const h=document.createElement('strong');h.textContent=descriptions[i][0];const hint=document.createElement('small');hint.textContent=descriptions[i][1];
  const url=i===0?b.image:(b.images?.[i]||'');
  const row=document.createElement('div');row.className='cms93-media-row';
  const preview=document.createElement('div');preview.className='cms93-media-thumb';
  if(url){const img=document.createElement('img');img.src=url;img.alt=descriptions[i][0];preview.append(img)}else preview.textContent='Фото не вибрано';
  const actions=document.createElement('div');actions.className='cms93-media-actions';
  const input=cmsPhotoUploadField(file=>uploadCmsImage(file,b,btn,i),'image/jpeg,image/png,image/webp,image/avif');input.hidden=true;
  const btn=document.createElement('button');btn.type='button';btn.textContent=url?'Замінити фото':'Завантажити фото';btn.onclick=()=>input.click();

  const del=document.createElement('button');del.type='button';del.className='cms93-remove';del.textContent='× Прибрати';del.disabled=!url;del.onclick=()=>{if(i===0)b.image='';else{b.images={...(b.images||{})};delete b.images[i]}persist();renderEditor();renderPreview()};
  const urlField=cmsPhotoUrlField(url,v=>{if(i===0)b.image=v;else{b.images={...(b.images||{}),[i]:v}}persist();renderEditor();renderPreview()},'Або вставити URL фотографії');
  actions.append(btn,del,input,urlField);row.append(preview,actions);wrap.append(h,hint,row);media.append(wrap);
 }
 holder.append(media);
}
const typeBox=document.createElement('div');typeBox.className='cms93-type-control cms91-field';const typeLabel=document.createElement('label');typeLabel.textContent='ТИП МАКЕТУ';const typeSelect=document.createElement('select');for(const [value,name] of [['editorial','Фото та текст'],['banner','Hero на всю ширину · градієнт зліва'],['text','Тільки текст'],['gallery','Три фото · 1 велике + 2 менші']])typeSelect.add(new Option(name,value));typeSelect.value=b.type;typeSelect.onchange=()=>{b.type=typeSelect.value;b.design={...b.design,layoutVersion:1,photoPreset:({banner:'gradient-hero',gallery:'three-photos',text:'text-only'})[b.type]||'left'};persist();renderEditor();renderPreview()};typeBox.append(typeLabel,typeSelect);holder.append(typeBox);
addDesignControls(holder,b.id,b.design||{},v=>{b.design=v;persist();renderPreview()},false,b.type,type=>{b.type=type;persist();renderEditor();renderPreview()});holder.append(field('АНІМАЦІЯ','select',b.animation,v=>{b.animation=v;changed()},animationOptions));holder.append(field('ТРИВАЛІСТЬ (мс)','number',b.duration,v=>{b.duration=Math.max(200,Math.min(1500,Number(v)||650));persist();renderPreview()}));cms91Tabs(holder,b);
 const removeBlock=document.createElement('button');removeBlock.type='button';removeBlock.className='secondary vh-delete-block';removeBlock.textContent='Видалити блок';
 removeBlock.onclick=()=>{if(!confirm('Видалити новий блок із чернетки?'))return;const id=b.id;blocks=blocks.filter(x=>x.id!==id);saveOrder(mergedOrder().filter(x=>x!==id));selected=null;changed();$('status').textContent='Новий блок видалено з чернетки. Опублікуйте зміни.'};
 holder.append(removeBlock);
}

function renderPreview(){scheduleLivePreview();if(pageId==='shared')return;const wrap=$('preview');wrap.replaceChildren();for(const b of blocks.filter(x=>x.visible!==false)){const card=document.createElement('article');card.className='preview-card '+b.type;card.dataset.animation=actualAnimation(b.animation);applyBlockDesign(card,b.design);applyCmsSpacing(card,b.design);card.style.setProperty('--duration',(b.duration||650)+'ms');if(b.type==='gallery'){for(let i=0;i<3;i++){const photo=document.createElement('div');photo.className='photo';const url=i===0?b.image:b.images?.[i];if(url&&/^(https?:\/\/|\/|\.\/?|\.\.\/)/.test(url))photo.style.backgroundImage='url('+JSON.stringify(url)+')';card.append(photo)}}else if(b.type!=='text'){const photo=document.createElement('div');photo.className='photo';if(b.image&&/^(https?:\/\/|\/|\.\/?|\.\.\/)/.test(b.image))photo.style.backgroundImage='url('+JSON.stringify(b.image)+')';card.append(photo)}const copy=document.createElement('div');copy.className='copy';const label=document.createElement('span');label.className='tag';label.textContent='VINTAGE HEDONISTA';const title=document.createElement('h3');title.textContent=b.title;const desc=document.createElement('div');desc.innerHTML=clean(b.body);copy.append(label,title,desc);card.append(copy);if(b.design?.backgroundMode==='transparent'||b.design?.surface==='transparent'){card.style.setProperty('background','#f2e9de','important');copy.style.setProperty('background','none','important');card.style.setProperty('color','#211a15','important');copy.style.setProperty('color','#211a15','important')}wrap.append(card)} }
let liveTimer=null,livePage='',sectionTargets=[];
const frame=$('siteFrame');
const viewport=$('desktopViewport');const previewWindow=document.querySelector('.live-preview-frame');
let cmsPreviewDeviceWidth=1440;
let cmsPreviewDeviceHeight=900;
function resizeDesktopPreview(){
 if(!viewport||!previewWindow)return;
 const available=Math.max(1,previewWindow.clientWidth-2);
 const width=cmsPreviewDeviceWidth;
 const scale=previewZoom==='fit'?Math.min(1,available/width):Math.max(.25,Math.min(1,Number(previewZoom)/100));const zoomLabel=$('studioZoom');if(zoomLabel)zoomLabel.textContent=Math.round(scale*100)+'%';
 const visibleHeight=Math.max(300,previewWindow.getBoundingClientRect().height||window.innerHeight-76);
 const iframeHeight=Math.ceil(visibleHeight/scale);
 viewport.style.setProperty('width',width+'px','important');
 viewport.style.setProperty('height',iframeHeight+'px','important');
 viewport.style.transformOrigin='top left';
 viewport.style.transform='scale('+scale+')';
 previewWindow.style.overflow='hidden';
 previewWindow.style.overflowX='hidden';
 previewWindow.style.overflowY='hidden';
 previewWindow.scrollLeft=0;
 frame.style.setProperty('width',width+'px','important');
 frame.style.setProperty('max-width','none','important');
 frame.style.setProperty('height',iframeHeight+'px','important');
 frame.setAttribute('scrolling','yes');
 const status=document.getElementById('cms125ViewportInfo');
 if(status)status.textContent=width+' × '+cmsPreviewDeviceHeight+' px · '+Math.round(scale*100)+'% масштабу';
}
if(typeof ResizeObserver!=='undefined')new ResizeObserver(resizeDesktopPreview).observe(previewWindow);
let previewZoom='fit';
window.VHCMSViewport={setDevice:device=>{cmsPreviewDeviceWidth={desktop:1440,tablet:820,mobile:390}[device]||1440;resizeDesktopPreview()},setZoom:value=>{previewZoom=value;resizeDesktopPreview()}};
window.addEventListener('resize',resizeDesktopPreview);
requestAnimationFrame(resizeDesktopPreview);
function scheduleLivePreview(){clearTimeout(liveTimer);liveTimer=setTimeout(updateLivePreview,180)}
function loadLivePage(){++previewEpoch;disconnectPreviewObserver();clearTimeout(previewReconcileTimer);selectedExisting=null;$('existingEditor').hidden=true;$('editorFields').hidden=false;const p=pages.find(x=>x.id===pageId);if(!p)return;livePage=pageId;sectionTargets=[];$('insertAfter').replaceChildren(new Option('Після основного вмісту','__end'));if(pageId==='home')frame.style.visibility='hidden';frame.src='../'+p.url+'?cms-preview=1';}
// STEP 58: isolated drafts for text edits to existing rendered sections.
let selectedExisting=null;
const existingKey=()=> 'vh-cms-existing-step65-'+pageId;
const orderKey=()=> 'vh-cms-order-step72-'+pageId;
function readOrder(){try{return JSON.parse(localStorage.getItem(orderKey()))||[]}catch{return []}}
function saveOrder(order){localStorage.setItem(orderKey(),JSON.stringify(order));markDirty()}
function mergedOrder(){
 const ids=[...sectionTargets.map(t=>t.id),...blocks.map(b=>b.id)];
 const saved=readOrder().filter(id=>ids.includes(id));
 return [...saved,...ids.filter(id=>!saved.includes(id))];
}
function moveUnified(id,delta){
 const order=mergedOrder(),i=order.indexOf(id),j=i+delta;
 if(i<0||j<0||j>=order.length)return;
 [order[i],order[j]]=[order[j],order[i]];saveOrder(order);renderExistingList();renderList();scheduleLivePreview();
}
function shiftAfter(id,afterId){
 const order=mergedOrder().filter(x=>x!==id);
 const i=order.indexOf(afterId);
 order.splice(i<0?order.length:i+1,0,id);saveOrder(order);renderExistingList();renderList();scheduleLivePreview();
}

function readExisting(){try{return JSON.parse(localStorage.getItem(existingKey()))||{}}catch{return {}}}
function saveExisting(data){localStorage.setItem(existingKey(),JSON.stringify(data));markDirty()}
let draggedBlockId=null;
function clearDragHighlights(){document.querySelectorAll('.cms-dragover,.cms-dragging').forEach(el=>el.classList.remove('cms-dragover','cms-dragging'))}
function placeBlock(from,to,after){const order=mergedOrder().filter(x=>x!==from);const i=order.indexOf(to);if(i<0)return;order.splice(i+(after?1:0),0,from);saveOrder(order);renderExistingList();renderList();scheduleLivePreview()}
function renderExistingList(){if(pageId==='shared')return;
 const host=$('existingBlocks');host.replaceChildren();
 const caption=document.createElement('p');caption.className='muted';caption.textContent='ВСІ БЛОКИ · ПЕРЕТЯГУЙТЕ ЗА ⠿ АБО КОРИСТУЙТЕСЬ СТРІЛКАМИ';host.append(caption);
 const order=mergedOrder();
 order.forEach((id,i)=>{
  const existing=sectionTargets.find(x=>x.id===id),fresh=blocks.find(x=>x.id===id);
  if(!existing&&!fresh)return;
  const row=document.createElement('div');row.className='existing-row cms-sort-row';row.dataset.cmsId=id;
  const grip=document.createElement('span');grip.className='cms-grip';grip.textContent='⠿';grip.title='Перетягнути блок';grip.draggable=true;row.append(grip);
  const b=document.createElement('button');b.className='existing-select'+(selectedExisting===id||selected===id&&!selectedExisting?' active':'');b.textContent=String(i+1).padStart(2,'0')+' · '+(existing?.label||fresh?.title||'Новий блок')+(fresh?' · НОВИЙ':'');
  b.onclick=()=>{if(existing){selectedExisting=id;renderExistingEditor()}else{selectedExisting=null;selected=id;$('existingEditor').hidden=true;$('editorFields').hidden=false;renderEditor()}renderExistingList()};row.append(b);
  for(const [glyph,delta] of [['↑',-1],['↓',1]]){const btn=document.createElement('button');btn.textContent=glyph;btn.disabled=i+delta<0||i+delta>=order.length;btn.title=delta<0?'Перемістити вище':'Перемістити нижче';btn.onclick=()=>moveUnified(id,delta);row.append(btn)}
  const del=document.createElement('button');del.textContent='×';del.title='Приховати наявний блок у чернетці';del.onclick=()=>{if(!confirm('Приховати цей блок у тестовій чернетці? Оригінал сайту залишиться без змін.'))return;const all=readExisting();all[id]={...(all[id]||{}),hidden:!all[id]?.hidden};saveExisting(all);if(existing)existing.el.style.display=all[id].hidden?'none':'';renderExistingList();scheduleLivePreview()};if(existing){del.textContent=readExisting()[id]?.hidden?'↺':'×';row.append(del)}
  if(fresh){const delNew=document.createElement('button');delNew.textContent='×';delNew.title='Видалити новий блок';delNew.onclick=()=>{if(!confirm('Видалити новий блок?'))return;blocks=blocks.filter(x=>x.id!==id);saveOrder(mergedOrder().filter(x=>x!==id));selected=null;selectedExisting=null;changed()};row.append(delNew)}
  grip.addEventListener('dragstart',e=>{draggedBlockId=id;e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('text/plain',id);row.classList.add('cms-dragging')});
  grip.addEventListener('dragend',()=>{draggedBlockId=null;row.classList.remove('cms-dragging');clearDragHighlights()});
  row.addEventListener('dragenter',e=>{e.preventDefault();row.classList.add('cms-dragover')});
  row.addEventListener('dragover',e=>{e.preventDefault();e.dataTransfer.dropEffect='move';row.classList.add('cms-dragover')});
  row.addEventListener('dragleave',e=>{if(!row.contains(e.relatedTarget))row.classList.remove('cms-dragover')});
  row.addEventListener('drop',e=>{e.preventDefault();e.stopPropagation();const dragged=draggedBlockId||e.dataTransfer.getData('text/plain');clearDragHighlights();if(dragged&&dragged!==id){const rect=row.getBoundingClientRect();placeBlock(dragged,id,e.clientY>rect.top+rect.height/2)}});
  host.append(row);
 });
 $('count').textContent=blocks.length+' нових блоків';
}
// STEP69: Explicit DOM field mappings for the three informational pages.
// Field IDs are taken from the actual frontend, not guessed from the first heading/paragraph.
function cmsFieldsFor(section){return window.VHCMSModel.fields(section,pageId)}
function cmsApplyMapped(section,mapped){window.VHCMSModel.applyMapped(section,mapped,pageId)}
function cmsPreviewImage(raw,base){
 const value=String(raw||'').trim();
 if(!value||value==='none'||value==='__removed__'||value==='undefined'||value==='null')return '';
 if(value.startsWith('data:image/'))return value;
 try{const url=new URL(value,base||frame.contentDocument?.baseURI||location.href);return ['http:','https:','blob:'].includes(url.protocol)?url.href:''}catch{return ''}
}
function cmsThumb(raw,base,alt='Мініатюра'){
 const box=document.createElement('div');box.className='cms-thumb-box cms-thumb-empty';
 const img=document.createElement('img');img.alt=alt;img.hidden=true;
 const label=document.createElement('span');label.className='cms-thumb-empty-label';label.textContent='Немає фото';
 box.append(img,label);
 const show=value=>{
  const url=cmsPreviewImage(value,base);
  if(!url){img.hidden=true;img.removeAttribute('src');box.classList.add('cms-thumb-empty');label.hidden=false;return}
  if(img.getAttribute('src')===url&&!img.hidden)return;
  img.onload=()=>{img.hidden=false;box.classList.remove('cms-thumb-empty');label.hidden=true};
  img.onerror=()=>{img.hidden=true;box.classList.add('cms-thumb-empty');label.hidden=false};
  if(img.getAttribute('src')!==url)img.src=url;
  else if(img.complete&&img.naturalWidth)img.onload();
 };
 show(raw);return {box,img,show};
}
const cmsLabels={
 journalPageTitle:'ЖУРНАЛ · Головний заголовок',journalPageSubtitle:'ЖУРНАЛ · Підзаголовок під назвою',
 journalNewTitle:'ЖУРНАЛ · Назва секції «Нове на сайті»',journalGuideTitle:'ЖУРНАЛ · Назва блоку гідів',
 journalGuideSubtitle:'ЖУРНАЛ · Опис блоку гідів',journalOtherTitle:'ЖУРНАЛ · Назва секції інших публікацій',
 journalCtaTitle:'ЖУРНАЛ · Заголовок нижнього банера',journalCtaText:'ЖУРНАЛ · Текст нижнього банера',
 journalCtaLink:'ЖУРНАЛ · Посилання кнопки на каталог',
 contactsKicker:'КОНТАКТИ · Надзаголовок',contactsTitle:'КОНТАКТИ · Заголовок',contactsIntro:'КОНТАКТИ · Вступний текст',
 deliveryKicker:'ДОСТАВКА · Надзаголовок',deliveryTitle:'ДОСТАВКА · Заголовок',deliveryIntro:'ДОСТАВКА · Вступний текст'
};
const cmsSelectorLabels={
 '.catalog-heading .kicker':'КАТАЛОГ · Напис над заголовком',
 '.catalog-heading .page-title':'КАТАЛОГ · Основний заголовок',
 '.catalog-intro-label':'КАТАЛОГ · Підпис вступного блоку',
 '.catalog-intro':'КАТАЛОГ · Вступний опис',
 '.capsule-hero-copy .capsule-kicker':'КАПСУЛИ · Надзаголовок',
 '.capsule-hero-copy h1':'КАПСУЛИ · Головний заголовок',
 '.capsule-hero-copy h2':'КАПСУЛИ · Другий заголовок',
 '.capsule-hero-copy p':'КАПСУЛИ · Опис',
 '.capsule-hero-photo':'КАПСУЛИ · Головне фото',
 '.capsule-intro-grid h2':'КАПСУЛИ · Заголовок вступу',
 '.capsule-intro-grid p':'КАПСУЛИ · Текст вступу'
};
function cmsReadableLabel(f){
 const homeNames={'#heroEyebrow':'Підпис HERO','#heroTitle':'Заголовок HERO','#heroDescription':'Опис HERO','#heroMain':'Головне фото HERO','#heroSide1':'Друге фото HERO','#heroSide2':'Третє фото HERO'};
 for(const [id,label] of Object.entries(homeNames))if(f.id==='static:'+id+':0')return label;
 if(cmsLabels[f.id])return cmsLabels[f.id];if(f.type==='text')return (f.el.matches('h1,h2,h3,h4')?'ЗАГОЛОВОК · ':'ТЕКСТ · ')+f.el.textContent.trim().slice(0,45);if(f.type==='image')return 'ФОТОГРАФІЯ';if(f.type==='link')return 'ПОСИЛАННЯ · '+f.el.textContent.trim().slice(0,45);
 if(f.id.startsWith('static:')){const selector=f.id.slice(7,f.id.lastIndexOf(':'));return cmsSelectorLabels[selector]||'ПОЛЕ СТОРІНКИ · '+selector}
 return f.id.replace(/([a-z])([A-Z])/g,'$1 $2').replace(/^(about)/i,'ПРО НАС · ').replace(/^(delivery)/i,'ДОСТАВКА · ').replace(/^(contacts)/i,'КОНТАКТИ · ');
}
function cmsRenderMappedEditor(host,target,draft){
 const fields=cmsFieldsFor(target.el);if(!fields.length)return false;

 const help=document.createElement('p');help.className='muted';help.textContent=pageId==='journal'?'Тут змінюються назви секцій і текст банера. Головна стаття, обкладинки та списки публікацій завантажуються з бази й редагуються у розділі «Вінтажні хроніки» чинної адмінки.':pageId==='catalog'?'Це оформлення каталогу. Картки товарів, фотографії, ціни та фільтри редагуються у відповідних розділах адмінки.':pageId==='contacts'?'Поля позначено за розташуванням на сторінці. Контактні адреси та кнопки-посилання редагуються окремо від тексту.':pageId==='delivery'?'Поля позначено за секціями доставки, оплати й оформлення.':'Редагування реальних елементів сторінки в локальній чернетці. Дані сайту та Supabase не змінюються.';if(pageId==='journal'||pageId==='catalog')host.append(help);
 const save=(id,value)=>{
  const all=readExisting(),d={...(all[target.id]||{})};
  d.mapped={...(d.mapped||{}),[id]:value};if(d.design?.layoutVersion===1){const slot=fields.filter(f=>f.type==='image').findIndex(f=>f.id===id);if(slot>=0)d.layoutImages={...d.layoutImages,[slot]:value}}all[target.id]=d;saveExisting(all);
  cmsApplyMapped(target.el,d.mapped);
  if(d.design?.layoutVersion===1||target.el.matches('.hero'))applyBlockDesign(target.el,d.design);scheduleLivePreview();
  $('status').textContent='Чернетку збережено локально · не опубліковано';
 };
 for(const f of fields){
  if(f.type==='image'&&draft.design?.layoutVersion===1&&draft.design.photoPreset!=='original')continue;
  const wrap=document.createElement('div');wrap.className='field cms-mapped-field';
  const label=document.createElement('label');label.textContent=cmsReadableLabel(f);wrap.append(label);
  const slot=fields.filter(item=>item.type==='image').indexOf(f);const value=f.type==='image'&&draft.design?.layoutVersion===1&&Object.prototype.hasOwnProperty.call(draft.layoutImages||{},slot)?draft.layoutImages[slot]:window.VHCMSModel.mappedValue(f,draft.mapped);
  if(f.type==='image'){
   const original=f.photo?.url||f.el.querySelector('img')?.getAttribute('src')||getComputedStyle(f.el).backgroundImage.match(/url\(["']?(.+?)["']?\)/)?.[1]||'';
   const {box,img:thumb,show:showThumb}=cmsThumb(value??original,frame.contentDocument.baseURI,f.id);
   const x=document.createElement('button');x.className='cms-photo-x';x.type='button';x.textContent='×';x.title='Прибрати фото';x.onclick=()=>{save(f.id,'__removed__');showThumb('')};box.append(thumb,x);wrap.append(box);
   const input=document.createElement('input');input.placeholder='URL або шлях до фото';input.value=value&&value!=='__removed__'&&!value.startsWith('data:')?value:'';
   input.onchange=()=>{const v=input.value.trim();if(v&&!/^(https?:|\/|\.\/|\.\.\/)/i.test(v)){alert('Вкажіть коректну адресу фото');return}save(f.id,v);showThumb(v)};wrap.append(input);
   const file=document.createElement('input');file.type='file';file.accept='image/png,image/jpeg,image/webp';
   file.onchange=async()=>{const f0=file.files?.[0];if(!f0)return;file.disabled=true;try{const url=await uploadExistingCmsPhoto(f0,f.id);save(f.id,url);showThumb(url);input.value=url;$('status').textContent='Фото завантажено в Supabase Storage. Збережіть чернетку.'}catch(e){alert('Помилка завантаження фото: '+(e.message||e))}finally{file.disabled=false;file.value=''}};wrap.append(file);
  }else if(f.type==='link'){
   const input=document.createElement('input');input.value=value??f.el.getAttribute('href')??'';input.placeholder='https:// або шлях до сторінки';input.onchange=()=>{const v=input.value.trim();if(v&&!/^(https?:|mailto:|tel:|\/|\.\/|\.\.\/|#)/i.test(v)){alert('Неприпустиме посилання');return}save(f.id,v)};wrap.append(input);
  }else{
   wrap.append(makeRichEditor(value??f.el.innerHTML,v=>save(f.id,v)));
   const settings=document.createElement('details');settings.className='cms-text-style';const summary=document.createElement('summary');summary.textContent='Оформлення цього тексту';settings.append(summary);
   const styles=draft.fieldStyles?.[f.id]||{};
   const setStyle=(key,value)=>{const all=readExisting(),edit=all[target.id]||{};edit.fieldStyles={...edit.fieldStyles,[f.id]:{...edit.fieldStyles?.[f.id],[key]:value}};all[target.id]=edit;saveExisting(all);window.VHCMSModel.applyFieldStyles(target.el,edit.fieldStyles,pageId);scheduleLivePreview()};
   settings.append(field('Розмір, px','number',styles.size||Math.round(parseFloat(frame.contentWindow.getComputedStyle(f.el).fontSize))||16,v=>setStyle('size',Number(v))),field('Вирівнювання','select',styles.align||'left',v=>setStyle('align',v),[['left','Ліворуч'],['center','По центру'],['right','Праворуч']]),field('Міжрядковий інтервал','number',styles.lineHeight||1.6,v=>setStyle('lineHeight',Number(v))),field('Насиченість','select',String(styles.weight||400),v=>setStyle('weight',Number(v)),[['300','Тонкий'],['400','Звичайний'],['500','Середній'],['600','Напівжирний'],['700','Жирний']]));
   const color=document.createElement('input');color.type='color';color.setAttribute('aria-label','Колір цього тексту');color.value=styles.color||'#f2e5d5';color.oninput=()=>setStyle('color',color.value);settings.append(color);wrap.append(settings);

  }
  host.append(wrap);
 }
 return true;
}
function renderExistingEditor(){
 const host=$('existingEditor');host.replaceChildren();const target=sectionTargets.find(x=>x.id===selectedExisting);
 host.hidden=!target;$('editorFields').hidden=!!target;if(!target){return}
 if(pageId==='journal'&&target.el.matches('.journal-v37-feature-section')){const note=document.createElement('p');note.className='muted';note.textContent='ГОЛОВНА СТАТТЯ · Перший великий матеріал журналу. Її назва, фото та текст беруться з запису статті. Для зміни відкрий «Вінтажні хроніки» у чинній адмінці.';host.append(note)}

 const data=readExisting(),draft=data[target.id]||{};
 if(pageId==='catalog'&&target.el.querySelector('#productGrid,.product-grid,[id*=productGrid]')){const note=document.createElement('p');note.className='muted';note.textContent='СІТКА ТОВАРІВ · У перегляді показані справжні картки товарів із каталогу. Назва, ціна, фото й опис кожного товару змінюються в розділі «Товари», а не в конструкторі сторінок.';host.append(note)}
 if(!cmsRenderMappedEditor(host,target,draft)){
  if(['product','article','account','checkout'].includes(pageId)){
   const note=document.createElement('p');note.className='muted';note.textContent='Системний вміст і записи товарів/статей редагуються у відповідних розділах адмінки.';host.append(note);
  }else{
   const headingEl=target.el.querySelector('h1,h2,h3');
   const descriptionEl=target.el.querySelector('p');
   const update=(key,value,el,rich=false)=>{
    const latest=readExisting();latest[target.id]={...(latest[target.id]||{}),[key]:value};saveExisting(latest);
    if(el){if(rich)el.innerHTML=clean(value);else el.textContent=value}
    $('status').textContent='Чернетку наявного блоку збережено локально · не опубліковано';
   };
   cmsSharedTextFields(host,{
    title:headingEl?(draft.title??headingEl.textContent.trim()):null,
    body:descriptionEl?(draft.description??descriptionEl.innerHTML):null,
    onTitle:value=>update('title',value,headingEl),
    onBody:value=>update('description',value,descriptionEl,true)
   });
  }
 }
 const photos=(pageId==='home'&&target.el.matches('.hero'))?[]:cmsSectionPhotos(target.el);
 if(photos.length&&(!cmsFieldsFor(target.el).some(f=>f.type==='image'))&&!(pageId==='home'&&target.el.matches('.homepage-capsules'))&&!(pageId==='home'&&target.el.matches('.hero'))){
  const title=document.createElement('h3');title.textContent='ФОТОГРАФІЇ БЛОКУ';title.className='photos-title';host.append(title);
  photos.forEach((photo,i)=>{
   const key='image'+i,wrap=document.createElement('div');wrap.className='photo-field';const thumbBox=document.createElement('div');thumbBox.className='cms-thumb-box';
   const effective=draft.images?.[key]==='__removed__'?'':(draft.images?.[key]||photo.url);const {box:thumbnail,img,show:showThumb}=cmsThumb(effective,frame.contentDocument.baseURI,'Мініатюра '+(i+1));
   const right=document.createElement('div');right.className='photo-controls';
   const label=document.createElement('label');label.textContent='Фото '+(i+1)+' · замінити URL';
   const input=cmsPhotoUrlField(draft.images?.[key]==='__removed__'?'':(draft.images?.[key]||''),url=>update(url),'https://... або шлях до фото');
   const update=url=>{
    const latest=readExisting(),d={...(latest[target.id]||{})};
    d.images={...(d.images||{}),[key]:url};latest[target.id]=d;saveExisting(latest);
    cmsSetPhoto(photo,url==='__removed__'?'__removed__':(url||photo.url),i);
    showThumb(url==='__removed__'?'':(url||photo.url));
    $('status').textContent='Фото змінено у локальній чернетці · сайт не опубліковано';
   };

   const file=cmsPhotoUploadField(async f=>{const url=await uploadExistingCmsPhoto(f,target.id+'-'+key);update(url);input.value=url;$('status').textContent='Фото завантажено в Supabase Storage. Збережіть чернетку.'},'image/png,image/jpeg,image/webp,image/gif');
   const note=document.createElement('small');note.textContent='Зміни збережуться після натискання «Зберегти чернетку»';
   const remove=document.createElement('button');remove.type='button';remove.className='cms-photo-x';remove.textContent='×';remove.title='Видалити фото';remove.setAttribute('aria-label','Видалити фото');remove.onclick=()=>{update('__removed__');input.value='';};right.append(label,input,file,note);thumbnail.append(remove);wrap.append(thumbnail,right);host.append(wrap);
  });
 }
 if(draft.design?.layoutVersion===1&&draft.design.photoPreset!=='original'){
  const media=document.createElement('div');media.className='cms-layout-media';
  const slots=draft.design.photoPreset==='three-photos'?3:draft.design.photoPreset==='framed'?2:draft.design.photoPreset==='text-only'?0:1;
  for(let i=0;i<slots;i++){const wrap=document.createElement('div');wrap.className='field';const label=document.createElement('label');label.textContent='Фото макета '+(i+1);wrap.append(label);const initial=window.VHCMSModel.imageSources(target.el,draft,pageId)[i]||'';const thumb=cmsThumb(initial,frame.contentDocument.baseURI,'Фото макета '+(i+1));wrap.append(thumb.box);const save=url=>{const all=readExisting();all[target.id]={...all[target.id],layoutImages:{...all[target.id]?.layoutImages,[i]:url}};saveExisting(all);thumb.show(url==='__removed__'?'':url);scheduleLivePreview()};const remove=document.createElement('button');remove.type='button';remove.className='cms-photo-x';remove.textContent='×';remove.title='Прибрати фото макета';remove.onclick=()=>save('__removed__');thumb.box.append(remove);wrap.append(cmsPhotoUploadField(async file=>save(await uploadExistingCmsPhoto(file,target.id+'-layout-'+i)),'image/jpeg,image/png,image/webp,image/avif'),cmsPhotoUrlField(initial,save,'Посилання на фото'));media.append(wrap)}host.append(media);
 }
 cmsCustomButtonEditor(host,target,draft);
 // Shared animation controls for existing site sections. 'System' retains their native CSS animation.
 host.append(field('АНІМАЦІЯ','select',draft.animation||'system',v=>{
  const all=readExisting();all[target.id]={...(all[target.id]||{}),animation:v};saveExisting(all);
  applyExistingAnimation(target.el,v);$('status').textContent='Анімацію змінено у чернетці';
 },animationOptions));
 host.append(field('ТРИВАЛІСТЬ (мс)','number',draft.duration||700,value=>{const all=readExisting();all[target.id]={...all[target.id],duration:Math.max(200,Math.min(1500,Number(value)||700))};saveExisting(all);scheduleLivePreview()}));
 // Design controls for each existing section (draft only)
 addDesignControls(host,target.id,draft.design||{},value=>{const all=readExisting();all[target.id]={...(all[target.id]||{}),design:value};saveExisting(all);applyBlockDesign(target.el,value);if(value.layoutVersion!==1&&!(pageId==='home'&&target.el.matches('.hero')))cmsApplyExistingLayout(target.el,value,all[target.id].templateImage);// Keep the active controls mounted: rebuilding them on each slider input resets focus and scroll.
 scheduleLivePreview()},false);
 // Template-specific photo controls: one photo for gradient, native fields for legacy layouts.
 const gradientSelected=(draft.design?.layoutVersion!==1&&draft.design?.photoPreset==='gradient-hero')&&!(pageId==='home'&&target.el.matches('.hero'));
 if(gradientSelected){
  host.querySelectorAll('.photo-field,.cms-mapped-field').forEach(node=>{
   if(node.classList.contains('photo-field')||node.querySelector('input[type=file]'))node.hidden=true;
  });
  const title=document.createElement('h3');title.textContent='ФОТО ДЛЯ ГРАДІЄНТНОГО БАНЕРА · 1920 × 900 px';host.append(title);
  const wrap=document.createElement('div');wrap.className='field cms-gradient-image-field';
  const current=draft.templateImage&&draft.templateImage!=='__removed__'?draft.templateImage:'';
  const thumb=cmsThumb(current,frame.contentDocument.baseURI,'Фонове фото градієнта');wrap.append(thumb.box);
  const input=document.createElement('input');input.placeholder='Посилання на фото · 1920 × 900';input.value=current;wrap.append(input);
  const setImage=value=>{const all=readExisting();all[target.id]={...(all[target.id]||{}),templateImage:value};saveExisting(all);cmsApplyExistingLayout(target.el,all[target.id].design||{},value);thumb.show(value==='__removed__'?'':value);$('status').textContent='Фонове фото градієнта збережене в чернетці'};
  input.onchange=()=>{const v=input.value.trim();if(v&&!['https://','http://','/','./','../'].some(prefix=>v.startsWith(prefix))){alert('Некоректне посилання');return}setImage(v||'__removed__')};
  const file=document.createElement('input');file.type='file';file.accept='image/jpeg,image/png,image/webp';file.onchange=async()=>{const f=file.files?.[0];if(!f)return;file.disabled=true;try{const url=await uploadExistingCmsPhoto(f,target.id+'-gradient');setImage(url);input.value=url}catch(e){alert('Не вдалося завантажити фото: '+(e.message||e))}finally{file.disabled=false;file.value=''}};wrap.append(file);
  const remove=document.createElement('button');remove.type='button';remove.textContent='Видалити фонове фото';remove.onclick=()=>{setImage('__removed__');input.value=''};wrap.append(remove);host.append(wrap);
 }
 cms91Tabs(host,{type:'editorial'});
 const reset=document.createElement('button');reset.className='secondary';reset.textContent='Скинути зміни цього блоку';reset.onclick=()=>{const d=readExisting();delete d[target.id];saveExisting(d);frame.src=frame.src};host.append(reset);
 const removeBlock=document.createElement('button');removeBlock.type='button';removeBlock.className='secondary vh-delete-block';removeBlock.textContent='Видалити блок';removeBlock.onclick=()=>{if(!confirm('Прибрати блок «'+target.label+'» зі сторінки? Після публікації він буде прихований для покупців.'))return;const all=readExisting();all[target.id]={...(all[target.id]||{}),hidden:true};saveExisting(all);target.el.style.display='none';selectedExisting=null;renderExistingList();renderExistingEditor();scheduleLivePreview();$('status').textContent='Блок приховано в чернетці. Збережіть та опублікуйте зміни.'};host.append(removeBlock);
}
function applyCapsulePhoto(section,url){
 const media=section?.querySelector('#homeCapsulesMedia');if(!media)return;
 if(!url)return;
 media.replaceChildren();
 if(url==='__removed__')return;
 const img=frame.contentDocument.createElement('img');img.src=url;img.alt='Фото капсул';img.loading='eager';img.decoding='async';
 img.style.cssText='width:100%;height:100%;object-fit:cover;display:block';
 img.onerror=()=>{
  if(!img.isConnected)return;
  media.dataset.cmsPhotoError='true';
  const warning=frame.contentDocument.createElement('div');
  warning.textContent='Не вдалося завантажити фото. Перевірте посилання або доступ до файлу.';
  warning.style.cssText='padding:24px;color:#fff;background:#6e2929;font:14px/1.5 sans-serif';
  img.replaceWith(warning);
  const status=document.getElementById('status');
  if(status)status.textContent='Помилка завантаження фото «Капсули» у перегляді';
 };
 img.onload=()=>{delete media.dataset.cmsPhotoError};
 media.append(img);
}
function applyExistingAnimation(el,value){
 if(!el)return;
 el.classList.remove('cms-animation-fade-up','cms-animation-fade-left','cms-animation-fade-right','cms-animation-zoom','cms-animation-fade','cms-animation-none');
 if(value&&value!=='system')el.classList.add('cms-animation-'+value);
}
function cmsRenderCustomButtons(section,buttons){window.VHCMSModel.applyButtons(section,buttons)}
function cmsCustomButtonEditor(host,target,draft){
 const wrap=document.createElement('div');wrap.className='vh-cms-buttons-editor';
 const buttons=Array.isArray(draft.customButtons)?draft.customButtons.map(b=>({...b})):[];
 const save=()=>{const all=readExisting();all[target.id]={...(all[target.id]||{}),customButtons:buttons.map(b=>({...b}))};saveExisting(all);cmsRenderCustomButtons(target.el,buttons);scheduleLivePreview()};
 const draw=()=>{
  wrap.replaceChildren();
  for(const [i,b] of buttons.entries()){
   const group=document.createElement('div');group.className='vh-cms-button-entry';
   for(const [key,label] of [['label','Назва кнопки'],['url','Посилання кнопки']]){
    const input=document.createElement('input');input.placeholder=label;input.value=b[key]||'';
    input.oninput=()=>{b[key]=input.value;save()};group.append(input);
   }
   const align=document.createElement('select');
   for(const [value,label] of [['left','Ліворуч'],['center','По центру'],['right','Праворуч']])align.add(new Option(label,value));
   align.value=b.position||'left';align.onchange=()=>{b.position=align.value;save()};group.append(align);
   const remove=document.createElement('button');remove.type='button';remove.textContent='Видалити кнопку';remove.onclick=()=>{buttons.splice(i,1);save();draw()};group.append(remove);
   for(const [axis,label] of [['x','По горизонталі'],['y','По вертикалі']]){
    const control=document.createElement('label');control.className='vh-cms-position-label';control.textContent=label;
    const range=document.createElement('input');range.type='range';range.min='0';range.max='100';range.step='1';range.value=b[axis]??50;
    range.oninput=()=>{b[axis]=Number(range.value);save()};control.append(range);group.append(control);
   }
   const widthLabel=document.createElement('label');widthLabel.className='vh-cms-position-label';widthLabel.textContent='Ширина кнопки (70–500 px)';
   const width=document.createElement('input');width.type='number';width.min=70;width.max=500;width.value=b.width||160;width.onchange=()=>{b.width=Math.max(70,Math.min(500,Number(width.value)||160));save()};widthLabel.append(width);group.append(widthLabel);
   const appearance=document.createElement('select');appearance.add(new Option('Темна · золотистий контур','dark'));appearance.add(new Option('Світла · темний текст','light'));appearance.value=b.style||'dark';appearance.onchange=()=>{b.style=appearance.value;save()};group.append(appearance);
   wrap.append(group);
  }
  const add=document.createElement('button');add.type='button';add.className='vh-cms-add-button';add.textContent='+ Додати кнопку';add.onclick=()=>{buttons.push({label:'Нова кнопка',url:'#',position:'left'});save();draw()};wrap.append(add);
 };
 draw();host.append(wrap);
}
function applyExistingDrafts(){const data=readExisting();for(const t of sectionTargets){
 if(pageId==='home'&&t.el.matches('.homepage-capsules')){
  const media=t.el.querySelector('#homeCapsulesMedia'),copy=t.el.querySelector('.editorial-copy');
  // Keep the public site's default composition: copy left, one image right.
  if(media&&copy){media.style.order='2';copy.style.order='1'}
 }
const d=data[t.id];if(!d)continue;if(d.hidden)t.el.style.display='none';else t.el.style.removeProperty('display');if(d.mapped)cmsApplyMapped(t.el,d.mapped);if(d.design){applyBlockDesign(t.el,d.design);if(d.design.layoutVersion!==1&&!cmsFieldsFor(t.el).some(f=>f.type==='image')&&!(pageId==='home'&&t.el.matches('.hero')))cmsApplyExistingLayout(t.el,d.design,d.templateImage)}applyExistingAnimation(t.el,d.animation||'system');if(d.capsuleImage)applyCapsulePhoto(t.el,d.capsuleImage);cmsRenderCustomButtons(t.el,d.customButtons);for(const [key,sel] of [['title','h1,h2,h3'],['description','p']]){if(typeof d[key]==='string'&&!Object.prototype.hasOwnProperty.call(d.mapped||{},'unified:'+key)){const el=t.el.querySelector(sel);if(el){if(key==='description')el.innerHTML=clean(d[key]);else el.textContent=d[key]}}}}}
const cmsPhotoSlots=new WeakMap();
function cmsSectionPhotos(section){
 if(cmsPhotoSlots.has(section)){
  const saved=cmsPhotoSlots.get(section);
  if(saved.every(p=>p.node===section||section.contains(p.node)))return saved;
  cmsPhotoSlots.delete(section);
 }
 const photos=[],nodes=[section,...section.querySelectorAll('*')].slice(0,900);
 const bgURL=s=>String(s||'').match(/url\(\s*['"]?([^'"\)]+)['"]?\s*\)/)?.[1]||'';
 for(const node of nodes){
  if(photos.length>=40)break;
  const add=(url,kind)=>{if(url&&url!=='none'&&!url.startsWith('data:')&&photos.length<40)photos.push({node,url,kind})};
  if(node.tagName==='IMG')add(node.getAttribute('src')||node.currentSrc,'img');
  if(node.tagName==='VIDEO')add(node.getAttribute('poster'),'poster');
  add(bgURL(getComputedStyle(node).backgroundImage),'bg');
  for(const pseudo of ['::before','::after'])try{add(bgURL(getComputedStyle(node,pseudo).backgroundImage),pseudo)}catch{}
 }
 cmsPhotoSlots.set(section,photos);return photos;
}
function cmsSetPhoto(photo,value,index){
 const {node,kind}=photo,doc=node.ownerDocument;
 if(value==='__removed__'){
  if(kind==='img')node.style.visibility='hidden';
  else if(kind==='poster')node.removeAttribute('poster');
  else if(kind==='bg')node.style.setProperty('background-image','none','important');
  else {node.style.setProperty('--cms-replacement-'+index,'none');node.setAttribute('data-cms-photo-'+index,'')}
  return;
 }
 if(!value)return;
 if(kind==='img'){
  node.style.removeProperty('visibility');
  if(node.getAttribute('src')!==value)node.setAttribute('src',value);
  node.removeAttribute('srcset');node.removeAttribute('sizes');
 }else if(kind==='poster'){
  if(node.getAttribute('poster')!==value)node.setAttribute('poster',value);
 }else if(kind==='bg'){
  const bg='url('+JSON.stringify(value)+')';
  if(node.style.backgroundImage!==bg)node.style.setProperty('background-image',bg,'important');
 }else{
  const id='vh-cms-photo-rule-'+index+'-'+kind.replace(':','');
  let st=doc.getElementById(id);
  if(!st){st=doc.createElement('style');st.id=id;st.textContent='[data-cms-photo-'+index+']'+kind+'{background-image:var(--cms-replacement-'+index+')!important}';doc.head.append(st)}
  node.style.setProperty('--cms-replacement-'+index,'url('+JSON.stringify(value)+')');
  node.setAttribute('data-cms-photo-'+index,'');
 }
}
function applyImageDrafts(){
 const drafts=readExisting();
 for(const target of sectionTargets){
  if(pageId==='home'&&target.el.matches('.homepage-capsules'))continue;
  const current=drafts[target.id]||{};
  if(pageId==='home'&&target.el.matches('.hero'))continue;
  if(current.mapped&&cmsFieldsFor(target.el).some(f=>f.type==='image'))continue;
  const photos=cmsSectionPhotos(target.el),images=current.images;
  if(!images)continue;
  photos.forEach((photo,i)=>{if(images['image'+i]!==undefined)cmsSetPhoto(photo,images['image'+i],i)});
 }
}
function detectSections(doc){
 if(pageId==='shared'){sectionTargets=[];return}
 const sel=$('insertAfter'),old=sel.value;sel.replaceChildren(new Option('Після основного вмісту','__end'));
 sectionTargets=window.VHCMSModel.sections(doc,pageId).map((el,i)=>{const label=(el.querySelector('h1,h2,h3')?.textContent||el.getAttribute('aria-label')||el.id||el.className||'Блок '+(i+1)).toString().replace(/\s+/g,' ').trim().slice(0,75);const id=window.VHCMSModel.sectionId(el,i);sel.add(new Option((i+1)+'. '+label,id));return {id,el,label}});
 sel.value=[...sel.options].some(x=>x.value===old)?old:'__end';renderExistingList();for(const target of sectionTargets){cmsSectionPhotos(target.el);cmsFieldsFor(target.el)}applyExistingDrafts();applyImageDrafts();renderExistingEditor();
}
function installCmsPreviewStyles(doc){
 let style=doc.getElementById('vh-cms-step66-styles');
 if(style)return;
 style=doc.createElement('style');style.id='vh-cms-step66-styles';
 style.textContent=`
 /* Editing mode: avoid storefront entrance animations obscuring the true content. */
 .hero,.hero *,.homepage-capsules,.homepage-capsules *{animation-duration:0s!important;animation-delay:0s!important;transition-duration:0s!important;transition-delay:0s!important}
 main > .vh-cms-injected-unit{margin:28px 0!important;display:block!important;clear:both}
 .vh-cms-injected-unit + .vh-cms-injected-unit{margin-top:28px!important}
 .vh-cms-injected-unit .vh-lab-card{margin:0!important;min-height:220px}
 .cms-white-copy .vh-lab-copy,.cms-white-copy .copy,.cms-white-copy .homepage-capsules-copy,.cms-white-copy .editorial-copy{background:#fff!important;color:#211a15!important;padding:28px!important}
 .cms-cream-copy .vh-lab-copy,.cms-cream-copy .copy,.cms-cream-copy .homepage-capsules-copy,.cms-cream-copy .editorial-copy{background:#f5ede2!important;color:#211a15!important;padding:28px!important}
 .cms-white-copy .vh-lab-copy *,.cms-white-copy .copy *,.cms-white-copy .homepage-capsules-copy *,.cms-white-copy .editorial-copy *,
 .cms-cream-copy .vh-lab-copy *,.cms-cream-copy .copy *,.cms-cream-copy .homepage-capsules-copy *,.cms-cream-copy .editorial-copy *{color:#211a15!important}
 .cms-transparent-copy .vh-lab-copy,.cms-transparent-copy .copy{background:transparent!important}
 .cms-animation-none{animation:none!important;opacity:1!important;transform:none!important}
 .cms-animation-fade-up{animation:cms66Up .7s both!important}
 .cms-animation-fade-left{animation:cms66Left .7s both!important}
 .cms-animation-fade-right{animation:cms66Right .7s both!important}
 .cms-animation-fade{animation:cms66Fade .7s both!important}
 .cms-animation-zoom{animation:cms66Zoom .7s both!important}
 @keyframes cms66Up{from{opacity:0;transform:translateY(24px)}to{opacity:1;transform:none}}
 @keyframes cms66Left{from{opacity:0;transform:translateX(-24px)}to{opacity:1;transform:none}}
 @keyframes cms66Right{from{opacity:0;transform:translateX(24px)}to{opacity:1;transform:none}}
 @keyframes cms66Fade{from{opacity:0}to{opacity:1}}
 @keyframes cms66Zoom{from{opacity:0;transform:scale(.97)}to{opacity:1;transform:none}}
 @media(prefers-reduced-motion:reduce){.cms-animation-fade-up,.cms-animation-fade-left,.cms-animation-fade-right,.cms-animation-fade,.cms-animation-zoom{animation:none!important}}
 `;
 doc.head.append(style);
}
function cms96Viewport(){
 const preview=document.querySelector('.live-preview-frame');
 if(!frame||!viewport||!preview||document.querySelector('.cms96-device-bar'))return;
 const bar=document.createElement('div');bar.className='cms96-device-bar';
 const title=document.createElement('span');title.textContent='ПЕРЕГЛЯД НА ПРИСТРОЯХ';bar.append(title);
 const devices=[['Комп’ютер',1440,900],['Ноутбук',1280,800],['Планшет',820,1180],['Телефон',390,844],['Великий телефон',430,932]];
 devices.unshift(['Мій екран',Math.max(320,window.innerWidth),Math.max(400,window.innerHeight)]);
 devices.forEach(([name,width,height],i)=>{
  const button=document.createElement('button');button.type='button';button.textContent=name;
  button.className=i===1?'active':'';
  button.onclick=()=>{
   cmsPreviewDeviceWidth=width;cmsPreviewDeviceHeight=height;
   resizeDesktopPreview();
   bar.querySelectorAll('button').forEach(x=>x.classList.toggle('active',x===button));
  };
  bar.append(button);
 });
 const info=document.createElement('span');info.id='cms125ViewportInfo';info.style.cssText='font-size:11px;opacity:.75;white-space:nowrap';bar.append(info);
 preview.parentElement.insertBefore(bar,preview);
 resizeDesktopPreview();
}
function updateLivePreviewCore(){cms96Viewport();
 // Keep horizontal scrolling disabled inside the website iframe; vertical scroll remains native.
 try{const inner=frame.contentDocument;if(inner?.head&&!inner.getElementById('vh-cms-scroll-axis')){
  const st=inner.createElement('style');st.id='vh-cms-scroll-axis';
  st.textContent='html,body{overflow-x:hidden!important;max-width:100%!important}html{overflow-y:auto!important}';
  inner.head.append(st);
 }}catch{}
if(livePage!==pageId){loadLivePage();return}let doc;try{doc=frame.contentDocument;if(!doc||doc.readyState==='loading')return}catch{return}applySharedPreview(doc);if(pageId==='shared')return;applyExistingDrafts();applyImageDrafts();installCmsPreviewStyles(doc);doc.querySelectorAll('.vh-cms-injected-unit').forEach(n=>n.remove());doc.getElementById('vh-cms-injected-style')?.remove();const style=doc.createElement('style');style.id='vh-cms-injected-style';style.textContent=`.vh-cms-injected-unit{display:block;clear:both;background:#f5f0e9;color:#231911;padding:0;}.vh-cms-injected-unit .vh-lab-label{font:11px 'Montserrat',Arial,sans-serif;letter-spacing:2px;color:#805c38;margin:0 0 14px}.vh-cms-injected-unit .vh-lab-card{display:grid;grid-template-columns:1fr 1fr;background:#0d0c09;color:#f2e5d5;min-height:390px;margin:0;overflow:hidden}.vh-cms-injected-unit .vh-lab-photo{min-height:250px;background:linear-gradient(135deg,#593b29,#281a13);background-position:center;background-size:cover}.vh-cms-injected-unit .vh-lab-copy{padding:clamp(38px,6vw,110px);align-self:center}.vh-cms-injected-unit h2{font:clamp(32px,4vw,66px) 'Bodoni Moda',Georgia,serif;color:inherit;margin:12px 0}.vh-cms-injected-unit p{color:inherit;line-height:1.7;font-family:'Montserrat',Arial,sans-serif}.vh-cms-injected-unit .vh-lab-card[data-type=text]{display:block;background:#e9dccb;color:#21160e}.vh-cms-injected-unit .vh-lab-card[data-type=banner]{position:relative;display:block;min-height:540px}.vh-cms-injected-unit .vh-lab-card[data-type=banner] .vh-lab-photo{position:absolute;inset:0;opacity:.5}.vh-cms-injected-unit .vh-lab-card[data-type=banner] .vh-lab-copy{position:relative;max-width:60%;padding:110px 7%}.vh-cms-injected-unit .vh-lab-card[data-type=gallery]{grid-template-columns:repeat(3,1fr)}.vh-cms-injected-unit .vh-lab-card[data-type=gallery] .vh-lab-photo{border-right:4px solid #f5f0e9}.vh-cms-injected-unit .vh-lab-card[data-type=gallery] .vh-lab-copy{grid-column:1/-1;padding:36px 7%}@media(max-width:700px){.vh-cms-injected-unit .vh-lab-card{grid-template-columns:1fr}.vh-cms-injected-unit .vh-lab-card[data-type=banner] .vh-lab-copy{max-width:100%}}`;style.textContent+=`.vh-cms-injected-unit{background:transparent!important}.vh-cms-injected-unit .vh-lab-card{overflow:hidden!important;isolation:isolate}.vh-cms-injected-unit .vh-lab-card[data-type=editorial]{align-items:stretch}.vh-cms-injected-unit .vh-lab-card[data-type=editorial] .vh-lab-photo{height:100%;min-height:100%}.vh-cms-injected-unit .vh-lab-copy{box-sizing:border-box;align-self:stretch;display:flex;flex-direction:column;justify-content:center}.vh-cms-injected-unit .cms-white-copy .vh-lab-copy{background:#fff!important;color:#211a15!important;padding:clamp(38px,6vw,110px)!important}.vh-cms-injected-unit .cms-cream-copy .vh-lab-copy{background:#f5ede2!important;color:#211a15!important;padding:clamp(38px,6vw,110px)!important}.vh-cms-injected-unit .cms-transparent-copy{background:transparent!important}.vh-cms-injected-unit .cms-transparent-copy .vh-lab-copy{background:transparent!important}.vh-cms-injected-unit .cms-white-copy .vh-lab-copy *, .vh-cms-injected-unit .cms-cream-copy .vh-lab-copy *{color:#211a15!important}`;style.textContent+=`.vh-cms-injected-unit .vh-lab-card[data-type=gallery]{display:grid!important;grid-template-columns:2fr 1fr!important;grid-template-rows:180px 180px auto!important;gap:10px;padding:10px;min-height:0!important}.vh-cms-injected-unit .vh-lab-card[data-type=gallery]>.vh-lab-photo{min-height:0!important;height:100%!important;width:100%!important;margin:0!important;aspect-ratio:auto!important;background-size:cover!important;border:0!important}.vh-cms-injected-unit .vh-lab-card[data-type=gallery]>.vh-lab-photo:first-child{grid-row:1/3;grid-column:1}.vh-cms-injected-unit .vh-lab-card[data-type=gallery]>.vh-lab-photo:nth-child(2){grid-row:1;grid-column:2}.vh-cms-injected-unit .vh-lab-card[data-type=gallery]>.vh-lab-photo:nth-child(3){grid-row:2;grid-column:2}.vh-cms-injected-unit .vh-lab-card[data-type=gallery]>.vh-lab-copy{grid-column:1/-1!important;grid-row:3;padding:25px!important}@media(max-width:700px){.vh-cms-injected-unit .vh-lab-card[data-type=gallery]{grid-template-rows:140px 140px auto!important}}`;style.textContent+=`@media(max-width:700px){
.vh-cms-injected-unit,.vh-cms-injected-unit *{box-sizing:border-box}
.vh-cms-injected-unit .vh-lab-card[data-type=editorial]{display:flex!important;flex-direction:column!important;grid-template-columns:none!important;min-height:0!important;width:100%!important;direction:ltr!important;overflow:hidden!important}
.vh-cms-injected-unit .vh-lab-card[data-type=editorial]>.vh-lab-photo{order:0!important;display:block!important;flex:0 0 auto!important;width:100%!important;height:auto!important;min-height:0!important;max-height:none!important;aspect-ratio:4/3!important;margin:0!important;align-self:stretch!important;background-size:cover!important}
.vh-cms-injected-unit .vh-lab-card[data-type=editorial]>.vh-lab-copy{order:1!important;display:block!important;flex:0 0 auto!important;min-width:0!important;width:100%!important;max-width:100%!important;padding:28px 22px!important}
.vh-cms-injected-unit .vh-lab-card[data-type=editorial]>.vh-lab-copy h2{font-size:clamp(28px,8vw,42px)!important;overflow-wrap:anywhere}
.vh-cms-injected-unit .vh-lab-card[data-type=editorial]>.vh-lab-copy *{max-width:100%;overflow-wrap:anywhere}
.vh-cms-injected-unit .vh-lab-card[data-type=editorial]:has(>.cms92-second-photo){display:grid!important;grid-template-columns:minmax(0,1fr) minmax(0,1fr)!important;gap:0!important}
.vh-cms-injected-unit .vh-lab-card[data-type=editorial]:has(>.cms92-second-photo)>.vh-lab-photo{grid-row:1!important;grid-column:1!important;aspect-ratio:3/4!important}
.vh-cms-injected-unit .vh-lab-card[data-type=editorial]:has(>.cms92-second-photo)>.cms92-second-photo{grid-row:1!important;grid-column:2!important}
.vh-cms-injected-unit .vh-lab-card[data-type=editorial]:has(>.cms92-second-photo)>.vh-lab-copy{grid-row:2!important;grid-column:1/-1!important}
.vh-cms-injected-unit .vh-lab-card[data-type=editorial][data-mobile-order=text-first]:not(:has(>.cms92-second-photo))>.vh-lab-copy{order:-1!important}
.vh-cms-injected-unit .vh-lab-card[data-type=gallery]{width:100%!important;grid-template-columns:minmax(0,1fr) minmax(0,1fr)!important;grid-template-rows:220px 130px auto!important;gap:6px!important}
.vh-cms-injected-unit .vh-lab-card[data-type=gallery]>.vh-lab-photo:first-child{grid-column:1/-1!important;grid-row:1!important}
.vh-cms-injected-unit .vh-lab-card[data-type=gallery]>.vh-lab-photo:nth-child(2){grid-column:1!important;grid-row:2!important}
.vh-cms-injected-unit .vh-lab-card[data-type=gallery]>.vh-lab-photo:nth-child(3){grid-column:2!important;grid-row:2!important}
.vh-cms-injected-unit .vh-lab-card[data-type=gallery]>.vh-lab-copy{grid-column:1/-1!important;grid-row:3!important;padding:25px 20px!important;min-width:0!important}
.vh-cms-injected-unit .vh-lab-card[data-type=banner]{min-height:340px!important}
.vh-cms-injected-unit .vh-lab-card[data-type=banner]>.vh-lab-copy{max-width:100%!important;padding:42px 22px!important}
}`;style.textContent+=`
.vh-cms-injected-unit .vh-lab-card.cms98-transparent-section{background:transparent!important;background-color:transparent!important}
.vh-cms-injected-unit .vh-lab-card.cms98-transparent-section>.vh-lab-copy{background:transparent!important;background-color:transparent!important;color:#211a15!important}.vh-cms-injected-unit .vh-lab-card.cms98-transparent-section>.vh-lab-copy *{color:#211a15!important}

`;style.textContent+=`.vh-cms-injected-unit .vh-lab-card.cms98-transparent-section{background:#f2e9de!important;color:#211a15!important}.vh-cms-injected-unit .vh-lab-card.cms98-transparent-section>.vh-lab-copy{background:none!important;background-color:transparent!important;color:#211a15!important}.vh-cms-injected-unit .vh-lab-card.cms98-transparent-section>.vh-lab-copy *{color:#211a15!important}`;style.textContent+=`.vh-cms-injected-unit .vh-lab-card[data-type=banner]{position:relative!important;display:block!important;min-height:500px!important;isolation:isolate}.vh-cms-injected-unit .vh-lab-card[data-type=banner]>.vh-lab-photo{position:absolute!important;inset:0!important;width:100%!important;height:100%!important;margin:0!important;opacity:1!important;background-size:cover!important}.vh-cms-injected-unit .vh-lab-card[data-type=banner]>.vh-lab-photo::after{content:'';position:absolute;inset:0;background:linear-gradient(90deg,rgba(12,9,7,.92),rgba(15,11,9,.78) 26%,rgba(17,12,9,.48) 50%,transparent 100%)}.vh-cms-injected-unit .vh-lab-card[data-type=banner]>.vh-lab-copy{position:relative!important;z-index:1!important;max-width:min(650px,60%)!important;background:transparent!important;color:#f6ebdf!important;padding:70px clamp(28px,5vw,80px)!important}@media(max-width:700px){.vh-cms-injected-unit .vh-lab-card[data-type=banner]>.vh-lab-copy{max-width:100%!important;min-height:420px!important;justify-content:end!important}.vh-cms-injected-unit .vh-lab-card[data-type=banner]>.vh-lab-photo::after{background:linear-gradient(0deg,rgba(12,9,7,.92),rgba(12,9,7,.48) 55%,transparent)}}`;doc.head.append(style);const wrapper=doc.createElement('section');wrapper.id='vh-cms-injected';const label=doc.createElement('p');label.className='vh-lab-label';label.textContent='ТЕСТОВІ БЛОКИ · НЕ ОПУБЛІКОВАНО';wrapper.append(label);for(const b of blocks.filter(x=>x.visible!==false)){const card=doc.createElement('article');card.className='vh-lab-card';card.dataset.type=b.type;card.dataset.mobileOrder=b.design?.mobileOrder||'photo-first';card.classList.toggle('cms98-transparent-section',b.design?.backgroundMode==='transparent');applyBlockDesign(card,b.design);const photo=(slot=0)=>{const e=doc.createElement('div');e.className='vh-lab-photo';const url=slot===0?b.image:b.images?.[slot];if(url&&(/^(https?:\/\/|data:image\/|\.\.?\/|\/)/.test(url)))e.style.backgroundImage='url('+JSON.stringify(url)+')';const crop=b.design?.['crop'+slot];if(crop){e.style.backgroundPosition=`${Math.max(0,Math.min(100,Number(crop.x)||0))}% ${Math.max(0,Math.min(100,Number(crop.y)||0))}%`;e.style.backgroundSize=(Math.max(100,Math.min(200,Number(crop.zoom)||100)))+'% auto'}return e};if(b.type==='gallery'){for(let i=0;i<3;i++)card.append(photo(i))}else if(b.type!=='text')card.append(photo());const copy=doc.createElement('div');copy.className='vh-lab-copy';const h=doc.createElement('h2');h.textContent=b.title;const body=doc.createElement('div');body.innerHTML=clean(b.body||'');copy.append(h,body);card.append(copy);if(b.type==='editorial'&&b.design?.photoPreset==='framed'){const second=photo(1);second.classList.add('cms92-second-photo');second.style.order='2';card.append(second)}applyBlockDesign(card,b.design);applyCmsSpacing(card,b.design);
 // Final: copy transparency requires a site-colored backdrop, not a dark parent card.
 if(b.design?.backgroundMode==='transparent'||b.design?.surface==='transparent'){
  card.style.setProperty('background','#f2e9de','important');
  card.style.setProperty('color','#211a15','important');
  const copyPanel=card.querySelector('.vh-lab-copy');
  if(copyPanel){
   copyPanel.style.setProperty('background','none','important');
   copyPanel.style.setProperty('background-color','transparent','important');
   copyPanel.style.setProperty('color','#211a15','important');
   copyPanel.querySelectorAll('h2,p,div,span').forEach(x=>x.style.setProperty('color','#211a15','important'));
  }
 }
 wrapper.append(card)}const main=doc.querySelector('main')||doc.body;
 const visible=blocks.filter(x=>x.visible!==false),cards=[...wrapper.querySelectorAll('.vh-lab-card')];
 wrapper.remove();
 const nodes=new Map();
 visible.forEach((b,i)=>{const n=doc.createElement('section');n.className='vh-cms-injected-unit';n.dataset.cmsId=b.id;n.append(cards[i]);nodes.set(b.id,n)});
 const originals=sectionTargets.filter(x=>x.el.isConnected&&x.el.parentElement===main);if(!originals.length&&sectionTargets.length){for(const n of nodes.values())main.append(n);return}
 const anchor=doc.createComment('CMS preview order');
 if(originals.length)main.insertBefore(anchor,originals[0].el);else main.append(anchor);
 let cursor=anchor;
 for(const id of mergedOrder()){
  const original=sectionTargets.find(t=>t.id===id)?.el;
  const node=original||nodes.get(id);
  if(!node)continue;
  if(original&&node.parentElement!==main)continue;
  cursor.after(node);cursor=node;
 }
 anchor.remove();}
// STEP 84: Preview page scripts may rebuild the DOM after iframe load.
// Keep the draft as the source of truth and reapply it after external DOM changes.
let previewObserver=null, previewReconcileTimer=null, previewEpoch=0;
function disconnectPreviewObserver(){if(previewObserver){previewObserver.disconnect();previewObserver=null}}
function watchPreviewDom(doc){
 if(!doc?.body || previewObserver)return;
 previewObserver=new MutationObserver(mutations=>{
  // Ignore our own inserted CMS blocks; react to changes from the site's scripts.
  const external=mutations.some(m=>{
   const target=m.target?.nodeType===1?m.target:m.target?.parentElement;
   if(!target || target.closest?.('.vh-cms-injected-unit, #vh-cms-injected'))return false;
   // Reordering CMS-owned nodes must not trigger another repaint.
   const changed=[...m.addedNodes,...m.removedNodes];
   if(!changed.length)return false;
   const cmsOwned=node=>{
    if(node.nodeType===8)return node.textContent==='CMS preview order';
    if(node.nodeType!==1)return false;
    return node.matches?.('.vh-cms-injected-unit, #vh-cms-injected, #vh-cms-injected-style, #vh-cms-scroll-axis')||false;
   };
   return changed.some(node=>!cmsOwned(node));
  });
  if(!external)return;
  // Product sliders and delayed site scripts can mutate continuously; avoid repeated full repaints.
  clearTimeout(previewReconcileTimer);
  const epoch=previewEpoch;
  previewReconcileTimer=setTimeout(()=>{if(epoch===previewEpoch)updateLivePreview()},900);
 });
 // Observe structural changes only: text updates and editor styling must not trigger full preview reconciliation.
 previewObserver.observe(doc.body,{subtree:true,childList:true});
}
function updateLivePreview(){
 disconnectPreviewObserver();
 try{
  const doc=frame.contentDocument;
  if(doc && doc.readyState!=='loading' && livePage===pageId && pageId!=='shared' &&
    sectionTargets.length && sectionTargets.some(t=>!t.el.isConnected))detectSections(doc);
  updateLivePreviewCore();
  const drafts=readExisting();for(const target of sectionTargets){const edit=drafts[target.id]||{};window.VHCMSModel.applyFieldStyles(target.el,edit.fieldStyles,pageId);window.VHCMSModel.motion(target.el,edit.animation,edit.duration)}
  for(const b of blocks){const unit=[...frame.contentDocument.querySelectorAll('.vh-cms-injected-unit')].find(el=>el.dataset.cmsId===b.id);const card=unit?.firstElementChild;if(card){window.VHCMSModel.applyDesign(card,b.design,pageId,{layoutImages:{0:b.image,...b.images}});window.VHCMSModel.motion(card,actualAnimation(b.animation),b.duration)}}

 }finally{
  try{const doc=frame.contentDocument;if(doc?.readyState!=='loading')watchPreviewDom(doc)}catch{}
 }
}
function reconcileAfterFrameLoad(){
 const epoch=++previewEpoch;
 disconnectPreviewObserver();clearTimeout(previewReconcileTimer);
 // Apply immediately, then after delayed site initialization (fonts, data, scripts).
 for(const delay of [0,400,1600])setTimeout(()=>{
  if(epoch!==previewEpoch || livePage!==pageId)return;
  try{
   const doc=frame.contentDocument;
   if(doc?.body&&pageId!=='shared'){
    // Rebuild the section list only if delayed page scripts replaced its DOM.
    const stale=!sectionTargets.length||sectionTargets.some(t=>!doc.contains(t.el));
    if(stale){detectSections(doc)}
   }
   updateLivePreview();
  }catch(e){console.warn('Preview reconcile',e)}
 },delay);
}
function installPreviewLinks(doc){
 if(doc.__cmsLinksReady)return;doc.__cmsLinksReady=true;
 doc.addEventListener('click',e=>{const a=e.target.closest?.('a[href]');if(!a)return;
  const href=a.getAttribute('href');if(!href||href.startsWith('#'))return;
  if(a.closest('.vh-cms-injected-unit')||sectionTargets.some(t=>t.el.contains(a))||a.closest('[data-cms-link-preview]')||a.matches('[data-footer-instagram],[data-footer-telegram]')){
   e.preventDefault();e.stopImmediatePropagation();
   try{const u=new URL(href,doc.baseURI);if(['http:','https:'].includes(u.protocol))window.open(u.href,'_blank','noopener')}catch{}
  }
 },true);
}
frame.addEventListener('load',()=>{
 const doc=frame.contentDocument;
 const loadedPage=pageId;
 const start=()=>{
  if(pageId!==loadedPage||frame.contentDocument!==doc)return;
  try{installPreviewLinks(doc);applySharedPreview(doc);if(loadedPage==='shared')renderSharedEditor();detectSections(doc);reconcileAfterFrameLoad();if(loadedPage==='home'){updateLivePreview();requestAnimationFrame(()=>{if(pageId===loadedPage&&frame.contentDocument===doc)frame.style.visibility='visible'})}else frame.style.visibility='visible'}
  catch(e){frame.style.visibility='visible';$('status').textContent='Не вдалося відкрити перегляд: '+e.message}
 };
 if(!doc.defaultView?.__VH_PUBLISHED_READY){
  let done=false;
  const finish=()=>{if(done)return;done=true;clearTimeout(fallback);start()};
  doc.defaultView.addEventListener('vh:published-ready',finish,{once:true});
  const fallback=setTimeout(finish,9000);
 }else start();
});
$('insertAfter').addEventListener('change',updateLivePreview);$('reloadSite').onclick=()=>{frame.src=frame.src};
function changed(){persist();render()}function render(){renderPages();renderList();renderExistingList();renderEditor();renderPreview()}
$('add').onclick=()=>{const type=$('type').value||'editorial';const b={id:'demo-'+Date.now(),type,title:({editorial:'Новий Editorial',banner:'Новий банер',text:'Новий текстовий блок',gallery:'Нова галерея'})[type],body:'<p>Відредагуйте текст цього блоку.</p>',image:'',images:{},design:{layoutVersion:1,photoPreset:({banner:'gradient-hero',gallery:'three-photos',text:'text-only'})[type]||'left',backgroundMode:'dark',textTone:'light',spacing:'normal'},animation:'system',duration:650,visible:true};blocks.push(b);saveOrder([...mergedOrder().filter(id=>id!==b.id),b.id]);selectedExisting=null;selected=b.id;$('existingEditor').hidden=true;$('editorFields').hidden=false;changed()};$('save').onclick=()=>runCloudOperation(saveCloudDraft);$('publish').onclick=()=>runCloudOperation(publishCloudPage);$('reset').onclick=()=>{if(confirm('Скинути локальну чернетку? Збережена в Supabase версія залишиться без змін.')){draftStore.backup(pageId,'before-local-reset');const remote=remoteDrafts.get(pageId);draftStore.useServer(pageId,remote);restoreVisibleState();syncCloudButtons()}};render();
function runCloudOperation(fn){if(cloudOperation)return;cloudOperation=true;syncCloudButtons();return fn().catch(e=>{$('status').textContent='Помилка: '+e.message}).finally(()=>{cloudOperation=false;syncCloudButtons()})}
installRecoveryActions();if(reviewOnly){const badge=document.createElement('div');badge.className='cms-review-banner';badge.textContent='Тестова версія · чернетки використовують спільну базу · публікацію вимкнено';document.querySelector('.preview').append(badge)}syncCloudButtons();
requireAdmin().then(()=>{syncCloudButtons();return switchCloudPage()}).catch(e=>{$('status').textContent='Доступ до Supabase: '+e.message; $('save').disabled=true});
})();
