/* Storefront analytics. Google loads only after the visitor allows analytics. */
(()=>{
 'use strict';
 const measurementId='G-15N51M35Y2',consentKey='vh_analytics_consent_v1';
 if(location.hostname!=='vintazhka.com.ua'||window.VH_DEPLOYMENT?.readOnlyData)return;
 if(/^\/(?:admin(?:\/|$)|account(?:\.html)?(?:\/|$))/i.test(location.pathname))return;
 try{if(window.self!==window.top)return}catch{return}
 if(/[?&#](?:access_token|refresh_token|token|token_hash|code|error_description)=/i.test(location.search+location.hash))return;
 if(window.VHAnalytics)return;
 let consent=null,loaded=false,initialView=false;
 const context=new Map(),seen=new Set();
 try{const saved=JSON.parse(localStorage.getItem(consentKey)||'null');if(saved&&Date.now()-saved.at<180*86400000&&['granted','denied'].includes(saved.value))consent=saved.value}catch{}
 if(navigator.globalPrivacyControl===true)consent='denied';
 window.dataLayer=window.dataLayer||[];
 const gtag=function(){window.dataLayer.push(arguments)};
 function pageLocation(){
  const url=new URL(location.href);url.search='';url.hash='';
  const slug=new URLSearchParams(location.search).get('slug');
  if(/^\/product(?:\.html)?\/?$/.test(url.pathname)&&slug&&/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)&&slug.length<=180)url.pathname='/seo-product/'+slug+'/';
  return url.href;
 }
 function referrer(){try{return new URL(document.referrer).origin+'/'}catch{return ''}}
 const page={page_location:pageLocation(),page_referrer:referrer(),page_title:document.title};
 function send(name,params={}){
  if(consent!=='granted'||!loaded)return;
  gtag('event',name,{...params,...page});
 }
 function start(){
  if(loaded||consent!=='granted')return;
  window['ga-disable-'+measurementId]=false;
  gtag('consent','default',{analytics_storage:'denied',ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied'});
  gtag('consent','update',{analytics_storage:'granted'});
  gtag('set','ads_data_redaction',true);
  gtag('js',new Date());
  gtag('config',measurementId,{send_page_view:false,allow_google_signals:false,allow_ad_personalization_signals:false,...page});
  const script=document.createElement('script');script.async=true;script.src='https://www.googletagmanager.com/gtag/js?id='+measurementId;script.id='vh-google-analytics';document.head.append(script);
  loaded=true;
  if(!initialView){initialView=true;send('page_view')}
  for(const [name,params] of context)send(name,params);
 }
 function clearCookies(){
  for(const cookie of document.cookie.split(';')){
   const name=cookie.trim().split('=')[0];if(!/^_ga(?:_|$)|^_gid$|^_gat(?:_|$)/.test(name))continue;
   for(const domain of ['',location.hostname,'.'+location.hostname])document.cookie=name+'=; Max-Age=0; Path=/; SameSite=Lax'+(domain?'; Domain='+domain:'');
  }
 }
 function choose(value){
  consent=value;
  try{localStorage.setItem(consentKey,JSON.stringify({value,at:Date.now()}))}catch{}
  document.getElementById('vh-analytics-choice')?.remove();
  if(value==='granted'){
   if(loaded){window['ga-disable-'+measurementId]=false;gtag('consent','update',{analytics_storage:'granted'})}else start();
  }else{
   window['ga-disable-'+measurementId]=true;
   if(loaded)gtag('consent','update',{analytics_storage:'denied'});
   clearCookies();
  }
 }
 function settings(){
  if(document.getElementById('vh-analytics-choice'))return;
  const panel=document.createElement('section');panel.id='vh-analytics-choice';panel.setAttribute('role','region');panel.setAttribute('aria-label','Налаштування аналітики');
  const text=document.createElement('p');text.textContent='Дозволити аналітичні cookie? Вони допомагають нам розуміти відвідування й покращувати магазин.';panel.append(text);
  const privacy=document.querySelector('meta[name="vh-privacy-policy"]')?.content;
  if(privacy){const link=document.createElement('a');link.href=privacy;link.target='_blank';link.rel='noopener';link.textContent='Політика конфіденційності';link.style.cssText='display:inline-block;margin:0 0 12px;text-decoration:underline';panel.append(link)}
  const actions=document.createElement('div');
  for(const [label,value] of [['Відхилити','denied'],['Дозволити','granted']]){const button=document.createElement('button');button.type='button';button.textContent=label;button.addEventListener('click',()=>choose(value));actions.append(button)}
  panel.append(actions);document.body.append(panel);
 }
 function settingsButton(){
  const footer=document.querySelector('footer');if(!footer)return;
  let button=footer.querySelector('[data-vh-analytics-settings]');
  if(!button){button=document.createElement('button');button.type='button';button.dataset.vhAnalyticsSettings='';button.className='vh-analytics-settings';button.textContent='Налаштування cookie';footer.append(button)}
  if(!button.dataset.vhAnalyticsBound){button.addEventListener('click',settings);button.dataset.vhAnalyticsBound='1'}
  button.hidden=false;
 }
 function commerce(name,products,total,eventKey){
  if(!['view_item','add_to_cart','remove_from_cart','begin_checkout','order_placed'].includes(name)||!Array.isArray(products))return;
  // Only catalogue fields are copied. Customer/profile/form/order IDs never enter GA.
  const items=products.slice(0,100).filter(p=>p&&typeof p.id==='string'&&/^[a-zA-Z0-9_-]{1,100}$/.test(p.id)).map(p=>{
   const item={item_id:p.id,quantity:1};
   for(const [from,to] of [['name','item_name'],['brand','item_brand']])if(typeof p[from]==='string')item[to]=p[from].slice(0,150);
   if(p.price!==null&&p.price!==''&&Number.isFinite(Number(p.price))&&Number(p.price)>=0)item.price=Number(p.price);
   return item;
  });
  if(!items.length)return;
  const params={currency:'UAH',items};
  if(total!==null&&total!==''&&total!==undefined&&Number.isFinite(Number(total))&&Number(total)>=0)params.value=Number(total);
  const key=typeof eventKey==='string'?name+':'+eventKey:null;
  if(key&&seen.has(key))return;
  if(key)seen.add(key);
  if(['view_item','begin_checkout'].includes(name))context.set(name,params);
  send(name,params);
 }
 window.VHAnalytics=Object.freeze({commerce,settings});
 const style=document.createElement('style');style.textContent='#vh-analytics-choice{position:fixed;z-index:10050;left:16px;bottom:calc(16px + env(safe-area-inset-bottom,0px));width:min(500px,calc(100vw - 32px));box-sizing:border-box;padding:18px;background:#f3eadf;color:#211812;border:1px solid #aa9780;box-shadow:0 4px 24px #0002;font:14px/1.5 Arial,sans-serif}#vh-analytics-choice p{margin:0 0 12px}#vh-analytics-choice>div{display:flex;gap:10px}#vh-analytics-choice button{flex:1;min-height:44px;padding:8px 14px;background:#f3eadf;color:#211812;border:1px solid #78634d;font:inherit;cursor:pointer}#vh-analytics-choice button:focus-visible,.vh-analytics-settings:focus-visible{outline:2px solid #78634d;outline-offset:3px}.vh-analytics-settings{display:block;margin:16px auto;padding:10px;background:transparent;border:0;color:inherit;font:inherit;font-size:12px;text-decoration:underline;cursor:pointer}';document.head.append(style);
 function ready(){settingsButton();if(consent==='granted')start();else if(consent===null)settings()}
 for(const event of ['vh:published-ready','vh:shell-ready'])window.addEventListener(event,settingsButton);
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',ready,{once:true});else ready();
})();
