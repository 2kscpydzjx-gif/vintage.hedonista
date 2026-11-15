/* Vintazhka shared rich text editor — STEP 75 */
(function(){'use strict';
const ALLOWED=new Set(['P','DIV','BR','STRONG','B','EM','I','UL','OL','LI','H1','H2','H3','A','IMG','FIGURE','FIGCAPTION','BLOCKQUOTE']);
const svg={move:'<path d="M12 3v18M3 12h18M9 6l3-3 3 3M9 18l3 3 3-3M6 9l-3 3 3 3M18 9l3 3-3 3"/>',up:'<path d="M12 20V4M5 11l7-7 7 7"/>',down:'<path d="M12 4v16M5 13l7 7 7-7"/>',resize:'<path d="M4 20 20 4M12 4h8v8M4 12v8h8"/>',bold:'<path d="M6 4h6a4 4 0 0 1 0 8H6zm0 8h7a4 4 0 0 1 0 8H6z"/>',italic:'<path d="M10 4h9M5 20h9M14 4 9 20"/>',link:'<path d="M10 13a5 5 0 0 0 7 .4l3-3a5 5 0 0 0-7-7l-2 2M14 11a5 5 0 0 0-7-.4l-3 3a5 5 0 0 0 7 7l2-2"/>',list:'<path d="M9 6h12M9 12h12M9 18h12M3 6h.01M3 12h.01M3 18h.01"/>',image:'<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/>',paragraph:'<path d="M10 20V4m0 0h6v16M10 4H8a4 4 0 0 0 0 8h2"/>',h2:'<path d="M3 5v14M13 5v14M3 12h10M17 12a3 3 0 0 1 6 0c0 3-6 3-6 7h6"/>',h3:'<path d="M3 5v14M13 5v14M3 12h10M18 12a3 3 0 1 1 0 6M18 18a3 3 0 1 0 0-6"/>',left:'<path d="M4 6h16M4 10h10M4 14h16M4 18h10"/>',right:'<path d="M4 6h16M10 10h10M4 14h16M10 18h10"/>',center:'<path d="M4 6h16M7 10h10M4 14h16M7 18h10"/>',trash:'<path d="M4 7h16M10 3h4M6 7l1 14h10l1-14M10 11v6M14 11v6"/>'};
const ico=k=>`<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${svg[k]}</svg>`;
const urlOK=v=>/^(https?:\/\/|mailto:|tel:|\/|\.\/|\.\.\/|#)/i.test(v);
function safeHTML(html){const doc=new DOMParser().parseFromString('<div>'+String(html||'')+'</div>','text/html'),root=doc.body.firstElementChild;
 function walk(el){for(const n of [...el.childNodes]){if(n.nodeType===8){n.remove();continue}if(n.nodeType!==1)continue;
  if(['SCRIPT','STYLE','IFRAME','OBJECT','SVG','FORM'].includes(n.tagName)){n.remove();continue}
  const href=n.getAttribute('href'),src=n.getAttribute('src'),alt=n.getAttribute('alt'),width=n.getAttribute('data-vh-width'),align=n.getAttribute('data-vh-align'),x=n.getAttribute('data-vh-x');
  walk(n);if(!ALLOWED.has(n.tagName)){n.replaceWith(...n.childNodes);continue}for(const a of [...n.attributes])n.removeAttribute(a.name);
  if(n.tagName==='A'&&href&&urlOK(href)){n.setAttribute('href',href);n.setAttribute('rel','noopener noreferrer')}
  if(n.tagName==='IMG'){if(src&&(/^(https?:\/\/|\/|\.\/|\.\.\/)/i.test(src)||/^data:image\/(png|jpeg|webp);base64,/i.test(src))){n.setAttribute('src',src);n.setAttribute('alt',alt||'')}else n.remove()}
  if(n.tagName==='FIGURE')window.VHSafeRich.figureLayout(n,{width,align,x});
 }}walk(root);return root.innerHTML}
function create(source,opts={}){if(!source||source.dataset.vhRichReady)return null;source.dataset.vhRichReady='1';
 const host=document.createElement('div');host.className='vh-rte';host.innerHTML='<div class="vh-rte-toolbar"><span class="vh-rte-label">РЕДАКТОР ТЕКСТУ</span><div class="vh-rte-buttons"></div><div class="vh-rte-tabs"><button type="button" data-mode="visual" class="active">Візуально</button><button type="button" data-mode="html">HTML</button></div></div><div class="vh-rte-canvas" contenteditable="true" role="textbox" aria-multiline="true"></div><textarea class="vh-rte-code" spellcheck="false" hidden></textarea>';
 source.insertAdjacentElement('afterend',host);source.classList.add('vh-rte-source');const visual=host.querySelector('.vh-rte-canvas'),code=host.querySelector('.vh-rte-code'),buttons=host.querySelector('.vh-rte-buttons');let lastValue=null,selection=null,draggedFigure=null,dragOffset=0;
 const imageOriginals=new WeakMap();
 const status=document.createElement('div');status.className='vh-rte-status';status.setAttribute('role','status');host.append(status);
 const notice=text=>{status.textContent=text};
 const read=()=>source.value||'';const set=v=>{source.value=v;lastValue=v;source.dispatchEvent(new Event('input',{bubbles:true}))};
 const cleanVisual=()=>{const clone=visual.cloneNode(true);clone.querySelectorAll('.vh-image-controls,.vh-image-resize,.vh-image-drop-marker').forEach(n=>n.remove());clone.querySelectorAll('[contenteditable]').forEach(n=>n.removeAttribute('contenteditable'));return safeHTML(clone.innerHTML)};
 const sync=()=>{const v=cleanVisual();set(v);code.value=v};
 const remember=()=>{const sel=window.getSelection();if(sel&&sel.rangeCount&&visual.contains(sel.anchorNode))selection=sel.getRangeAt(0).cloneRange()};
 const restore=()=>{visual.focus({preventScroll:true});const sel=window.getSelection();if(!selection||!visual.contains(selection.commonAncestorContainer)){selection=document.createRange();selection.selectNodeContents(visual);selection.collapse(false)}sel.removeAllRanges();sel.addRange(selection)};
 function insertHTML(html){
  restore();if(document.execCommand('insertHTML',false,html))return;
  // Chromium can refuse insertHTML immediately after a non-editable figure.
  restore();const range=window.getSelection().getRangeAt(0),fragment=range.createContextualFragment(html),last=fragment.lastChild;
  range.deleteContents();range.insertNode(fragment);if(last){range.setStartAfter(last);range.collapse(true);selection=range.cloneRange();const sel=window.getSelection();sel.removeAllRanges();sel.addRange(range)}
 }
 const btn=(name,label,title,callback)=>{const b=document.createElement('button');b.type='button';b.className='vh-rte-tool';b.title=title;b.setAttribute('aria-label',title);b.innerHTML=svg[name]?ico(name):label;b.addEventListener('mousedown',e=>e.preventDefault());b.onclick=callback;buttons.append(b);return b};
 const cmd=(action,value)=>{restore();document.execCommand(action,false,value);sync();remember()};
 btn('bold','B','Жирний',()=>cmd('bold'));btn('italic','I','Курсив',()=>cmd('italic'));
 btn('link','','Додати або змінити посилання',()=>{
  restore();const sel=window.getSelection(),a=sel?.anchorNode?.parentElement?.closest('a');
  const v=prompt('Адреса посилання',a?.getAttribute('href')||'');
  if(v===null)return;
  if(!v.trim()){if(a){a.replaceWith(...a.childNodes);sync()}return}
  if(!urlOK(v)){alert('Некоректне посилання');return}
  if(a){a.setAttribute('href',v.trim());sync();remember()}else cmd('createLink',v.trim())
 });
 btn('','Зняти 🔗','Прибрати посилання (текст залишиться)',()=>{
  restore();const sel=window.getSelection(),a=sel?.anchorNode?.parentElement?.closest('a');
  if(a&&visual.contains(a)){a.replaceWith(...a.childNodes);sync();remember()}
  else cmd('unlink')
 });
 btn('list','','Маркований список',()=>cmd('insertUnorderedList'));
 const format=(tag)=>{restore();const sel=window.getSelection(),node=sel?.anchorNode,block=node?.parentElement?.closest('h1,h2,h3,p,div,li');const next=block?.tagName?.toLowerCase()===tag?'p':tag;document.execCommand('formatBlock',false,next);sync();remember()};
 btn('','H1','Заголовок H1 (лише для сторінок без основного H1)',()=>format('h1'));btn('h2','','Заголовок H2 (повторне натискання — звичайний текст)',()=>format('h2'));btn('h3','','Підзаголовок H3 (повторне натискання — звичайний текст)',()=>format('h3'));btn('paragraph','','Звичайний абзац',()=>format('p'));
 function decorate(){
  if(!opts.images)return;
  // Pasted and browser-inserted block photos must sit between text blocks.
  for(const fig of visual.querySelectorAll('figure')){
   while(fig.parentElement&&fig.parentElement!==visual){
    const parent=fig.parentElement,tail=parent.cloneNode(false),range=document.createRange();
    range.setStartAfter(fig);range.setEnd(parent,parent.childNodes.length);tail.append(range.extractContents());
    parent.after(fig);if(tail.childNodes.length)fig.after(tail);
    if(!parent.textContent.trim()&&!parent.querySelector('img,br'))parent.remove();
   }
  }
  visual.querySelectorAll('figure').forEach(fig=>{
   window.VHSafeRich.figureLayout(fig);
   if(fig.querySelector('.vh-image-controls'))return;
   fig.classList.add('vh-inline-figure');fig.setAttribute('contenteditable','false');
   const panel=document.createElement('div');panel.className='vh-image-controls';panel.setAttribute('contenteditable','false');
   const make=(key,title,fn,label)=>{const b=document.createElement('button');b.type='button';b.title=title;b.setAttribute('aria-label',title);b.innerHTML=svg[key]?ico(key):(label||key);b.onmousedown=e=>e.preventDefault();b.onclick=e=>{e.preventDefault();fn(b)};panel.append(b);return b};
   const size=document.createElement('select');size.title='Розмір фото';size.setAttribute('aria-label','Розмір фото');
   [100,80,60,40,25].forEach(v=>size.add(new Option(v+'%',v)));panel.append(size);
   const extras=document.createElement('details');extras.className='vh-image-adjustments';
   extras.innerHTML='<summary>Ширина й положення</summary><label>Ширина <output></output><input type="range" min="20" max="100" step="1" aria-label="Ширина фото у відсотках"></label><label>Положення <input type="range" min="0" max="100" step="1" aria-label="Положення фото по горизонталі"></label>';
   const [widthRange,xRange]=extras.querySelectorAll('input'),output=extras.querySelector('output');
   function update(){
    const w=Number(fig.dataset.vhWidth)||100;
    for(const o of [...size.options])if(o.dataset.custom)o.remove();
    if(![...size.options].some(o=>Number(o.value)===w)){const option=new Option(w+'%',w);option.dataset.custom='1';size.add(option)}
    size.value=String(w);widthRange.value=String(w);output.value=w+'%';
    xRange.value=fig.dataset.vhAlign==='right'?'100':fig.dataset.vhAlign==='center'?'50':fig.dataset.vhX||'0';
    window.VHSafeRich.figureLayout(fig);sync();
   }
   size.onchange=()=>{fig.dataset.vhWidth=size.value;update()};
   widthRange.oninput=()=>{fig.dataset.vhWidth=widthRange.value;update()};
   xRange.oninput=()=>{fig.dataset.vhAlign='free';fig.dataset.vhX=xRange.value;update()};
   const align=value=>{fig.dataset.vhAlign=value;delete fig.dataset.vhX;fig.style.removeProperty('--vh-photo-offset');update()};
   make('left','Фото ліворуч, текст обтікає справа',()=>align('left'));
   make('center','Фото по центру, без обтікання',()=>align('center'));
   make('right','Фото праворуч, текст обтікає зліва',()=>align('right'));
   const grip=make('move','Перетягнути фото між абзацами',()=>notice('Перетягни фото за цю ручку в потрібне місце. Для клавіатури — Alt + ↑ або ↓.'),'↕');
   grip.className='vh-image-drag';grip.draggable=true;
   grip.addEventListener('dragstart',e=>{draggedFigure=fig;dragOffset=e.clientX-fig.getBoundingClientRect().left;e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('application/x-vh-article-photo','move');e.dataTransfer.setDragImage(fig,Math.max(0,dragOffset),20);fig.classList.add('is-dragging')});
   grip.addEventListener('dragend',finishDrag);
   function shift(direction){const sibling=direction<0?fig.previousElementSibling:fig.nextElementSibling;if(!sibling||sibling.classList.contains('vh-image-drop-marker'))return;if(direction<0)sibling.before(fig);else sibling.after(fig);update();notice('Фото переміщено')}
   grip.addEventListener('keydown',e=>{if(e.altKey&&['ArrowUp','ArrowDown'].includes(e.key)){e.preventDefault();shift(e.key==='ArrowUp'?-1:1)}});
   make('up','Фото на один блок вище',()=>shift(-1),'↑');make('down','Фото на один блок нижче',()=>shift(1),'↓');
   make('','ALT опис фото',()=>{const img=fig.querySelector('img');if(!img)return;const alt=prompt('ALT: опишіть зображення для пошуку та доступності',img.alt||'');if(alt!==null){img.alt=alt.trim();sync()}},'ALT');
   make('','Прибрати однотонні поля з фото',async button=>{
    const img=fig.querySelector('img');if(!img)return;
    if(imageOriginals.has(fig)){img.src=imageOriginals.get(fig);imageOriginals.delete(fig);button.textContent='Без полів';button.title='Прибрати однотонні поля з фото';button.setAttribute('aria-label',button.title);sync();notice('Початкове фото відновлено');return}
    button.disabled=true;notice('Перевіряємо поля фотографії…');
    try{const cropped=await window.VHArticlePhotos.trimPadding(img.src);if(!cropped){notice('Однотонних полів не знайдено. Фото залишилося без змін.');return}imageOriginals.set(fig,img.src);img.src=cropped;button.textContent='↶';button.title='Скасувати прибирання полів';button.setAttribute('aria-label',button.title);sync();notice('Поля прибрано. Зміна потрапить на сайт після збереження статті.')}catch{notice('Не вдалося обробити це фото. Спробуй вставити оригінал файлу.')}finally{button.disabled=false}
   },'Без полів');
   make('trash','Видалити фото',()=>{fig.remove();sync()});
   panel.append(extras);fig.append(panel);
   const resize=document.createElement('button');resize.type='button';resize.className='vh-image-resize';resize.setAttribute('aria-label','Змінити ширину фото перетягуванням');resize.title='Тягни для зміни ширини; клавіші ← / → — по 1%';resize.innerHTML=ico('resize');fig.append(resize);
   const setWidth=value=>{fig.dataset.vhWidth=String(Math.max(20,Math.min(100,Math.round(value))));update()};
   resize.addEventListener('pointerdown',e=>{
    if(e.button!==0)return;e.preventDefault();e.stopPropagation();const start=e.clientX,startWidth=Number(fig.dataset.vhWidth)||100,available=visual.clientWidth-parseFloat(getComputedStyle(visual).paddingLeft)-parseFloat(getComputedStyle(visual).paddingRight);
    resize.setPointerCapture(e.pointerId);
    const move=event=>setWidth(startWidth+(event.clientX-start)/available*100);
    const end=()=>{resize.removeEventListener('pointermove',move);resize.removeEventListener('pointerup',end);resize.removeEventListener('pointercancel',end)};
    resize.addEventListener('pointermove',move);resize.addEventListener('pointerup',end);resize.addEventListener('pointercancel',end);
   });
   resize.addEventListener('keydown',e=>{if(['ArrowLeft','ArrowRight'].includes(e.key)){e.preventDefault();setWidth((Number(fig.dataset.vhWidth)||100)+(e.key==='ArrowRight'?1:-1)*(e.shiftKey?5:1))}});
   // Reflect saved dimensions without dirtying or rewriting an article merely opened for reading.
   const w=Number(fig.dataset.vhWidth)||100;
   if(![...size.options].some(o=>Number(o.value)===w)){const o=new Option(w+'%',w);o.dataset.custom='1';size.add(o)}size.value=String(w);widthRange.value=String(w);output.value=w+'%';xRange.value=fig.dataset.vhAlign==='right'?'100':fig.dataset.vhAlign==='center'?'50':fig.dataset.vhX||'0';
  });
 }
 const marker=document.createElement('div');marker.className='vh-image-drop-marker';marker.setAttribute('contenteditable','false');
 function finishDrag(){draggedFigure?.classList.remove('is-dragging');draggedFigure=null;marker.remove()}
 visual.addEventListener('dragover',e=>{
  if(!draggedFigure)return;e.preventDefault();e.dataTransfer.dropEffect='move';
  let target=e.target.closest('figure,p,div,h1,h2,h3,ul,ol,blockquote');
  if(target===marker)return;
  while(target&&target!==visual&&target.parentElement!==visual)target=target.parentElement;
  if(target===draggedFigure)return;
  if(!target||target===visual){visual.append(marker);return}
  const box=target.getBoundingClientRect();if(e.clientY<box.top+box.height/2)target.before(marker);else target.after(marker);
 });
 visual.addEventListener('drop',e=>{
  if(!draggedFigure)return;e.preventDefault();
  const fig=draggedFigure;
  if(marker.isConnected){marker.before(fig);const bounds=visual.getBoundingClientRect(),style=getComputedStyle(visual),left=bounds.left+parseFloat(style.paddingLeft),available=visual.clientWidth-parseFloat(style.paddingLeft)-parseFloat(style.paddingRight)-fig.getBoundingClientRect().width;fig.dataset.vhAlign='free';fig.dataset.vhX=String(available>0?Math.max(0,Math.min(100,Math.round((e.clientX-left-dragOffset)/available*100))):0);window.VHSafeRich.figureLayout(fig);fig.querySelectorAll('.vh-image-adjustments input')[1].value=fig.dataset.vhX}
  finishDrag();sync();notice('Фото переміщено');
 });
 async function addImage(file){if(!file||!/^image\/(jpeg|png|webp)$/.test(file.type)){alert('Виберіть JPG, PNG або WebP');return}if(file.size>12000000){alert('Фото має бути до 12 МБ');return}
  const bitmap=await createImageBitmap(file);const scale=Math.min(1,1600/bitmap.width,1600/bitmap.height),canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));canvas.getContext('2d').drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close();const src=canvas.toDataURL('image/webp',.9);
  insertHTML('<figure data-vh-width="100" data-vh-align="center"><img src="'+src+'" alt="Фото статті"></figure><p><br></p>');decorate();sync();remember();}

 if(opts.images){const picker=document.createElement('input');picker.type='file';picker.accept='image/jpeg,image/png,image/webp';picker.hidden=true;host.append(picker);picker.onchange=async()=>{const f=picker.files?.[0];picker.value='';if(!f)return;try{await addImage(f)}catch(e){console.error(e);alert('Не вдалося обробити фотографію')}};btn('image','','Вставити фотографію',()=>{remember();picker.click()})}
 function mode(next){host.querySelectorAll('[data-mode]').forEach(b=>b.classList.toggle('active',b.dataset.mode===next));if(next==='html'){code.value=cleanVisual();visual.hidden=true;code.hidden=false}else{visual.innerHTML=safeHTML(code.value);code.hidden=true;visual.hidden=false;decorate();sync()}}
 visual.addEventListener('paste',e=>{
  const html=e.clipboardData?.getData('text/html'),text=e.clipboardData?.getData('text/plain');
  if(!html&&!text)return;e.preventDefault();remember();restore();
  const plain=document.createElement('div');plain.textContent=text||'';
  insertHTML(html?safeHTML(html):plain.innerHTML.replace(/\n/g,'<br>'));
  decorate();sync();remember();
 });
 host.querySelectorAll('[data-mode]').forEach(b=>b.onclick=()=>mode(b.dataset.mode));visual.addEventListener('input',()=>{sync();remember()});visual.addEventListener('keyup',remember);visual.addEventListener('mouseup',remember);code.addEventListener('input',()=>set(safeHTML(code.value)));
 if(opts.images){
  const topbar=document.querySelector('.topbar');
  if(topbar){const observer=new ResizeObserver(()=>{if(!host.isConnected){observer.disconnect();return}host.style.setProperty('--vh-editor-top',(topbar.getBoundingClientRect().height+8)+'px')});observer.observe(topbar)}
 }
 function refresh(){const value=read();if(value===lastValue)return;lastValue=value;visual.innerHTML=safeHTML(value);code.value=safeHTML(value);decorate()}refresh();
 const timer=setInterval(()=>{if(!host.isConnected){clearInterval(timer);return}if(document.activeElement===visual||document.activeElement===code||host.contains(document.activeElement))return;refresh()},500);
 function replaceImageUrls(urls){
  for(const img of visual.querySelectorAll('img')){const next=urls.get(img.getAttribute('src'));if(next)img.setAttribute('src',next)}
  if(!code.hidden){const doc=new DOMParser().parseFromString('<div>'+safeHTML(code.value)+'</div>','text/html');for(const img of doc.querySelectorAll('img')){const next=urls.get(img.getAttribute('src'));if(next)img.setAttribute('src',next)}code.value=doc.body.firstElementChild.innerHTML;set(code.value)}else sync();
 }
 const api={host,refresh,sync,replaceImageUrls};source.__vhRichEditor=api;return api}
function mount(){for(const id of ['pShort','pDescription','nExcerpt']){const el=document.getElementById(id);if(el)create(el)}const article=document.getElementById('journalArticleHtml');if(article)create(article,{images:true})}
document.addEventListener('DOMContentLoaded',()=>{mount();const root=document.getElementById('journalBlockEditor');if(root)new MutationObserver(()=>{const el=document.getElementById('journalArticleHtml');if(el&&!el.dataset.vhRichReady)create(el,{images:true})}).observe(root,{childList:true})});
window.VHRichEditor={create,mount,safeHTML};})();
