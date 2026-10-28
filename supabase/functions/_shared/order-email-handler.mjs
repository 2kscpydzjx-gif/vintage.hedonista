import { emailHtml, statusContent } from './order-email-template.mjs';

const statuses=new Set(['new','confirmed','shipped','received','cancelled']);
const uuid=value=>typeof value==='string'&&/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value);
const email=value=>typeof value==='string'&&/^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(value);
async function boundedText(request){
 const reader=request.body?.getReader();if(!reader)return '';
 const chunks=[];let size=0;
 try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>32768){await reader.cancel();throw Error('too_large')}chunks.push(value)}}finally{reader.releaseLock()}
 const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length}
 return new TextDecoder().decode(bytes);
}
async function equalSecret(left,right){
 if(!left||!right||left.length<32||right.length<32||left.length>512||right.length>512)return false;
 const hash=async value=>new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)));
 const [a,b]=await Promise.all([hash(left),hash(right)]);let different=0;
 for(let i=0;i<a.length;i++)different|=a[i]^b[i];return different===0;
}

/** Dependencies are injected so tests never access a real order or email provider. */
export function createOrderEmailHandler({createClient,env,fetch:send=globalThis.fetch,log=console}){
 return async request=>{
  const headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type, x-vh-webhook-secret','Access-Control-Allow-Methods':'POST, OPTIONS','Content-Type':'application/json','Cache-Control':'no-store'};
  const reply=(status,body,extra={})=>new Response(JSON.stringify(body),{status,headers:{...headers,...extra}});
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
  if(request.method!=='POST')return reply(405,{ok:false,error:'Method not allowed'},{Allow:'POST, OPTIONS'});
  if(Number(request.headers.get('content-length')||0)>32768)return reply(413,{ok:false,error:'Request too large'});
  let body;
  try{body=JSON.parse(await boundedText(request))}catch(error){return error?.message==='too_large'?reply(413,{ok:false,error:'Request too large'}):reply(400,{ok:false,error:'Invalid JSON'})}
  if(!body||typeof body!=='object'||Array.isArray(body))return reply(400,{ok:false,error:'Invalid request'});
  try{
   let owner=null,isAdmin=false,webhook=false;
   const hookHeader=request.headers.get('x-vh-webhook-secret');
   const url=env('SUPABASE_URL'),serviceKey=env('SUPABASE_SERVICE_ROLE_KEY'),anonKey=env('SUPABASE_ANON_KEY')||env('SUPABASE_PUBLISHABLE_KEY');
   if(!url||!serviceKey)return reply(503,{ok:false,error:'Email service unavailable'});
   if(hookHeader){
    if(!await equalSecret(hookHeader,env('ORDER_EMAIL_WEBHOOK_SECRET')))return reply(401,{ok:false,error:'Unauthorized'});
    webhook=true;
   }else{
    const authorization=request.headers.get('authorization');
    if(!authorization||!/^Bearer \S+$/i.test(authorization))return reply(401,{ok:false,error:'Unauthorized'});
    if(!anonKey)return reply(503,{ok:false,error:'Email service unavailable'});
    const caller=createClient(url,anonKey,{global:{headers:{Authorization:authorization}},db:{schema:'public'},auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
    const result=await caller.auth.getUser(authorization.replace(/^Bearer /i,''));
    if(result.error||!uuid(result.data?.user?.id))return reply(401,{ok:false,error:'Unauthorized'});
    owner=result.data.user.id;
    const check=await caller.rpc('is_admin');
    if(check.error)return reply(503,{ok:false,error:'Email service unavailable'});
    isAdmin=check.data===true;
   }
   let orderId=body.order_id;
   if(webhook){
    if(body.schema!=='public'||body.table!=='orders'||!['INSERT','UPDATE'].includes(body.type)||!body.record||!statuses.has(body.record.status)||!Number.isSafeInteger(body.record.vh_email_version)||body.record.vh_email_version<0)return reply(400,{ok:false,error:'Invalid order event'});
    if(body.type==='UPDATE'&&body.old_record?.vh_email_version===body.record.vh_email_version)return reply(200,{ok:true,skipped:true});
    orderId=body.record.id;
   }
   if(!uuid(orderId))return reply(400,{ok:false,error:'Invalid order ID'});
   // A service-role read happens only after a verified user or trusted webhook.
   // Customer requests additionally constrain the row to their verified user ID.
   const db=createClient(url,serviceKey,{db:{schema:'public'},auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
   let query=db.from('orders').select('*,products(name,brand,cover_image)').eq('id',orderId);
   if(!webhook&&!isAdmin)query=query.eq('user_id',owner);
   const {data:order,error}=await query.maybeSingle();
   if(error)return reply(503,{ok:false,error:'Email service unavailable'});
   if(!order)return reply(404,{ok:false,error:'Order not available'});
   if(!webhook&&!isAdmin&&order.status!=='new')return reply(403,{ok:false,error:'Status notifications require administrator access'});
   if(!statuses.has(order.status))return reply(400,{ok:false,error:'Unsupported order status'});
   if(!Number.isSafeInteger(order.vh_email_version)||order.vh_email_version<0)return reply(503,{ok:false,error:'Email service unavailable'});
   if(webhook&&(order.status!==body.record.status||order.vh_email_version!==body.record.vh_email_version))return reply(200,{ok:true,skipped:true});
   if(!order.email)return reply(200,{ok:true,skipped:true});
   const testMode=env('TEST_MODE')==='true';
   const recipient=testMode?env('TEST_EMAIL'):order.email;
   const from=env('ORDER_EMAIL_FROM')||(testMode?'Vintage Hedonista <onboarding@resend.dev>':'');
   const fromAddress=from.match(/<([^<>]+)>$/)?.[1]||from;
   if(!email(recipient)||!email(fromAddress)||/[\r\n]/.test(from)||(!testMode&&/onboarding@resend\.dev/i.test(from))||!env('RESEND_API_KEY'))return reply(503,{ok:false,error:'Email service unavailable'});
   // Resend deduplicates identical retries for 24 hours, including calls to the
   // legacy alias. This is not a substitute for durable database delivery state.
   const response=await send('https://api.resend.com/emails',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+env('RESEND_API_KEY'),'Idempotency-Key':'vh-order-'+String(order.id).toLowerCase()+'-'+order.vh_email_version},body:JSON.stringify({from,to:[recipient],subject:(testMode?'[TEST] ':'')+statusContent(order).subject,html:emailHtml(order)})});
   if(!response.ok){log.warn?.('Order email provider rejected delivery',{status:response.status});return reply(502,{ok:false,error:'Email delivery failed'})}
   return reply(200,{ok:true,test_mode:testMode});
  }catch{log.warn?.('Order email delivery failed');return reply(503,{ok:false,error:'Email service unavailable'})}
 };
}
