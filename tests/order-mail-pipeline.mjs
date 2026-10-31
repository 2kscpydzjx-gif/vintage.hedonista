import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
import {createOrderEmailHandler} from '../supabase/functions/_shared/order-email-handler.mjs';
import {prepareMailDatabase,dummyHash,dummySecret} from './order-mail-db-fixture.mjs';

const sql=readFileSync(new URL('../supabase/migrations/202610280001_order_email_version.sql',import.meta.url),'utf8');
const activate=readFileSync(new URL('../supabase/rollouts/2026-10-31-resend-domain/activate-server-mail.sql',import.meta.url),'utf8');
const deactivate=readFileSync(new URL('../supabase/rollouts/2026-10-31-resend-domain/deactivate-server-mail.sql',import.meta.url),'utf8');
const db=new PGlite(),id='11111111-1111-4111-8111-111111111111';
try{
 await prepareMailDatabase(db);
 await db.exec("CREATE TABLE public.orders(id uuid PRIMARY KEY,status text NOT NULL,amount numeric,email text,customer_name text,product_name text,admin_note text,ttn text,user_id uuid); ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY; CREATE POLICY test_insert ON public.orders FOR INSERT TO anon WITH CHECK (true); GRANT INSERT ON public.orders TO anon;");
 await db.exec(sql);
 assert.equal((await db.query("SELECT tgenabled FROM pg_trigger WHERE tgname='zz_vh_order_email_webhook'")).rows[0].tgenabled,'D','preparation unexpectedly activated mail');
 await db.exec(activate);
 for(const role of ['anon','authenticated']){
  await db.exec('SET ROLE '+role);
  await assert.rejects(db.query('SELECT public.vh_order_email_webhook_secret_hash()'),/permission denied/);
  await assert.rejects(db.query('SELECT * FROM vault.decrypted_secrets'),/permission denied/);
  await assert.rejects(db.query('SELECT vh_private.enqueue_order_email()'),/permission denied/);
  await db.exec('RESET ROLE');
 }
 await db.exec('SET ROLE service_role');
 assert.equal((await db.query('SELECT public.vh_order_email_webhook_secret_hash() AS hash')).rows[0].hash,dummyHash);
 await db.exec('RESET ROLE');
 const deliveries=[],ids=new Map(),logs=[];
 const createClient=(url,key,options)=>{
  assert.equal(key,'service');assert.equal(options.db.schema,'public');
  return {
   rpc:async name=>{assert.equal(name,'vh_order_email_webhook_secret_hash');await db.exec('SET ROLE service_role');try{return {data:(await db.query('SELECT public.vh_order_email_webhook_secret_hash() AS hash')).rows[0].hash,error:null}}finally{await db.exec('RESET ROLE')}},
   from:table=>{assert.equal(table,'orders');let orderId;const q={select:()=>q,eq:(name,value)=>{assert.equal(name,'id');orderId=value;return q},maybeSingle:async()=>({data:(await db.query('SELECT * FROM public.orders WHERE id=$1',[orderId])).rows[0]||null,error:null})};return q}
  };
 };
 const variables={SUPABASE_URL:'https://example.invalid',SUPABASE_SERVICE_ROLE_KEY:'service',RESEND_API_KEY:'mock',TEST_MODE:'true',TEST_EMAIL:'sink@example.test',ORDER_EMAIL_FROM:'Vintazhka <orders@vintazhka.com.ua>',ORDER_EMAIL_REPLY_TO:'support@example.test'};
 const handler=createOrderEmailHandler({createClient,env:key=>variables[key],log:{info:(...args)=>logs.push(args),warn:(...args)=>logs.push(args)},fetch:async(url,options)=>{
  assert.equal(url,'https://api.resend.com/emails');const key=options.headers['Idempotency-Key'];
  if(!ids.has(key)){ids.set(key,'mail-'+ids.size);deliveries.push(JSON.parse(options.body))}
  return new Response(JSON.stringify({id:ids.get(key)}));
 }});
 const requests=async()=> (await db.query('SELECT * FROM public.test_mail_requests ORDER BY id')).rows;
 const dispatch=async row=>{
  assert.equal(row.url,'https://yffwjgwwkapdrpwyjwfp.supabase.co/functions/v1/resend-email');
  assert.equal(row.headers['X-VH-Webhook-Secret'],dummySecret);
  assert.deepEqual(Object.keys(row.body.record).sort(),['id','status','vh_email_version']);
  return handler(new Request(row.url,{method:'POST',headers:row.headers,body:JSON.stringify(row.body)}));
 };
 // The real SQL trigger runs as a result of an anonymous write allowed by RLS.
 await db.exec('SET ROLE anon');
 await db.query("INSERT INTO public.orders(id,status,amount,email,customer_name,product_name) VALUES($1,'new',1200,'private@example.test','Test buyer','Vintage item')",[id]);
 await db.exec('RESET ROLE');
 let queued=await requests();assert.equal(queued.length,1);assert.equal(queued[0].body.type,'INSERT');
 assert.equal((await dispatch(queued[0])).status,200);
 assert.equal(deliveries.length,1);assert.deepEqual(deliveries[0].to,['sink@example.test']);assert.equal(deliveries[0].reply_to,'support@example.test');assert.match(deliveries[0].subject,/прийнято — Vintazhka$/);
 assert.equal((await dispatch(queued[0])).status,200);assert.equal(deliveries.length,1,'provider idempotency identity changed on a duplicate event');
 await db.query("UPDATE public.orders SET admin_note='not a mail event' WHERE id=$1",[id]);assert.equal((await requests()).length,1);
 await db.query("UPDATE public.orders SET status='confirmed' WHERE id=$1",[id]);
 queued=await requests();assert.equal(queued.length,2);assert.equal(queued[1].body.old_record.status,'new');
 assert.equal((await dispatch(queued[1])).status,200);assert.equal(deliveries.length,2);assert.match(deliveries[1].subject,/підтверджено/);
 assert.equal((await dispatch(queued[0])).status,200);assert.equal(deliveries.length,2,'stale event was sent');
 await db.query("UPDATE public.orders SET status='shipped' WHERE id=$1",[id]);assert.equal((await requests()).length,2,'shipment without tracking queued a message');
 await db.query("UPDATE public.orders SET ttn='TRACK-123' WHERE id=$1",[id]);queued=await requests();assert.equal(queued.length,3);
 assert.equal((await dispatch(queued[2])).status,200);assert.match(deliveries[2].html,/TRACK-123/);
 await db.query("UPDATE public.orders SET ttn='TRACK-123' WHERE id=$1",[id]);assert.equal((await requests()).length,3);
 await db.query("UPDATE public.orders SET ttn='TRACK-456' WHERE id=$1",[id]);assert.equal((await requests()).length,4);
 await db.exec("SET test.mail_queue_failure='true'");
 await db.query("UPDATE public.orders SET status='cancelled' WHERE id=$1",[id]);
 assert.equal((await db.query('SELECT status FROM public.orders WHERE id=$1',[id])).rows[0].status,'cancelled','queue failure rolled back an accepted order change');
 assert.equal((await requests()).length,4);
 await db.exec("SET test.mail_queue_failure='false'");
 await db.exec('BEGIN');
 await db.query("INSERT INTO public.orders(id,status) VALUES('22222222-2222-4222-8222-222222222222','new')");
 await db.exec('ROLLBACK');assert.equal((await requests()).length,4,'rolled-back order left a queued mail');
 const snapshot=(await db.query('SELECT row_to_json(o)::text AS row FROM public.orders o ORDER BY id')).rows;
 await db.exec(sql);assert.deepEqual((await db.query('SELECT row_to_json(o)::text AS row FROM public.orders o ORDER BY id')).rows,snapshot);
 assert.equal((await db.query("SELECT tgenabled FROM pg_trigger WHERE tgname='zz_vh_order_email_webhook'")).rows[0].tgenabled,'O','reapply changed activation state');
 assert.equal((await db.query('SELECT count(*)::integer AS count FROM vault.secrets')).rows[0].count,1,'reapply rotated the credential');
 await db.exec(deactivate);
 await db.query("UPDATE public.orders SET status='confirmed' WHERE id=$1",[id]);
 assert.equal((await requests()).length,4,'deactivation left notifications enabled');
 assert.doesNotMatch(JSON.stringify(logs),/sink@example|private@example|Test buyer|11111111111111111111111111111111/);
 console.log('PASS: anonymous DB write -> real PostgreSQL trigger -> Vault hash authorization -> mail handler -> isolated provider; ACLs, minimal payload, test recipient, duplicate/stale events, status/tracking changes, queue failures and transaction rollback. No live database or real email used.');
}finally{await db.close()}
