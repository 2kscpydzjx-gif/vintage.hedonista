import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {transformSync} from 'esbuild';

// Execute the actual deployment source with no database or provider connections.
const source=await readFile(new URL('../supabase/rollouts/2026-10-31-resend-domain/index.ts',import.meta.url),'utf8');
const javascript=transformSync(source.replace(/^import .*createClient.*;\n/,''),{loader:'ts',format:'cjs',target:'es2022'}).code;
const from='Vintage Hedonista <orders@vintazhka.com.ua>';
function fixture({env={},order={},queryError=false,providerError=false}={}){
 const variables={SUPABASE_URL:'https://db.invalid',SUPABASE_SERVICE_ROLE_KEY:'mock-service-key',RESEND_API_KEY:'mock-provider-key',TEST_MODE:'true',TEST_EMAIL:'control@example.test',ORDER_EMAIL_FROM:from,...env};
 const record={id:'11111111-1111-4111-8111-111111111111',email:'customer@example.test',customer_name:'<script>unsafe</script>',product_name:'Vintage item',amount:1500,status:'new',ttn:'12345',products:{name:'Vintage item',brand:'Example'},...order};
 const calls={deliveries:[],reads:0};
 let handler;
 const sandbox={Request,Response,console:{error(){}},Deno:{env:{get:key=>variables[key]},serve:fn=>{handler=fn}},createClient:(url,key)=>{
  assert.equal(url,variables.SUPABASE_URL);assert.equal(key,variables.SUPABASE_SERVICE_ROLE_KEY);
  const query={select:()=>query,eq:(column,id)=>{assert.equal(column,'id');assert.equal(id,record.id);return query},single:async()=>{calls.reads++;return {data:queryError?null:record,error:queryError?{message:'mock query failure'}:null}}};
  return {from:table=>{assert.equal(table,'orders');return query}};
 },fetch:async(url,options)=>{
  assert.equal(url,'https://api.resend.com/emails');assert.equal(options.method,'POST');
  calls.deliveries.push(JSON.parse(options.body));
  return new Response(JSON.stringify(providerError?{message:'mock rejection'}:{id:'mock-email-id'}),{status:providerError?429:200});
 }};
 vm.runInNewContext(javascript,sandbox);
 const run=async({method='POST',body={order_id:record.id}}={})=>{
  const response=await handler(new Request('https://function.invalid',{method,...(method==='OPTIONS'?{}:{body:JSON.stringify(body)})}));
  return {status:response.status,body:method==='OPTIONS'?null:await response.json()};
 };
 return {calls,run};
}
for(const status of ['new','confirmed','shipped','received','cancelled']){
 const f=fixture({order:{status}}),result=await f.run();
 assert.equal(result.status,200);assert.equal(result.body.test_mode,true);assert.equal(f.calls.deliveries.length,1);
 const mail=f.calls.deliveries[0];assert.equal(mail.from,from);assert.deepEqual(mail.to,['control@example.test']);assert.match(mail.subject,/^\[TEST\] /);
 assert.ok(!mail.html.includes('<script>unsafe</script>'));assert.match(mail.html,/&lt;script&gt;unsafe&lt;\/script&gt;/);
}
for(const env of [{TEST_EMAIL:''},{ORDER_EMAIL_FROM:'Wrong\r\nBcc: attacker@example.test'},{ORDER_EMAIL_FROM:'invalid'},{TEST_MODE:'false',ORDER_EMAIL_FROM:''},{TEST_MODE:'false',ORDER_EMAIL_FROM:'Vintage <onboarding@resend.dev>'}]){
 const f=fixture({env});assert.equal((await f.run()).status,500);assert.equal(f.calls.deliveries.length,0);
}
{
 const f=fixture({env:{ORDER_EMAIL_FROM:''}});assert.equal((await f.run()).status,200);
 assert.equal(f.calls.deliveries[0].from,'Vintage Hedonista <onboarding@resend.dev>');assert.deepEqual(f.calls.deliveries[0].to,['control@example.test']);
}
{
 const f=fixture({env:{TEST_MODE:'false'}});assert.equal((await f.run()).status,200);
 assert.deepEqual(f.calls.deliveries[0].to,['customer@example.test']);assert.ok(!f.calls.deliveries[0].subject.startsWith('[TEST]'));
}
{
 const f=fixture({order:{email:null}});assert.equal((await f.run()).body.skipped,true);assert.equal(f.calls.deliveries.length,0);
}
{
 const f=fixture();assert.equal((await f.run({method:'OPTIONS'})).status,200);assert.equal(f.calls.reads,0);
 assert.equal((await f.run({body:{}})).status,500);assert.equal(f.calls.deliveries.length,0);
}
{
 const f=fixture({queryError:true});assert.equal((await f.run()).status,500);assert.equal(f.calls.deliveries.length,0);
 const rejected=fixture({providerError:true});assert.equal((await rejected.run()).status,500);
}
console.log('PASS: deployment source uses the verified sender, preserves test routing and status templates, rejects invalid senders, and handles skip/error cases. No network or real email used.');
