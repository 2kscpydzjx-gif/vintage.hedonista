/* V2: presentation only. CMS save/publish remains in cms-builder.js. */
(()=>{'use strict';document.documentElement.classList.add('cms-v2');
const sidebar=document.querySelector('.studio-side-tabs'),left=document.querySelector('main>.layout>div:first-child');
if(sidebar&&left&&sidebar.parentElement!==left)left.prepend(sidebar);
const list=document.getElementById('existingBlocks');
function normalize(){if(!list)return;list.querySelectorAll('.existing-row').forEach(row=>{
 const b=row.querySelector('.existing-select');if(!b)return;
 const n=b.querySelector('.studio-row-number'),thumb=b.querySelector('.studio-row-thumb'),name=b.querySelector('.studio-row-name');
 if(n&&thumb&&name){b.prepend(n);n.after(thumb);thumb.after(name)}
 const menu=row.querySelector('.studio-row-menu');if(menu)menu.style.zIndex='50';
 });}
if(list){new MutationObserver(normalize).observe(list,{childList:true,subtree:false});normalize()}
})();
