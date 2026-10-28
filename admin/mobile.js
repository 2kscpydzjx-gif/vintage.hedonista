/* Presentation and accessibility only; existing save, upload and auth handlers own data. */
(()=>{'use strict';
 const compact=matchMedia('(max-width:1199px)'),$=id=>document.getElementById(id);
 const sidebar=$('sidebar'),menu=$('menuBtn'),app=$('app'),main=document.querySelector('.main');if(!sidebar||!menu)return;
 const close=document.createElement('button');close.type='button';close.className='admin-mobile-close';close.textContent='×';close.setAttribute('aria-label','Закрити меню');sidebar.prepend(close);
 const backdrop=document.createElement('button');backdrop.type='button';backdrop.className='admin-mobile-backdrop';backdrop.hidden=true;backdrop.tabIndex=-1;backdrop.setAttribute('aria-label','Закрити меню');document.body.append(backdrop);
 const setMenu=open=>{sidebar.classList.toggle('open',compact.matches&&open);sync()};
 close.onclick=backdrop.onclick=()=>setMenu(false);menu.onclick=()=>setMenu(!sidebar.classList.contains('open'));
 menu.setAttribute('aria-controls','sidebar');menu.setAttribute('aria-label','Відкрити меню розділів');
 sidebar.addEventListener('click',event=>{if(event.target.closest('.nav-item'))setMenu(false)});
 const records=new Map(),stack=[];let scheduled=false,actionPage=null,saveTarget=null,backTarget=null;
 const actions=document.createElement('div');actions.className='admin-mobile-actions';actions.hidden=true;actions.setAttribute('role','group');actions.setAttribute('aria-label','Дії редагування');
 const back=document.createElement('button'),save=document.createElement('button');back.type=save.type='button';back.className='btn';save.className='btn primary';back.textContent='До списку';save.textContent='Зберегти';actions.append(back,save);document.body.append(actions);
 save.onclick=()=>{if(saveTarget&&!saveTarget.disabled)saveTarget.click()};back.onclick=()=>backTarget?.click();
 function syncActions(){
  const page=document.querySelector('.page.active'),id=page?.id;
  const targets={productForm:'saveProductBtn',newsForm:'saveNewsBtn',capsuleForm:'saveCapsuleEditorBtn',capsuleStyleForm:'saveStyleEditorBtn'};
  saveTarget=targets[id]?$(targets[id]):null;backTarget=page?.querySelector('.product-back-btn');
  const hidden=!compact.matches||!saveTarget||app.classList.contains('hidden');if(actions.hidden!==hidden)actions.hidden=hidden;document.body.classList.toggle('vh-admin-has-actions',!hidden);
  if(back.hidden!==!backTarget)back.hidden=!backTarget;if(save.disabled!==!!saveTarget?.disabled)save.disabled=!!saveTarget?.disabled;
  const caption=saveTarget?.disabled?'Зберігаємо…':'Зберегти';if(save.textContent!==caption)save.textContent=caption;
  if(actionPage!==id){actionPage=id;actions.dataset.page=id||''}
 }
 const definitions=[
  ['sidebar',null,()=>compact.matches&&sidebar.classList.contains('open'),()=>setMenu(false),'Розділи адміністративної панелі'],
  ['orderModal','.order-modal-card',el=>!el.classList.contains('hidden'),()=>window.closeOrderModal?.(),'Деталі замовлення'],
  ['mediaPickerV132','.media-picker-panel-v132',el=>!el.classList.contains('hidden'),()=>window.closeMediaPickerV132?.(),'Вибрати фотографію'],
  ['customerProfileModalV130','.customer-profile-panel-v130',el=>!el.classList.contains('hidden'),el=>el.querySelector('[data-close-customer]')?.click(),'Профіль клієнта'],
  ['journalCategoryModal','.journal-category-modal__box',el=>!el.hidden,el=>el.querySelector('[data-close-journal-category]')?.click(),'Категорія журналу']
 ];
 const visible=el=>el.isConnected&&el.getClientRects().length&&getComputedStyle(el).visibility!=='hidden';
 const focusable=box=>[...box.querySelectorAll('button,a[href],input,select,textarea,[tabindex]')].filter(el=>!el.disabled&&el.tabIndex>=0&&visible(el)&&!el.closest('[inert]'));
 const focus=el=>{try{el?.focus({preventScroll:true})}catch{}};
 function annotate(){
  for(const table of document.querySelectorAll('table.table')){
   table.setAttribute('role','table');table.querySelectorAll('thead,tbody').forEach(el=>el.setAttribute('role','rowgroup'));
   table.querySelectorAll('tr').forEach(el=>el.setAttribute('role','row'));table.querySelectorAll('th').forEach(el=>el.setAttribute('role','columnheader'));
   const names=[...table.querySelectorAll('thead th')].map(th=>th.textContent.trim());
   for(const row of table.querySelectorAll('tbody tr'))[...row.cells].forEach((cell,index)=>{
    cell.setAttribute('role','cell');cell.dataset.mobileLabel=names[index]||'Дії';if(!names[index])cell.setAttribute('data-mobile-actions','');
   });
  }
  for(const label of document.querySelectorAll('.field>label')){
   const field=label.parentElement,input=field.querySelector('input[id],select[id],textarea[id]');
   if(input?.classList.contains('vh-rte-source')){
    const editors=field.querySelectorAll('.vh-rte-canvas,.vh-rte-code');for(const editor of editors)if(!editor.hasAttribute('aria-label'))editor.setAttribute('aria-label',label.textContent.trim());
    if(label.hasAttribute('for'))label.removeAttribute('for');
    if(!label.dataset.mobileRichLabel){label.dataset.mobileRichLabel='true';label.addEventListener('click',event=>{event.preventDefault();[...editors].find(el=>!el.hidden)?.focus()})}
   }else if(!label.htmlFor&&input&&!label.contains(input))label.htmlFor=input.id;
  }
  for(const button of document.querySelectorAll('button[title]:not([aria-label])'))if(!button.textContent.trim()||/^[×✕↑↓]+$/.test(button.textContent.trim()))button.setAttribute('aria-label',button.title);
 }
 function sync(){
  scheduled=false;let newlyOpened=null,closedOpener=null;
  for(const [id,selector,isOpen,closeDialog,label] of definitions){
   const root=$(id);if(!root)continue;const box=selector?root.querySelector(selector):root;if(!box)continue;
   let r=records.get(root);if(!r){r={root,box,open:false,closeDialog};records.set(root,r);box.tabIndex=-1;if(!box.hasAttribute('aria-label')&&!box.hasAttribute('aria-labelledby'))box.setAttribute('aria-label',label);const dismiss=box.querySelector('button.close,button[data-media-close],button[data-close-customer]');if(dismiss&&!dismiss.hasAttribute('aria-label'))dismiss.setAttribute('aria-label','Закрити')}
   const open=isOpen(root)&&visible(root);
   if(id==='sidebar'){root.inert=compact.matches&&!open;menu.setAttribute('aria-expanded',String(open));if(backdrop.hidden!==!open)backdrop.hidden=!open;if(compact.matches){box.setAttribute('role','dialog');box.setAttribute('aria-modal','true')}else{box.removeAttribute('role');box.removeAttribute('aria-modal')}}
   else{box.setAttribute('role','dialog');box.setAttribute('aria-modal','true');root.inert=!open}
   if(open===r.open)continue;r.open=open;
   if(open){r.opener=document.activeElement;stack.push(r);newlyOpened=r}else{const i=stack.indexOf(r);if(i>=0)stack.splice(i,1);closedOpener=r.opener}
  }
  const top=stack.at(-1);app.inert=!!top&&top.root!==sidebar;main.inert=top?.root===sidebar;actions.inert=!!top;document.body.classList.toggle('vh-admin-overlay-open',!!top);
  for(const r of stack)r.root.inert=r!==top;
  if(top&&(newlyOpened===top||!top.box.contains(document.activeElement)))focus(top.box.querySelector('button[aria-label],button.close,[data-media-close],[data-close-customer]')||top.box);
  else if(!top&&closedOpener?.isConnected&&!closedOpener.closest('[inert]'))focus(closedOpener);
  syncActions();
 }
 function schedule(){if(scheduled)return;scheduled=true;requestAnimationFrame(sync)}
 document.addEventListener('keydown',event=>{
  const top=stack.at(-1);if(!top)return;
  if(event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();top.closeDialog(top.root);schedule();return}
  if(event.key!=='Tab')return;const nodes=focusable(top.box),first=nodes[0],last=nodes.at(-1);
  if(!first){event.preventDefault();focus(top.box)}
  else if(event.shiftKey&&(document.activeElement===first||document.activeElement===top.box)){event.preventDefault();focus(last)}
  else if(!event.shiftKey&&(document.activeElement===last||!top.box.contains(document.activeElement))){event.preventDefault();focus(first)}
 },true);
 document.addEventListener('focusin',event=>{const top=stack.at(-1);if(top&&!top.box.contains(event.target))focus(focusable(top.box)[0]||top.box)});
 compact.addEventListener('change',()=>{if(!compact.matches)sidebar.classList.remove('open');sync()});
 function start(){annotate();sync();new MutationObserver(changes=>{
   if(changes.some(c=>c.type==='childList'&&[...c.addedNodes].some(n=>n.nodeType===1)))annotate();schedule();
  }).observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['class','hidden','disabled']});
  const status=$('toast');if(status){status.setAttribute('role','status');status.setAttribute('aria-live','polite');status.setAttribute('aria-atomic','true')}
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
