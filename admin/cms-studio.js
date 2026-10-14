/* Vintage Hedonista Studio UI layer. Does not write CMS drafts or published revisions. */
(()=>{'use strict';
const $=id=>document.getElementById(id);
const pageSelect=$('studioPage'),pageNav=$('pageNav'),inspector=document.querySelector('.editor'),frame=$('siteFrame'),viewport=$('desktopViewport');
if(!pageSelect||!pageNav||!inspector||!frame||!viewport)return;
let activeTab='content',device='desktop';
const pageMap=new Map();
function syncPages(){
 const navButtons=[...pageNav.querySelectorAll('button.nav')];
 if(!navButtons.length)return;
 const selected=navButtons.findIndex(b=>b.classList.contains('active'));
 const signature=navButtons.map(b=>b.textContent.trim()).join('|');
 if(pageSelect.dataset.signature!==signature){
  pageSelect.replaceChildren();pageMap.clear();
  navButtons.forEach((b,i)=>{const opt=document.createElement('option');opt.value=String(i);opt.textContent=b.textContent.trim();pageSelect.append(opt);pageMap.set(String(i),b)});
  pageSelect.dataset.signature=signature;
  syncPageDrawer();
 }
 if(selected>=0&&pageSelect.value!==String(selected))pageSelect.value=String(selected);
 const drawerButtons=document.querySelectorAll('.studio-pages-list button');drawerButtons.forEach((b,i)=>b.classList.toggle('active',i===selected));
}
function syncPageDrawer(){
 const host=document.querySelector('.studio-pages-list');if(!host)return;
 host.replaceChildren();
 [...pageNav.querySelectorAll('button.nav')].forEach((button,i)=>{
  const entry=document.createElement('button');entry.type='button';entry.textContent=button.textContent;
  entry.classList.toggle('active',button.classList.contains('active'));
  entry.onclick=()=>{button.click();document.body.classList.remove('studio-pages-mode');document.querySelector('[data-side-tab="blocks"]')?.click()};
  host.append(entry);
 });
}
pageSelect.addEventListener('change',()=>pageMap.get(pageSelect.value)?.click());
new MutationObserver(syncPages).observe(pageNav,{childList:true,subtree:true,attributes:true,attributeFilter:['class']});
syncPages();
function polishMediaFields(editor){
 // The URL is an implementation detail, not a second photo editor.
 // Keep its value and change handler intact for existing drafts.
 for(const field of editor.querySelectorAll('#existingEditor .photo-field,#existingEditor .cms-gradient-image-field,#existingEditor .cms-mapped-field,#existingEditor .cms-capsule-field')){
  const isImage=field.classList.contains('photo-field')||field.classList.contains('cms-gradient-image-field')||
    field.classList.contains('cms-capsule-field')||!!field.querySelector('.cms-thumb-box');
  if(!isImage)continue;
  for(const input of field.querySelectorAll('input:not([type="file"])')){
   if(input.type==='hidden')continue;
   input.classList.add('studio-technical-url');
   input.setAttribute('aria-label','Технічне посилання на фото');
   const label=input.previousElementSibling;
   if(label?.tagName==='LABEL' && /URL|посилання|шлях/i.test(label.textContent||''))label.classList.add('studio-technical-url');
  }
  for(const note of field.querySelectorAll('small')){
   if(/чернетк|браузер/i.test(note.textContent||''))note.classList.add('studio-technical-note');
  }
  // One clear media action for all legacy field types. Preserve original input handlers.
  for(const file of field.querySelectorAll('input[type="file"]')){
   if(file.dataset.studioMediaAction)continue;
   file.dataset.studioMediaAction='1';
   const action=document.createElement('button');
   action.type='button';action.className='studio-replace-image';
   action.textContent='Замінити фото';
   action.addEventListener('click',()=>file.click());
   file.parentElement?.insertBefore(action,file);
   file.classList.add('studio-hidden-file-input');
  }
  for(const file of field.querySelectorAll('input[type="file"]')){
   file.classList.add('studio-image-file');
   if(!file.dataset.studioAccessible){
    file.dataset.studioAccessible='1';
    file.setAttribute('aria-label','Замінити фотографію');
   }
  }
 }
}
/* Resolve the actual selected page section, including CSS-background heroes.
   This is presentation only: the native CMS input remains the source of truth. */
function studioImageFromSection(section){
 if(!section)return '';
 const hero=section.querySelector('#heroMain,#heroSide1,#heroSide2');
 if(hero){const css=hero.ownerDocument.defaultView.getComputedStyle(hero).backgroundImage;const m=css.match(/url\(["']?(.*?)["']?\)/);if(m?.[1])return m[1]}
 const image=section.querySelector('img[src],img[data-src]');
 if(image){const src=image.currentSrc||image.src||image.getAttribute('data-src');if(src)return src}
 const nodes=[section,...section.querySelectorAll('*')].slice(0,120);
 for(const node of nodes){
  const style=node.ownerDocument.defaultView.getComputedStyle(node);
  const match=style.backgroundImage.match(/url\(["']?(.*?)["']?\)/);
  if(match?.[1])return match[1];
 }
 return '';
}
function studioPreviewPhoto(editor,section){
 if(!section)return;
 const source=studioImageFromSection(section);
 if(!source)return;
 const panel=editor.querySelector('#existingEditor .cms91-tab-panel[data-cms91-tab="content"]');
 if(!panel)return;
 const field=[...panel.querySelectorAll('.photo-field,.cms-gradient-image-field,.cms-capsule-field')].find(el=>!el.hidden);
 if(!field)return;
 const thumb=field.querySelector('.cms-thumb-box');
 if(!thumb)return;
 const hasPhoto=!!thumb.querySelector('img[src]')||/url\(/.test(thumb.style.backgroundImage);
 if(hasPhoto){
  thumb.querySelector('.studio-source-preview')?.remove();
  return;
 }
 let preview=thumb.querySelector('.studio-source-preview');
 if(!preview){preview=document.createElement('img');preview.className='studio-source-preview';preview.alt='Поточне фото блоку';thumb.prepend(preview)}
 if(preview.getAttribute('src')!==source)preview.src=source;
}
function compactContentPanel(editor){
 const panels=editor.querySelectorAll('#existingEditor .cms91-tab-panel[data-cms91-tab="content"]');
 for(const panel of panels){
  for(const el of panel.querySelectorAll(':scope > h3,:scope > p.muted,:scope > small,:scope > .cms98-panel-heading,:scope > .studio-media-heading'))el.hidden=true;
  for(const field of panel.querySelectorAll('.photo-field,.cms-gradient-image-field,.cms-mapped-field')){
   const file=field.querySelector('input[type="file"]');
   const thumb=field.querySelector('.cms-thumb-box');
   if(!file||!thumb)continue;
   field.classList.add('vh-compact-media');
   field.querySelectorAll(':scope > label,:scope > h3,:scope > small').forEach(el=>el.hidden=true);
   let actions=field.querySelector(':scope > .vh-media-actions');
   if(!actions){
    actions=document.createElement('div');actions.className='vh-media-actions';
    const upload=document.createElement('button');upload.type='button';upload.className='vh-media-action';upload.textContent='Завантажити фото';upload.onclick=()=>file.click();
    const remove=document.createElement('button');remove.type='button';remove.className='vh-media-action';remove.textContent='Видалити фото';
    remove.onclick=()=>{const original=thumb.querySelector('.cms-photo-x');if(original)original.click()};
    actions.append(upload,remove);field.append(actions);
   }
   thumb.querySelectorAll('.cms-photo-x').forEach(el=>el.classList.add('vh-hidden-original-remove'));
   field.querySelectorAll('.studio-replace-image').forEach(el=>el.hidden=true);
  }
  const media=[...panel.children].filter(el=>el.classList.contains('vh-compact-media'));
  const other=[...panel.children].filter(el=>!media.includes(el));
  const first=other[0];
  if(first)for(const el of media)if(el.compareDocumentPosition(first)&Node.DOCUMENT_POSITION_PRECEDING)panel.insertBefore(el,first);
  for(const field of panel.querySelectorAll('.field')){
   if(field.classList.contains('vh-compact-media'))continue;
   const label=field.querySelector(':scope > label');
   if(label){
    const t=label.textContent.trim();
    if(/^(ПОЛЯ СТОРІНКИ|НАЯВНИЙ БЛОК)/.test(t))label.hidden=true;
   }
  }
 }
}
function syncTabs(){
 const editor=inspector.querySelector('.cms-editor-scroll');if(!editor)return;
 // The native page's Hero is not the obsolete gradient-banner template.
 // Keep legacy controls/data available under Design, but do not mix its
 // gradient upload into the active Content panel for a different layout.
 const selectedRow=document.querySelector('#existingBlocks .existing-select.active');
 const selectedIndex=[...document.querySelectorAll('#existingBlocks .existing-select')].indexOf(selectedRow);
 let selectedSection=null;
 try{const id=selectedRow?.closest('.existing-row')?.dataset.cmsId||'';const n=/^existing-(\d+)$/.test(id)?Number(id.slice(9)):-1;selectedSection=n>=0?previewSections(frame.contentDocument)[n]:null}catch{}
 const nativeHero=selectedIndex===0 && selectedSection &&
   (selectedSection.matches('.hero')||!selectedSection.classList.contains('vh-existing-gradient-hero'));
 inspector.classList.toggle('studio-native-hero',!!nativeHero);
 polishMediaFields(editor);
 // Native mapped image controls own their thumbnails; do not inject a second stale preview.
 // Fixed-layout page blocks already have semantic heading elements.
 // The article editor remains untouched and retains its heading tools.
 const structuredPage=!['article','product'].includes(new URLSearchParams(location.search).get('page')||'home');
 if(structuredPage){
  editor.querySelectorAll('#existingEditor .vh-rte').forEach(rte=>{
   rte.classList.add('studio-simple-copy');
   rte.querySelector('.vh-rte-content')?.setAttribute('aria-label','Опис блоку');
   rte.querySelectorAll('.vh-rte-tool').forEach(btn=>{
    if(/Заголовок H[1-6]|Підзаголовок H[1-6]/i.test(btn.getAttribute('aria-label')||btn.title||''))btn.hidden=true;
   });
  });
 }

 // The CMS builds its own cms91-tabs. Delegate to its original tab handler so
 // hidden panels remain functional while presenting only one visible tab strip.
 editor.querySelectorAll('#existingEditor .cms91-tab-panel[data-cms91-tab="content"]').forEach(panel=>{
  const photo=panel.querySelector('.photo-field,.cms-gradient-image-field,.cms-capsule-field');
  if(photo&&!panel.querySelector('.studio-media-heading')){
   const heading=document.createElement('div');heading.className='studio-media-heading';heading.textContent='ФОНОВЕ ЗОБРАЖЕННЯ';
   const panelTitle=panel.querySelector('.cms98-panel-heading');
   panelTitle?.after(heading);heading.after(photo);
  }
  // Keep the original page's actual photo controls visible in every inspector.
  panel.querySelectorAll('h3.photos-title').forEach(h=>h.hidden=true);
 });
 editor.querySelectorAll('#existingEditor>h3,#existingEditor>p.muted').forEach(el=>{
  if(/НАЯВНИЙ БЛОК|Тестові зміни/.test(el.textContent||''))el.hidden=true;
 });
 // Keep the reference's content order: media, heading, description and buttons.
 editor.querySelectorAll('#existingEditor .cms91-tab-panel[data-cms91-tab="content"]').forEach(panel=>{
  const direct=[...panel.children];
  const media=direct.filter(el=>el.matches('.photo-field,.cms-gradient-image-field,.cms-capsule-field'));
  const headings=direct.filter(el=>el.matches('.field')&&/ЗАГОЛОВОК/.test(el.querySelector('label')?.textContent||''));
  const descriptions=direct.filter(el=>el.matches('.field')&&/ОПИС/.test(el.querySelector('label')?.textContent||''));
  const first=panel.querySelector('.cms98-panel-heading');
  if(first){
   let cursor=first;
   for(const item of [...media,...headings,...descriptions]){
    if(item===cursor)continue;
    if(cursor.nextElementSibling!==item)cursor.after(item);
    cursor=item;
   }
  }
  panel.querySelectorAll('p.muted').forEach(el=>{if(/Тестові зміни|Оригінал у Supabase/.test(el.textContent||''))el.hidden=true});
 });
 // Display every photo field directly, including multi-image HERO sections.
 editor.querySelectorAll('.cms91-tabs').forEach(bar=>{
  if(bar.dataset.studioUnified!==activeTab){
   bar.dataset.studioUnified=activeTab;
   const internal=[...bar.querySelectorAll('button[data-tab]')].find(b=>b.dataset.tab===activeTab);
   if(internal)internal.click();
  }
  bar.hidden=true;
  bar.style.setProperty('display','none','important');
 });
 compactContentPanel(editor);
 inspector.querySelector('.studio-tab-notice')?.remove();
}

document.querySelectorAll('[data-inspector-tab]').forEach(b=>b.addEventListener('click',()=>{
 activeTab=b.dataset.inspectorTab;
 document.querySelectorAll('[data-inspector-tab]').forEach(x=>x.classList.toggle('active',x===b));
 syncTabs();
}));
const editorScroll=inspector.querySelector('.cms-editor-scroll');
let tabSyncPending=false;
if(editorScroll)new MutationObserver(()=>{
 if(tabSyncPending)return;
 tabSyncPending=true;
 requestAnimationFrame(()=>{tabSyncPending=false;syncTabs()});
}).observe(editorScroll.querySelector('#existingEditor')||editorScroll,{childList:true,subtree:false});
function applyDevice(){
 const widths={desktop:1440,tablet:820,mobile:390},w=widths[device];
 const deviceNames={desktop:'Комп’ютер',tablet:'Планшет',mobile:'Телефон'};
 const legacy=[...document.querySelectorAll('.cms96-device-bar button')].find(b=>b.textContent===deviceNames[device]);if(legacy)legacy.click();
 viewport.style.setProperty('width',w+'px','important');frame.style.setProperty('width',w+'px','important');frame.style.setProperty('min-width',w+'px','important');frame.style.setProperty('max-width','none','important');
 document.querySelectorAll('[data-studio-device]').forEach(b=>b.classList.toggle('active',b.dataset.studioDevice===device));
 const label=$('studioZoomLabel');if(label)label.textContent=({desktop:'Комп’ютер',tablet:'Планшет',mobile:'Телефон'})[device]+' · живий перегляд';
}
document.querySelectorAll('[data-studio-device]').forEach(b=>b.addEventListener('click',()=>{device=b.dataset.studioDevice;applyDevice()}));
$('studioSeoToggle')?.addEventListener('click',()=>{
 const panel=$('pageSeoPanel');if(!panel)return;
 panel.classList.toggle('studio-seo-open');
 $('studioSeoToggle').classList.toggle('active',panel.classList.contains('studio-seo-open'));
});
applyDevice();

/* Studio 155: interactive block selection and visual structure. */
const list=$('existingBlocks'),frameHost=document.querySelector('.live-preview-frame');

const topbar=document.querySelector('main>header'),topControls=topbar?.querySelector('.studio-top-controls'),topActions=topbar?.querySelector('.actions');
const exit=topControls?.querySelector('.studio-exit');
if(topbar&&topControls&&topActions){
 const devices=topControls.querySelector('.studio-devices');
 const zoom=topControls.querySelector('.studio-zoom');
 const undo=topControls.querySelector('#studioUndo');
 const redo=topControls.querySelector('#studioRedo');
 const seo=topControls.querySelector('#studioSeoToggle');
 const page=topControls.querySelector('.studio-page-label');
 topControls.replaceChildren();
 if(page)topControls.append(page);
 if(devices)topControls.append(devices);
 if(zoom)topControls.append(zoom);
 if(undo)topControls.append(undo);
 if(redo)topControls.append(redo);
 if(seo)topControls.append(seo);
 if(exit)topbar.append(exit);
}
const zoomButton=$('studioZoom'),zoomMenu=$('studioZoomMenu');
if(zoomButton&&zoomMenu){
 zoomButton.addEventListener('click',()=>{zoomMenu.hidden=!zoomMenu.hidden});
 zoomMenu.querySelectorAll('[data-zoom]').forEach(b=>b.addEventListener('click',()=>{
  const value=b.dataset.zoom;zoomMenu.hidden=true;
  const desired=value==='fit'?Math.min(1,frameHost.clientWidth/({desktop:1440,tablet:820,mobile:390}[device]||1440)):Number(value)/100;
  const scale=Math.max(.25,Math.min(1,desired));
  viewport.style.setProperty('transform','scale('+scale+')','important');
  viewport.style.setProperty('transform-origin','top left','important');
  zoomButton.textContent=Math.round(scale*100)+'%⌄';
 }));
}
const studioStructure=document.querySelector('main>.layout>div:first-child');
const studioTabs=document.querySelector('.studio-side-tabs');
if(studioStructure&&studioTabs)studioStructure.prepend(studioTabs);
const inspectorHeading=inspector.querySelector('.studio-inspector-head h2');
const inspectorBar=inspector.querySelector('.studio-inspector-head');
const selectedLabel=document.createElement('div');selectedLabel.className='studio-selected-title';selectedLabel.textContent='Оберіть блок';
if(inspectorBar)inspectorBar.prepend(selectedLabel);
const blockCounter=document.createElement('span');blockCounter.className='studio-block-counter';
if(inspectorBar)inspectorBar.append(blockCounter);
function updateBlockCounter(){
 const rows=[...list.querySelectorAll('.existing-row')];
 const index=rows.findIndex(row=>row.querySelector('.existing-select.active'));
 blockCounter.textContent=index>=0?'Блок '+(index+1)+' з '+rows.length:'';
}

function refreshSelectedTitle(){
 const current=list?.querySelector('.existing-select.active');
 if(!current)return;
 const raw=current.querySelector('.studio-row-name')?.textContent.trim()||current.dataset.studioOriginalLabel||current.textContent.trim();
 selectedLabel.textContent=raw.length>42?raw.slice(0,42)+'…':raw;
 updateBlockCounter();
}

const drawer=document.createElement('div');drawer.className='studio-pages-list';list?.parentElement?.insertBefore(drawer,list);syncPageDrawer();
let activeInput=null;
document.addEventListener('focusin',e=>{if(e.target.matches('input,textarea,[contenteditable="true"]'))activeInput=e.target});
for(const [id,command] of [['studioUndo','undo'],['studioRedo','redo']]){
 const button=$(id);if(!button)continue;
 button.addEventListener('click',()=>{if(!activeInput||!activeInput.isConnected)return;activeInput.focus();document.execCommand(command)});
}
const tabs=document.querySelectorAll('[data-side-tab]');
tabs.forEach(button=>button.addEventListener('click',()=>{
 tabs.forEach(t=>t.classList.toggle('active',t===button));
 document.body.classList.toggle('studio-pages-mode',button.dataset.sideTab==='pages');
 if(button.dataset.sideTab==='styles')document.querySelector('[data-inspector-tab="design"]')?.click();
 if(button.dataset.sideTab==='blocks')list?.scrollIntoView({block:'nearest'});
}));
function previewSections(doc){
 const page=pageSelect.selectedOptions[0]?.textContent?.toLowerCase()||'';
 const main=doc.querySelector('main')||doc.body;
 let sections=page.includes('головн')?[...doc.body.children].filter(e=>e.tagName==='SECTION'):page.includes('про нас')?[...main.children].filter(e=>e.tagName==='SECTION'):[...main.children].filter(e=>!['SCRIPT','STYLE','HEADER','FOOTER'].includes(e.tagName)&&e.getBoundingClientRect().height>50);
 if(sections.length<2){const nested=[...main.querySelectorAll('section')].filter(e=>e.getBoundingClientRect().height>50);sections=nested.filter(el=>!nested.some(p=>p!==el&&p.contains(el)))}
 return sections.slice(0,35);
}
let overlay=null;
function selectVisualBlock(index){
 const rows=[...list.querySelectorAll('.existing-row')],row=rows[index];
 if(!row)return;
 row.querySelector('.existing-select')?.click();
 selectHighlight(index);
}

let autoSelectedPage='';
function decorateRows(){
 if(!list)return;
 const rows=[...list.querySelectorAll('.existing-row')];let doc;try{doc=frame.contentDocument}catch{return}
 if(!doc?.body)return;
 const sections=previewSections(doc);
 const pageKey=pageSelect.value;
 if(rows.length && !rows.some(row=>row.querySelector('.existing-select.active')) && autoSelectedPage!==pageKey){
  autoSelectedPage=pageKey;
  rows[0].querySelector('.existing-select')?.click();
  return;
 }
 rows.forEach((row,i)=>{
  const select=row.querySelector('.existing-select');
  const sectionId=row.dataset.cmsId||'';
  const sectionIndex=/^existing-(\d+)$/.test(sectionId)?Number(sectionId.slice(9)):-1;
  const currentSection=sectionIndex>=0?sections[sectionIndex]:null;
  if(select){
   const heading=currentSection?.querySelector('h1,h2,h3');
   const actual=(heading?.textContent||currentSection?.getAttribute('aria-label')||'').replace(/\s+/g,' ').trim();
   const fallback=select.dataset.studioOriginalLabel||select.textContent.trim().replace(/^\d+\.\s*/,'');
   if(!select.dataset.studioOriginalLabel)select.dataset.studioOriginalLabel=fallback;
   // The original CMS button is the sole source of block identity.
   // Build exactly ONE thumbnail, ONE index, and ONE label per row.
   const name=fallback.replace(/^\s*\d+\s*[.·-]?\s*/,'').trim()||actual;
   const oldThumb=select.querySelector('.studio-thumb');
   const thumb=oldThumb||document.createElement('span');
   thumb.className='studio-thumb';thumb.setAttribute('aria-hidden','true');
   let number=select.querySelector('.studio-row-number');
   if(!number){number=document.createElement('span');number.className='studio-row-number'}
   number.textContent=String(i+1).padStart(2,'0');
   let title=select.querySelector('.studio-row-name');
   if(!title){title=document.createElement('span');title.className='studio-row-name'}
   title.textContent=name;
   if(select.childNodes.length!==3||select.children[0]!==thumb||select.children[1]!==number||select.children[2]!==title){
    select.replaceChildren(thumb,number,title);
   }
   select.title=name;
   select.classList.add('studio-reference-row');
  }
  if(!row.querySelector('.studio-thumb')){
   const thumb=document.createElement('span');thumb.className='studio-thumb';thumb.setAttribute('aria-hidden','true');row.querySelector('.existing-select')?.prepend(thumb);
  }
  const thumb=row.querySelector('.studio-thumb'),section=currentSection;if(!thumb||!section)return;
  const hero=section.querySelector('#heroMain');const image=hero?null:section.querySelector('img[src],img[data-src]');const bgElement=(hero&&getComputedStyle(hero).backgroundImage.includes('url(')?hero:null)||[section,...section.querySelectorAll('*')].slice(0,90).find(el=>getComputedStyle(el).backgroundImage.includes('url('));
  const url=image?.currentSrc||image?.src||((bgElement&&getComputedStyle(bgElement).backgroundImage.match(/url\(["']?(.*?)["']?\)/))||[])[1];
  if(url)thumb.style.backgroundImage='url('+JSON.stringify(url)+')';
  else thumb.style.backgroundImage='linear-gradient(140deg,#5e4a3a,#241a15)';
  if(!row.dataset.studioClick){row.dataset.studioClick='1';row.querySelector('.existing-select')?.addEventListener('click',()=>requestAnimationFrame(()=>{selectHighlight(i);refreshSelectedTitle()}))}
 });
}
function selectHighlight(i){
 let doc;try{doc=frame.contentDocument}catch{return}
 if(!doc?.body)return;
 const section=previewSections(doc)[i];if(!section)return;
 doc.querySelectorAll('[data-vh-studio-selected]').forEach(el=>{
  el.style.removeProperty('outline');el.style.removeProperty('outline-offset');el.removeAttribute('data-vh-studio-selected')
 });
 doc.querySelectorAll('.vh-studio-selection-chip').forEach(el=>el.remove());
 section.dataset.vhStudioSelected='true';
 section.style.setProperty('outline','3px solid #478fff','important');
 section.style.setProperty('outline-offset','-3px','important');
 const chip=doc.createElement('div');chip.className='vh-studio-selection-chip';
 const name=list?.querySelectorAll('.existing-row')[i]?.querySelector('.existing-select')?.textContent?.replace(/^\\s*\\d+\\.\\s*/,'').trim()||'Блок';
 chip.textContent=name.length>34?name.slice(0,34)+'…':name;
 chip.style.cssText='position:absolute;z-index:2147483601;background:#2878e6;color:#fff;padding:5px 10px;font:12px Arial,sans-serif;pointer-events:none;border-radius:2px;';
 const position=()=>{if(!chip.isConnected||!section.isConnected)return;const rect=section.getBoundingClientRect();chip.style.top=Math.max(0,rect.top+doc.defaultView.scrollY-24)+'px';chip.style.left=Math.max(0,rect.left+doc.defaultView.scrollX)+'px'};
 doc.body.append(chip);position();
 if(!doc.__vhStudioChipScroll){doc.__vhStudioChipScroll=true;doc.defaultView.addEventListener('scroll',()=>{const selected=doc.querySelector('[data-vh-studio-selected]');const badge=doc.querySelector('.vh-studio-selection-chip');if(selected&&badge){const rect=selected.getBoundingClientRect();badge.style.top=Math.max(0,rect.top+doc.defaultView.scrollY-24)+'px';badge.style.left=Math.max(0,rect.left+doc.defaultView.scrollX)+'px'}},{passive:true})}
}

function attachPreview(){
 let doc;try{doc=frame.contentDocument}catch{return}if(!doc||doc.__vhStudioSelect)return;doc.__vhStudioSelect=true;
 doc.addEventListener('click',e=>{
  if(e.target.closest('a,button,input,textarea,select,[contenteditable],.vh-cms-injected-unit'))return;
  const sections=previewSections(doc),idx=sections.findIndex(el=>el===e.target||el.contains(e.target));
  if(idx<0)return;
  e.preventDefault();e.stopPropagation();selectVisualBlock(idx);
 },true);
 decorateRows();
}
frame.addEventListener('load',()=>{overlay=null;setTimeout(attachPreview,350);setTimeout(decorateRows,1500)});
let pending=false;
if(list)new MutationObserver(()=>{if(pending)return;pending=true;requestAnimationFrame(()=>{pending=false;decorateRows()})}).observe(list,{childList:true});
setTimeout(attachPreview,900);setTimeout(refreshSelectedTitle,1200);

})();