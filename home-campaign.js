/* A manual two-slide Hero. Published CMS content remains the original slide. */
(()=>{
 'use strict';
 if(!document.body.classList.contains('home-page')||new URLSearchParams(location.search).get('cms-preview')==='1')return;
 let instance=null;
 const imageUrl=value=>{if(typeof value!=='string'||!value.trim())return '';try{const u=new URL(value,document.baseURI);return /^https?:$/.test(u.protocol)?u.href:''}catch{return ''}};
 function mount(hero,config){
  let index=0,start=null,imageLoaded=false;
  const saved=new WeakMap();
  const promo=document.createElement('div');promo.className='vh-hero-promo';promo.dataset.vhHeroUi='';promo.id='vh-hero-promotion';promo.setAttribute('aria-label','Чорна п’ятниця');
  const picture=document.createElement('picture'),img=document.createElement('img');
  img.alt='';img.decoding='async';img.fetchPriority='low';img.draggable=false;img.style.objectPosition=config.imagePosition||'center';picture.append(img);
  const copy=document.createElement('div');copy.className='vh-hero-promo__copy';
  const eyebrow=document.createElement('p');eyebrow.className='vh-hero-promo__eyebrow';eyebrow.textContent=config.eyebrow;
  const title=document.createElement('h2');title.className='vh-hero-promo__title';title.textContent=config.title;
  const description=document.createElement('p');description.className='vh-hero-promo__description';description.textContent=config.description;
  const link=document.createElement('a');link.className='vh-hero-promo__button';link.textContent=config.buttonText;
  const destination=new URL(window.VH_CONFIG?.cleanUrls?'catalog':'catalog.html',document.baseURI);destination.searchParams.set('sale','1');link.href=destination.href;
  copy.append(eyebrow,title,description,link);promo.append(picture,copy);
  const controls=document.createElement('div');controls.className='vh-hero-controls';controls.dataset.vhHeroUi='';controls.setAttribute('role','group');controls.setAttribute('aria-label','Листання головного банера');
  const button=(label,html)=>{const b=document.createElement('button');b.type='button';b.setAttribute('aria-label',label);b.innerHTML=html;return b};
  const prev=button('Попередній слайд','<svg viewBox="0 0 20 20" aria-hidden="true"><path d="m12 5-5 5 5 5"/></svg>');
  const next=button('Наступний слайд','<svg viewBox="0 0 20 20" aria-hidden="true"><path d="m8 5 5 5-5 5"/></svg>');
  const dots=document.createElement('div');dots.className='vh-hero-dots';
  const choices=['Слайд 1: Vintazhka','Слайд 2: Чорна п’ятниця'].map((label,i)=>{const b=button(label,'<span aria-hidden="true"></span>');b.addEventListener('click',()=>select(i));dots.append(b);return b});
  const status=document.createElement('span');status.className='vh-hero-status';status.dataset.vhHeroUi='';status.setAttribute('aria-live','polite');status.setAttribute('aria-atomic','true');
  controls.append(prev,dots,next);hero.append(promo,controls,status);hero.classList.add('vh-hero-carousel');
  function originals(){return [...hero.children].filter(el=>!el.hasAttribute('data-vh-hero-ui'))}
  function currentPhoto(){
   for(const el of [hero.querySelector(':scope>.vh-cms-gradient-layer'),hero.querySelector(':scope>.vh-cms-composition .vh-cms-photo')]){
    if(!el)continue;
    const urls=[...getComputedStyle(el).backgroundImage.matchAll(/url\(["']?([^"')]+)["']?\)/g)];if(urls.length)return imageUrl(urls.at(-1)[1]);
   }
   const photo=hero.querySelector('#heroMain img,.hero-main img');
   return imageUrl(photo?.currentSrc||photo?.src||window.VH_CONFIG?.shareImageUrl||'');
  }
  function loadImage(){
   if(imageLoaded)return;imageLoaded=true;
   const fallback=currentPhoto(),desktop=imageUrl(config.image||fallback);
   if(config.mobileImage){const source=document.createElement('source');source.media='(max-width:760px)';source.srcset=imageUrl(config.mobileImage);picture.prepend(source)}
   if(desktop)img.src=desktop;
   img.addEventListener('error',()=>{picture.querySelector('source')?.remove();if(fallback&&img.src!==fallback)img.src=fallback},{once:true});
  }
  function select(value,announce=true){
   index=(value+2)%2;if(index===1)loadImage();
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
   choices.forEach((b,i)=>b.setAttribute('aria-pressed',String(i===index)));
   if(announce)status.textContent=index?'Слайд 2 з 2. Чорна п’ятниця.':'Слайд 1 з 2. Vintazhka.';
  }
  const previous=()=>select(index-1),following=()=>select(index+1);
  prev.addEventListener('click',previous);next.addEventListener('click',following);
  function keydown(e){if(e.target.closest('input,textarea,select,[contenteditable="true"]'))return;if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();select(index+(e.key==='ArrowRight'?1:-1))}}
  function down(e){if(!e.isPrimary||e.button!==0||e.target.closest('a,button,input,textarea,select'))return;start={id:e.pointerId,x:e.clientX,y:e.clientY,at:performance.now()};try{hero.setPointerCapture?.(e.pointerId)}catch{}}
  function up(e){if(!start||start.id!==e.pointerId)return;const dx=e.clientX-start.x,dy=e.clientY-start.y,elapsed=performance.now()-start.at;start=null;if(Math.abs(dx)>=50&&Math.abs(dx)>Math.abs(dy)*1.4&&elapsed<1200)select(index+(dx<0?1:-1))}
  const cancel=()=>{start=null};
  hero.addEventListener('keydown',keydown);hero.addEventListener('pointerdown',down);hero.addEventListener('pointerup',up);hero.addEventListener('pointercancel',cancel);
  select(0,false);
  return {hero,refresh:()=>select(index,false),destroy(){select(0,false);hero.classList.remove('vh-hero-carousel');delete hero.dataset.vhSlide;originals().forEach(el=>delete el.dataset.vhOriginalSlide);promo.remove();controls.remove();status.remove();hero.removeEventListener('keydown',keydown);hero.removeEventListener('pointerdown',down);hero.removeEventListener('pointerup',up);hero.removeEventListener('pointercancel',cancel)}};
 }
 function ready(){
  const config=window.VH_HOME_CAMPAIGN,hero=document.querySelector('body.home-page>.hero');
  if(!config?.enabled){instance?.destroy();instance=null;return}
  if(!hero||!window.__VH_PUBLISHED_READY||window.__VH_PUBLICATION_ERROR||getComputedStyle(hero).display==='none')return;
  if(instance?.hero===hero&&hero.querySelector('.vh-hero-controls')){instance.refresh();return}
  instance?.destroy();instance=mount(hero,config);
 }
 window.VHHomeCampaign=Object.freeze({refresh:ready});
 for(const event of ['vh:published-ready','vh:cms-ready','vh:home-rendered'])window.addEventListener(event,ready);
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',ready,{once:true});else ready();
})();
