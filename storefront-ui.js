/* Dialog focus and background isolation shared by native and generated pages. */
(()=>{'use strict';
 const records=new Map(),stack=[],isolated=new Map();let queued=false,wasOpen=false;
 const definitions=[
  ['#orderModal','.order-card-v126',el=>!el.classList.contains('hidden'),()=>window.closeOrder?.(),'Оформлення замовлення'],
  ['#productLightbox',null,el=>!el.classList.contains('hidden'),()=>window.closeProductLightbox?.(),'Фото товару'],
  ['#vhSearchOverlay','.vh-search-panel',el=>!el.classList.contains('hidden'),()=>window.vhClosePanel?.('search'),'Пошук'],
  ['#vh125LoginOverlay','.vh125-login-drawer',el=>!el.classList.contains('hidden'),()=>window.vhClosePanel?.('profile'),'Особистий кабінет'],
  ['#vhCartDrawer',null,el=>el.classList.contains('open'),()=>window.vhClosePanel?.('cart'),'Кошик'],
  ['.capsule-photo-lightbox',null,()=>true,el=>el.querySelector('button')?.click(),'Фото образу']
 ];
 const visible=el=>el.isConnected&&el.getClientRects().length&&getComputedStyle(el).visibility!=='hidden';
 const focusable=root=>[...root.querySelectorAll('button,a[href],input,select,textarea,[tabindex]')].filter(el=>!el.disabled&&!el.closest('[inert]')&&el.tabIndex>=0&&visible(el));
 const focus=el=>{try{el?.focus({preventScroll:true})}catch{}};
 function release(){for(const [el,value] of isolated)el.inert=value;isolated.clear()}
 function isolate(record){
  const keep=new Set([record.root]);if(record.root.id==='vhCartDrawer'){const backdrop=document.getElementById('vhCartBackdrop');if(backdrop)keep.add(backdrop)}
  for(let node=record.root;node&&node!==document.body;node=node.parentElement){for(const sibling of node.parentElement?.children||[]){if(sibling===node||['SCRIPT','STYLE','LINK'].includes(sibling.tagName)||sibling.matches('#toast,[role=status],[role=alert]')||[...keep].some(el=>sibling===el||sibling.contains(el)))continue;if(!isolated.has(sibling)){isolated.set(sibling,sibling.inert);sibling.inert=true}}}
 }
 function sync(){
  queued=false;release();let opened=null,opener=null;
  for(const record of records.values()){
   const open=record.root.isConnected&&record.isOpen(record.root)&&visible(record.root);
   record.root.inert=!open;
   if(!record.root.isConnected){record.observer.disconnect();records.delete(record.root)}
   if(open===record.open)continue;
   record.open=open;record.box.setAttribute('aria-hidden',String(!open));
   if(open){record.opener=document.activeElement;stack.push(record);opened=record}
   else{const index=stack.indexOf(record);if(index>=0)stack.splice(index,1);opener=record.opener}
  }
  const top=stack.at(-1);
  if(top){isolate(top);document.body.classList.add('vh-modal-open');if(opened===top||!top.root.contains(document.activeElement))focus(top.root.querySelector('button[aria-label],button.vh-close,.order-v126-close')||top.box)}
  else if(wasOpen){document.body.classList.remove('vh-modal-open');if(opener?.isConnected&&!opener.closest('[inert]'))focus(opener)}
  wasOpen=!!top;
 }
 function schedule(){if(queued)return;queued=true;queueMicrotask(sync)}
 function discover(){
  for(const [selector,boxSelector,isOpen,close,label] of definitions)for(const root of document.querySelectorAll(selector)){
   if(records.has(root))continue;const box=boxSelector?root.querySelector(boxSelector):root;if(!box)continue;
   box.setAttribute('role','dialog');box.setAttribute('aria-modal','true');box.tabIndex=-1;
   const title=box.querySelector('h1,h2');if(title){if(!title.id)title.id='vh-dialog-title-'+records.size;box.setAttribute('aria-labelledby',title.id)}else if(!box.hasAttribute('aria-label'))box.setAttribute('aria-label',label);
   box.setAttribute('aria-hidden','true');const record={root,box,isOpen,close,open:false};records.set(root,record);
   record.observer=new MutationObserver(schedule);record.observer.observe(root,{attributes:true,attributeFilter:['class','hidden']});
  }
  for(const control of document.querySelectorAll('#orderModal input,#orderModal textarea')){const label=control.closest('.field')?.querySelector('label');if(label&&!label.htmlFor)label.htmlFor=control.id}
  const phone=document.getElementById('oPhone');if(phone){phone.type='tel';phone.inputMode='tel'}
  sync();
 }
 document.addEventListener('keydown',event=>{
  const top=stack.at(-1);if(!top)return;
  if(event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();top.close(top.root);schedule();return}
  if(event.key!=='Tab')return;const nodes=focusable(top.root),first=nodes[0],last=nodes.at(-1);
  if(!first){event.preventDefault();focus(top.box);return}
  if(event.shiftKey&&(!top.root.contains(document.activeElement)||document.activeElement===first||document.activeElement===top.box)){event.preventDefault();focus(last)}
  else if(!event.shiftKey&&(!top.root.contains(document.activeElement)||document.activeElement===last)){event.preventDefault();focus(first)}
 },true);
 document.addEventListener('focusin',event=>{const top=stack.at(-1);if(top&&!top.root.contains(event.target))focus(focusable(top.root)[0]||top.box)});
 function start(){discover();new MutationObserver(()=>{if(!queued){queued=true;queueMicrotask(()=>{queued=false;discover()})}}).observe(document.body,{childList:true,subtree:true})}
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
