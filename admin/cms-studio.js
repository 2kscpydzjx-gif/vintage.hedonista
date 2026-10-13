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
function syncTabs(){
 const editor=inspector.querySelector('.cms-editor-scroll');if(!editor)return;
 // The CMS builds its own cms91-tabs. Delegate to its original tab handler so
 // hidden panels remain functional while presenting only one visible tab strip.
 editor.querySelectorAll('#existingEditor .cms91-tab-panel[data-cms91-tab="content"]').forEach(panel=>{
  const photo=panel.querySelector('.photo-field,.cms-gradient-image-field,.cms-capsule-field');
  if(photo&&!panel.querySelector('.studio-media-heading')){
   const heading=document.createElement('div');heading.className='studio-media-heading';heading.textContent='ФОНОВЕ ЗОБРАЖЕННЯ';
   const panelTitle=panel.querySelector('.cms98-panel-heading');
   panelTitle?.after(heading);heading.after(photo);
  }
  panel.querySelectorAll('h3.photos-title').forEach(h=>h.hidden=true);
 });
 editor.querySelectorAll('#existingEditor>h3,#existingEditor>p.muted').forEach(el=>{
  if(/НАЯВНИЙ БЛОК|Тестові зміни/.test(el.textContent||''))el.hidden=true;
 });
 editor.querySelectorAll('.cms91-tabs').forEach(bar=>{
  if(bar.dataset.studioUnified!==activeTab){
   bar.dataset.studioUnified=activeTab;
   const internal=[...bar.querySelectorAll('button[data-tab]')].find(b=>b.dataset.tab===activeTab);
   if(internal)internal.click();
  }
  bar.hidden=true;
  bar.style.setProperty('display','none','important');
 });
 inspector.querySelector('.studio-tab-notice')?.remove();
}

document.querySelectorAll('[data-inspector-tab]').forEach(b=>b.addEventListener('click',()=>{
 activeTab=b.dataset.inspectorTab;
 document.querySelectorAll('[data-inspector-tab]').forEach(x=>x.classList.toggle('active',x===b));
 syncTabs();
}));
const editorScroll=inspector.querySelector('.cms-editor-scroll');
if(editorScroll)new MutationObserver(()=>{syncTabs()}).observe(editorScroll,{childList:true,subtree:true});
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
 const raw=current.textContent.trim().replace(/^\\d+\\.\\s*/,'');
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

function decorateRows(){
 if(!list)return;
 const rows=[...list.querySelectorAll('.existing-row')];let doc;try{doc=frame.contentDocument}catch{return}
 if(!doc?.body)return;
 const sections=previewSections(doc);
 rows.forEach((row,i)=>{
  if(!row.querySelector('.studio-thumb')){
   const thumb=document.createElement('span');thumb.className='studio-thumb';thumb.setAttribute('aria-hidden','true');row.querySelector('.existing-select')?.prepend(thumb);
  }
  const thumb=row.querySelector('.studio-thumb'),section=sections[i];if(!thumb||!section)return;
  const image=section.querySelector('img[src],img[data-src]');const bgElement=[section,...section.querySelectorAll('*')].slice(0,45).find(el=>getComputedStyle(el).backgroundImage.includes('url('));
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