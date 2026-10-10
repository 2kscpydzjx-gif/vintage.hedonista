/* Vintage Hedonista shared rich text editor — STEP 75 */
(function(){'use strict';
const ALLOWED=new Set(['P','DIV','BR','STRONG','B','EM','I','UL','OL','LI','H1','H2','H3','A','IMG','FIGURE','FIGCAPTION','BLOCKQUOTE']);
const svg={bold:'<path d="M6 4h6a4 4 0 0 1 0 8H6zm0 8h7a4 4 0 0 1 0 8H6z"/>',italic:'<path d="M10 4h9M5 20h9M14 4 9 20"/>',link:'<path d="M10 13a5 5 0 0 0 7 .4l3-3a5 5 0 0 0-7-7l-2 2M14 11a5 5 0 0 0-7-.4l-3 3a5 5 0 0 0 7 7l2-2"/>',list:'<path d="M9 6h12M9 12h12M9 18h12M3 6h.01M3 12h.01M3 18h.01"/>',image:'<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/>',paragraph:'<path d="M10 20V4m0 0h6v16M10 4H8a4 4 0 0 0 0 8h2"/>',h2:'<path d="M3 5v14M13 5v14M3 12h10M17 12a3 3 0 0 1 6 0c0 3-6 3-6 7h6"/>',h3:'<path d="M3 5v14M13 5v14M3 12h10M18 12a3 3 0 1 1 0 6M18 18a3 3 0 1 0 0-6"/>',left:'<path d="M4 6h16M4 10h10M4 14h16M4 18h10"/>',right:'<path d="M4 6h16M10 10h10M4 14h16M10 18h10"/>',center:'<path d="M4 6h16M7 10h10M4 14h16M7 18h10"/>',trash:'<path d="M4 7h16M10 3h4M6 7l1 14h10l1-14M10 11v6M14 11v6"/>'};
const ico=k=>`<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${svg[k]}</svg>`;
const urlOK=v=>/^(https?:\/\/|mailto:|tel:|\/|\.\/|\.\.\/|#)/i.test(v);
function safeHTML(html){const doc=new DOMParser().parseFromString('<div>'+String(html||'')+'</div>','text/html'),root=doc.body.firstElementChild;
 function walk(el){for(const n of [...el.childNodes]){if(n.nodeType===8){n.remove();continue}if(n.nodeType!==1)continue;
  if(['SCRIPT','STYLE','IFRAME','OBJECT','SVG','FORM'].includes(n.tagName)){n.remove();continue}
  const href=n.getAttribute('href'),src=n.getAttribute('src'),alt=n.getAttribute('alt'),width=n.getAttribute('data-vh-width'),align=n.getAttribute('data-vh-align');
  walk(n);if(!ALLOWED.has(n.tagName)){n.replaceWith(...n.childNodes);continue}for(const a of [...n.attributes])n.removeAttribute(a.name);
  if(n.tagName==='A'&&href&&urlOK(href)){n.setAttribute('href',href);n.setAttribute('rel','noopener noreferrer')}
  if(n.tagName==='IMG'){if(src&&(/^(https?:\/\/|\/|\.\/|\.\.\/)/i.test(src)||/^data:image\/(png|jpeg|webp);base64,/i.test(src))){n.setAttribute('src',src);n.setAttribute('alt',alt||'')}else n.remove()}
  if(n.tagName==='FIGURE'){if(width&&/^\d{2,3}$/.test(width))n.setAttribute('data-vh-width',String(Math.min(100,Math.max(20,+width))));if(['left','right','center'].includes(align))n.setAttribute('data-vh-align',align)}
 }}walk(root);return root.innerHTML}
function create(source,opts={}){if(!source||source.dataset.vhRichReady)return null;source.dataset.vhRichReady='1';
 const host=document.createElement('div');host.className='vh-rte';host.innerHTML='<div class="vh-rte-toolbar"><span class="vh-rte-label">РЕДАКТОР ТЕКСТУ</span><div class="vh-rte-buttons"></div><div class="vh-rte-tabs"><button type="button" data-mode="visual" class="active">Візуально</button><button type="button" data-mode="html">HTML</button></div></div><div class="vh-rte-canvas" contenteditable="true" role="textbox" aria-multiline="true"></div><textarea class="vh-rte-code" spellcheck="false" hidden></textarea>';
 source.insertAdjacentElement('afterend',host);source.classList.add('vh-rte-source');const visual=host.querySelector('.vh-rte-canvas'),code=host.querySelector('.vh-rte-code'),buttons=host.querySelector('.vh-rte-buttons');let lastValue=null,selection=null,activeFigure=null;
 const read=()=>source.value||'';const set=v=>{source.value=v;lastValue=v;source.dispatchEvent(new Event('input',{bubbles:true}))};
 const cleanVisual=()=>{const clone=visual.cloneNode(true);clone.querySelectorAll('.vh-image-controls').forEach(n=>n.remove());clone.querySelectorAll('[contenteditable]').forEach(n=>n.removeAttribute('contenteditable'));return safeHTML(clone.innerHTML)};
 const sync=()=>{const v=cleanVisual();set(v);code.value=v};
 const remember=()=>{const sel=window.getSelection();if(sel&&sel.rangeCount&&visual.contains(sel.anchorNode))selection=sel.getRangeAt(0).cloneRange()};
 const restore=()=>{visual.focus();if(selection){const sel=window.getSelection();sel.removeAllRanges();try{sel.addRange(selection)}catch{}}};
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
 function decorate(){if(!opts.images)return;visual.querySelectorAll('figure').forEach(fig=>{if(fig.querySelector('.vh-image-controls'))return;fig.classList.add('vh-inline-figure');fig.setAttribute('contenteditable','false');
  const panel=document.createElement('div');panel.className='vh-image-controls';panel.setAttribute('contenteditable','false');
  const make=(key,title,fn)=>{const b=document.createElement('button');b.type='button';b.title=title;b.setAttribute('aria-label',title);b.innerHTML=ico(key);b.onmousedown=e=>e.preventDefault();b.onclick=e=>{e.preventDefault();fn()};panel.append(b)};
  const size=document.createElement('select');size.title='Розмір фото';size.setAttribute('aria-label','Розмір фото');[100,80,60,40,25].forEach(v=>{const o=new Option(v+'%',v);size.add(o)});size.value=fig.dataset.vhWidth||'100';size.onchange=()=>{fig.dataset.vhWidth=size.value;sync()};panel.append(size);
  make('left','Фото ліворуч, текст обтікає справа',()=>{fig.dataset.vhAlign='left';sync()});make('center','Фото по центру, без обтікання',()=>{fig.dataset.vhAlign='center';sync()});make('right','Фото праворуч, текст обтікає зліва',()=>{fig.dataset.vhAlign='right';sync()});make('','ALT','ALT опис фото',()=>{const img=fig.querySelector('img');if(!img)return;const alt=prompt('ALT: опишіть зображення для пошуку та доступності',img.alt||'');if(alt!==null){img.alt=alt.trim();sync()}});make('trash','Видалити фото',()=>{fig.remove();sync()});fig.append(panel)
 })}
 async function addImage(file){if(!file||!/^image\/(jpeg|png|webp)$/.test(file.type)){alert('Виберіть JPG, PNG або WebP');return}if(file.size>12000000){alert('Фото має бути до 12 МБ');return}
  const bitmap=await createImageBitmap(file);const scale=Math.min(1,1200/bitmap.width,1200/bitmap.height),canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));canvas.getContext('2d').drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close();const src=canvas.toDataURL('image/jpeg',.78);
  restore();const fig=document.createElement('figure');fig.dataset.vhWidth='100';fig.dataset.vhAlign='center';const img=document.createElement('img');img.src=src;img.alt='Фото статті';fig.append(img);const sel=window.getSelection();if(sel?.rangeCount){const range=sel.getRangeAt(0);range.deleteContents();range.insertNode(fig);const p=document.createElement('p');p.append(document.createElement('br'));fig.after(p);range.setStart(p,0);range.collapse(true);sel.removeAllRanges();sel.addRange(range)}else visual.append(fig);decorate();sync();remember();}
 if(opts.images){const picker=document.createElement('input');picker.type='file';picker.accept='image/jpeg,image/png,image/webp';picker.hidden=true;host.append(picker);picker.onchange=async()=>{const f=picker.files?.[0];picker.value='';if(!f)return;try{await addImage(f)}catch(e){console.error(e);alert('Не вдалося обробити фотографію')}};btn('image','','Вставити фотографію',()=>{remember();picker.click()})}
 function mode(next){host.querySelectorAll('[data-mode]').forEach(b=>b.classList.toggle('active',b.dataset.mode===next));if(next==='html'){code.value=cleanVisual();visual.hidden=true;code.hidden=false}else{visual.innerHTML=safeHTML(code.value);code.hidden=true;visual.hidden=false;decorate();sync()}}
 host.querySelectorAll('[data-mode]').forEach(b=>b.onclick=()=>mode(b.dataset.mode));visual.addEventListener('input',()=>{sync();remember()});visual.addEventListener('keyup',remember);visual.addEventListener('mouseup',remember);code.addEventListener('input',()=>set(safeHTML(code.value)));
 function refresh(){const value=read();if(value===lastValue)return;lastValue=value;visual.innerHTML=safeHTML(value);code.value=safeHTML(value);decorate()}refresh();
 const timer=setInterval(()=>{if(!host.isConnected){clearInterval(timer);return}if(document.activeElement===visual||document.activeElement===code||host.contains(document.activeElement))return;refresh()},500);
 return {host,refresh,sync}}
function mount(){for(const id of ['pShort','pDescription','nExcerpt']){const el=document.getElementById(id);if(el)create(el)}const article=document.getElementById('journalArticleHtml');if(article)create(article,{images:true})}
document.addEventListener('DOMContentLoaded',()=>{mount();const root=document.getElementById('journalBlockEditor');if(root)new MutationObserver(()=>{const el=document.getElementById('journalArticleHtml');if(el&&!el.dataset.vhRichReady)create(el,{images:true})}).observe(root,{childList:true})});
window.VHRichEditor={create,mount,safeHTML};})();
