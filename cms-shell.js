/* One published header/footer renderer for CMS pages and standalone storefront pages. */
(()=>{'use strict';
 const cacheKey='vh-published-cache-v1-home-shell',navigationDefaults=new WeakMap();let pending,observer;
 function navigation(shared,doc=document,reset=true){
  const nav=doc.querySelector('body > header nav.nav,body > header nav');if(!nav)return;
  [...nav.querySelectorAll('a')].forEach((link,i)=>{
   if(!navigationDefaults.has(link))navigationDefaults.set(link,{label:link.dataset.vhNavDefaultLabel??link.textContent,href:link.dataset.vhNavDefaultHref??link.getAttribute('href')});
   const original=navigationDefaults.get(link),value=shared?.nav?.[String(i)];
   const label=value?.label||(reset?original.label:null);
   if(label!=null&&link.textContent!==label)link.textContent=label;
   const href=value?.href&&/^(https?:|\/|\.\/|\.\.\/|[\w-]+\.html|#)/i.test(value.href)?value.href:reset?original.href:null;
   if(href!=null&&link.getAttribute('href')!==href)link.setAttribute('href',href);
  });
 }
 function logo(image,value){
  if(window.VHCMSModel?.applyLogo)return window.VHCMSModel.applyLogo(image,value);
  if(!image||typeof value!=='string')return;
  if(!image.dataset.vhLogoDefault)image.dataset.vhLogoDefault=image.getAttribute('src')||'assets/vintage-hedonista-logo-v257.webp';
  if(value==='__removed__'){image.style.visibility='hidden';return}
  const source=value.trim()||image.dataset.vhLogoDefault;image.style.removeProperty('visibility');
  if(image.getAttribute('src')===source)return;
  image.onerror=()=>{if(image.getAttribute('src')!==source)return;image.onerror=null;image.src=image.dataset.vhLogoDefault;image.style.removeProperty('visibility')};image.src=source;
 }
 function apply(shared,doc=document){
  shared=shared||{};navigation(shared,doc);
  const header=doc.querySelector('body > header'),footer=doc.querySelector('footer.site-footer-v64,body > footer');
  if(header){
   logo(header.querySelector('.vh-header-logo,.brand img'),shared.headerLogo);
  }
  if(footer){
   logo(footer.querySelector('.vh-footer-logo-img,.footer-v64-logo img'),shared.footerLogo);
   const copy=footer.querySelector('.footer-v64-center p,.footer-v64-center'),copyright=footer.querySelector('.footer-v64-copy');
   if(copy&&typeof shared.footerText==='string')copy.textContent=shared.footerText;
   if(copyright&&typeof shared.footerCopyright==='string')copyright.textContent=shared.footerCopyright;
   for(const [key,selector] of [['instagram','[data-footer-instagram]'],['telegram','[data-footer-telegram]']]){const link=footer.querySelector(selector);if(link&&/^https:\/\//i.test(shared[key]||''))link.href=shared[key]}
  }
 }
 function cached(){try{return JSON.parse(localStorage.getItem(cacheKey)||'null')}catch{return null}}
 function prime(){
  observer?.disconnect();
  const value=cached(),built=Date.parse(document.querySelector('meta[name="vh-published-nav-revision"]')?.content||''),saved=Date.parse(value?.updated_at||'');
  // A newer deployment must not be replaced by an older browser cache.
  if(value?.shared&&(!Number.isFinite(built)||Number.isFinite(saved)&&saved>=built))navigation(value.shared,document,false);
 }
 async function load(){
  if(pending)return pending;
  const config=window.VH_CONFIG;if(!config||!window.supabase)return;
  const db=window.VHPublicClient||(window.VHPublicClient=window.supabase.createClient(config.supabaseUrl,config.supabaseKey,{auth:{storageKey:'vintage-hedonista-public-content',persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}}));
  pending=(async()=>{let timer;try{
   const result=await Promise.race([Promise.resolve(db.from('vh_page_revisions').select('shared,updated_at').eq('page_key','home').eq('revision_status','published').maybeSingle()),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Shared header/footer request timed out')),12000)})]);
   if(result.error)throw result.error;
   // A successful empty response clears the old cache; only failures may reuse it.
   try{if(result.data)localStorage.setItem(cacheKey,JSON.stringify(result.data));else localStorage.removeItem(cacheKey)}catch{}
   apply(result.data?.shared);return result.data;
  }catch(error){const value=cached();if(value?.shared)apply(value.shared);console.warn('Published header/footer',error);return value}
  finally{clearTimeout(timer);pending=null;window.__VH_SHELL_READY=true;window.dispatchEvent(new Event('vh:shell-ready'))}})();return pending;
 }
 window.VHCMSShell={apply,load,prime};
 // If HTML arrives in pieces, update a completed nav before the next paint.
 if(document.readyState==='loading'&&cached()?.shared?.nav){observer=new MutationObserver(()=>{if(document.querySelector('body > header .header-icons'))prime()});observer.observe(document.documentElement,{childList:true,subtree:true})}
 function auto(){
  // CMS publication already fetches the same shared revision and owns its timing.
  if([...document.scripts].some(script=>/(?:^|\/)cms-published\.js(?:\?|$)/.test(script.getAttribute('src')||'')))return;
  load();
 }
 if(document.readyState==='complete')auto();else document.addEventListener('DOMContentLoaded',auto,{once:true});
})();
