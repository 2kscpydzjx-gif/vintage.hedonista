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
 const panels=[...editor.querySelectorAll('.cms-design,[class*=animation],.cms-animation')].filter(el=>el.closest('.cms-editor-scroll')===editor);
 panels.forEach(el=>{
  if(el.classList.contains('cms-design'))el.dataset.studioGroup='design';
  else if(!el.dataset.studioGroup && /анімац|animation/i.test(el.className+' '+(el.querySelector('summary,h3,h4')?.textContent||'')))el.dataset.studioGroup='animation';
 });
 const grouped=[...editor.querySelectorAll('[data-studio-group]')];
 grouped.forEach(el=>{el.hidden=activeTab!=='content'&&el.dataset.studioGroup!==activeTab});
 // Content shows all fields by default to preserve access to legacy controls.
 if(activeTab==='content')grouped.forEach(el=>el.hidden=false);
 const hasGroup=grouped.some(el=>el.dataset.studioGroup===activeTab);
 const old=inspector.querySelector('.studio-tab-notice');if(old)old.remove();
 if(activeTab!=='content'&&!hasGroup){const note=document.createElement('p');note.className='studio-tab-notice';note.textContent='Налаштування цього типу доступні в основній вкладці «Контент».';inspector.querySelector('.studio-inspector-head')?.after(note)}
}
document.querySelectorAll('[data-inspector-tab]').forEach(b=>b.addEventListener('click',()=>{
 activeTab=b.dataset.inspectorTab;
 document.querySelectorAll('[data-inspector-tab]').forEach(x=>x.classList.toggle('active',x===b));
 syncTabs();
}));
const editorScroll=inspector.querySelector('.cms-editor-scroll');
if(editorScroll)new MutationObserver(()=>{if(activeTab!=='content')syncTabs()}).observe(editorScroll,{childList:true,subtree:true});
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
  if(!row.dataset.studioClick){row.dataset.studioClick='1';row.querySelector('.existing-select')?.addEventListener('click',()=>requestAnimationFrame(()=>selectHighlight(i)))}
 });
}
function selectHighlight(i){
 let doc;try{doc=frame.contentDocument}catch{return}
 const section=previewSections(doc)[i];if(!section)return;
 doc.querySelectorAll('[data-vh-studio-selected]').forEach(el=>{el.style.removeProperty('outline');el.style.removeProperty('outline-offset');el.removeAttribute('data-vh-studio-selected')});
 section.dataset.vhStudioSelected='true';
 section.style.setProperty('outline','3px solid #478fff','important');
 section.style.setProperty('outline-offset','-3px','important');
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
setTimeout(attachPreview,900);

})();