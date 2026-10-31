import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
import {prepareMailDatabase} from './order-mail-db-fixture.mjs';
const sql=readFileSync(new URL('../supabase/migrations/202610280001_order_email_version.sql',import.meta.url),'utf8');
const id='11111111-1111-4111-8111-111111111111';
for(const withTracking of [true,false]){
 const db=new PGlite();
 try{
  await prepareMailDatabase(db);
  await db.exec(`CREATE TABLE public.orders(id uuid PRIMARY KEY,status text NOT NULL,amount numeric,admin_note text${withTracking?',ttn text':''});INSERT INTO public.orders(id,status,amount) VALUES('${id}','new',1200)`);
  await db.exec(sql);
  const row=async()=> (await db.query('SELECT * FROM public.orders WHERE id=$1',[id])).rows[0];
  assert.equal(Number((await row()).vh_email_version),0);assert.equal((await row()).status,'new');assert.equal(Number((await row()).amount),1200);
  await db.query("UPDATE public.orders SET status='confirmed',vh_email_version=999 WHERE id=$1",[id]);assert.equal(Number((await row()).vh_email_version),1,'caller forged the event revision');
  await db.query("UPDATE public.orders SET admin_note='internal note',vh_email_version=999 WHERE id=$1",[id]);assert.equal(Number((await row()).vh_email_version),1,'unrelated write created an email event');
  await db.query("UPDATE public.orders SET status='cancelled' WHERE id=$1",[id]);await db.query("UPDATE public.orders SET status='confirmed' WHERE id=$1",[id]);assert.equal(Number((await row()).vh_email_version),3,'return to a prior status needs a new delivery identity');
  await db.exec(sql);assert.equal(Number((await row()).vh_email_version),3,'reapplying migration reset delivery history');
  await db.query("UPDATE public.orders SET status='shipped' WHERE id=$1",[id]);assert.equal(Number((await row()).vh_email_version),4);
  if(withTracking){await db.query("UPDATE public.orders SET ttn='TRACK-123' WHERE id=$1",[id]);assert.equal(Number((await row()).vh_email_version),5,'new tracking number on a shipped order must notify');await db.query("UPDATE public.orders SET ttn='TRACK-123' WHERE id=$1",[id]);assert.equal(Number((await row()).vh_email_version),5,'same tracking number created another event')}
  await db.query("INSERT INTO public.orders(id,status,amount,vh_email_version) VALUES('22222222-2222-4222-8222-222222222222','new',700,999)");const inserted=(await db.query("SELECT * FROM public.orders WHERE id='22222222-2222-4222-8222-222222222222'")).rows[0];assert.equal(Number(inserted.vh_email_version),1);assert.equal(Number(inserted.amount),700);
  assert.equal(Number((await row()).amount),1200,'migration changed order pricing');
 }finally{await db.close()}
}
console.log('PASS: PostgreSQL migration preserves existing rows/prices, is repeatable, assigns unforgeable event revisions, handles repeated status cycles and tracking corrections, and supports schemas without optional tracking columns. In-memory databases only.');
