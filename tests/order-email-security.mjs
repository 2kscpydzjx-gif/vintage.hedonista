import assert from 'node:assert/strict';
import {createOrderEmailHandler} from '../supabase/functions/_shared/order-email-handler.mjs';
import {createHash} from 'node:crypto';
const id='11111111-1111-4111-8111-111111111111',owner='22222222-2222-4222-8222-222222222222',other='33333333-3333-4333-8333-333333333333';
const secret='unit-test-only-webhook-secret-0123456789';
function fixture(overrides={}){
 const variables={SUPABASE_URL:'https://example.invalid',SUPABASE_ANON_KEY:'anon',SUPABASE_SERVICE_ROLE_KEY:'service',RESEND_API_KEY:'test-provider-key',TEST_MODE:'true',TEST_EMAIL:'sink@example.test',ORDER_EMAIL_WEBHOOK_SECRET:secret,ORDER_EMAIL_REPLY_TO:'support@example.test',...overrides.env};
 const order={id,user_id:owner,email:'private-recipient@example.test',customer_name:'<script>alert(1)</script>',product_name:'<img onerror="alert(1)">',amount:1200,status:'new',vh_email_version:1,ttn:'<b>tracking</b>',...overrides.order};
 const calls={auth:0,admin:0,reads:[],deliveries:[],logs:[],service:0,hashReads:0};
 const createClient=(url,key,options)=>{
  assert.equal(options.db.schema,'public');assert.equal(options.auth.persistSession,false);
  if(key==='anon')return {auth:{getUser:async token=>{calls.auth++;return {data:{user:token==='valid'?{id:overrides.user||owner}:null},error:token==='valid'?null:{message:'invalid'}}}},rpc:async name=>{calls.admin++;assert.equal(name,'is_admin');return {data:overrides.admin===true,error:overrides.adminError?{message:'internal database info'}:null}}};
  assert.equal(key,'service');calls.service++;
  return {rpc:async name=>{assert.equal(name,'vh_order_email_webhook_secret_hash');calls.hashReads++;return {data:overrides.missingHash?null:createHash('sha256').update(secret).digest('hex'),error:overrides.hashError?{message:'private config error'}:null}},from:table=>{assert.equal(table,'orders');const filters=[];const q={select:()=>q,eq:(k,v)=>{filters.push([k,v]);return q},maybeSingle:async()=>{calls.reads.push(filters);return {data:filters.every(([k,v])=>order[k]===v)?order:null,error:overrides.dbError?{message:'private internal details'}:null}}};return q}};
 };
 const handler=createOrderEmailHandler({createClient,env:key=>variables[key],log:{warn:(...args)=>calls.logs.push(args),info:(...args)=>calls.logs.push(args)},fetch:async(url,options)=>{assert.equal(url,'https://api.resend.com/emails');calls.deliveries.push({headers:options.headers,body:JSON.parse(options.body)});return new Response(JSON.stringify(overrides.providerError?{message:'private provider details'}:{id:'email'}),{status:overrides.providerError?429:200})}});
 const run=async({headers={},body={order_id:id},method='POST',raw}={})=>{const r=await handler(new Request('https://functions.example.test/resend-email',{method,headers,...(!['GET','OPTIONS'].includes(method)?{body:raw??JSON.stringify(body)}:{})}));return {status:r.status,headers:r.headers,body:await r.text()}};
 return {run,calls,variables};
}
const auth={authorization:'Bearer valid'},hook={'x-vh-webhook-secret':secret};
const event=(status='new',extra={})=>({schema:'public',table:'orders',type:'INSERT',record:{id,status,vh_email_version:1,email:'attacker@example.test'},...extra});
for(const headers of [{},{authorization:'Bearer forged'},{authorization:'Bearer anon'},{'x-vh-webhook-secret':'invalid'},{'x-vh-webhook-secret':'x'.repeat(40)}]){
 const f=fixture(),r=await f.run({headers});assert.equal(r.status,401);assert.equal(f.calls.service,0);assert.equal(f.calls.deliveries.length,0);
}
{
 const f=fixture();assert.equal((await f.run({method:'OPTIONS'})).status,204);const get=await f.run({method:'GET'});assert.equal(get.status,405);assert.equal(get.headers.get('allow'),'POST, OPTIONS');assert.equal(f.calls.auth,0);assert.equal(f.calls.service,0);
 for(const raw of ['{','null','[]'])assert.equal((await f.run({headers:auth,raw})).status,400);
 assert.equal((await f.run({headers:auth,raw:'x'.repeat(32769)})).status,413);assert.equal(f.calls.service,0);
}
{
 const f=fixture(),r=await f.run({headers:auth});assert.equal(r.status,200);assert.deepEqual(f.calls.reads[0],[['id',id],['user_id',owner]]);const mail=f.calls.deliveries[0];assert.deepEqual(mail.body.to,['sink@example.test']);assert.ok(mail.body.subject.startsWith('[TEST] '));assert.ok(!mail.body.html.includes('<script>'));assert.ok(!mail.body.html.includes('<img onerror='));assert.match(mail.body.html,/&lt;script&gt;/);assert.equal(r.headers.get('cache-control'),'no-store');assert.ok(!r.body.includes('recipient'));assert.ok(!r.body.includes('sink@example'));assert.ok(!r.body.includes('sent_to'));
}
{
 const f=fixture({user:other}),r=await f.run({headers:auth});assert.equal(r.status,404);assert.equal(f.calls.deliveries.length,0);
}
{
 const f=fixture({order:{status:'confirmed'}});assert.equal((await f.run({headers:auth})).status,403);assert.equal(f.calls.deliveries.length,0);
}
{
 const f=fixture({admin:true,user:other,order:{status:'shipped'}});assert.equal((await f.run({headers:auth})).status,200);assert.deepEqual(f.calls.reads[0],[['id',id]]);assert.match(f.calls.deliveries[0].body.html,/&lt;b&gt;tracking&lt;\/b&gt;/);
}
for(const variant of [{adminError:true},{dbError:true}]){
 const f=fixture(variant),r=await f.run({headers:auth});assert.equal(r.status,503);assert.equal(f.calls.deliveries.length,0);assert.ok(!r.body.includes('private'));if(variant.adminError)assert.equal(f.calls.service,0);
}
{
 const f=fixture();assert.equal((await f.run({headers:hook,body:event()})).status,200);assert.equal(f.calls.auth,0);assert.deepEqual(f.calls.deliveries[0].body.to,['sink@example.test']);const again=await f.run({headers:hook,body:event()});assert.equal(again.status,200);assert.equal(f.calls.deliveries[0].headers['Idempotency-Key'],f.calls.deliveries[1].headers['Idempotency-Key']);
}
for(const change of [{schema:'other'},{table:'customer_profiles'},{type:'DELETE'},{record:{id:'not-a-uuid',status:'new'}}]){
 const f=fixture();assert.equal((await f.run({headers:hook,body:event('new',change)})).status,400);assert.equal(f.calls.service,0);
}
{
 const f=fixture();assert.equal((await f.run({headers:hook,body:event('new',{type:'UPDATE',old_record:{status:'new',vh_email_version:1}})})).status,200);assert.equal(f.calls.reads.length,0);assert.equal((await f.run({headers:hook,body:event('confirmed')})).status,200);assert.equal(f.calls.deliveries.length,0);
}
for(const env of [{TEST_EMAIL:''},{TEST_MODE:'false'},{TEST_MODE:'false',ORDER_EMAIL_FROM:'Vintage <onboarding@resend.dev>'},{ORDER_EMAIL_FROM:'Bad\r\nFrom: injected@example.test'},{RESEND_API_KEY:''}]){
 const f=fixture({env});assert.equal((await f.run({headers:auth})).status,503);assert.equal(f.calls.deliveries.length,0);
}
{
 const f=fixture({env:{TEST_MODE:'false',ORDER_EMAIL_FROM:'Vintage Hedonista <orders@shop.example.test>'}});assert.equal((await f.run({headers:auth})).status,200);assert.deepEqual(f.calls.deliveries[0].body.to,['private-recipient@example.test']);assert.ok(!f.calls.deliveries[0].body.subject.startsWith('[TEST]'));
}
{
 const f=fixture({providerError:true}),r=await f.run({headers:auth});assert.equal(r.status,502);assert.ok(!r.body.includes('private'));assert.ok(!JSON.stringify(f.calls.logs).includes('private-recipient'));
}
{const a=fixture(),b=fixture({order:{vh_email_version:3}});await a.run({headers:auth});await b.run({headers:auth});assert.notEqual(a.calls.deliveries[0].headers['Idempotency-Key'],b.calls.deliveries[0].headers['Idempotency-Key'],'a later return to the same status was suppressed');const missing=fixture({order:{vh_email_version:undefined}});assert.equal((await missing.run({headers:auth})).status,503);assert.equal(missing.calls.deliveries.length,0);const stale=fixture({order:{vh_email_version:3}});await stale.run({headers:hook,body:event()});assert.equal(stale.calls.deliveries.length,0)}
{const f=fixture({order:{status:'shipped',vh_email_version:2}});const body=event('shipped',{type:'UPDATE',record:{id,status:'shipped',vh_email_version:2},old_record:{status:'shipped',vh_email_version:1}});assert.equal((await f.run({headers:hook,body})).status,200);assert.equal(f.calls.deliveries.length,1,'tracking correction event was lost')}
{const f=fixture({admin:true,order:{status:'shipped',ttn:null}});assert.equal((await f.run({headers:auth})).status,200);assert.equal(f.calls.deliveries.length,0,'shipped email was sent without tracking')}
for(const status of ['new','confirmed','shipped','received','cancelled']){const f=fixture({admin:true,order:{status},env:{ORDER_EMAIL_FROM:'Vintage Hedonista <orders@vintazhka.com.ua>'}});assert.equal((await f.run({headers:auth})).status,200);const mail=f.calls.deliveries[0].body;assert.equal(mail.from,'Vintazhka <orders@vintazhka.com.ua>');assert.match(mail.subject,/— Vintazhka$/);assert.match(mail.html,/>VINTAZHKA</);assert.match(mail.html,/команда Vintazhka/);assert.doesNotMatch(mail.html,/vintage hedonista/i)}
{
 const f=fixture({env:{ORDER_EMAIL_WEBHOOK_SECRET:''}});
 assert.equal((await f.run({headers:hook,body:event()})).status,200);
 assert.equal(f.calls.hashReads,1);assert.equal(f.calls.service,1);assert.equal(f.calls.deliveries.length,1);
 const bad=fixture({env:{ORDER_EMAIL_WEBHOOK_SECRET:''}});
 assert.equal((await bad.run({headers:{'x-vh-webhook-secret':'x'.repeat(64)},body:event()})).status,401);
 assert.equal(bad.calls.reads.length,0);assert.equal(bad.calls.deliveries.length,0);
 for(const issue of [{hashError:true},{missingHash:true}]){
  const unavailable=fixture({...issue,env:{ORDER_EMAIL_WEBHOOK_SECRET:''}});
  assert.equal((await unavailable.run({headers:hook,body:event()})).status,503);
  assert.equal(unavailable.calls.reads.length,0);assert.equal(unavailable.calls.deliveries.length,0);
 }
}
console.log('PASS: verified JWT/ownership/admin access, secret-authenticated guest webhooks, explicit public schema, bounded requests, safe sender/test routing, redacted responses, escaped templates and provider idempotency. No network or real email used.');
for(const env of [
 {ORDER_EMAIL_REPLY_TO:'support@example.test\r\nBcc: attacker@example.test'},
 {ORDER_EMAIL_REPLY_TO:'invalid'},
 {TEST_MODE:'false',ORDER_EMAIL_FROM:'Vintazhka <orders@shop.example.test>',ORDER_EMAIL_REPLY_TO:''}
]){
 const f=fixture({env});assert.equal((await f.run({headers:auth})).status,503);assert.equal(f.calls.deliveries.length,0);
}
{
 const f=fixture({env:{ORDER_EMAIL_REPLY_TO:'  support@example.test  '}});assert.equal((await f.run({headers:auth})).status,200);
 assert.equal(f.calls.deliveries[0].body.reply_to,'support@example.test');
 assert.deepEqual(f.calls.deliveries[0].body.to,['sink@example.test']);
 assert.ok(!JSON.stringify(f.calls.logs).includes('support@example.test'));
 const staging=fixture({env:{ORDER_EMAIL_REPLY_TO:''}});assert.equal((await staging.run({headers:auth})).status,200);
 assert.equal(Object.hasOwn(staging.calls.deliveries[0].body,'reply_to'),false,'empty Reply-To sent to provider');
 const live=fixture({env:{TEST_MODE:'false',ORDER_EMAIL_FROM:'Vintazhka <orders@shop.example.test>'}});assert.equal((await live.run({headers:auth})).status,200);
 assert.equal(live.calls.deliveries[0].body.reply_to,'support@example.test');assert.deepEqual(live.calls.deliveries[0].body.to,['private-recipient@example.test']);
}
console.log('PASS: Reply-To goes to the configured support inbox, preserves test/customer recipients, rejects invalid/header-injected values, and is required before customer delivery. No network or real email used.');
