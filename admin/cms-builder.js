(()=>{'use strict';
const $=id=>document.getElementById(id);
const cloud=window.supabase&&window.VH_CONFIG?window.supabase.createClient(VH_CONFIG.supabaseUrl,VH_CONFIG.supabaseKey,{auth:{persistSession:true,autoRefreshToken:true,storage:window.localStorage,storageKey:'vintage-hedonista-admin-auth'}}):null;
let cloudReady=false;
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
 const key=pageId==='shared'?'home':pageId;
 const {data,error}=await cloud.from('vh_page_revisions').select('blocks,shared').eq('page_key',key).eq('revision_status','draft').maybeSingle();
 if(error)throw error;
 if(pageId==='shared'){
  if(data?.shared&&Object.keys(data.shared).length){localStorage.setItem(sharedStorageKey,JSON.stringify(data.shared));renderSharedEditor();updateLivePreview()}
 }else if(data&&Array.isArray(data.blocks)){
  // Restore both added blocks and edits to existing page sections.
  const saved=data.shared?.cmsPageDraft;
  if(saved&&typeof saved==='object'){
   if(saved.existing&&typeof saved.existing==='object')localStorage.setItem(existingKey(),JSON.stringify(saved.existing));
   if(Array.isArray(saved.order))localStorage.setItem(orderKey(),JSON.stringify(saved.order));
  }
  blocks=data.blocks;localStorage.setItem(storageKey(),JSON.stringify(blocks));selected=blocks[0]?.id||null;render();
  // Rehydrate the already-loaded iframe, not only the sidebar editor.
  // detectSections() applies mapped and regular edits from the restored draft.
  try {
   const doc=frame.contentDocument;
   if(doc && doc.readyState!=='loading' && livePage===pageId){
    detectSections(doc);
    applyExistingDrafts();
    applyImageDrafts();
   }
  } catch(e) { console.warn('CMS preview hydration deferred',e); }
  scheduleLivePreview();
 }
 $('status').textContent=data?'Чернетку завантажено з Supabase':'У Supabase немає чернетки для цієї сторінки';
}
async function saveCloudDraft(){
 if(!cloudReady)throw Error('Немає з’єднання з адмінкою');
 const key=pageId==='shared'?'home':pageId;
 // Read the existing row first so saving shared settings does not overwrite homepage blocks.
 const {data:old,error:readError}=await cloud.from('vh_page_revisions').select('blocks,shared').eq('page_key',key).eq('revision_status','draft').maybeSingle();
 if(readError)throw readError;
 const savedShared=pageId==='shared'?{...(old?.shared||{}),...sharedDraft()}:{...(old?.shared||{}),cmsPageDraft:{existing:readExisting(),order:mergedOrder()}};
 const payload={page_key:key,revision_status:'draft',blocks:pageId==='shared'?(old?.blocks||[]):blocks,shared:savedShared,updated_at:new Date().toISOString()};
 const {error}=await cloud.from('vh_page_revisions').upsert(payload,{onConflict:'page_key,revision_status'});
 if(error)throw error;
 $('status').textContent='Чернетку збережено в Supabase · сайт не опубліковано';
}
async function publishCloudPage(){
 if(!cloudReady)throw Error('Немає прав адміністратора');
 if(!confirm('Опублікувати збережену чернетку на основному сайті? Ця дія замінить поточну опубліковану версію.'))return;
 // Never publish unsaved local edits silently.
 await saveCloudDraft();
 const key=pageId==='shared'?'home':pageId;
 const {data:draft,error:readError}=await cloud.from('vh_page_revisions').select('blocks,shared').eq('page_key',key).eq('revision_status','draft').single();
 if(readError)throw readError;
 const published={page_key:key,revision_status:'published',blocks:draft.blocks||[],shared:draft.shared||{},updated_at:new Date().toISOString(),published_at:new Date().toISOString()};
 const {error}=await cloud.from('vh_page_revisions').upsert(published,{onConflict:'page_key,revision_status'});
 if(error)throw error;
 $('status').textContent='Опубліковано · оновіть сторінку сайту для перевірки';
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
 void loadPageSeo();
 try{await loadCloudDraft()}catch(e){$('status').textContent='Не вдалося завантажити чернетку: '+e.message}
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
const sharedDefaults={headerLogo:'',footerLogo:'',footerText:'',instagram:'',telegram:'',nav:{}};
function sharedDraft(){try{return {...sharedDefaults,...JSON.parse(localStorage.getItem(sharedStorageKey)||'{}')}}catch{return {...sharedDefaults}}}
function saveShared(d){try{localStorage.setItem(sharedStorageKey,JSON.stringify(d));$('status').textContent='Спільні елементи змінено · натисніть «Зберегти чернетку в Supabase»'}catch{$('status').textContent='Не вдалося зберегти спільну чернетку'}}
function applySharedPreview(doc){
 const d=sharedDraft();
 const header=doc.querySelector('body > header'),footer=doc.querySelector('footer.site-footer-v64,body > footer');
 if(header){const logo=header.querySelector('.vh-header-logo,.brand img');if(logo&&d.headerLogo)logo.src=d.headerLogo;
 const nav=header.querySelector('nav.nav,nav');if(nav){[...nav.querySelectorAll('a')].forEach((a,i)=>{const n=d.nav?.[String(i)];if(!n)return;if(n.label)a.textContent=n.label;if(n.href)a.href=n.href})}}
 if(footer){const logo=footer.querySelector('.vh-footer-logo-img,.footer-v64-logo img');if(logo&&d.footerLogo)logo.src=d.footerLogo;
 const text=footer.querySelector('.footer-v64-center p,.footer-v64-center');if(text&&d.footerText!==undefined&&d.footerText!=='')text.textContent=d.footerText;
 const ig=footer.querySelector('[data-footer-instagram]'),tg=footer.querySelector('[data-footer-telegram]');
 if(ig&&d.instagram)ig.href=d.instagram;if(tg&&d.telegram)tg.href=d.telegram;
 }
}
function renderSharedEditor(){
 const host=$('sharedEditor');if(!host)return;host.replaceChildren();const d=sharedDraft();
 const title=document.createElement('h3');title.textContent='СПІЛЬНІ ЕЛЕМЕНТИ САЙТУ';host.append(title);
 const note=document.createElement('p');note.className='muted';note.textContent='Ці налаштування однакові для всіх семи сторінок у попередньому перегляді. Публікація на сайт поки не підключена.';host.append(note);
 const add=(label,key,placeholder,kind='text')=>{const box=document.createElement('div');box.className='field';const lab=document.createElement('label');lab.textContent=label;const inp=document.createElement(kind==='textarea'?'textarea':'input');inp.value=d[key]||'';inp.placeholder=placeholder||'';inp.addEventListener('change',()=>{if((key==='instagram'||key==='telegram')&&!safeLink(inp.value,false)){inp.setCustomValidity('Вкажіть повне посилання https://');inp.reportValidity();return}inp.setCustomValidity('');const next=sharedDraft();next[key]=inp.value.trim();saveShared(next);updateLivePreview()});box.append(lab,inp);host.append(box);return inp};
 const sub=document.createElement('h3');sub.textContent='ВЕРХНЯ ШАПКА';host.append(sub);
 add('ЛОГОТИП У ШАПЦІ · URL / ШЛЯХ','headerLogo','assets/your-logo.webp');
 const navTitle=document.createElement('p');navTitle.className='muted';navTitle.textContent='Пункти меню (назва і адреса)';host.append(navTitle);
 const navDefaults=[['ГОЛОВНА','index.html'],['КАТАЛОГ','catalog.html'],['ПРО НАС','about.html'],['ЖУРНАЛ','journal.html'],['ДОСТАВКА І ОПЛАТА','delivery.html'],['КОНТАКТИ','contacts.html']];
 navDefaults.forEach(([label,url],i)=>{const row=document.createElement('div');row.className='cms-nav-edit';const name=document.createElement('input');name.value=d.nav?.[String(i)]?.label||label;name.setAttribute('aria-label','Назва '+label);const link=document.createElement('input');link.value=d.nav?.[String(i)]?.href||url;link.setAttribute('aria-label','Адреса '+label);const change=()=>{if(!safeLink(link.value,true)){link.setCustomValidity('Недопустима адреса');link.reportValidity();return}link.setCustomValidity('');const next=sharedDraft();next.nav={...(next.nav||{}),[String(i)]:{label:name.value,href:link.value}};saveShared(next);updateLivePreview()};name.addEventListener('change',change);link.addEventListener('change',change);row.append(name,link);host.append(row)});
 const foot=document.createElement('h3');foot.textContent='НИЖНЯ ШАПКА · ПІДВАЛ';host.append(foot);
 add('ЛОГОТИП У ПІДВАЛІ · URL / ШЛЯХ','footerLogo','assets/your-logo.webp');
 add('ТЕКСТ ПО ЦЕНТРУ','footerText','Вінтажний одяг з історією, відібраний зі смаком.','textarea');
 const instagram=add('ПОСИЛАННЯ INSTAGRAM','instagram','https://www.instagram.com/...');
 const telegram=add('ПОСИЛАННЯ TELEGRAM','telegram','https://t.me/...');
 for(const input of [instagram,telegram])input.addEventListener('change',()=>{if(input.value&&!safeLink(input.value,false)){input.setCustomValidity('Вкажіть повне посилання https://');input.reportValidity()}else input.setCustomValidity('')});
 cms91Tabs(host,{type:'editorial'});
 const reset=document.createElement('button');reset.className='secondary';reset.textContent='Скинути спільні налаштування';reset.onclick=()=>{if(confirm('Скинути спільну локальну чернетку шапки й підвалу?')){localStorage.removeItem(sharedStorageKey);renderSharedEditor();updateLivePreview()}};host.append(reset);
}
function safeLink(v,relative){if(!v)return true;return relative?/^(https?:\/\/|\/|\.\.?\/|[a-z0-9_-]+\.html(?:[?#].*)?|#)/i.test(v):/^https:\/\/[^\s]+$/i.test(v)}
const animationOptions=[['system','СИСТЕМНИЙ · як на сайті'],['fade-up','Плавна поява знизу'],['fade-left','Поява зліва'],['fade-right','Поява справа'],['zoom','Легкий зум'],['fade','Плавна поява'],['none','Без анімації']];
const systemAnimation='fade-up';
function actualAnimation(v){return !v||v==='system'?systemAnimation:v}
const defaults=[{id:'demo-1',type:'banner',title:'VINTAGE HEDONISTA',body:'<p>Одяг із минулого. Стиль поза часом.</p>',image:'',images:{},design:{photoPreset:'left',backgroundMode:'dark',textTone:'light',spacing:'normal'},animation:'system',duration:650,visible:true},{id:'demo-2',type:'editorial',title:'КАПСУЛИ',body:'<p>Готові образи з вінтажних речей.</p>',image:'',images:{},design:{photoPreset:'left',backgroundMode:'dark',textTone:'light',spacing:'normal'},animation:'system',duration:650,visible:true}];
const pageFromUrl=new URLSearchParams(location.search).get('page');
let pageId=pages.some(p=>p.id===pageFromUrl)?pageFromUrl:(sessionStorage.getItem('vh-cms-active-page')||'home');
if(!pages.some(p=>p.id===pageId))pageId='home';
const storageKey=()=>pageId==='home'?'vh-cms-lab-step55-v1':'vh-cms-lab-step56-'+pageId;
const getBlocks=()=>{try{const x=JSON.parse(localStorage.getItem(storageKey()));return Array.isArray(x)?x:(pageId==='home'?structuredClone(defaults):[])}catch{return pageId==='home'?structuredClone(defaults):[]}};
let blocks=getBlocks(),selected=blocks[0]?.id||null;
function renderPages(){const shared=pageId==='shared';document.body.classList.toggle('cms-shared-mode',shared);if(shared)renderSharedEditor();const wrap=$('pageNav');wrap.replaceChildren();pages.forEach(p=>{const btn=document.createElement('button');btn.className='nav'+(p.id===pageId?' active':'');btn.textContent=p.name;btn.onclick=()=>{pageId=p.id;sessionStorage.setItem('vh-cms-active-page',pageId);history.replaceState(null,'','?page='+encodeURIComponent(pageId));blocks=getBlocks();selected=blocks[0]?.id||null;render();void switchCloudPage()};wrap.append(btn)});const p=pages.find(x=>x.id===pageId);$('currentPageName').textContent=p.name;$('currentPageDescription').textContent=p.description;$('realEditorLink').href='admin.html?page='+encodeURIComponent(p.editor);$('publicPageLink').href='../'+p.url}
const clean=html=>{const root=document.createElement('div');root.innerHTML=html;const allowed=new Set(['P','BR','STRONG','B','EM','I','UL','OL','LI','H1','H2','H3','A']);const walk=node=>{for(const child of [...node.childNodes]){if(child.nodeType===8){child.remove();continue}if(child.nodeType!==1)continue;if(!allowed.has(child.tagName)){child.replaceWith(...child.childNodes);continue}for(const attr of [...child.attributes])child.removeAttribute(attr.name);if(child.tagName==='A'){const href=child.dataset?.unused||'';void href}walk(child)}}; // preserve safe links before stripping attributes
const links=[...root.querySelectorAll('a')].map(a=>({a,href:a.getAttribute('href')||''}));walk(root);for(const {a,href} of links){if(!root.contains(a))continue;try{const url=new URL(href,location.href);if(['http:','https:'].includes(url.protocol))a.setAttribute('href',href)}catch{}}return root.innerHTML};
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const persist=()=>{try{localStorage.setItem(storageKey(),JSON.stringify(blocks));$('status').textContent='Є незбережені зміни · натисніть «Зберегти чернетку в Supabase»'}catch{$('status').textContent='Не вдалося зберегти чернетку в браузері'}};
const current=()=>blocks.find(b=>b.id===selected);
function renderList(){const wrap=$('blocks');wrap.replaceChildren();return;/* unified list above */$('count').textContent=blocks.length+' блоків';blocks.forEach((b,i)=>{const item=document.createElement('div');item.className='block'+(b.id===selected?' active':'');const head=document.createElement('div');head.className='blockhead';const choose=document.createElement('button');choose.className='blockname';choose.textContent=String(i+1).padStart(2,'0')+' · '+(b.title||b.type);choose.onclick=()=>{selected=b.id;render()};head.append(choose);const controls=document.createElement('div');controls.className='blockbuttons';[['↑',()=>moveUnified(b.id,-1),mergedOrder()[0]===b.id],['↓',()=>moveUnified(b.id,1),mergedOrder().at(-1)===b.id],['⧉',()=>duplicate(b),false],[b.visible?'◉':'○',()=>{b.visible=!b.visible;changed()},false],['×',()=>{if(confirm('Видалити тестовий блок?')){blocks.splice(i,1);selected=blocks[0]?.id||null;changed()}},false]].forEach(([txt,fn,disabled])=>{const btn=document.createElement('button');btn.textContent=txt;btn.title=({'↑':'Вгору','↓':'Вниз','⧉':'Дублювати','×':'Видалити'})[txt]||'Показати/приховати';btn.disabled=disabled;btn.onclick=fn;controls.append(btn)});head.append(controls);item.append(head);const detail=document.createElement('small');detail.textContent=b.type+' · '+(b.visible?'видимий':'прихований')+' · '+b.animation;item.append(detail);wrap.append(item)})}
function move(i,delta){[blocks[i],blocks[i+delta]]=[blocks[i+delta],blocks[i]];changed()}function duplicate(b){const clone={...b,id:'demo-'+Date.now()+'-'+Math.random().toString(36).slice(2,6)};blocks.splice(blocks.indexOf(b)+1,0,clone);selected=clone.id;changed()}
function field(label,kind,value,onchange,options){const holder=document.createElement('div');holder.className='field';const lab=document.createElement('label');lab.textContent=label;holder.append(lab);let el=document.createElement(kind==='select'?'select':kind==='textarea'?'textarea':'input');if(kind==='select')options.forEach(([v,t])=>{const opt=document.createElement('option');opt.value=v;opt.textContent=t;el.append(opt)});else if(kind==='number')el.type='number';else el.type='text';el.value=value;el.addEventListener('input',()=>onchange(el.value));holder.append(el);return holder}
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
 editor.addEventListener('input',commit);editor.addEventListener('blur',()=>{editor.innerHTML=clean(editor.innerHTML)});source.addEventListener('change',commit);
 shell.append(heading,bar,extra,editor,source);return shell;
}
function applyBlockDesign(el,d){if(!el||!d)return;
 if(d.backgroundMode){el.style.setProperty('background-color',d.backgroundMode==='transparent'?'transparent':'#0d0c09','important')}
 if(d.textTone){el.style.setProperty('color',({light:'#f2e5d5',gold:'#b7956d',dark:'#211a15'})[d.textTone]||'#f2e5d5','important')}
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
 el.style.display=layout==='stacked'?'flex':'grid';
 el.style.flexDirection=layout==='stacked'?'column':'';
 el.style.gridTemplateColumns=layout==='stacked'?'1fr':d.photoPreset==='framed'?'minmax(0,1fr) minmax(0,1.35fr) minmax(0,1fr)':'1fr 1fr';
 const photo=el.querySelector('.vh-lab-photo,.photo'),copy=el.querySelector('.vh-lab-copy,.copy');
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
 if(d.photoPreset&&el.classList.contains('vh-lab-card')){const p=el.querySelector('.vh-lab-photo');const preset=d.photoPreset;el.style.gridTemplateColumns=el.dataset.cmsLayout==='stacked'?'1fr':preset==='framed'?'minmax(0,1fr) minmax(0,1.35fr) minmax(0,1fr)':preset==='wide'?'60% 40%':'50% 50%';if(p){p.style.margin=preset==='square'?'28px':'0';p.style.width=preset==='square'?'calc(100% - 56px)':'100%';p.style.height=preset==='square'?'auto':'100%';p.style.minHeight='0';p.style.aspectRatio=preset==='square'?'1 / 1':'auto';p.style.alignSelf='center';p.style.boxSizing='border-box'}}
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
 const {error}=await cloud.storage.from(bucket).upload(path,file,{contentType:file.type,upsert:false,cacheControl:'31536000'});
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
  const {error}=await cloud.storage.from(bucket).upload(path,file,{contentType:file.type,upsert:false,cacheControl:'31536000'});
  if(error)throw error;
  const url=cloud.storage.from(bucket).getPublicUrl(path).data?.publicUrl;
  if(!url)throw Error('Не вдалося отримати URL фото');
  if(slot===0)block.image=url;else block.images={...(block.images||{}),[slot]:url};persist();renderEditor();renderPreview();
  $('status').textContent='Фото завантажено. Збережіть чернетку в Supabase.';
 }finally{button.disabled=false;button.textContent='Завантажити фото'}
}
function addDesignControls(host,id,initial,onChange){
 const d={...initial};const details=document.createElement('div');details.className='cms-design cms91-design';
 const commit=()=>onChange({...d});
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
 select(content,'mobileOrder','ПОРЯДОК НА ТЕЛЕФОНІ',[['photo-first','Спочатку фото, потім текст'],['text-first','Спочатку текст, потім фото']],d.mobileOrder||'photo-first');

 const photo=document.createElement('div');photo.className='cms91-panel';photo.dataset.tab='design';
 const title=document.createElement('div');title.className='cms91-caption';title.textContent='МАКЕТ БЛОКУ · виберіть готову композицію';photo.append(title);
 const grid=document.createElement('div');grid.className='cms91-layout-grid';
 const presets=[['left','Фото ліворуч','50 / 50'],['right','Фото праворуч','50 / 50'],['square','Квадрат із відступами','1 : 1'],['wide','Акцент на фото','60 / 40'],['framed','Фото з двох боків','Фото · текст · фото']];
 for(const [value,name,hint] of presets){const btn=document.createElement('button');btn.type='button';btn.className='cms91-preset';btn.dataset.preset=value;btn.innerHTML='<span class="cms91-mini cms91-mini-'+value+'"><i></i><b></b></span><strong>'+name+'</strong><small>'+hint+'</small>';btn.onclick=()=>{d.photoPreset=value;d.layout=value==='right'?'photo-right':'photo-left';d.photoRatio=value==='square'?'1/1':'auto';d.photoWidth=value==='wide'?60:50;d.photoInset=value==='square'?28:0;update();commit()};grid.append(btn)}photo.append(grid);
 const crop=document.createElement('details');crop.className='cms91-crop';crop.innerHTML='<summary>Кадрування фото</summary>';const cropBody=document.createElement('div');cropBody.className='cms91-crop-body';
 select(cropBody,'photoFit','ВІДОБРАЖЕННЯ',[['cover','Заповнити область'],['contain','Показати повністю']],d.photoFit||'cover');
 for(const [key,text] of [['photoX','Горизонталь'],['photoY','Вертикаль']]){const row=document.createElement('div');row.className='cms91-field';row.append(label(text));const range=document.createElement('input');range.type='range';range.min='0';range.max='100';range.step='5';range.value=d[key]??50;range.oninput=()=>{d[key]=Number(range.value);commit()};row.append(range);cropBody.append(row)}crop.append(cropBody);photo.append(crop);
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
 const update=()=>grid.querySelectorAll('button').forEach(x=>x.classList.toggle('active',x.dataset.preset===(d.photoPreset||'left')));update();

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
function cms91Tabs(holder,b){
 const content=document.createElement('div'),design=document.createElement('div'),motion=document.createElement('div');
 for(const [el,key] of [[content,'content'],[design,'design'],[motion,'animation']]){el.className='cms91-tab-panel';el.dataset.cms91Tab=key}
 for(const el of [...holder.children]){
  if(el.classList.contains('cms93-type-control')){design.append(el);continue}
  if(el.classList.contains('cms91-design')){for(const part of [...el.children])design.append(part);el.remove();continue}
  const t=el.textContent||'';
  if(/АНІМАЦІЯ|ТРИВАЛІСТЬ/.test(t)&&!el.classList.contains('cms-mapped-field'))motion.append(el);
  else content.append(el);
 }
 const bar=document.createElement('div');bar.className='cms91-tabs';const panels={content,design,animation:motion};
 const switchTo=key=>{for(const [k,v] of Object.entries(panels))v.hidden=k!==key;bar.querySelectorAll('button').forEach(x=>x.classList.toggle('active',x.dataset.tab===key))};
 for(const [key,name] of [['content','Контент'],['design','Дизайн'],['animation','Анімація']]){const btn=document.createElement('button');btn.type='button';btn.dataset.tab=key;btn.textContent=name;btn.onclick=()=>switchTo(key);bar.append(btn)}
 const headings={content:'Тексти та фотографії',design:'Макет, кольори та відступи',animation:'Анімація появи'};
 for(const [key,panel] of Object.entries(panels)){const h=document.createElement('div');h.className='cms98-panel-heading';h.textContent=headings[key];panel.prepend(h)}
 holder.prepend(bar);holder.append(content,design,motion);switchTo('content');
}
function renderEditor(){if(pageId==='shared')return;if(selectedExisting)return;const holder=$('editorFields');holder.replaceChildren();const b=current();if(!b){holder.textContent='Додайте або оберіть блок';return}holder.append(field('ЗАГОЛОВОК','input',b.title,v=>{b.title=v;persist();renderList();renderPreview()}));const body=document.createElement('div');body.className='field';body.append(makeRichEditor(b.body||'',v=>{b.body=v;persist();renderPreview()}));holder.append(body);
if(b.type!=='text'){
 const media=document.createElement('div');media.className='cms93-media';
 const caption=document.createElement('h4');caption.textContent='ФОТОГРАФІЇ БЛОКУ';media.append(caption);
 const slotCount=b.type==='gallery'?3:2;
 const descriptions=b.type==='gallery'?[['Основне фото','Рекомендовано 1200 × 1500 px · 4:5'],['Додаткове фото 1','Рекомендовано 900 × 900 px · 1:1'],['Додаткове фото 2','Рекомендовано 900 × 900 px · 1:1']]:[['Основне фото','Рекомендовано 1200 × 1500 px · 4:5 або 1200 × 1200 px'],['Друге фото','Для макета «Фото · текст · фото» · 1200 × 1500 px']];
 for(let i=0;i<slotCount;i++){
  const wrap=document.createElement('div');wrap.className='cms93-media-slot';
  const h=document.createElement('strong');h.textContent=descriptions[i][0];const hint=document.createElement('small');hint.textContent=descriptions[i][1];
  const url=i===0?b.image:(b.images?.[i]||'');
  const row=document.createElement('div');row.className='cms93-media-row';
  const preview=document.createElement('div');preview.className='cms93-media-thumb';
  if(url){const img=document.createElement('img');img.src=url;img.alt=descriptions[i][0];preview.append(img)}else preview.textContent='Фото не вибрано';
  const actions=document.createElement('div');actions.className='cms93-media-actions';
  const input=document.createElement('input');input.type='file';input.accept='image/jpeg,image/png,image/webp,image/avif';input.hidden=true;
  const btn=document.createElement('button');btn.type='button';btn.textContent=url?'Замінити фото':'Завантажити фото';btn.onclick=()=>input.click();
  input.onchange=async()=>{const f=input.files?.[0];if(!f)return;try{await uploadCmsImage(f,b,btn,i)}catch(e){$('status').textContent='Помилка завантаження фото: '+e.message}finally{input.value=''}};
  const del=document.createElement('button');del.type='button';del.className='cms93-remove';del.textContent='× Прибрати';del.disabled=!url;del.onclick=()=>{if(i===0)b.image='';else{b.images={...(b.images||{})};delete b.images[i]}persist();renderEditor();renderPreview()};
  const urlField=document.createElement('input');urlField.type='url';urlField.placeholder='Або вставити URL фотографії';urlField.value=url||'';urlField.onchange=()=>{const v=urlField.value.trim();if(v&&!/^(https?:\/\/|\/|\.\/?|\.\.\/)/i.test(v)){alert('Вкажіть коректне посилання');return}if(i===0)b.image=v;else{b.images={...(b.images||{}),[i]:v}}persist();renderEditor();renderPreview()};
  actions.append(btn,del,input,urlField);row.append(preview,actions);wrap.append(h,hint,row);media.append(wrap);
 }
 holder.append(media);
}
const typeBox=document.createElement('div');typeBox.className='cms93-type-control cms91-field';const typeLabel=document.createElement('label');typeLabel.textContent='ТИП МАКЕТУ';const typeSelect=document.createElement('select');for(const [value,name] of [['editorial','Фото та текст'],['banner','Банер із градієнтом'],['text','Тільки текст'],['gallery','Галерея · 1 велике + 2 менші']])typeSelect.add(new Option(name,value));typeSelect.value=b.type;typeSelect.onchange=()=>{b.type=typeSelect.value;persist();renderEditor();renderPreview()};typeBox.append(typeLabel,typeSelect);holder.append(typeBox);
addDesignControls(holder,b.id,b.design||{},v=>{b.design=v;persist();renderPreview()});holder.append(field('АНІМАЦІЯ','select',b.animation,v=>{b.animation=v;changed()},animationOptions));holder.append(field('ТРИВАЛІСТЬ (мс)','number',b.duration,v=>{b.duration=Math.max(200,Math.min(1500,Number(v)||650));persist();renderPreview()}));cms91Tabs(holder,b)}

function renderPreview(){scheduleLivePreview();if(pageId==='shared')return;const wrap=$('preview');wrap.replaceChildren();for(const b of blocks.filter(x=>x.visible)){const card=document.createElement('article');card.className='preview-card '+b.type;card.dataset.animation=actualAnimation(b.animation);applyBlockDesign(card,b.design);applyCmsSpacing(card,b.design);card.style.setProperty('--duration',(b.duration||650)+'ms');if(b.type==='gallery'){for(let i=0;i<3;i++){const photo=document.createElement('div');photo.className='photo';const url=i===0?b.image:b.images?.[i];if(url&&/^(https?:\/\/|\/|\.\/?|\.\.\/)/.test(url))photo.style.backgroundImage='url('+JSON.stringify(url)+')';card.append(photo)}}else if(b.type!=='text'){const photo=document.createElement('div');photo.className='photo';if(b.image&&/^(https?:\/\/|\/|\.\/?|\.\.\/)/.test(b.image))photo.style.backgroundImage='url('+JSON.stringify(b.image)+')';card.append(photo)}const copy=document.createElement('div');copy.className='copy';const label=document.createElement('span');label.className='tag';label.textContent='VINTAGE HEDONISTA';const title=document.createElement('h3');title.textContent=b.title;const desc=document.createElement('div');desc.innerHTML=clean(b.body);copy.append(label,title,desc);card.append(copy);if(b.design?.backgroundMode==='transparent'||b.design?.surface==='transparent'){card.style.setProperty('background','#f2e9de','important');copy.style.setProperty('background','none','important');card.style.setProperty('color','#211a15','important');copy.style.setProperty('color','#211a15','important')}wrap.append(card)} }
let liveTimer=null,livePage='',sectionTargets=[];
const frame=$('siteFrame');
const viewport=$('desktopViewport');const previewWindow=document.querySelector('.live-preview-frame');
let cmsPreviewDeviceWidth=1440;
function resizeDesktopPreview(){
 if(!viewport||!previewWindow)return;
 const available=Math.max(1,previewWindow.clientWidth-2);
 const width=cmsPreviewDeviceWidth;
 const scale=Math.min(1,available/width);
 viewport.style.setProperty('width',width+'px','important');
 viewport.style.setProperty('height','950px','important');
 viewport.style.transformOrigin='top left';
 viewport.style.transform='scale('+scale+')';
 previewWindow.style.height=Math.ceil(950*scale+2)+'px';
 frame.style.setProperty('width',width+'px','important');
 frame.style.setProperty('max-width','none','important');
 frame.style.setProperty('height','950px','important');
} 
if(typeof ResizeObserver!=='undefined')new ResizeObserver(resizeDesktopPreview).observe(previewWindow);window.addEventListener('resize',resizeDesktopPreview);requestAnimationFrame(resizeDesktopPreview);
function scheduleLivePreview(){clearTimeout(liveTimer);liveTimer=setTimeout(updateLivePreview,180)}
function loadLivePage(){++previewEpoch;disconnectPreviewObserver();clearTimeout(previewReconcileTimer);selectedExisting=null;$('existingEditor').hidden=true;$('editorFields').hidden=false;const p=pages.find(x=>x.id===pageId);if(!p)return;livePage=pageId;sectionTargets=[];$('insertAfter').replaceChildren(new Option('Після основного вмісту','__end'));frame.src='../'+p.url;}
// STEP 58: isolated drafts for text edits to existing rendered sections.
let selectedExisting=null;
const existingKey=()=> 'vh-cms-existing-step65-'+pageId;
const orderKey=()=> 'vh-cms-order-step72-'+pageId;
function readOrder(){try{return JSON.parse(localStorage.getItem(orderKey()))||[]}catch{return []}}
function saveOrder(order){try{localStorage.setItem(orderKey(),JSON.stringify(order))}catch{}}
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
function saveExisting(data){try{localStorage.setItem(existingKey(),JSON.stringify(data))}catch{}}
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
const cmsMappedPages=new Set(['about','delivery','contacts','catalog','capsules','journal','product','article','account','checkout']);
const cmsStaticSelectors={
 catalog:['.catalog-heading .kicker','.catalog-heading .page-title','.catalog-intro-label','.catalog-intro'],
 capsules:['.capsule-hero-copy .capsule-kicker','.capsule-hero-copy h1','.capsule-hero-copy h2','.capsule-hero-copy p','.capsule-hero-photo','.capsule-intro-grid h2','.capsule-intro-grid p'],
 journal:['#journalPageTitle','#journalPageSubtitle','#journalNewTitle','#journalGuideTitle','#journalGuideSubtitle','#journalOtherTitle','#journalCtaTitle','#journalCtaText','#journalCtaLink'],
 product:['.product-recommendations h2'],
 article:['.article-back-v71'],
 account:[],
 checkout:['.checkout-head .kicker','.checkout-head h1','.checkout-head p','.checkout-grid .checkout-section-title']
};
function cmsFieldsFor(section){
 if(!cmsMappedPages.has(pageId))return [];
 const named=[...section.querySelectorAll('[id]')].filter(el=>{
  const id=el.id;
  return (pageId==='about'&&/^about(?:Hero|Philosophy|Editorial|P[1-4]|Manifest|Origin|Final)/.test(id))||
         (pageId==='delivery'&&/^delivery(?:Kicker|Title|Intro|Shipping|Payment|Extra|Process|Step[1-3]|Cta)/.test(id))||
         (pageId==='contacts'&&/^contacts(?:Kicker|Title|Intro|List|Instagram|Telegram|Email|Phone|Help|Topics|Topic[1-3])/.test(id));
 }).map(el=>({el,id:el.id,type:el.id.endsWith('Image')||/^aboutEditorial[123]$/.test(el.id)?'image':el.tagName==='A'?'link':'text'}));
 const staticFields=[];
 for(const selector of cmsStaticSelectors[pageId]||[]){
  for(const el of section.querySelectorAll(selector)){
   // Do not expose controls, dynamic collections, checkout fields, or Supabase records.
   const id='static:'+selector+':'+[...section.querySelectorAll(selector)].indexOf(el);
   const type=el.matches('.capsule-hero-photo')?'image':el.tagName==='A'?'link':'text';
   staticFields.push({el,id,type});
  }
 }
 return [...named,...staticFields];
}
function cmsApplyMapped(section,mapped){
 for(const f of cmsFieldsFor(section)){
  if(!(f.id in mapped))continue;
  const value=mapped[f.id];
  if(f.type==='image'){
   if(value==='__removed__'){f.el.style.backgroundImage='none';f.el.classList.remove('loaded');f.el.querySelectorAll('img').forEach(img=>img.style.display='none')}
   else if(value){f.el.style.backgroundImage='url('+JSON.stringify(value)+')';f.el.style.backgroundSize='cover';f.el.style.backgroundPosition='center';f.el.querySelectorAll('img').forEach(img=>img.style.display='none');f.el.classList.add('loaded')}
  }else if(f.type==='link'){if(typeof value==='string'&&/^(https?:|mailto:|tel:|\/|\.\/|\.\.\/|#)/i.test(value))f.el.setAttribute('href',value)}
  else if(typeof value==='string')f.el.innerHTML=clean(value);
 }
}
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
 const show=value=>{const url=cmsPreviewImage(value,base);img.hidden=true;img.removeAttribute('src');box.classList.add('cms-thumb-empty');label.hidden=false;if(!url)return;
  img.onload=()=>{img.hidden=false;box.classList.remove('cms-thumb-empty');label.hidden=true};
  img.onerror=()=>{img.hidden=true;img.removeAttribute('src');box.classList.add('cms-thumb-empty');label.hidden=false};img.src=url;
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
 if(cmsLabels[f.id])return cmsLabels[f.id];
 if(f.id.startsWith('static:')){const selector=f.id.slice(7,f.id.lastIndexOf(':'));return cmsSelectorLabels[selector]||'ПОЛЕ СТОРІНКИ · '+selector}
 return f.id.replace(/([a-z])([A-Z])/g,'$1 $2').replace(/^(about)/i,'ПРО НАС · ').replace(/^(delivery)/i,'ДОСТАВКА · ').replace(/^(contacts)/i,'КОНТАКТИ · ');
}
function cmsRenderMappedEditor(host,target,draft){
 const fields=cmsFieldsFor(target.el);if(!fields.length)return false;
 const title=document.createElement('h3');title.textContent='ПОЛЯ СТОРІНКИ · '+fields.length;host.append(title);
 const help=document.createElement('p');help.className='muted';help.textContent=pageId==='journal'?'Тут змінюються назви секцій і текст банера. Головна стаття, обкладинки та списки публікацій завантажуються з бази й редагуються у розділі «Вінтажні хроніки» чинної адмінки.':pageId==='catalog'?'Це оформлення каталогу. Картки товарів, фотографії, ціни та фільтри редагуються у відповідних розділах адмінки.':pageId==='contacts'?'Поля позначено за розташуванням на сторінці. Контактні адреси та кнопки-посилання редагуються окремо від тексту.':pageId==='delivery'?'Поля позначено за секціями доставки, оплати й оформлення.':'Редагування реальних елементів сторінки в локальній чернетці. Дані сайту та Supabase не змінюються.';host.append(help);
 const save=(id,value)=>{
  const all=readExisting(),d={...(all[target.id]||{})};
  d.mapped={...(d.mapped||{}),[id]:value};all[target.id]=d;saveExisting(all);
  cmsApplyMapped(target.el,d.mapped);
  $('status').textContent='Чернетку збережено локально · не опубліковано';
 };
 for(const f of fields){
  const wrap=document.createElement('div');wrap.className='field cms-mapped-field';
  const label=document.createElement('label');label.textContent=cmsReadableLabel(f);wrap.append(label);
  const value=draft.mapped?.[f.id];
  if(f.type==='image'){
   const original=f.el.querySelector('img')?.getAttribute('src')||getComputedStyle(f.el).backgroundImage.match(/url\(["']?(.+?)["']?\)/)?.[1]||'';
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
  }
  host.append(wrap);
 }
 return true;
}
function renderExistingEditor(){
 const host=$('existingEditor');host.replaceChildren();const target=sectionTargets.find(x=>x.id===selectedExisting);
 host.hidden=!target;$('editorFields').hidden=!!target;if(!target){return}
 const heading=document.createElement('h3');heading.textContent='НАЯВНИЙ БЛОК · '+target.label;host.append(heading);if(pageId==='journal'&&target.el.matches('.journal-v37-feature-section')){const note=document.createElement('p');note.className='muted';note.textContent='ГОЛОВНА СТАТТЯ · Перший великий матеріал журналу. Її назва, фото та текст беруться з запису статті. Для зміни відкрий «Вінтажні хроніки» у чинній адмінці.';host.append(note)}
 const help=document.createElement('p');help.className='muted';help.textContent='Тестові зміни заголовка й опису. Оригінал у Supabase не змінюється.';host.append(help);
 const data=readExisting(),draft=data[target.id]||{};
 if(pageId==='catalog'&&target.el.querySelector('#productGrid,.product-grid,[id*=productGrid]')){const note=document.createElement('p');note.className='muted';note.textContent='СІТКА ТОВАРІВ · У перегляді показані справжні картки товарів із каталогу. Назва, ціна, фото й опис кожного товару змінюються в розділі «Товари», а не в конструкторі сторінок.';host.append(note)}
 if(!cmsRenderMappedEditor(host,target,draft)){
  if(['product','article','account','checkout'].includes(pageId)){const note=document.createElement('p');note.className='muted';note.textContent='Системний вміст і записи товарів/статей редагуються у відповідних розділах адмінки. Тут можна додавати тестові дизайнерські блоки без зміни функціональності.';host.append(note)}else{
 for(const [key,label,selector] of [['title','ЗАГОЛОВОК','h1,h2,h3'],['description','ОПИС','p']]){
  const el=target.el.querySelector(selector);if(!el)continue;
  const wrap=document.createElement('div');wrap.className='field';const lab=document.createElement('label');lab.textContent=label;const input=document.createElement('textarea');input.rows=key==='title'?2:4;input.value=draft[key]??el.textContent.trim();
  input.oninput=()=>{const latest=readExisting();latest[target.id]={...(latest[target.id]||{}),[key]:input.value};saveExisting(latest);el.textContent=input.value;$('status').textContent='Чернетка наявного блоку збережена локально · не опубліковано'};
  wrap.append(lab);
  if(key==='description'){const rte=makeRichEditor(draft[key]??el.innerHTML,v=>{const latest=readExisting();latest[target.id]={...(latest[target.id]||{}),[key]:v};saveExisting(latest);el.innerHTML=clean(v);$('status').textContent='Чернетку опису збережено локально · не опубліковано'});wrap.append(rte)}else wrap.append(input);
  host.append(wrap);
 }
 }
 }
 const photos=[];
 const candidates=[target.el,...target.el.querySelectorAll('*')].slice(0,900);
 const imageURL=(str)=>{const m=String(str||'').match(/url\(\s*['"]?([^'"\)]+)['"]?\s*\)/);return m?.[1]?.trim()||''};
 for(const node of candidates){
  if(photos.length>=40)break;
  const add=(url,kind)=>{if(!url||url==='none'||url.startsWith('data:'))return;photos.push({node,url,kind})};
  if(node.tagName==='IMG')add(node.getAttribute('src')||node.currentSrc,'img');
  if(node.tagName==='VIDEO')add(node.getAttribute('poster'),'poster');
  const computed=getComputedStyle(node);
  add(imageURL(computed.backgroundImage),'bg');
  for(const pseudo of ['::before','::after']){
   try{add(imageURL(getComputedStyle(node,pseudo).backgroundImage),pseudo)}catch{}
  }
 }
 if(photos.length&&!cmsFieldsFor(target.el).length){
  const title=document.createElement('h3');title.textContent='ФОТОГРАФІЇ БЛОКУ';title.className='photos-title';host.append(title);
  photos.forEach((photo,i)=>{
   const key='image'+i,wrap=document.createElement('div');wrap.className='photo-field';const thumbBox=document.createElement('div');thumbBox.className='cms-thumb-box';
   const effective=draft.images?.[key]||photo.url;const {box:thumbnail,img,show:showThumb}=cmsThumb(effective,frame.contentDocument.baseURI,'Мініатюра '+(i+1));
   const right=document.createElement('div');right.className='photo-controls';
   const label=document.createElement('label');label.textContent='Фото '+(i+1)+' · замінити URL';
   const input=document.createElement('input');input.type='url';input.value=draft.images?.[key]||'';
   input.placeholder='https://... або шлях до фото';
   const update=url=>{
    const latest=readExisting(),d={...(latest[target.id]||{})};
    d.images={...(d.images||{}),[key]:url};latest[target.id]=d;saveExisting(latest);
    if(photo.kind==='img'){photo.node.src=url||photo.url;photo.node.removeAttribute('srcset')}
    else if(photo.kind==='poster')photo.node.poster=url||photo.url;
    else if(photo.kind==='bg')photo.node.style.backgroundImage='url('+JSON.stringify(url||photo.url)+')';
    else {photo.node.style.setProperty('--cms-replacement-'+i,'url('+JSON.stringify(url||photo.url)+')');const st=frame.contentDocument.createElement('style');st.textContent='[data-cms-photo-'+i+']'+photo.kind+'{background-image:var(--cms-replacement-'+i+')!important}';photo.node.setAttribute('data-cms-photo-'+i,'');frame.contentDocument.head.append(st)}
    showThumb(url||photo.url);
    $('status').textContent='Фото змінено у локальній чернетці · сайт не опубліковано';
   };
   input.onchange=()=>{const url=input.value.trim();if(url&&/^(javascript:|data:)/i.test(url)){alert('Неприпустимий формат адреси');return}update(url)};
   const file=document.createElement('input');file.type='file';file.accept='image/png,image/jpeg,image/webp,image/gif';
   file.onchange=async()=>{const f=file.files?.[0];if(!f)return;file.disabled=true;try{const url=await uploadExistingCmsPhoto(f,target.id+'-'+key);update(url);input.value=url;$('status').textContent='Фото завантажено в Supabase Storage. Збережіть чернетку.'}catch(e){alert('Помилка завантаження фото: '+(e.message||e))}finally{file.disabled=false;file.value=''}};
   const note=document.createElement('small');note.textContent='Тестова заміна · лише у цьому браузері';
   const remove=document.createElement('button');remove.type='button';remove.className='cms-photo-x';remove.textContent='×';remove.title='Видалити фото';remove.setAttribute('aria-label','Видалити фото');remove.onclick=()=>{
 const all=readExisting();all[target.id]={...(all[target.id]||{}),images:{...(all[target.id]?.images||{}),[key]:'__removed__'}};saveExisting(all);
 if(photo.kind==='img')photo.node.style.visibility='hidden';
 else if(photo.kind==='poster')photo.node.removeAttribute('poster');
 else photo.node.style.setProperty('background-image','none','important');
 showThumb('');
 };right.append(label,input,file,note);thumbnail.append(remove);wrap.append(thumbnail,right);host.append(wrap);
  });
 }
 // Shared animation controls for existing site sections. 'System' retains their native CSS animation.
 host.append(field('АНІМАЦІЯ','select',draft.animation||'system',v=>{
  const all=readExisting();all[target.id]={...(all[target.id]||{}),animation:v};saveExisting(all);
  applyExistingAnimation(target.el,v);$('status').textContent='Анімацію змінено у чернетці';
 },animationOptions));
 // Design controls for each existing section (draft only)
 addDesignControls(host,target.id,draft.design||{},value=>{const all=readExisting();all[target.id]={...(all[target.id]||{}),design:value};saveExisting(all);applyBlockDesign(target.el,value)});
 // The real homepage Capsules section uses #homeCapsulesMedia, populated asynchronously by site.js.
 if(target.el.matches('.homepage-capsules')||target.el.querySelector('#homeCapsulesMedia')){
  const media=target.el.querySelector('#homeCapsulesMedia');
  const wrap=document.createElement('div');wrap.className='field cms-capsule-field';
  const label=document.createElement('label');label.textContent='ГОЛОВНЕ ФОТО БЛОКУ КАПСУЛИ';
  const {box:capsuleThumbBox,show:showCapsuleThumb}=cmsThumb(draft.capsuleImage||media?.querySelector('img')?.getAttribute('src')||'',frame.contentDocument.baseURI,'Фото капсул');
  const input=document.createElement('input');input.placeholder='URL або шлях до фотографії';input.value=draft.capsuleImage?.startsWith('data:')?'':draft.capsuleImage||'';
  const file=document.createElement('input');file.type='file';file.accept='image/png,image/jpeg,image/webp';
  const update=v=>{
   const all=readExisting();all[target.id]={...(all[target.id]||{}),capsuleImage:v};saveExisting(all);
   applyCapsulePhoto(target.el,v);
   showCapsuleThumb(v==='__removed__'?'':v);input.value=v.startsWith('data:')?'':v==='__removed__'?'':v;
   $('status').textContent='Фото капсул змінено лише в тестовому перегляді';
  };
  input.onchange=()=>{const v=input.value.trim();if(v&&/^(javascript:|data:)/i.test(v)){alert('Недопустима адреса');return}update(v)};
  file.onchange=async()=>{const f=file.files?.[0];if(!f)return;file.disabled=true;try{const url=await uploadExistingCmsPhoto(f,target.id+'-capsule');update(url);$('status').textContent='Фото завантажено в Supabase Storage. Збережіть чернетку.'}catch(e){alert('Помилка завантаження фото: '+(e.message||e))}finally{file.disabled=false;file.value=''}};
  const remove=document.createElement('button');remove.type='button';remove.className='cms-photo-x';remove.textContent='×';remove.title='Видалити фото';remove.setAttribute('aria-label','Видалити фото');remove.onclick=()=>update('__removed__');
  capsuleThumbBox.append(remove);wrap.append(label,capsuleThumbBox,input,file);host.append(wrap);
 }
 cms91Tabs(host,{type:'editorial'});
 const reset=document.createElement('button');reset.className='secondary';reset.textContent='Скинути зміни цього блоку';reset.onclick=()=>{const d=readExisting();delete d[target.id];saveExisting(d);frame.src=frame.src};host.append(reset);
}
function applyCapsulePhoto(section,url){
 const media=section?.querySelector('#homeCapsulesMedia');if(!media)return;
 if(!url)return;
 media.replaceChildren();
 if(url==='__removed__')return;
 const img=frame.contentDocument.createElement('img');img.src=url;img.alt='Фото капсул';img.loading='eager';img.decoding='async';
 img.style.cssText='width:100%;height:100%;object-fit:cover;display:block';
 media.append(img);
}
function applyExistingAnimation(el,value){
 if(!el)return;
 el.classList.remove('cms-animation-fade-up','cms-animation-fade-left','cms-animation-fade-right','cms-animation-zoom','cms-animation-fade','cms-animation-none');
 if(value&&value!=='system')el.classList.add('cms-animation-'+value);
}
function applyExistingDrafts(){const data=readExisting();for(const t of sectionTargets){const d=data[t.id];if(!d)continue;if(d.hidden)t.el.style.display='none';else t.el.style.removeProperty('display');if(d.mapped)cmsApplyMapped(t.el,d.mapped);if(d.design)applyBlockDesign(t.el,d.design);applyExistingAnimation(t.el,d.animation||'system');if(d.capsuleImage)applyCapsulePhoto(t.el,d.capsuleImage);for(const [key,sel] of [['title','h1,h2,h3'],['description','p']]){if(typeof d[key]==='string'){const el=t.el.querySelector(sel);if(el){if(key==='description')el.innerHTML=clean(d[key]);else el.textContent=d[key]}}}}}
function applyImageDrafts(){
 const drafts=readExisting();
 for(const target of sectionTargets){
  const images=drafts[target.id]?.images;if(!images)continue;
  let index=0;const nodes=[target.el,...target.el.querySelectorAll('*')].slice(0,900);
  for(const node of nodes){
   const candidates=[];const match=x=>String(x||'').match(/url\(\s*['"]?([^'"\)]+)['"]?\s*\)/)?.[1]||'';
   if(node.tagName==='IMG')candidates.push(['img',node.getAttribute('src')]);
   if(node.tagName==='VIDEO')candidates.push(['poster',node.getAttribute('poster')]);
   candidates.push(['bg',match(getComputedStyle(node).backgroundImage)]);
   for(const pseudo of ['::before','::after'])try{candidates.push([pseudo,match(getComputedStyle(node,pseudo).backgroundImage)])}catch{}
   for(const [kind,url] of candidates){if(!url||url==='none'||url.startsWith('data:'))continue;
    const value=images['image'+index];if(value==='__removed__'){if(kind==='img')node.style.visibility='hidden';else if(kind==='poster')node.removeAttribute('poster');else node.style.setProperty('background-image','none','important')}else if(value){if(kind==='img'){node.src=value;node.removeAttribute('srcset')}else if(kind==='poster')node.poster=value;else if(kind==='bg')node.style.backgroundImage='url('+JSON.stringify(value)+')';else {node.style.setProperty('--cms-replacement-'+index,'url('+JSON.stringify(value)+')');const st=frame.contentDocument.createElement('style');st.textContent='[data-cms-photo-'+index+']'+kind+'{background-image:var(--cms-replacement-'+index+')!important}';node.setAttribute('data-cms-photo-'+index,'');frame.contentDocument.head.append(st)}}index++;if(index>=40)break}
   if(index>=40)break;
  }
 }
}
function detectSections(doc){if(pageId==='shared'){sectionTargets=[];return}const sel=$('insertAfter'),old=sel.value;sel.replaceChildren(new Option('Після основного вмісту','__end'));sectionTargets=[];const main=doc.querySelector('main')||doc.body;let candidates=(pageId==='home'?[...doc.body.children].filter(e=>e.tagName==='SECTION'):[...main.children]).filter(e=>e.tagName!=='SCRIPT'&&e.tagName!=='STYLE'&&e.tagName!=='HEADER'&&e.tagName!=='FOOTER'&&e.getBoundingClientRect().height>50);if(candidates.length<2){
 const sections=[...main.querySelectorAll('section')].filter(e=>e.getBoundingClientRect().height>50);
 const topSections=sections.filter(el=>!sections.some(parent=>parent!==el&&parent.contains(el)));
 if(topSections.length>1)candidates=topSections;
 else {
  const containers=[...main.querySelectorAll('article,section,[class*="section"],[class*="hero"],[class*="content"],[class*="editorial"]')]
   .filter(e=>e.getBoundingClientRect().height>90);
  const top=containers.filter(el=>!containers.some(parent=>parent!==el&&parent.contains(el)));
  if(top.length>1)candidates=top;
 }
}candidates.slice(0,35).forEach((el,i)=>{const label=(el.querySelector('h1,h2,h3')?.textContent||el.getAttribute('aria-label')||el.id||el.className||'Блок '+(i+1)).toString().replace(/\s+/g,' ').trim().slice(0,75);const id='existing-'+i;sectionTargets.push({id,el,label});sel.add(new Option((i+1)+'. '+label,id))});sel.value=[...sel.options].some(x=>x.value===old)?old:'__end';renderExistingList();applyExistingDrafts();applyImageDrafts();renderExistingEditor();}
function installCmsPreviewStyles(doc){
 let style=doc.getElementById('vh-cms-step66-styles');
 if(style)return;
 style=doc.createElement('style');style.id='vh-cms-step66-styles';
 style.textContent=`
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
 [['Комп’ютер',1440],['Планшет',820],['Телефон',390]].forEach(([name,width],i)=>{
  const button=document.createElement('button');button.type='button';button.textContent=name;
  button.className=i===0?'active':'';
  button.onclick=()=>{
   cmsPreviewDeviceWidth=width;
   resizeDesktopPreview();
   bar.querySelectorAll('button').forEach(x=>x.classList.toggle('active',x===button));
  };
  bar.append(button);
 });
 preview.parentElement.insertBefore(bar,preview);
 resizeDesktopPreview();
}
function updateLivePreviewCore(){cms96Viewport();if(livePage!==pageId){loadLivePage();return}let doc;try{doc=frame.contentDocument;if(!doc||doc.readyState==='loading')return}catch{return}applySharedPreview(doc);if(pageId==='shared')return;applyExistingDrafts();applyImageDrafts();installCmsPreviewStyles(doc);doc.querySelectorAll('.vh-cms-injected-unit').forEach(n=>n.remove());doc.getElementById('vh-cms-injected-style')?.remove();const style=doc.createElement('style');style.id='vh-cms-injected-style';style.textContent=`.vh-cms-injected-unit{display:block;clear:both;background:#f5f0e9;color:#231911;padding:0;}.vh-cms-injected-unit .vh-lab-label{font:11px 'Montserrat',Arial,sans-serif;letter-spacing:2px;color:#805c38;margin:0 0 14px}.vh-cms-injected-unit .vh-lab-card{display:grid;grid-template-columns:1fr 1fr;background:#0d0c09;color:#f2e5d5;min-height:390px;margin:0;overflow:hidden}.vh-cms-injected-unit .vh-lab-photo{min-height:250px;background:linear-gradient(135deg,#593b29,#281a13);background-position:center;background-size:cover}.vh-cms-injected-unit .vh-lab-copy{padding:clamp(38px,6vw,110px);align-self:center}.vh-cms-injected-unit h2{font:clamp(32px,4vw,66px) 'Bodoni Moda',Georgia,serif;color:inherit;margin:12px 0}.vh-cms-injected-unit p{color:inherit;line-height:1.7;font-family:'Montserrat',Arial,sans-serif}.vh-cms-injected-unit .vh-lab-card[data-type=text]{display:block;background:#e9dccb;color:#21160e}.vh-cms-injected-unit .vh-lab-card[data-type=banner]{position:relative;display:block;min-height:540px}.vh-cms-injected-unit .vh-lab-card[data-type=banner] .vh-lab-photo{position:absolute;inset:0;opacity:.5}.vh-cms-injected-unit .vh-lab-card[data-type=banner] .vh-lab-copy{position:relative;max-width:60%;padding:110px 7%}.vh-cms-injected-unit .vh-lab-card[data-type=gallery]{grid-template-columns:repeat(3,1fr)}.vh-cms-injected-unit .vh-lab-card[data-type=gallery] .vh-lab-photo{border-right:4px solid #f5f0e9}.vh-cms-injected-unit .vh-lab-card[data-type=gallery] .vh-lab-copy{grid-column:1/-1;padding:36px 7%}@media(max-width:700px){.vh-cms-injected-unit .vh-lab-card{grid-template-columns:1fr}.vh-cms-injected-unit .vh-lab-card[data-type=banner] .vh-lab-copy{max-width:100%}}`;style.textContent+=`.vh-cms-injected-unit{background:transparent!important}.vh-cms-injected-unit .vh-lab-card{overflow:hidden!important;isolation:isolate}.vh-cms-injected-unit .vh-lab-card[data-type=editorial]{align-items:stretch}.vh-cms-injected-unit .vh-lab-card[data-type=editorial] .vh-lab-photo{height:100%;min-height:100%}.vh-cms-injected-unit .vh-lab-copy{box-sizing:border-box;align-self:stretch;display:flex;flex-direction:column;justify-content:center}.vh-cms-injected-unit .cms-white-copy .vh-lab-copy{background:#fff!important;color:#211a15!important;padding:clamp(38px,6vw,110px)!important}.vh-cms-injected-unit .cms-cream-copy .vh-lab-copy{background:#f5ede2!important;color:#211a15!important;padding:clamp(38px,6vw,110px)!important}.vh-cms-injected-unit .cms-transparent-copy{background:transparent!important}.vh-cms-injected-unit .cms-transparent-copy .vh-lab-copy{background:transparent!important}.vh-cms-injected-unit .cms-white-copy .vh-lab-copy *, .vh-cms-injected-unit .cms-cream-copy .vh-lab-copy *{color:#211a15!important}`;style.textContent+=`.vh-cms-injected-unit .vh-lab-card[data-type=gallery]{display:grid!important;grid-template-columns:2fr 1fr!important;grid-template-rows:180px 180px auto!important;gap:10px;padding:10px;min-height:0!important}.vh-cms-injected-unit .vh-lab-card[data-type=gallery]>.vh-lab-photo{min-height:0!important;height:100%!important;width:100%!important;margin:0!important;aspect-ratio:auto!important;background-size:cover!important;border:0!important}.vh-cms-injected-unit .vh-lab-card[data-type=gallery]>.vh-lab-photo:first-child{grid-row:1/3;grid-column:1}.vh-cms-injected-unit .vh-lab-card[data-type=gallery]>.vh-lab-photo:nth-child(2){grid-row:1;grid-column:2}.vh-cms-injected-unit .vh-lab-card[data-type=gallery]>.vh-lab-photo:nth-child(3){grid-row:2;grid-column:2}.vh-cms-injected-unit .vh-lab-card[data-type=gallery]>.vh-lab-copy{grid-column:1/-1!important;grid-row:3;padding:25px!important}@media(max-width:700px){.vh-cms-injected-unit .vh-lab-card[data-type=gallery]{grid-template-rows:140px 140px auto!important}}`;style.textContent+=`@media(max-width:700px){
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

`;style.textContent+=`.vh-cms-injected-unit .vh-lab-card.cms98-transparent-section{background:#f2e9de!important;color:#211a15!important}.vh-cms-injected-unit .vh-lab-card.cms98-transparent-section>.vh-lab-copy{background:none!important;background-color:transparent!important;color:#211a15!important}.vh-cms-injected-unit .vh-lab-card.cms98-transparent-section>.vh-lab-copy *{color:#211a15!important}`;doc.head.append(style);const wrapper=doc.createElement('section');wrapper.id='vh-cms-injected';const label=doc.createElement('p');label.className='vh-lab-label';label.textContent='ТЕСТОВІ БЛОКИ · НЕ ОПУБЛІКОВАНО';wrapper.append(label);for(const b of blocks.filter(x=>x.visible)){const card=doc.createElement('article');card.className='vh-lab-card';card.dataset.type=b.type;card.dataset.mobileOrder=b.design?.mobileOrder||'photo-first';card.classList.toggle('cms98-transparent-section',b.design?.backgroundMode==='transparent');applyBlockDesign(card,b.design);const photo=(slot=0)=>{const e=doc.createElement('div');e.className='vh-lab-photo';const url=slot===0?b.image:b.images?.[slot];if(url&&(/^(https?:\/\/|data:image\/|\.\.?\/|\/)/.test(url)))e.style.backgroundImage='url('+JSON.stringify(url)+')';const crop=b.design?.['crop'+slot];if(crop){e.style.backgroundPosition=`${Math.max(0,Math.min(100,Number(crop.x)||0))}% ${Math.max(0,Math.min(100,Number(crop.y)||0))}%`;e.style.backgroundSize=(Math.max(100,Math.min(200,Number(crop.zoom)||100)))+'% auto'}return e};if(b.type==='gallery'){for(let i=0;i<3;i++)card.append(photo(i))}else if(b.type!=='text')card.append(photo());const copy=doc.createElement('div');copy.className='vh-lab-copy';const h=doc.createElement('h2');h.textContent=b.title;const body=doc.createElement('div');body.innerHTML=clean(b.body||'');copy.append(h,body);card.append(copy);if(b.type==='editorial'&&b.design?.photoPreset==='framed'){const second=photo(1);second.classList.add('cms92-second-photo');second.style.order='2';card.append(second)}applyBlockDesign(card,b.design);applyCmsSpacing(card,b.design);
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
 const visible=blocks.filter(x=>x.visible),cards=[...wrapper.querySelectorAll('.vh-lab-card')];
 wrapper.remove();
 const nodes=new Map();
 visible.forEach((b,i)=>{const n=doc.createElement('section');n.className='vh-cms-injected-unit';n.dataset.cmsId=b.id;n.append(cards[i]);nodes.set(b.id,n)});
 const originals=sectionTargets.filter(x=>x.el.isConnected&&x.el.parentElement===main);if(!originals.length&&sectionTargets.length){for(const n of nodes.values())main.append(n);return}
 const anchor=doc.createComment('CMS preview order');
 if(originals.length)main.insertBefore(anchor,originals[0].el);else main.append(anchor);
 let cursor=anchor;
 for(const id of (pageId==='journal'?mergedOrder().sort((a,b)=>{const rank=id=>{const t=sectionTargets.find(x=>x.id===id);const el=t?.el;return el?.matches('.journal-v37-head')?0:el?.matches('.journal-v37-feature-section')?1:el?.matches('.journal-v37-new-section')?2:el?.matches('.journal-v37-guide-wrap')?3:el?.matches('.journal-v37-other-section')?4:el?.matches('.journal-v37-cta')?5:6};return rank(a)-rank(b)}):mergedOrder())){
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
   return target && !target.closest?.('.vh-cms-injected-unit') &&
    !target.closest?.('#vh-cms-injected');
  });
  if(!external)return;
  clearTimeout(previewReconcileTimer);
  const epoch=previewEpoch;
  previewReconcileTimer=setTimeout(()=>{if(epoch===previewEpoch)updateLivePreview()},120);
 });
 previewObserver.observe(doc.body,{subtree:true,childList:true,characterData:true});
}
function updateLivePreview(){
 disconnectPreviewObserver();
 try{
  const doc=frame.contentDocument;
  if(doc && doc.readyState!=='loading' && livePage===pageId && pageId!=='shared' &&
    sectionTargets.length && sectionTargets.some(t=>!t.el.isConnected))detectSections(doc);
  updateLivePreviewCore();
 }finally{
  try{const doc=frame.contentDocument;if(doc?.readyState!=='loading')watchPreviewDom(doc)}catch{}
 }
}
function reconcileAfterFrameLoad(){
 const epoch=++previewEpoch;
 disconnectPreviewObserver();clearTimeout(previewReconcileTimer);
 // Apply immediately, then after delayed site initialization (fonts, data, scripts).
 for(const delay of [0,180,600,1500,3200])setTimeout(()=>{
  if(epoch!==previewEpoch || livePage!==pageId)return;
  try{updateLivePreview()}catch(e){console.warn('Preview reconcile',e)}
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
frame.addEventListener('load',()=>{try{installPreviewLinks(frame.contentDocument);applySharedPreview(frame.contentDocument);detectSections(frame.contentDocument);reconcileAfterFrameLoad()}catch(e){$('status').textContent='Не вдалося відкрити перегляд: '+e.message}});
$('insertAfter').addEventListener('change',updateLivePreview);$('reloadSite').onclick=()=>{frame.src=frame.src};
function changed(){persist();render()}function render(){renderPages();renderList();renderExistingList();renderEditor();renderPreview()}
$('add').onclick=()=>{const type='editorial';const b={id:'demo-'+Date.now(),type,title:({editorial:'Новий Editorial',banner:'Новий банер',text:'Новий текстовий блок',gallery:'Нова галерея'})[type],body:'<p>Відредагуйте текст цього блоку.</p>',image:'',images:{},design:{photoPreset:'left',backgroundMode:'dark',textTone:'light',spacing:'normal'},animation:'system',duration:650,visible:true};blocks.push(b);saveOrder([...mergedOrder().filter(id=>id!==b.id),b.id]);selected=b.id;changed()};$('save').onclick=async()=>{const button=$('save');button.disabled=true;try{await saveCloudDraft()}catch(e){$('status').textContent='Помилка збереження: '+e.message}finally{button.disabled=false}};$('publish').onclick=async()=>{const b=$('publish');b.disabled=true;try{await publishCloudPage()}catch(e){$('status').textContent='Помилка публікації: '+e.message}finally{b.disabled=false}};$('reset').onclick=()=>{if(confirm('Скинути локальну чернетку? Збережена в Supabase версія залишиться без змін.')){localStorage.removeItem(orderKey());localStorage.removeItem(existingKey());blocks=pageId==='home'?structuredClone(defaults):[];selected=blocks[0]?.id||null;changed()}};render();
requireAdmin().then(switchCloudPage).catch(e=>{$('status').textContent='Доступ до Supabase: '+e.message; $('save').disabled=true});
})();
