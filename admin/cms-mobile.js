/* Narrow-screen navigation. No draft content, page DOM or save handlers are replaced. */
(()=>{'use strict';
 const compact=matchMedia('(max-width:1199px)'),main=document.querySelector('body>main'),frame=document.getElementById('siteFrame');
 const panels={blocks:document.querySelector('.layout>div:first-child'),preview:document.querySelector('.preview'),inspector:document.querySelector('.editor')};if(!main||Object.values(panels).some(p=>!p))return;
 const nav=document.createElement('div');nav.className='cms-mobile-nav';nav.setAttribute('role','tablist');nav.setAttribute('aria-label','Робочі панелі редактора');
 let current='blocks',autoDevice=false;
 function show(name,focusPanel=false){
  if(!panels[name])return;current=name;document.body.dataset.cmsPane=name;
  const frameHidden=compact.matches&&name!=='preview';frame.inert=frameHidden;panels.preview.setAttribute('aria-hidden',String(frameHidden));
  if(frameHidden)frame.tabIndex=-1;else frame.removeAttribute('tabindex');
  for(const button of nav.children){const active=button.dataset.pane===name;button.setAttribute('aria-selected',String(active));button.tabIndex=active?0:-1}
  if(compact.matches&&focusPanel)panels[name].focus({preventScroll:true});
  if(name==='preview')requestAnimationFrame(()=>window.dispatchEvent(new Event('resize')));
 }
 for(const [name,title] of [['blocks','Блоки'],['preview','Перегляд'],['inspector','Налаштування']]){
  const button=document.createElement('button');button.type='button';button.textContent=title;button.dataset.pane=name;button.id='cms-mobile-tab-'+name;button.setAttribute('role','tab');
  if(!panels[name].id)panels[name].id='cms-mobile-panel-'+name;button.setAttribute('aria-controls',panels[name].id);button.onclick=()=>show(name);nav.append(button);
 }
 main.querySelector(':scope>header').after(nav);
 nav.addEventListener('keydown',event=>{
  const index=[...nav.children].indexOf(event.target);if(index<0)return;let next;
  if(event.key==='ArrowRight')next=(index+1)%3;else if(event.key==='ArrowLeft')next=(index+2)%3;else if(event.key==='Home')next=0;else if(event.key==='End')next=2;else return;
  event.preventDefault();nav.children[next].click();nav.children[next].focus();
 });
 panels.blocks.addEventListener('click',event=>{
  if(!compact.matches)return;
  if(event.target.closest('.existing-select')&&(event.isTrusted||current==='preview'))show('inspector',true);
  if(event.target.closest('#add,[data-side-tab=styles]'))show('inspector',true);
 });
 document.getElementById('studioPage').addEventListener('change',()=>{if(compact.matches)show(document.body.classList.contains('cms-shared-mode')?'inspector':'blocks')});
 function responsive(){
  for(const [name,panel] of Object.entries(panels)){
   if(compact.matches){panel.setAttribute('role','tabpanel');panel.setAttribute('aria-labelledby','cms-mobile-tab-'+name);panel.tabIndex=-1}
   else{panel.removeAttribute('role');panel.removeAttribute('aria-labelledby');panel.removeAttribute('tabindex')}
  }
  if(compact.matches&&!autoDevice){document.querySelector('[data-studio-device="'+(innerWidth<768?'mobile':'tablet')+'"]').click();autoDevice=true}
  show(current);
 }
 compact.addEventListener('change',responsive);responsive();
 const seo=document.getElementById('pageSeoPanel'),toggle=document.getElementById('studioSeoToggle'),close=document.createElement('button');
 close.id='cmsMobileSeoClose';close.type='button';close.textContent='×';close.setAttribute('aria-label','Закрити SEO налаштування');close.hidden=!compact.matches;seo.prepend(close);
 let seoOpen=false,opener=null;
 function syncSeo(){
  close.hidden=!compact.matches;const open=compact.matches&&seo.classList.contains('studio-seo-open');
  if(open===seoOpen)return;seoOpen=open;
  if(open){opener=document.activeElement;seo.setAttribute('role','dialog');seo.setAttribute('aria-modal','true');seo.setAttribute('aria-label','SEO налаштування сторінки');main.querySelector('header').inert=true;nav.inert=true;Object.values(panels).forEach(p=>p.inert=true);close.focus({preventScroll:true})}
  else{seo.removeAttribute('role');seo.removeAttribute('aria-modal');main.querySelector('header').inert=false;nav.inert=false;Object.values(panels).forEach(p=>p.inert=false);if(opener?.isConnected)opener.focus({preventScroll:true})}
 }
 close.onclick=()=>seo.classList.remove('studio-seo-open');new MutationObserver(syncSeo).observe(seo,{attributes:true,attributeFilter:['class']});compact.addEventListener('change',syncSeo);
 document.addEventListener('keydown',event=>{
  if(!seoOpen)return;
  if(event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();close.click()}
  if(event.key==='Tab'){
   const fields=[...seo.querySelectorAll('button,input,textarea,a[href]')].filter(el=>!el.disabled&&!el.hidden&&el.getClientRects().length),first=fields[0],last=fields.at(-1);
   if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus()}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus()}
  }
 },true);
})();
