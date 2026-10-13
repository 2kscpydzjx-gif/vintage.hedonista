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
 }
 if(selected>=0&&pageSelect.value!==String(selected))pageSelect.value=String(selected);
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
})();