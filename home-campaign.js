/* Two-slide campaign Hero. Published CMS content remains the original slide. */
(()=>{
 'use strict';
 if(!document.body.classList.contains('home-page')||new URLSearchParams(location.search).get('cms-preview')==='1')return;
 let instance=null,popup=null;
 const imageUrl=value=>{if(typeof value!=='string'||!value.trim())return '';try{const u=new URL(value,document.baseURI);return /^https?:$/.test(u.protocol)?u.href:''}catch{return ''}};
 function destination(){const url=new URL(window.VH_CONFIG?.cleanUrls?'catalog':'catalog.html',document.baseURI);url.searchParams.set('sale','1');return url.href}
 function currentPhoto(hero){
  for(const el of [hero.querySelector(':scope>.vh-cms-gradient-layer'),hero.querySelector(':scope>.vh-cms-composition .vh-cms-photo')]){
   if(!el)continue;
   const urls=[...getComputedStyle(el).backgroundImage.matchAll(/url\(["']?([^"')]+)["']?\)/g)];if(urls.length)return imageUrl(urls.at(-1)[1]);
  }
  const photo=hero.querySelector('#heroMain img,.hero-main img');
  return imageUrl(photo?.currentSrc||photo?.src||window.VH_CONFIG?.shareImageUrl||'');
 }
 function loadPhoto(picture,img,config,hero){
  const fallback=currentPhoto(hero),desktop=imageUrl(config.image)||fallback;
  const mobile=imageUrl(config.mobileImage);
  let usingFallback=false;
  const properties=['width','height','left','top'].map(name=>'--vh-campaign-image-'+name);
  function frame(){
   const inset=!usingFallback&&(mobile&&matchMedia('(max-width:760px)').matches?config.mobileImageFrame:config.imageFrame);
   properties.forEach(name=>img.style.removeProperty(name));
   if(!inset||!img.naturalWidth)return;
   const top=Math.max(0,Number(inset.top)||0)/100,bottom=Math.max(0,Number(inset.bottom)||0)/100;
   if(top+bottom>=1)return;
   const box=picture.getBoundingClientRect(),photoHeight=img.naturalHeight*(1-top-bottom);
   if(!box.width||!box.height)return;
   const scale=Math.max(box.width/img.naturalWidth,box.height/photoHeight),width=img.naturalWidth*scale,height=img.naturalHeight*scale;
   const [x,y]=getComputedStyle(img).objectPosition.split(' ').map(value=>Math.min(1,Math.max(0,(parseFloat(value)||0)/100)));
   const values=[width,height,(box.width-width)*x,-img.naturalHeight*top*scale+(box.height-photoHeight*scale)*y];
   properties.forEach((name,i)=>img.style.setProperty(name,values[i]+'px'));
  }
  const observer=new ResizeObserver(frame);observer.observe(picture);img.addEventListener('load',frame);
  if(mobile){const source=document.createElement('source');source.media='(max-width:760px)';source.srcset=mobile;picture.prepend(source)}
  img.addEventListener('error',()=>{usingFallback=true;frame();picture.querySelector('source')?.remove();if(fallback&&img.src!==fallback)img.src=fallback},{once:true});
  if(desktop)img.src=desktop;
  return ()=>{observer.disconnect();img.removeEventListener('load',frame)};
 }
 function mountPopup(hero,config){
  const settings=config.popup,key='vh_campaign_dismissed_'+settings.id;
  let timer,dialog=null,stopped=false,previousOverflow='',locked=false,cleanupPhoto=()=>{};
  function dismissed(){try{if(localStorage.getItem(key)==='1')return true}catch{}try{return sessionStorage.getItem(key)==='1'}catch{return false}}
  function remember(){try{localStorage.setItem(key,'1')}catch{}try{sessionStorage.setItem(key,'1')}catch{}}
  function close(){dialog.close();closed()}
  function release(){if(locked){locked=false;document.documentElement.style.overflow=previousOverflow}}
  function closed(){stopped=true;release();remember();cleanupPhoto();window.dispatchEvent(new Event('vh:campaign-popup-change'))}
  function blocked(){
   return document.visibilityState!=='visible'||document.querySelector('#vh-analytics-choice,dialog[open],.vh-modal-open,.vh-mobile-menu-open')||
    document.activeElement?.matches('input,textarea,select,[contenteditable="true"]');
  }
  function show(){
   if(stopped||dismissed())return;
   if(blocked()){timer=setTimeout(show,1000);return}
   dialog=document.createElement('dialog');dialog.className='vh-campaign-popup';dialog.setAttribute('aria-labelledby','vh-campaign-popup-title');dialog.setAttribute('aria-describedby','vh-campaign-popup-description');
   const card=document.createElement('div');card.className='vh-campaign-popup__card';
   const picture=document.createElement('picture'),img=document.createElement('img');img.alt='';img.decoding='async';img.fetchPriority='low';img.style.objectPosition=settings.imagePosition||config.imagePosition||'center';picture.append(img);
   const exit=document.createElement('button');exit.type='button';exit.className='vh-campaign-popup__close';exit.setAttribute('aria-label','Закрити оголошення');exit.autofocus=true;
   exit.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m7 7 10 10M17 7 7 17"/></svg>';exit.addEventListener('click',close);
   const copy=document.createElement('div');copy.className='vh-campaign-popup__copy';
   const title=document.createElement('h2');title.id='vh-campaign-popup-title';title.textContent=settings.title||config.title.replace(/\n/g,' ');
   const text=document.createElement('p');text.id='vh-campaign-popup-description';text.textContent=settings.description||config.description;
   const link=document.createElement('a');link.className='vh-campaign-popup__button';link.href=destination();link.textContent=settings.buttonText||config.buttonText;link.addEventListener('click',close);
   copy.append(title,text,link);card.append(picture,exit,copy);dialog.append(card);document.body.append(dialog);
   dialog.addEventListener('keydown',e=>{if(e.key!=='Tab')return;if(e.shiftKey&&document.activeElement===exit){e.preventDefault();link.focus()}else if(!e.shiftKey&&document.activeElement===link){e.preventDefault();exit.focus()}});
   cleanupPhoto=loadPhoto(picture,img,{...config,image:settings.image||config.image,mobileImage:settings.mobileImage||settings.image||config.mobileImage,imageFrame:settings.image?settings.imageFrame:config.imageFrame,mobileImageFrame:settings.mobileImage?settings.mobileImageFrame:settings.image?settings.imageFrame:config.mobileImageFrame},hero);
   dialog.addEventListener('close',closed);
   dialog.addEventListener('cancel',e=>{e.preventDefault();close()});
   dialog.addEventListener('click',e=>{const r=dialog.getBoundingClientRect();if(e.target===dialog&&(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom))close()});
   previousOverflow=document.documentElement.style.overflow;dialog.showModal();locked=true;document.documentElement.style.overflow='hidden';
   window.dispatchEvent(new Event('vh:campaign-popup-change'));
  }
  // Count from page initialization; wait until CMS and other dialogs are ready.
  timer=setTimeout(show,Math.max(0,Math.ceil((Number(settings.delayMs)||5000)-performance.now())));
  const storage=e=>{if(e.key===key&&e.newValue==='1'){stopped=true;clearTimeout(timer);if(dialog?.open)close()}};
  window.addEventListener('storage',storage);
  return {key,destroy(){stopped=true;clearTimeout(timer);cleanupPhoto();window.removeEventListener('storage',storage);if(dialog){dialog.removeEventListener('close',closed);if(dialog.open)dialog.close();release();dialog.remove()}}};
 }
 function mount(hero,config){
  let index=0,start=null,imageLoaded=false,cleanupPhoto=()=>{};
  let rotationTimer=null,hovered=false,inView=false,destroyed=false;
  const motion=matchMedia('(prefers-reduced-motion:reduce)');let paused=motion.matches;
  const interval=Math.max(1000,Number(config.autoSlideMs)||7000);
  const saved=new WeakMap();
  const promo=document.createElement('div');promo.className='vh-hero-promo';promo.dataset.vhHeroUi='';promo.id='vh-hero-promotion';promo.setAttribute('aria-label','Чорна п’ятниця');
  if(config.desktopImageFit==='contain')promo.classList.add('vh-hero-promo--contain');
  const picture=document.createElement('picture'),img=document.createElement('img');
  img.alt='';img.decoding='async';img.fetchPriority='low';img.draggable=false;img.style.objectPosition=config.imagePosition||'center';picture.append(img);
  const copy=document.createElement('div');copy.className='vh-hero-promo__copy';
  const eyebrow=document.createElement('p');eyebrow.className='vh-hero-promo__eyebrow';eyebrow.textContent=config.eyebrow;
  const title=document.createElement('h2'),titleText=document.createTextNode(config.title);title.className='vh-hero-promo__title';title.append(titleText);
  if(config.discount){const discount=document.createElement('span');discount.className='vh-hero-promo__discount';discount.textContent=config.discount;title.append(discount)}
  const description=document.createElement('div');description.className='vh-hero-promo__description';
  for(const value of [config.description,config.detail].filter(Boolean)){const p=document.createElement('p');p.textContent=value;description.append(p)}
  const link=document.createElement('a');link.className='vh-hero-promo__button';link.textContent=config.buttonText;
  link.href=destination();
  copy.append(eyebrow,title,description,link);promo.append(picture,copy);
  const controls=document.createElement('div');controls.className='vh-hero-controls';controls.dataset.vhHeroUi='';controls.setAttribute('role','group');controls.setAttribute('aria-label','Листання головного банера');
  const button=(label,html)=>{const b=document.createElement('button');b.type='button';b.setAttribute('aria-label',label);b.innerHTML=html;return b};
  const prev=button('Попередній слайд','<svg viewBox="0 0 32 24" aria-hidden="true"><path d="M26 12H6m8-7-8 7 8 7"/></svg>');prev.className='vh-hero-arrow vh-hero-arrow--prev';
  const next=button('Наступний слайд','<svg viewBox="0 0 32 24" aria-hidden="true"><path d="M6 12h20m-8-7 8 7-8 7"/></svg>');next.className='vh-hero-arrow vh-hero-arrow--next';
  // Keyboard and screen-reader users can also stop rotation explicitly.
  const rotation=button('','');rotation.className='vh-hero-rotation';
  function rotationLabel(){rotation.textContent=paused?'Увімкнути автоматичне листання':'Зупинити автоматичне листання'}
  rotationLabel();rotation.addEventListener('click',()=>{paused=!paused;rotationLabel();restartRotation()});
  const status=document.createElement('span');status.className='vh-hero-status';status.dataset.vhHeroUi='';status.setAttribute('aria-live','polite');status.setAttribute('aria-atomic','true');
  controls.append(prev,next,rotation);hero.append(promo,controls,status);hero.classList.add('vh-hero-carousel');
  // Read the original slide's live typography and anchors, including saved CMS styles.
  function syncCopy(){
   if(destroyed)return;
   const sources=[hero.querySelector('#heroEyebrow'),hero.querySelector('#heroTitle'),hero.querySelector('#heroDescription p')||hero.querySelector('#heroDescription'),hero.querySelector('#heroCatalogBtn')];
   if(sources.some(el=>!el||!el.getBoundingClientRect().width)){delete copy.dataset.vhCopySynced;return}
   const bounds=hero.getBoundingClientRect(),column=sources[1].getBoundingClientRect().width;
   const headingStyle=getComputedStyle(sources[1]),headingLines=sources[1].getBoundingClientRect().height/parseFloat(headingStyle.lineHeight);
   titleText.textContent=headingLines<2.5?config.title.replace(/\n/g,' '):config.title;
   const typography=['font-family','font-size','font-weight','font-style','font-stretch','line-height','letter-spacing','word-spacing','text-align','text-transform','font-kerning','font-variant-ligatures','text-rendering','color'];
   [eyebrow,title,description,link].forEach((target,i)=>{
    const source=sources[i],rect=source.getBoundingClientRect(),style=getComputedStyle(source);
    for(const name of typography)target.style.setProperty(name,style.getPropertyValue(name),'important');
    for(const [name,value] of Object.entries({x:rect.x-bounds.x,y:rect.y-bounds.y,width:rect.width,height:rect.height,'column-width':column}))target.style.setProperty('--vh-ref-'+name,value+'px');
    if(i===3)target.style.setProperty('--vh-ref-padding',style.padding);
   });
   copy.dataset.vhCopySynced='';
  }
  const textObserver=new ResizeObserver(syncCopy);
  for(const el of [hero,...['#heroEyebrow','#heroTitle','#heroDescription','#heroCatalogBtn'].map(selector=>hero.querySelector(selector))].filter(Boolean))textObserver.observe(el);
  hero.addEventListener('animationend',syncCopy);hero.addEventListener('transitionend',syncCopy);
  document.fonts?.ready.then(syncCopy);
  function clearRotation(){clearTimeout(rotationTimer);rotationTimer=null}
  function canRotate(){return !destroyed&&!paused&&!hovered&&inView&&!start&&document.visibilityState==='visible'&&!hero.contains(document.activeElement)&&!document.querySelector('dialog[open],#vh-analytics-choice,.vh-modal-open,.vh-mobile-menu-open')}
  function scheduleRotation(){
   if(!canRotate()){clearRotation();return}
   if(rotationTimer!==null)return;
   rotationTimer=setTimeout(()=>{rotationTimer=null;if(canRotate())select(index+1,false);else scheduleRotation()},interval);
  }
  function restartRotation(){clearRotation();scheduleRotation()}
  function originals(){return [...hero.children].filter(el=>!el.hasAttribute('data-vh-hero-ui'))}
  function loadImage(){
   if(imageLoaded)return;imageLoaded=true;
   cleanupPhoto=loadPhoto(picture,img,config,hero);
  }
  function select(value,announce=true){
   index=(value+2)%2;if(index===1)loadImage();
   syncCopy();
   const nodes=originals();
   if(index&&nodes.some(el=>el.contains(document.activeElement)))next.focus({preventScroll:true});
   if(!index&&promo.contains(document.activeElement))prev.focus({preventScroll:true});
   hero.dataset.vhSlide=String(index);
   for(const el of nodes){
    if(!saved.has(el))saved.set(el,{inert:el.inert,aria:el.getAttribute('aria-hidden')});
    el.dataset.vhOriginalSlide='';
    if(index){el.inert=true;el.setAttribute('aria-hidden','true')}
    else{const prior=saved.get(el);el.inert=prior.inert;if(prior.aria===null)el.removeAttribute('aria-hidden');else el.setAttribute('aria-hidden',prior.aria)}
   }
   promo.inert=index!==1;promo.setAttribute('aria-hidden',String(index!==1));
   if(announce)status.textContent=index?'Слайд 2 з 2. Чорна п’ятниця.':'Слайд 1 з 2. Vintazhka.';
   restartRotation();
  }
  const previous=()=>select(index-1),following=()=>select(index+1);
  prev.addEventListener('click',previous);next.addEventListener('click',following);
  function keydown(e){if(e.target.closest('input,textarea,select,[contenteditable="true"]'))return;if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();select(index+(e.key==='ArrowRight'?1:-1))}}
  function down(e){if(!e.isPrimary||e.button!==0||e.target.closest('a,button,input,textarea,select'))return;start={id:e.pointerId,x:e.clientX,y:e.clientY,at:performance.now()};scheduleRotation();try{hero.setPointerCapture?.(e.pointerId)}catch{}}
  function up(e){if(!start||start.id!==e.pointerId)return;const dx=e.clientX-start.x,dy=e.clientY-start.y,elapsed=performance.now()-start.at;start=null;if(Math.abs(dx)>=50&&Math.abs(dx)>Math.abs(dy)*1.4&&elapsed<1200)select(index+(dx<0?1:-1));else scheduleRotation()}
  const cancel=()=>{start=null;scheduleRotation()};
  const enter=()=>{hovered=true;scheduleRotation()},leave=()=>{hovered=false;scheduleRotation()},focusOut=()=>queueMicrotask(scheduleRotation);
  const motionChange=()=>{paused=motion.matches;rotationLabel();scheduleRotation()};
  const viewObserver=new IntersectionObserver(entries=>{inView=entries[0].isIntersecting;scheduleRotation()},{threshold:0});viewObserver.observe(hero);
  const modalObserver=new MutationObserver(scheduleRotation);modalObserver.observe(document.body,{childList:true,attributes:true,attributeFilter:['class']});
  hero.addEventListener('mouseenter',enter);hero.addEventListener('mouseleave',leave);hero.addEventListener('focusin',scheduleRotation);hero.addEventListener('focusout',focusOut);
  document.addEventListener('visibilitychange',scheduleRotation);window.addEventListener('vh:campaign-popup-change',scheduleRotation);motion.addEventListener('change',motionChange);
  hero.addEventListener('keydown',keydown);hero.addEventListener('pointerdown',down);hero.addEventListener('pointerup',up);hero.addEventListener('pointercancel',cancel);
  select(0,false);
  return {hero,refresh:()=>select(index,false),destroy(){destroyed=true;select(0,false);clearRotation();viewObserver.disconnect();modalObserver.disconnect();textObserver.disconnect();cleanupPhoto();hero.classList.remove('vh-hero-carousel');delete hero.dataset.vhSlide;originals().forEach(el=>delete el.dataset.vhOriginalSlide);promo.remove();controls.remove();status.remove();hero.removeEventListener('animationend',syncCopy);hero.removeEventListener('transitionend',syncCopy);hero.removeEventListener('keydown',keydown);hero.removeEventListener('pointerdown',down);hero.removeEventListener('pointerup',up);hero.removeEventListener('pointercancel',cancel);hero.removeEventListener('mouseenter',enter);hero.removeEventListener('mouseleave',leave);hero.removeEventListener('focusin',scheduleRotation);hero.removeEventListener('focusout',focusOut);document.removeEventListener('visibilitychange',scheduleRotation);window.removeEventListener('vh:campaign-popup-change',scheduleRotation);motion.removeEventListener('change',motionChange)}};
 }
 function ready(){
  const config=window.VH_HOME_CAMPAIGN,hero=document.querySelector('body.home-page>.hero');
  if(!config?.enabled){instance?.destroy();instance=null;popup?.destroy();popup=null;return}
  if(!hero||!window.__VH_PUBLISHED_READY||window.__VH_PUBLICATION_ERROR||getComputedStyle(hero).display==='none')return;
  if(!config.popup?.enabled){popup?.destroy();popup=null}
  else if(!popup||popup.key!=='vh_campaign_dismissed_'+config.popup.id){popup?.destroy();popup=mountPopup(hero,config)}
  if(instance?.hero===hero&&hero.querySelector('.vh-hero-controls')){instance.refresh();return}
  instance?.destroy();instance=mount(hero,config);
 }
 window.VHHomeCampaign=Object.freeze({refresh:ready});
 for(const event of ['vh:published-ready','vh:cms-ready','vh:home-rendered'])window.addEventListener(event,ready);
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',ready,{once:true});else ready();
})();
