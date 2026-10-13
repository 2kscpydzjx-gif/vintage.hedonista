/* Vintage Hedonista V2 bridge.
 * Preserves the APPROVED original HTML/CSS/SVG; the old CMS is used only as
 * the data/operations engine. No original layout nodes are rebuilt.
 * Must be hosted alongside cms-builder.html on the same origin.
 */
(()=>{'use strict';
const $=id=>document.getElementById(id);
const engine=document.createElement('iframe');
engine.src='cms-builder.html';engine.title='CMS data engine';engine.setAttribute('aria-hidden','true');
engine.style.cssText='position:fixed;left:-200vw;top:0;width:1400px;height:900px;visibility:hidden;pointer-events:none';
document.body.append(engine);
let d=null,active=-1,rows=[],connected=false,syncing=false;
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

const say=(s)=>{const n=$('notice');n.textContent=s;n.style.display='block';clearTimeout(say.timer);say.timer=setTimeout(()=>n.style.display='none',3500)};
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
  let img=document.createElement('img');img.className='thumb';img.alt='';img.src=thumbnail(row)||'thumb-1.jpg';
  let title=document.createElement('span');title.className='blocktitle';title.textContent=titleOf(row);
  let more=document.createElement('span');more.className='more';more.textContent='•••';
  el.append(num,img,title,more);el.onclick=(e)=>{if(e.target===more){const trigger=row.querySelector('.studio-row-menu-trigger');if(trigger)trigger.click();else say('Додаткові дії доступні в CMS');return}nativeSelect(i)};
  list.append(el)
 });
 const selected=rows[active];$('paneltitle').textContent=selected?titleOf(selected):'Оберіть блок';$('count').textContent=rows.length?'Блок '+(active+1)+' з '+rows.length:'';
 const inputTitle=labeled(/заголовок|назва/i),inputDesc=labeled(/підзаголовок|опис/i),inputCta=labeled(/кнопк/i);
 if(document.activeElement!==$('title'))$('title').value=inputTitle?.value||'';
 if(document.activeElement!==$('description'))$('description').value=inputDesc?.value||'';
 if(document.activeElement!==$('cta'))$('cta').value=inputCta?.value||'';
 const photo=root()?.querySelector('.photo-field img,.cms-thumb-box img,img');
 $('photo').src=photo?.src||thumbnail(selected||rows[0]||document.createElement('div'))||'thumb-1.jpg';
 $('selectedLabel').textContent=selected?titleOf(selected)+' ···':'';
 }finally{syncing=false}}
function bind(id,fn){let el=$(id);el.addEventListener('click',e=>{e.preventDefault();e.stopImmediatePropagation();fn()},true)}
function bindValue(id,re){$(id).addEventListener('change',e=>{e.stopImmediatePropagation();if(!connected)return say('CMS ще не підключена');if(!setNative(labeled(re),e.target.value))say('Для цього блоку поле недоступне');setTimeout(sync,150)},true)}
engine.addEventListener('load',()=>{try{
 d=engine.contentDocument;if(!d?.querySelector('#existingBlocks'))throw Error('Немає списку блоків');connected=true;
 let nativeFrame=d.getElementById('siteFrame');if(nativeFrame){const canvas=$('canvas');canvas.replaceChildren(nativeFrame);nativeFrame.style.cssText='width:100%;height:100%;display:block;border:0';canvas.style.padding='0';}
 const pages=d.getElementById('studioPage');if(pages){$('page').replaceChildren(...[...pages.options].map(o=>new Option(o.textContent,o.value)));$('page').value=pages.value;new MutationObserver(()=>{if(!connected)return;$('page').replaceChildren(...[...pages.options].map(o=>new Option(o.textContent,o.value)));$('page').value=pages.value;}).observe(pages,{childList:true});}
 new MutationObserver(()=>requestAnimationFrame(sync)).observe(d.getElementById('existingBlocks'),{childList:true});
 sync();checkSession();if(uiReady())say('CMS завантажено. Перевір сторінки та блоки перед збереженням.');
 }catch(e){say('CMS не підключена: '+e.message);console.error('V2 CMS bridge',e)}});
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
bind('add',()=>{d?.getElementById('add')?.click();setTimeout(sync,130)});
bind('changePhoto',()=>{let f=root()?.querySelector('input[type=file]');if(f)f.click();else say('У цьому блоці немає поля завантаження фото')});
$('upload')?.addEventListener('change',e=>{const file=e.target.files?.[0];if(!file)return;const input=root()?.querySelector('input[type=file]');if(!input){say('У цьому блоці немає поля завантаження фото');e.target.value='';return;}try{const transfer=new DataTransfer();transfer.items.add(file);input.files=transfer.files;input.dispatchEvent(new Event('change',{bubbles:true}));say('Фото передано в CMS; перевір прев’ю.');}catch(err){say('Не вдалося передати фото: '+err.message)}e.target.value='';});
bind('editPhoto',()=>{const scope=root();const btn=[...(scope?.querySelectorAll('button')||[])].find(b=>/кадруван|позиці|редагувати фото/i.test(b.textContent||''));if(btn)btn.click();else say('Для цього блоку кадрування поки недоступне');});
bind('undo',()=>d?.getElementById('studioUndo')?.click());bind('redo',()=>d?.getElementById('studioRedo')?.click());
bindValue('title',/заголовок|назва/i);bindValue('description',/підзаголовок|опис/i);bindValue('cta',/кнопк/i);
$('page').addEventListener('change',e=>{e.stopImmediatePropagation();let p=d?.getElementById('studioPage');if(p){p.value=e.target.value;p.dispatchEvent(new Event('change',{bubbles:true}));setTimeout(sync,850)}},true);
document.querySelectorAll('[data-device]').forEach(btn=>btn.addEventListener('click',()=>{d?.querySelector('[data-studio-device="'+btn.dataset.device+'"]')?.click()},true));
document.querySelectorAll('[data-rtab]').forEach(btn=>btn.addEventListener('click',()=>{d?.querySelector('[data-inspector-tab="'+btn.dataset.rtab+'"]')?.click()},true));
})();
