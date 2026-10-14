/* Vintage Hedonista V2 bridge.
 * Preserves the APPROVED original HTML/CSS/SVG; the old CMS is used only as
 * the data/operations engine. No original layout nodes are rebuilt.
 * Must be hosted alongside cms-builder.html on the same origin.
 */
(()=>{'use strict';
const $=id=>document.getElementById(id);
const engine=document.createElement('iframe');
engine.src='v2-cms-builder.html';engine.title='CMS data engine';engine.setAttribute('aria-hidden','true');
engine.style.cssText='position:fixed;left:-200vw;top:0;width:1400px;height:900px;visibility:hidden;pointer-events:none';
document.body.append(engine);
let d=null,active=-1,rows=[],connected=false,syncing=false;
let previewFrame=null,previewScale=1;
function updateSelection(){
 const selection=document.querySelector('#canvas .selection');
 if(!selection||!previewFrame)return;
 const doc=previewFrame.contentDocument;
 if(!doc||!rows.length){selection.style.display='none';return;}
 const id=rows[active]?.dataset.cmsId;
 // Existing section IDs are assigned by the native CMS. Only draw if we can
 // identify the actual element; never invent a percentage-based rectangle.
 const target=id?doc.getElementById(id):null;
 if(!target){selection.style.display='none';return;}
 const rect=target.getBoundingClientRect();
 const frameRect=previewFrame.getBoundingClientRect();
 if(rect.width<=0||rect.height<=0){selection.style.display='none';return;}
 const scale=frameRect.width/previewFrame.offsetWidth;
 selection.style.display='block';
 selection.style.left=(rect.left*scale)+'px';
 selection.style.top=(rect.top*scale)+'px';
 selection.style.width=(rect.width*scale)+'px';
 selection.style.height=(rect.height*scale)+'px';
 selection.style.right='auto';
 const label=$('selectedLabel');
 if(label)label.textContent=titleOf(rows[active]);
}

const uiReady=()=>connected&&d?.getElementById('existingBlocks');
function showConnectionError(message){const n=$('notice');if(n){n.textContent=message;n.style.display='block';clearTimeout(say.timer);}}
function waitForCms(){
 let attempts=0;
 const timer=setInterval(()=>{
  if(connected){clearInterval(timer);return;}
  try{
   const doc=engine.contentDocument;
   const status=doc?.getElementById('status')?.textContent?.trim()||'';
   if(/потрібно увійти|немає прав адміністратора|не вдалося завантажити supabase/i.test(status)){
    clearInterval(timer);showConnectionError('CMS: '+status);return;
   }
  }catch(error){clearInterval(timer);showConnectionError('CMS недоступна: '+error.message);return;}
  if(++attempts>=30){clearInterval(timer);showConnectionError('CMS не відповідає. Перевір авторизацію та відкрий редактор повторно.');}
 },500);
}
waitForCms();
const cmsStatus=()=>d?.getElementById('status')?.textContent?.trim()||'';
function checkSession(){const status=cmsStatus();if(/увійти|авторизац|немає прав|supabase/i.test(status))say('Потрібна авторизація адміністратора: '+status);}

const say=(s)=>{const n=$('notice');if(!n)return;n.textContent=s;n.style.display='block';clearTimeout(say.timer);say.timer=setTimeout(()=>n.style.display='none',3500)};
const root=()=>d?.querySelector('#existingEditor:not([hidden])')||d?.querySelector('#editorFields');
function labeled(re){const scope=root();if(!scope)return null;for(const label of scope.querySelectorAll('label')){if(!re.test(label.textContent||''))continue;let id=label.getAttribute('for');let input=(id&&d.getElementById(id))||label.querySelector('input,textarea');if(input)return input;let next=label.nextElementSibling;if(next?.matches('input,textarea'))return next;}return null;}
function setNative(el,value){if(!el)return false;let proto=el.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;let setter=Object.getOwnPropertyDescriptor(proto,'value')?.set;if(setter)setter.call(el,value);else el.value=value;el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));return true;}
function currentRows(){return [...d.querySelectorAll('#existingBlocks .existing-row')];}
function nativeSelect(i){let b=rows[i]?.querySelector('.existing-select');if(!b)return;b.click();active=i;setTimeout(sync,90);}
function thumbnail(row){let b=row.querySelector('.existing-select');let img=b?.querySelector('img');if(img?.src)return img.src;let thumb=b?.querySelector('.studio-row-thumb');if(thumb?.style.backgroundImage){let m=thumb.style.backgroundImage.match(/url\(["']?(.*?)["']?\)/);if(m)return m[1]}return ''}
function titleOf(row){let b=row.querySelector('.existing-select');return b?.querySelector('.studio-row-name')?.textContent.trim()||b?.textContent.trim().replace(/^\d+\s*[·.]?\s*/,'')||'Блок'}
function sync(){if(!connected||syncing)return;syncing=true;try{
 rows=currentRows();let index=rows.findIndex(r=>r.querySelector('.existing-select.active'));if(index>=0)active=index;else if(active<0)active=0;
 const list=$('blocklist');list.replaceChildren();rows.forEach((row,i)=>{
  let el=document.createElement('button');el.className='block'+(i===active?' active':'');
  let num=document.createElement('span');num.className='num';num.textContent=String(i+1).padStart(2,'0');
  let img=document.createElement('img');img.className='thumb';img.alt='';const url=thumbnail(row);if(url)img.src=url;else img.style.visibility='hidden';
  let title=document.createElement('span');title.className='blocktitle';title.textContent=titleOf(row);
  let more=document.createElement('span');more.className='more';more.textContent='•••';
  el.append(num,img,title,more);el.onclick=(e)=>{if(e.target===more){const trigger=row.querySelector('.studio-row-menu-trigger');if(trigger)trigger.click();else say('Додаткові дії доступні в CMS');return}nativeSelect(i)};
  list.append(el)
 });
 const selected=rows[active];$('paneltitle').textContent=selected?titleOf(selected):'Оберіть блок';$('count').textContent=rows.length?'Блок '+(active+1)+' з '+rows.length:'';
 const inputTitle=labeled(/заголовок|назва/i),inputDesc=labeled(/підзаголовок|опис/i),inputCta=labeled(/кнопк/i);
 if(document.activeElement!==$('title'))$('title').value=inputTitle?.value||'';
 if(document.activeElement!==$('description')){
  const rich=root()?.querySelector('.vh-rte-content');
  $('description').value=rich?rich.innerText:(inputDesc?.value||'');
 }
 refreshRich();
 if(document.activeElement!==$('cta'))$('cta').value=inputCta?.value||'';
 const inspector=root();
  const photo=inspector?.querySelector('.photo-field img,.cms-thumb-box img');
  const imageUrl=photo?.currentSrc||photo?.src||thumbnail(selected);
  const photoPreview=$('photo');
  if(imageUrl){photoPreview.src=imageUrl;photoPreview.style.visibility='visible';}
  else{photoPreview.removeAttribute('src');photoPreview.style.visibility='hidden';}
 updateSelection();
 }finally{syncing=false}}
function bind(id,fn){let el=$(id);el.addEventListener('click',e=>{e.preventDefault();e.stopImmediatePropagation();fn()},true)}
function bindValue(id,re){$(id).addEventListener('change',e=>{e.stopImmediatePropagation();if(!connected)return say('CMS ще не підключена');if(!setNative(labeled(re),e.target.value))say('Для цього блоку поле недоступне');setTimeout(sync,150)},true)}
engine.addEventListener('load',()=>{let retries=0;const initialize=()=>{try{
 d=engine.contentDocument;if(!d?.querySelector('#existingBlocks')){if(++retries<40){setTimeout(initialize,250);return;}throw Error('Немає списку блоків');}connected=true;
 let nativeFrame=d.getElementById('siteFrame');
 if(nativeFrame){
  // Never adopt the CMS iframe into another document: it breaks CMS references.
  // Keep V2's selection overlay (#selectedLabel) intact.
  const canvas=$('canvas');
  const mirror=document.createElement('iframe');
  mirror.title='Попередній перегляд сторінки';
  mirror.style.cssText='display:block;position:absolute;left:0;top:0;width:1200px;height:1200px;border:0;transform-origin:top left';
  const resizeMirror=()=>{
   const w=canvas.getBoundingClientRect().width;
   if(!w)return;
   const scale=Math.min(1,w/1200);
   mirror.style.transform='scale('+scale+')';
   canvas.style.height=Math.ceil(1200*scale)+'px';
   canvas.style.minHeight='0';
   updateSelection();
  };
  new ResizeObserver(resizeMirror).observe(canvas);
  requestAnimationFrame(resizeMirror);
  mirror.setAttribute('loading','eager');
  const existingImage=canvas.querySelector(':scope > img');
  if(existingImage)existingImage.remove();
  canvas.prepend(mirror);
  previewFrame=mirror;
  mirror.addEventListener('load',()=>{updateSelection();});
  canvas.style.padding='0';
  const updateMirror=()=>{
   const src=nativeFrame.getAttribute('src');
   if(src&&mirror.getAttribute('src')!==src)mirror.setAttribute('src',src);
  };
  new MutationObserver(updateMirror).observe(nativeFrame,{attributes:true,attributeFilter:['src']});
  updateMirror();
  // Native page updates are rendered inside its own frame; V2 mirrors the URL.
  // Preserve selection overlay so inspector updates cannot throw on null.
 }
 const pages=d.getElementById('studioPage');if(pages){$('page').replaceChildren(...[...pages.options].map(o=>new Option(o.textContent,o.value)));$('page').value=pages.value;new MutationObserver(()=>{if(!connected)return;$('page').replaceChildren(...[...pages.options].map(o=>new Option(o.textContent,o.value)));$('page').value=pages.value;}).observe(pages,{childList:true});}
 new MutationObserver(()=>requestAnimationFrame(sync)).observe(d.getElementById('existingBlocks'),{childList:true});
 // The native CMS replaces its inspector fields after selecting a block.
 // Refresh V2 from the actual inspector, not only from changes to the block list.
 let inspectorSyncPending=false;
 const refreshInspector=()=>{
  if(inspectorSyncPending)return;
  inspectorSyncPending=true;
  requestAnimationFrame(()=>{inspectorSyncPending=false;sync();});
 };
 for(const id of ['existingEditor','editorFields']){
  const node=d.getElementById(id);
  if(node)new MutationObserver(refreshInspector).observe(node,{childList:true,subtree:true,attributes:true,attributeFilter:['hidden','src','style','value']});
 }
 const nativeStatus=d.getElementById('status');
 if(nativeStatus)new MutationObserver(()=>{
  const message=nativeStatus.textContent.trim();
  if(/помил|конфлікт|відмов|не вдало/i.test(message))showConnectionError('CMS: '+message);
 }).observe(nativeStatus,{childList:true,subtree:true,characterData:true});
 sync();checkSession();if(uiReady())say('CMS завантажено. Перевір сторінки та блоки перед збереженням.');
 }catch(e){showConnectionError('CMS не підключена: '+e.message);console.error('V2 CMS bridge',e)}};initialize();});
// Report native CMS save state; never claim persistence from a button click alone.
function observeOperation(buttonId,action){
 const button=d?.getElementById(buttonId),status=d?.getElementById('status');
 if(!connected||!button||button.disabled)return say(action+' недоступне: перевір авторизацію CMS');
 if(!status)return say('Не знайдено статус операції CMS');
 const before=status.textContent.trim();
 let finished=false;
 const finish=(message)=>{if(finished)return;finished=true;observer.disconnect();clearTimeout(timer);say(message)};
 const observer=new MutationObserver(()=>{
  const current=status.textContent.trim();
  if(!current||current===before)return;
  if(/помил|не вдало|конфлікт|відмов|error/i.test(current))finish('CMS: '+current);
  else if(/збережен|опублікован|успішн/i.test(current))finish('CMS: '+current);
 });
 observer.observe(status,{subtree:true,childList:true,characterData:true});
 const timer=setTimeout(()=>finish('Не отримано підтвердження від CMS. Перевір чернетку перед виходом.'),12000);
 button.click();
}
bind('save',()=>observeOperation('save','Збереження'));
bind('publish',()=>{if(confirm('Опублікувати зміни на сайті?'))observeOperation('publish','Публікація')});
/* Compact block picker, anchored to the approved Add button; no redesign. */
const blockTypes=[['editorial','Фото + текст']];
const picker=document.createElement('div');
picker.setAttribute('role','menu');
picker.setAttribute('aria-label','Тип нового блоку');
picker.style.cssText='display:none;position:fixed;z-index:10000;min-width:210px;background:#241d18;border:1px solid #695440;border-radius:9px;padding:6px;box-shadow:0 12px 32px #0009';
for(const [type,label] of blockTypes){
 const item=document.createElement('button');item.type='button';item.setAttribute('role','menuitem');item.textContent=label;
 item.style.cssText='display:block;width:100%;padding:11px 12px;border:0;border-radius:5px;background:transparent;color:#eee9e3;text-align:left;cursor:pointer';
 item.addEventListener('click',()=>{
  picker.style.display='none';
  const native=d?.getElementById('add');
  if(!connected||!native){say('CMS ще не готова до додавання блоку');return;}
  native.click();setTimeout(sync,160);
 });
 picker.append(item);
}
document.body.append(picker);
bind('add',()=>{
 if(!connected)return say('CMS ще не підключена');
 const button=$('add'),rect=button.getBoundingClientRect();
 picker.style.left=Math.max(8,Math.min(rect.left,window.innerWidth-220))+'px';
 picker.style.top=Math.min(rect.bottom+6,window.innerHeight-210)+'px';
 picker.style.display=picker.style.display==='none'?'block':'none';
});
document.addEventListener('pointerdown',e=>{if(!picker.contains(e.target)&&e.target!==$('add'))picker.style.display='none';});

bind('changePhoto',()=>{let f=root()?.querySelector('input[type=file]');if(f)f.click();else say('У цьому блоці немає поля завантаження фото')});
$('upload')?.addEventListener('change',e=>{const file=e.target.files?.[0];if(!file)return;const input=root()?.querySelector('input[type=file]');if(!input){say('У цьому блоці немає поля завантаження фото');e.target.value='';return;}try{const transfer=new DataTransfer();transfer.items.add(file);input.files=transfer.files;input.dispatchEvent(new Event('change',{bubbles:true}));say('Фото передано в CMS; перевір прев’ю.');}catch(err){say('Не вдалося передати фото: '+err.message)}e.target.value='';});
bind('editPhoto',()=>{const scope=root();const btn=[...(scope?.querySelectorAll('button')||[])].find(b=>/кадруван|позиці|редагувати фото/i.test(b.textContent||''));if(btn)btn.click();else say('Для цього блоку кадрування поки недоступне');});
bind('undo',()=>d?.getElementById('studioUndo')?.click());bind('redo',()=>d?.getElementById('studioRedo')?.click());
bindValue('title',/заголовок|назва/i);
/* Rich-text controls use the CMS editor as the data source, retaining HTML semantics. */
const description=$('description');
const toolbar=document.createElement('div');
toolbar.setAttribute('aria-label','Форматування тексту');
toolbar.style.cssText='display:flex;gap:5px;flex-wrap:wrap;margin:6px 0';
const richView=document.createElement('div');
richView.contentEditable='true';richView.setAttribute('role','textbox');richView.setAttribute('aria-multiline','true');
richView.style.cssText='display:none;min-height:110px;padding:12px;border:1px solid #574638;border-radius:6px;color:#eee9e3;background:#1c1714;outline-offset:2px;line-height:1.55;white-space:normal';
description.insertAdjacentElement('beforebegin',toolbar);
description.insertAdjacentElement('afterend',richView);
let lastRich=null;
function commitRich(){
 const native=root()?.querySelector('.vh-rte-content');
 if(!native)return;
 native.innerHTML=richView.innerHTML;
 native.dispatchEvent(new Event('input',{bubbles:true}));
}
function refreshRich(){
 const native=root()?.querySelector('.vh-rte-content');
 const enabled=!!native;
 toolbar.style.display=enabled?'flex':'none';
 richView.style.display=enabled?'block':'none';
 description.style.display=enabled?'none':'';
 if(!enabled){lastRich=null;return;}
 if(document.activeElement===richView)return;
 if(lastRich!==native||richView.innerHTML!==native.innerHTML){richView.innerHTML=native.innerHTML;lastRich=native;}
}
for(const [label,command,value] of [['B','bold',null],['I','italic',null],['H2','formatBlock','H2'],['H3','formatBlock','H3'],['•','insertUnorderedList',null],['Посилання','createLink',null]]){
 const btn=document.createElement('button');btn.type='button';btn.textContent=label;btn.title=label==='Посилання'?'Додати посилання':label;
 btn.style.cssText='padding:5px 9px;background:#302720;color:#eee9e3;border:1px solid #574638;border-radius:4px;cursor:pointer';
 btn.addEventListener('mousedown',e=>e.preventDefault());
 btn.addEventListener('click',()=>{
  if(!root()?.querySelector('.vh-rte-content'))return say('Редактор тексту для цього блоку недоступний');
  richView.focus();
  let arg=value;
  if(command==='createLink'){arg=prompt('Введіть URL посилання (https://)');if(!arg)return;try{const url=new URL(arg);if(!['https:','http:'].includes(url.protocol))throw Error();}catch{return say('Вкажіть коректне посилання https://');}}
  document.execCommand(command,false,arg);
  commitRich();
 });
 toolbar.append(btn);
}
richView.addEventListener('input',commitRich);
description.addEventListener('change',e=>{
 e.stopImmediatePropagation();
 if(root()?.querySelector('.vh-rte-content'))return;
 if(!setNative(labeled(/підзаголовок|опис/i),e.target.value))say('Поле опису недоступне для цього блоку');
},true);
bindValue('cta',/кнопк/i);
/* Photo position: connect the approved V2 design slider to the real CMS crop control. */
const positionSlider=document.querySelector('#design input[type="range"]');
if(positionSlider){
 positionSlider.addEventListener('input',()=>{
  if(!connected)return;
  const crop=root()?.querySelector('.cms91-crop');
  const horizontal=crop?.querySelector('input[type="range"]');
  if(!horizontal){say('Цей тип блоку не підтримує позиціювання фото');return;}
  horizontal.value=positionSlider.value;
  horizontal.dispatchEvent(new Event('input',{bubbles:true}));
 });
}

$('page').addEventListener('change',e=>{e.stopImmediatePropagation();let p=d?.getElementById('studioPage');if(p){p.value=e.target.value;p.dispatchEvent(new Event('change',{bubbles:true}));setTimeout(sync,850)}},true);
document.querySelectorAll('[data-device]').forEach(btn=>btn.addEventListener('click',()=>{d?.querySelector('[data-studio-device="'+btn.dataset.device+'"]')?.click()},true));
document.querySelectorAll('[data-rtab]').forEach(btn=>btn.addEventListener('click',()=>{d?.querySelector('[data-inspector-tab="'+btn.dataset.rtab+'"]')?.click()},true));
})();
