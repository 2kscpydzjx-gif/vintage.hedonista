/* Vintazhka shared rich text editor — STEP 75 */
(function(){'use strict';
const ALLOWED=new Set(['P','DIV','BR','STRONG','B','EM','I','UL','OL','LI','H1','H2','H3','A','IMG','FIGURE','FIGCAPTION','BLOCKQUOTE']);
const svg={undo:'<path d="M9 4 4 9l5 5M4 9h9a7 7 0 0 1 0 14"/>',redo:'<path d="m15 4 5 5-5 5M20 9h-9a7 7 0 0 0 0 14"/>',move:'<path d="M12 3v18M3 12h18M9 6l3-3 3 3M9 18l3 3 3-3M6 9l-3 3 3 3M18 9l3 3-3 3"/>',up:'<path d="M12 20V4M5 11l7-7 7 7"/>',down:'<path d="M12 4v16M5 13l7 7 7-7"/>',resize:'<path d="M4 20 20 4M12 4h8v8M4 12v8h8"/>',bold:'<path d="M6 4h6a4 4 0 0 1 0 8H6zm0 8h7a4 4 0 0 1 0 8H6z"/>',italic:'<path d="M10 4h9M5 20h9M14 4 9 20"/>',link:'<path d="M10 13a5 5 0 0 0 7 .4l3-3a5 5 0 0 0-7-7l-2 2M14 11a5 5 0 0 0-7-.4l-3 3a5 5 0 0 0 7 7l2-2"/>',list:'<path d="M9 6h12M9 12h12M9 18h12M3 6h.01M3 12h.01M3 18h.01"/>',image:'<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/>',paragraph:'<path d="M10 20V4m0 0h6v16M10 4H8a4 4 0 0 0 0 8h2"/>',h2:'<path d="M3 5v14M13 5v14M3 12h10M17 12a3 3 0 0 1 6 0c0 3-6 3-6 7h6"/>',h3:'<path d="M3 5v14M13 5v14M3 12h10M18 12a3 3 0 1 1 0 6M18 18a3 3 0 1 0 0-6"/>',left:'<path d="M4 6h16M4 10h10M4 14h16M4 18h10"/>',right:'<path d="M4 6h16M10 10h10M4 14h16M10 18h10"/>',center:'<path d="M4 6h16M7 10h10M4 14h16M7 18h10"/>',trash:'<path d="M4 7h16M10 3h4M6 7l1 14h10l1-14M10 11v6M14 11v6"/>'};
const ico=k=>`<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${svg[k]}</svg>`;
const urlOK=v=>/^(https?:\/\/|mailto:|tel:|\/|\.\/|\.\.\/|#)/i.test(v);
function safeHTML(html){const doc=new DOMParser().parseFromString('<div>'+String(html||'')+'</div>','text/html'),root=doc.body.firstElementChild;
 function walk(el){for(const n of [...el.childNodes]){if(n.nodeType===8){n.remove();continue}if(n.nodeType!==1)continue;
  if(['SCRIPT','STYLE','IFRAME','OBJECT','SVG','FORM'].includes(n.tagName)){n.remove();continue}
  const href=n.getAttribute('href'),src=n.getAttribute('src'),alt=n.getAttribute('alt'),width=n.getAttribute('data-vh-width'),align=n.getAttribute('data-vh-align'),x=n.getAttribute('data-vh-x'),row=n.getAttribute('data-vh-photo-row');
  walk(n);if(!ALLOWED.has(n.tagName)){n.replaceWith(...n.childNodes);continue}for(const a of [...n.attributes])n.removeAttribute(a.name);
  if(n.tagName==='A'&&href&&urlOK(href)){n.setAttribute('href',href);n.setAttribute('rel','noopener noreferrer')}
  if(n.tagName==='IMG'){if(src&&(/^(https?:\/\/|\/|\.\/|\.\.\/)/i.test(src)||/^data:image\/(png|jpeg|webp);base64,/i.test(src))){n.setAttribute('src',src);n.setAttribute('alt',alt||'')}else n.remove()}
  if(n.tagName==='FIGURE')window.VHSafeRich.figureLayout(n,{width,align,x});
  if(n.tagName==='DIV')window.VHSafeRich.photoRowLayout(n,row);
 }}walk(root);return root.innerHTML}
function create(source,opts={}){if(!source||source.dataset.vhRichReady)return null;source.dataset.vhRichReady='1';
 const host=document.createElement('div');host.className='vh-rte';host.innerHTML='<div class="vh-rte-toolbar"><span class="vh-rte-label">РЕДАКТОР ТЕКСТУ</span><div class="vh-rte-buttons"></div><div class="vh-rte-tabs"><button type="button" data-mode="visual" class="active">Візуально</button><button type="button" data-mode="html">HTML</button></div></div><div class="vh-rte-canvas" contenteditable="true" role="textbox" aria-multiline="true"></div><textarea class="vh-rte-code" spellcheck="false" hidden></textarea>';
 source.insertAdjacentElement('afterend',host);source.classList.add('vh-rte-source');const visual=host.querySelector('.vh-rte-canvas'),code=host.querySelector('.vh-rte-code'),buttons=host.querySelector('.vh-rte-buttons');let lastValue=null,selection=null,draggedFigure=null,dropProposal=null,dragOffset=0;
 let activeFigure=null,undoButton,redoButton,history=[],historyIndex=-1,replaying=false,lastGroup='',lastEdit=0;
 const cleanup=new AbortController();
 const status=document.createElement('div');status.className='vh-rte-status';status.setAttribute('role','status');host.append(status);
 const notice=text=>{status.textContent=text};
 const read=()=>source.value||'';const set=v=>{source.value=v;lastValue=v;source.dispatchEvent(new Event('input',{bubbles:true}))};
 const cleanVisual=()=>{const clone=visual.cloneNode(true);clone.querySelectorAll('.vh-image-controls,.vh-image-resize,.vh-image-drop-marker').forEach(n=>n.remove());clone.querySelectorAll('[contenteditable]').forEach(n=>n.removeAttribute('contenteditable'));return safeHTML(clone.innerHTML)};
 const sync=(group='')=>{const v=cleanVisual();set(v);code.value=v;record(v,group)};
 const remember=()=>{const sel=window.getSelection();if(sel&&sel.rangeCount&&visual.contains(sel.anchorNode))selection=sel.getRangeAt(0).cloneRange()};
 const restore=()=>{visual.focus({preventScroll:true});const sel=window.getSelection();if(!selection||!visual.contains(selection.commonAncestorContainer)){selection=document.createRange();selection.selectNodeContents(visual);selection.collapse(false)}sel.removeAllRanges();sel.addRange(selection)};
 function point(node,offset){
  if(!node||!visual.contains(node)||node.parentElement?.closest('.vh-image-controls,.vh-image-resize'))return null;
  const path=[];for(let n=node;n!==visual;n=n.parentNode)path.unshift([...n.parentNode.childNodes].indexOf(n));
  return {path,offset,type:node.nodeType};
 }
 function bookmark(){
  if(!code.hidden)return {code:[code.selectionStart,code.selectionEnd]};
  const sel=window.getSelection();if(!sel?.rangeCount)return null;const r=sel.getRangeAt(0);
  const start=point(r.startContainer,r.startOffset),end=point(r.endContainer,r.endOffset);return start&&end?{start,end}:null;
 }
 function metadata(){return {caret:bookmark(),scroll:code.hidden?visual.scrollTop:code.scrollTop,photo:activeFigure?[...visual.querySelectorAll('figure')].indexOf(activeFigure):-1}}
 function updateHistoryMeta(){if(!replaying&&historyIndex>=0)Object.assign(history[historyIndex],metadata())}
 function updateHistoryButtons(){if(undoButton)undoButton.disabled=historyIndex<=0;if(redoButton)redoButton.disabled=historyIndex>=history.length-1}
 function record(html,group=''){
  if(replaying)return;
  const state={html,...metadata()},now=Date.now();
  if(history[historyIndex]?.html===html){Object.assign(history[historyIndex],state);updateHistoryButtons();return}
  history.splice(historyIndex+1);
  if(group&&group===lastGroup&&now-lastEdit<750&&historyIndex>0)history[historyIndex]=state;
  else{history.push(state);historyIndex++}
  while(history.length>2&&(history.length>60||history.reduce((n,x)=>n+x.html.length,0)>16000000)){history.shift();historyIndex--}
  lastGroup=group;lastEdit=now;updateHistoryButtons();
 }
 function restoreCaret(saved){
  if(!code.hidden){code.focus({preventScroll:true});const values=saved?.code||[code.value.length,code.value.length];code.setSelectionRange(...values);return}
  visual.focus({preventScroll:true});const range=document.createRange();
  const resolve=p=>{let node=visual;for(const index of p.path){node=node.childNodes[index];if(!node)return null}return node.nodeType===p.type?node:null};
  try{const a=saved?.start&&resolve(saved.start),b=saved?.end&&resolve(saved.end);if(!a||!b)throw new Error('caret');range.setStart(a,Math.min(saved.start.offset,a.nodeType===3?a.length:a.childNodes.length));range.setEnd(b,Math.min(saved.end.offset,b.nodeType===3?b.length:b.childNodes.length))}catch{range.selectNodeContents(visual);range.collapse(false)}
  if(range.collapsed&&range.startContainer===visual&&range.startOffset===visual.childNodes.length&&visual.lastElementChild?.tagName==='FIGURE'){const p=document.createElement('p');p.append(document.createElement('br'));visual.append(p);range.setStart(p,0);range.collapse(true)}
  const sel=window.getSelection();sel.removeAllRanges();sel.addRange(range);selection=range.cloneRange();
 }
 function travel(direction){
  const next=historyIndex+direction;if(next<0||next>=history.length)return;
  updateHistoryMeta();historyIndex=next;const state=history[next];replaying=true;
  activeFigure=null;visual.innerHTML=state.html;code.value=state.html;set(state.html);selection=null;decorate();
  const fig=visual.querySelectorAll('figure')[state.photo];if(fig)activatePhoto(fig,false);
  restoreCaret(state.caret);(code.hidden?visual:code).scrollTop=state.scroll;positionControls();
  replaying=false;lastGroup='';updateHistoryButtons();notice(direction<0?'Зміну скасовано':'Зміну повернуто');
 }
 function caretAfter(fig){
  fig=topBlock(fig);let next=fig.nextElementSibling;if(!next||next.tagName==='FIGURE'){next=document.createElement('p');next.append(document.createElement('br'));fig.after(next)}
  const range=document.createRange();range.selectNodeContents(next);range.collapse(true);visual.focus({preventScroll:true});const sel=window.getSelection();sel.removeAllRanges();sel.addRange(range);selection=range.cloneRange();
 }
 function activatePhoto(fig,focus=true){
  if(!fig&&!activeFigure)return;
  const current=window.getSelection(),caret=!focus&&current?.rangeCount&&visual.contains(current.anchorNode)?current.getRangeAt(0).cloneRange():null;
  for(const photo of visual.querySelectorAll('figure')){const active=photo===fig;photo.classList.toggle('is-photo-selected',active);photo.querySelector('.vh-image-controls')?.toggleAttribute('hidden',!active);photo.querySelector('.vh-image-resize')?.toggleAttribute('hidden',!active)}
  activeFigure=fig&&visual.contains(fig)?fig:null;
  if(activeFigure&&focus)caretAfter(activeFigure);
  else if(caret&&visual.contains(caret.commonAncestorContainer)){current.removeAllRanges();current.addRange(caret);selection=caret.cloneRange()}
  positionControls();
 }
 function positionControls(){
  if(!activeFigure?.isConnected||draggedFigure)return;
  const panel=activeFigure.querySelector('.vh-image-controls'),image=activeFigure.querySelector('img');if(!panel||!image)return;
  const bounds=visual.getBoundingClientRect(),photo=image.getBoundingClientRect(),fig=activeFigure.getBoundingClientRect(),style=getComputedStyle(visual);
  const header=document.querySelector('.topbar')?.getBoundingClientRect().bottom||0,heading=document.querySelector('#newsForm.active>.content-editor-top')?.getBoundingClientRect().bottom||0;
  const top=Math.max(bounds.top+6,header+6,heading+6),bottom=Math.min(bounds.bottom-6,innerHeight-12);
  if(photo.bottom<top||photo.top>bottom||bottom<=top){panel.hidden=true;return}
  panel.hidden=false;const width=Math.min(300,visual.clientWidth-parseFloat(style.paddingLeft)-parseFloat(style.paddingRight)-12);
  panel.style.width=Math.max(120,width)+'px';panel.style.maxHeight=Math.max(100,bottom-top)+'px';
  const left=Math.max(bounds.left+6,Math.min(photo.right-width,bounds.left+visual.clientWidth-width-6));
  panel.style.left=(left-fig.left)+'px';panel.style.top=(Math.max(top,Math.min(photo.top+6,bottom-panel.getBoundingClientRect().height))-fig.top)+'px';
 }
 function topBlock(node){while(node&&node.parentElement!==visual)node=node.parentElement;return node}
 function updateScale(fig){
  const select=fig.querySelector('.vh-image-scale');if(!select)return;
  const width=String(Math.max(20,Math.min(100,Number(fig.dataset.vhWidth)||100)));
  for(const option of [...select.options])if(option.dataset.custom)option.remove();
  if(![...select.options].some(option=>option.value===width)){const option=new Option(width+'%',width);option.dataset.custom='1';select.add(option)}
  select.value=width;
 }
 function photoPlacement(fig,align='center'){
  delete fig.dataset.vhX;fig.style.removeProperty('--vh-photo-offset');
  fig.dataset.vhAlign=align;fig.dataset.vhWidth=['left','right'].includes(align)?'40':'100';window.VHSafeRich.figureLayout(fig);updateScale(fig);
 }
 function normalizeRows(){
  for(const row of visual.querySelectorAll('div[data-vh-photo-row]')){
   const photos=[...row.children].filter(child=>child.tagName==='FIGURE');
   if([...row.childNodes].some(n=>n.nodeType===1&&n.tagName!=='FIGURE'||n.nodeType===3&&n.textContent.trim())){row.replaceWith(...row.childNodes);continue}
   if(!photos.length){row.remove();continue}
   if(photos.length===1){row.replaceWith(photos[0]);continue}
   if(photos.length>3){for(let i=photos.length-1;i>=3;i--)row.after(photos[i]);}
   for(const photo of photos.slice(0,3)){photo.dataset.vhAlign='center';delete photo.dataset.vhX;photo.style.removeProperty('--vh-photo-offset');window.VHSafeRich.figureLayout(photo);updateScale(photo)}
   window.VHSafeRich.photoRowLayout(row,String(Math.min(3,photos.length)));
  }
 }
 function deletePhoto(fig){
  if(!fig||!visual.contains(fig))return;updateHistoryMeta();
  const root=topBlock(fig),next=root.nextElementSibling,previous=root.previousElementSibling;
  const remaining=root!==fig?[...root.querySelectorAll('figure')].filter(photo=>photo!==fig):[];
  activatePhoto(null,false);fig.remove();normalizeRows();
  if(remaining.length){caretAfter(remaining.at(-1));sync();notice('Фото видалено. Його можна повернути стрілкою скасування.');return}
  let block=next&&next.tagName!=='FIGURE'?next:previous&&previous.tagName!=='FIGURE'?previous:null;
  if(!block){block=document.createElement('p');block.append(document.createElement('br'));if(next)next.before(block);else visual.append(block)}
  const range=document.createRange();range.selectNodeContents(block);range.collapse(block===next||!previous);visual.focus({preventScroll:true});const sel=window.getSelection();sel.removeAllRanges();sel.addRange(range);selection=range.cloneRange();sync();notice('Фото видалено. Його можна повернути стрілкою скасування.');
 }
 function insertHTML(html){
  restore();if(document.execCommand('insertHTML',false,html))return;
  // Chromium can refuse insertHTML immediately after a non-editable figure.
  restore();const range=window.getSelection().getRangeAt(0),fragment=range.createContextualFragment(html),last=fragment.lastChild;
  range.deleteContents();range.insertNode(fragment);if(last){range.setStartAfter(last);range.collapse(true);selection=range.cloneRange();const sel=window.getSelection();sel.removeAllRanges();sel.addRange(range)}
 }
 const btn=(name,label,title,callback)=>{const b=document.createElement('button');b.type='button';b.className='vh-rte-tool';b.title=title;b.setAttribute('aria-label',title);b.innerHTML=svg[name]?ico(name):label;b.addEventListener('mousedown',e=>e.preventDefault());b.onclick=()=>{updateHistoryMeta();callback()};buttons.append(b);return b};
 const cmd=(action,value)=>{restore();document.execCommand(action,false,value);sync();remember()};
 undoButton=btn('undo','','Скасувати зміну',()=>travel(-1));redoButton=btn('redo','','Повторити зміну',()=>travel(1));
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
  normalizeRows();
  // Lift blocks out of pasted paragraphs while retaining explicit photo rows.
  for(const block of visual.querySelectorAll('div[data-vh-photo-row],figure')){
   while(block.parentElement&&block.parentElement!==visual&&!block.parentElement.matches('div[data-vh-photo-row]')){
    const parent=block.parentElement,tail=parent.cloneNode(false),range=document.createRange();
    range.setStartAfter(block);range.setEnd(parent,parent.childNodes.length);tail.append(range.extractContents());
    parent.after(block);if(tail.childNodes.length)block.after(tail);
    if(!parent.textContent.trim()&&!parent.querySelector('img,br'))parent.remove();
   }
  }
  visual.querySelectorAll('figure').forEach(fig=>{
   window.VHSafeRich.figureLayout(fig);
   if(fig.querySelector('.vh-image-controls'))return;
   fig.classList.add('vh-inline-figure');fig.setAttribute('contenteditable','false');
   const panel=document.createElement('div');panel.className='vh-image-controls';panel.hidden=true;panel.setAttribute('contenteditable','false');
   const make=(key,title,fn,label)=>{const b=document.createElement('button');b.type='button';b.title=title;b.setAttribute('aria-label',title);b.innerHTML=svg[key]?ico(key):(label||key);b.onmousedown=e=>e.preventDefault();b.onclick=e=>{e.preventDefault();updateHistoryMeta();fn(b)};panel.append(b);return b};
   const size=document.createElement('select');size.className='vh-image-scale';size.title='Масштаб фото';size.setAttribute('aria-label','Масштаб фото');[100,80,60,40,25].forEach(value=>size.add(new Option(value+'%',value)));panel.append(size);
   function update(group=''){window.VHSafeRich.figureLayout(fig);updateScale(fig);sync(group);positionControls()}
   size.onchange=()=>{updateHistoryMeta();fig.dataset.vhWidth=size.value;update()};
   const align=value=>{const row=fig.parentElement.matches('[data-vh-photo-row]')?fig.parentElement:null;if(row){row.after(fig);normalizeRows()}photoPlacement(fig,value);update()};
   make('left','Фото ліворуч, текст обтікає справа',()=>align('left'));
   make('center','Фото по центру, без обтікання',()=>align('center'));
   make('right','Фото праворуч, текст обтікає зліва',()=>align('right'));
   const grip=make('move','Перетягнути фото між абзацами',()=>notice('Перетягни саме фото або ручку: збоку іншого фото — в один ряд, збоку абзацу — поряд із текстом.'),'↕');
   grip.className='vh-image-drag';grip.draggable=true;
   const img=fig.querySelector('img');if(img)img.draggable=true;
   function shift(direction){const block=topBlock(fig),sibling=direction<0?block.previousElementSibling:block.nextElementSibling;if(!sibling||sibling.classList.contains('vh-image-drop-marker'))return;if(direction<0)sibling.before(fig);else sibling.after(fig);photoPlacement(fig);normalizeRows();update();notice('Фото переміщено')}
   grip.addEventListener('keydown',e=>{if(e.altKey&&['ArrowUp','ArrowDown'].includes(e.key)){e.preventDefault();shift(e.key==='ArrowUp'?-1:1)}});
   make('up','Фото на один блок вище',()=>shift(-1),'↑');make('down','Фото на один блок нижче',()=>shift(1),'↓');
   make('','ALT опис фото',()=>{const img=fig.querySelector('img');if(!img)return;const alt=prompt('ALT: опишіть зображення для пошуку та доступності',img.alt||'');if(alt!==null){img.alt=alt.trim();sync()}},'ALT');
   make('trash','Видалити фото',()=>deletePhoto(fig));
   panel.addEventListener('focusin',updateHistoryMeta);fig.append(panel);updateScale(fig);
   const resize=document.createElement('button');resize.type='button';resize.hidden=true;resize.className='vh-image-resize';resize.setAttribute('aria-label','Змінити ширину фото перетягуванням');resize.title='Тягни для зміни ширини; клавіші ← / → — по 1%';resize.innerHTML=ico('resize');fig.append(resize);
   const setWidth=value=>{fig.dataset.vhWidth=String(Math.max(20,Math.min(100,Math.round(value))));update('photo-width')};
   resize.addEventListener('pointerdown',e=>{
    if(e.button!==0)return;e.preventDefault();e.stopPropagation();updateHistoryMeta();lastGroup='';const start=e.clientX,startWidth=Number(fig.dataset.vhWidth)||100,available=visual.clientWidth-parseFloat(getComputedStyle(visual).paddingLeft)-parseFloat(getComputedStyle(visual).paddingRight);
    resize.setPointerCapture(e.pointerId);
    const move=event=>setWidth(startWidth+(event.clientX-start)/available*100);
    const end=()=>{resize.removeEventListener('pointermove',move);resize.removeEventListener('pointerup',end);resize.removeEventListener('pointercancel',end)};
    resize.addEventListener('pointermove',move);resize.addEventListener('pointerup',end);resize.addEventListener('pointercancel',end);
   });
   resize.addEventListener('keydown',e=>{if(['ArrowLeft','ArrowRight'].includes(e.key)){e.preventDefault();setWidth((Number(fig.dataset.vhWidth)||100)+(e.key==='ArrowRight'?1:-1)*(e.shiftKey?5:1))}});
  });
 }
 const marker=document.createElement('div');marker.className='vh-image-drop-marker';marker.setAttribute('contenteditable','false');marker.setAttribute('aria-hidden','true');
 function finishDrag(){draggedFigure?.classList.remove('is-dragging');draggedFigure=null;dropProposal=null;marker.remove();positionControls()}
 visual.addEventListener('dragstart',e=>{
  if(!e.target.matches('img,.vh-image-drag')&&!e.target.closest('.vh-image-drag'))return;
  const fig=e.target.closest('figure'),img=fig?.querySelector('img');if(!fig||!img)return;
  activatePhoto(fig,false);updateHistoryMeta();lastGroup='';draggedFigure=fig;
  e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('application/x-vh-article-photo','move');
  const rect=img.getBoundingClientRect();dragOffset=Math.max(0,Math.min(rect.width,e.clientX-rect.left));e.dataTransfer.setDragImage(img,Math.max(0,Math.min(rect.width,e.clientX-rect.left)),Math.max(0,Math.min(rect.height,e.clientY-rect.top)));fig.classList.add('is-dragging');
 });
 visual.addEventListener('dragend',finishDrag);
 document.addEventListener('dragover',e=>{if(draggedFigure&&!visual.contains(e.target)){e.preventDefault();e.dataTransfer.dropEffect='none'}},{signal:cleanup.signal});
 document.addEventListener('drop',e=>{if(draggedFigure&&!visual.contains(e.target)){e.preventDefault();finishDrag();notice('Переміщення скасовано')}},{signal:cleanup.signal});
 function proposalAt(e){
  let figure=e.target.closest('figure');
  if(!figure&&e.target===visual){
   const candidates=[...visual.querySelectorAll('figure')].filter(photo=>photo!==draggedFigure).map(photo=>({photo,rect:photo.querySelector('img')?.getBoundingClientRect()})).filter(item=>item.rect&&e.clientY>item.rect.top&&e.clientY<item.rect.bottom);
   candidates.sort((a,b)=>Math.min(Math.abs(e.clientX-a.rect.left),Math.abs(e.clientX-a.rect.right))-Math.min(Math.abs(e.clientX-b.rect.left),Math.abs(e.clientX-b.rect.right)));
   if(candidates.length)figure=candidates[0].photo;
   else{const own=draggedFigure.querySelector('img').getBoundingClientRect();if(e.clientY>=own.top&&e.clientY<=own.bottom&&!draggedFigure.parentElement.hasAttribute('data-vh-photo-row'))return {mode:'free',target:draggedFigure,x:e.clientX}}
  }
  if(figure===draggedFigure)return null;
  if(figure){
   const rect=figure.querySelector('img').getBoundingClientRect(),row=figure.parentElement.matches('[data-vh-photo-row]')?figure.parentElement:null;
   const count=row?[...row.children].filter(child=>child.tagName==='FIGURE'&&child!==draggedFigure).length:1;
   const vertical=(e.clientY-rect.top)/Math.max(1,rect.height),horizontal=(e.clientX-rect.left)/Math.max(1,rect.width);
   if(count<3&&(vertical>.22&&vertical<.78||horizontal<.2||horizontal>.8))return {mode:'row',target:figure,before:e.clientX<rect.left+rect.width/2};
   return {mode:'block',target:topBlock(figure),before:e.clientY<rect.top+rect.height/2};
  }
  const row=e.target.closest('[data-vh-photo-row]');
  if(row){const photos=[...row.children].filter(child=>child.tagName==='FIGURE'&&child!==draggedFigure);if(photos.length&&photos.length<3){const target=photos.find(photo=>e.clientX<photo.getBoundingClientRect().right)||photos.at(-1);return {mode:'row',target,before:e.clientX<target.getBoundingClientRect().left+target.getBoundingClientRect().width/2}}}
  let target=e.target.closest('p,div,h1,h2,h3,ul,ol,blockquote');if(target===marker)return dropProposal;
  if(!target||target===visual)return {mode:'block',target:null,before:false};
  target=topBlock(target);if(target===topBlock(draggedFigure)&&target===draggedFigure)return null;
  const rect=target.getBoundingClientRect(),bounds=visual.getBoundingClientRect(),style=getComputedStyle(visual),left=bounds.left+parseFloat(style.paddingLeft),width=visual.clientWidth-parseFloat(style.paddingLeft)-parseFloat(style.paddingRight);
  if(!target.hasAttribute('data-vh-photo-row')&&target.tagName!=='FIGURE'&&e.clientY>rect.top+6&&e.clientY<rect.bottom-6){if(e.clientX<left+width*.25)return {mode:'left',target};if(e.clientX>left+width*.75)return {mode:'right',target}}
  return {mode:'block',target,before:e.clientY<rect.top+rect.height/2};
 }
 function showProposal(proposal){
  if(!proposal){marker.remove();return}
  const bounds=visual.getBoundingClientRect(),style=getComputedStyle(visual),padding=parseFloat(style.paddingLeft),width=visual.clientWidth-padding-parseFloat(style.paddingRight),target=proposal.target;
  const rect=target?.getBoundingClientRect();let x=padding,y=rect?(proposal.before?rect.top:rect.bottom)-bounds.top+visual.scrollTop:visual.scrollHeight-16,w=width,h=3;
  let label='Між абзацами';
  if(proposal.mode==='row'){x=(proposal.before?rect.left:rect.right)-bounds.left-2;y=rect.top-bounds.top+visual.scrollTop;w=4;h=Math.max(36,Math.min(rect.height,140));label='В один ряд'}
  else if(proposal.mode==='free'){w=draggedFigure.getBoundingClientRect().width;x=Math.max(padding,Math.min(proposal.x-bounds.left-dragOffset,padding+width-w));y=rect.top-bounds.top+visual.scrollTop;h=Math.min(rect.height,100);label='Положення фото'}
  else if(proposal.mode==='left'||proposal.mode==='right'){x=padding+(proposal.mode==='right'?width*.6:0);y=rect.top-bounds.top+visual.scrollTop;w=width*.4;h=Math.max(32,Math.min(rect.height,100));label=proposal.mode==='left'?'Фото ліворуч від тексту':'Фото праворуч від тексту'}
  marker.dataset.placement=proposal.mode;marker.dataset.label=label;Object.assign(marker.style,{left:x+'px',top:y+'px',width:w+'px',height:h+'px'});visual.append(marker);
 }
 visual.addEventListener('dragover',e=>{
  if(!draggedFigure)return;e.preventDefault();e.dataTransfer.dropEffect='move';
  const rect=visual.getBoundingClientRect();if(e.clientY<rect.top+32)visual.scrollTop-=12;else if(e.clientY>rect.bottom-32)visual.scrollTop+=12;
  dropProposal=proposalAt(e);showProposal(dropProposal);
 });
 visual.addEventListener('drop',e=>{
  if(!draggedFigure)return;e.preventDefault();const fig=draggedFigure,proposal=proposalAt(e)||dropProposal;
  if(proposal){
   const target=proposal.target;
   if(proposal.mode==='row'&&target!==fig){let row=target.parentElement.matches('[data-vh-photo-row]')?target.parentElement:null;const sameRow=row&&fig.parentElement===row;if(!row){row=document.createElement('div');row.dataset.vhPhotoRow='2';target.before(row);row.append(target);photoPlacement(target)}if(!sameRow)photoPlacement(fig);if(proposal.before)target.before(fig);else target.after(fig)}
   else if(proposal.mode==='free'){const bounds=visual.getBoundingClientRect(),style=getComputedStyle(visual),left=bounds.left+parseFloat(style.paddingLeft),available=visual.clientWidth-parseFloat(style.paddingLeft)-parseFloat(style.paddingRight)-fig.getBoundingClientRect().width;fig.dataset.vhAlign='free';fig.dataset.vhX=String(available>0?Math.max(0,Math.min(100,Math.round((proposal.x-left-dragOffset)/available*100))):0);window.VHSafeRich.figureLayout(fig)}
   else if(proposal.mode==='left'||proposal.mode==='right'){target.before(fig);photoPlacement(fig,proposal.mode)}
   else if(target&&target!==fig){if(proposal.before)target.before(fig);else target.after(fig);photoPlacement(fig)}
   else if(!target){visual.append(fig);photoPlacement(fig)}
   normalizeRows();
  }
  finishDrag();sync();positionControls();notice(proposal?.mode==='row'?'Фото розміщено в одному ряду':'Фото переміщено');
 });
 async function addImage(file){if(!file||!/^image\/(jpeg|png|webp)$/.test(file.type)){alert('Виберіть JPG, PNG або WebP');return}if(file.size>12000000){alert('Фото має бути до 12 МБ');return}
  if(activeFigure)caretAfter(activeFigure);remember();const insertion=selection?.cloneRange();updateHistoryMeta();
  const bitmap=await createImageBitmap(file);const scale=Math.min(1,1600/bitmap.width,1600/bitmap.height),canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));canvas.getContext('2d').drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close();const src=canvas.toDataURL('image/webp',.9);
  if(insertion&&visual.contains(insertion.commonAncestorContainer))selection=insertion;
  insertHTML('<figure data-vh-width="100" data-vh-align="center"><img src="'+src+'" alt="Фото статті"></figure><p><br></p>');decorate();const added=[...visual.querySelectorAll('img')].find(img=>img.getAttribute('src')===src)?.closest('figure');if(added){const bounds=visual.getBoundingClientRect(),picture=added.querySelector('img').getBoundingClientRect();if(picture.top<bounds.top||picture.bottom>bounds.bottom)visual.scrollTop+=picture.top-bounds.top-12}activatePhoto(added);sync();remember();}

 if(opts.images){const picker=document.createElement('input');picker.type='file';picker.accept='image/jpeg,image/png,image/webp';picker.hidden=true;host.append(picker);picker.onchange=async()=>{const f=picker.files?.[0];picker.value='';if(!f)return;try{await addImage(f)}catch(e){console.error(e);alert('Не вдалося обробити фотографію')}};btn('image','','Вставити фотографію',()=>{if(activeFigure)caretAfter(activeFigure);remember();picker.click()})}
 function mode(next){updateHistoryMeta();activatePhoto(null,false);host.querySelectorAll('[data-mode]').forEach(b=>b.classList.toggle('active',b.dataset.mode===next));if(next==='html'){code.value=cleanVisual();visual.hidden=true;code.hidden=false}else{visual.innerHTML=safeHTML(code.value);code.hidden=true;visual.hidden=false;decorate();sync()}}
 visual.addEventListener('paste',e=>{
  const html=e.clipboardData?.getData('text/html'),text=e.clipboardData?.getData('text/plain');
  if(!html&&!text)return;e.preventDefault();remember();updateHistoryMeta();activatePhoto(null,false);restore();
  const plain=document.createElement('div');plain.textContent=text||'';
  insertHTML(html?safeHTML(html):plain.innerHTML.replace(/\n/g,'<br>'));
  decorate();sync();remember();
 });
 host.querySelectorAll('[data-mode]').forEach(b=>b.onclick=()=>mode(b.dataset.mode));
 visual.addEventListener('beforeinput',e=>{if(e.target.closest('.vh-image-controls'))return;if(e.inputType==='historyUndo'||e.inputType==='historyRedo'){e.preventDefault();travel(e.inputType==='historyUndo'?-1:1);return}updateHistoryMeta()});
 visual.addEventListener('input',e=>{if(e.target.closest('.vh-image-controls'))return;activatePhoto(null,false);sync(e.inputType?.startsWith('insertText')||e.inputType?.includes('Composition')?'typing':'');remember()});
 visual.addEventListener('keyup',()=>{remember();updateHistoryMeta()});visual.addEventListener('mouseup',()=>{remember();updateHistoryMeta()});
 visual.addEventListener('pointerdown',e=>{if(!e.target.closest('img,.vh-image-controls,.vh-image-resize'))activatePhoto(null,false)});
 visual.addEventListener('click',e=>{const image=e.target.closest('img'),fig=image?.closest('figure');if(fig&&visual.contains(fig)){e.preventDefault();activatePhoto(fig);updateHistoryMeta()}});
 visual.addEventListener('scroll',positionControls,{passive:true});
 document.addEventListener('pointerdown',e=>{if(!host.contains(e.target))activatePhoto(null,false)},{signal:cleanup.signal});
 host.addEventListener('keydown',e=>{
  if((e.ctrlKey||e.metaKey)&&!e.altKey&&['z','y'].includes(e.key.toLowerCase())){e.preventDefault();travel(e.key.toLowerCase()==='y'||e.shiftKey?1:-1);return}
  if(e.key==='Escape'){activatePhoto(null,false);return}
  if(activeFigure&&['Backspace','Delete'].includes(e.key)&&e.target===visual){e.preventDefault();deletePhoto(activeFigure)}
 });
 code.addEventListener('beforeinput',updateHistoryMeta);code.addEventListener('input',e=>{const html=safeHTML(code.value);set(html);record(html,e.inputType==='insertText'?'code-typing':'')});
 const observer=new ResizeObserver(()=>{if(!host.isConnected){observer.disconnect();return}positionControls()});observer.observe(visual);
 function refresh(){const value=read();if(value===lastValue)return;lastValue=value;selection=null;activeFigure=null;visual.innerHTML=safeHTML(value);code.value=safeHTML(value);decorate();history=[];historyIndex=-1;lastGroup='';record(cleanVisual())}refresh();
 const timer=setInterval(()=>{if(!host.isConnected){clearInterval(timer);cleanup.abort();observer.disconnect();return}if(document.activeElement===visual||document.activeElement===code||host.contains(document.activeElement))return;refresh()},500);
 function replaceImageUrls(urls){
  const replace=html=>{const doc=new DOMParser().parseFromString('<div>'+safeHTML(html)+'</div>','text/html');for(const img of doc.querySelectorAll('img')){const next=urls.get(img.getAttribute('src'));if(next)img.setAttribute('src',next)}return doc.body.firstElementChild.innerHTML};
  for(const img of visual.querySelectorAll('img')){const next=urls.get(img.getAttribute('src'));if(next)img.setAttribute('src',next)}
  code.value=replace(code.value);const html=code.hidden?cleanVisual():code.value;set(html);
  for(const state of history)state.html=replace(state.html);
  if(history[historyIndex])history[historyIndex].html=html;
  updateHistoryButtons();
 }
 const api={host,refresh,sync,replaceImageUrls};source.__vhRichEditor=api;return api}
function mount(){for(const id of ['pShort','pDescription','nExcerpt']){const el=document.getElementById(id);if(el)create(el)}const article=document.getElementById('journalArticleHtml');if(article)create(article,{images:true})}
document.addEventListener('DOMContentLoaded',()=>{mount();const root=document.getElementById('journalBlockEditor');if(root)new MutationObserver(()=>{const el=document.getElementById('journalArticleHtml');if(el&&!el.dataset.vhRichReady)create(el,{images:true})}).observe(root,{childList:true})});
window.VHRichEditor={create,mount,safeHTML};})();
