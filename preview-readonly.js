/* Accident prevention for the Cloudflare rehearsal. Database authorization still lives in Supabase. */
(()=>{'use strict';
 if(!window.VH_DEPLOYMENT?.readOnlyData)return;
 const origin=window.VH_DEPLOYMENT.supabaseOrigin;
 const message='Тестова версія Cloudflare: запис у робочу базу, завантаження фото та надсилання замовлень вимкнені. Локальні чернетки конструктора залишаються в цьому браузері.';
 function blocked(input,options){
  let url;try{url=new URL(typeof input==='string'||input instanceof URL?input:input.url,document.baseURI)}catch{return false}
  if(url.origin!==origin)return false;
  const method=String(options?.method||input?.method||'GET').toUpperCase(),path=url.pathname;
  if(path.startsWith('/functions/v1/'))return true;
  if(path.startsWith('/rest/v1/rpc/'))return path!=='/rest/v1/rpc/is_admin'||!['GET','POST','HEAD'].includes(method);
  if(['GET','HEAD','OPTIONS'].includes(method))return false;
  if(method==='POST'&&['/auth/v1/token','/auth/v1/logout'].includes(path))return false;
  return true;
 }
 const fetch=window.fetch.bind(window);
 window.fetch=(input,options)=>blocked(input,options)?Promise.resolve(new Response(JSON.stringify({code:'VH_PREVIEW_READ_ONLY',message}),{status:403,headers:{'Content-Type':'application/json'}})):fetch(input,options);
 const open=XMLHttpRequest.prototype.open,send=XMLHttpRequest.prototype.send,requests=new WeakMap();
 XMLHttpRequest.prototype.open=function(method,url,...args){requests.set(this,{method,url});return open.call(this,method,url,...args)};
 XMLHttpRequest.prototype.send=function(...args){const request=requests.get(this);if(request&&blocked(request.url,request))throw new DOMException(message,'NotAllowedError');return send.apply(this,args)};
 const beacon=navigator.sendBeacon?.bind(navigator);
 if(beacon)navigator.sendBeacon=(url,data)=>blocked(url,{method:'POST'})?false:beacon(url,data);
 function notice(){const node=document.createElement('div');node.id='vh-cloudflare-preview-notice';node.setAttribute('role','status');node.textContent='Тест Cloudflare · запис у робочу базу та надсилання замовлень вимкнені';node.style.cssText='position:fixed;bottom:8px;left:8px;right:8px;z-index:2147483647;padding:8px 12px;background:#302219;color:#fff3df;border:1px solid #b7956d;font:12px/1.5 Arial,sans-serif;text-align:center;pointer-events:none';document.body.append(node)}
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',notice,{once:true});else notice();
})();
