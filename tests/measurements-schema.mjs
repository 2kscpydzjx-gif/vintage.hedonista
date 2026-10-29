import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
const sql=readFileSync(new URL('../supabase/migrations/202610290001_product_measurements.sql',import.meta.url),'utf8');
const db=new PGlite();try{
 await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE SCHEMA auth;
 CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$ SELECT current_setting('request.jwt.claim.role',true) $$;
 CREATE FUNCTION public.is_admin() RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT coalesce(current_setting('request.jwt.claim.sub',true),'')='admin' $$;
 GRANT USAGE ON SCHEMA auth TO anon, authenticated;
 CREATE TABLE public.products(id text PRIMARY KEY,name text,price numeric,measurement_chest text,measurement_length text,measurement_waist text);
 INSERT INTO public.products VALUES('legacy','Костюм',1800,' 54 см ','72 см','35–40 см');
 ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
 CREATE POLICY public_read ON public.products FOR SELECT USING(true);
 CREATE POLICY deliberately_broad_update ON public.products FOR UPDATE TO authenticated USING(true) WITH CHECK(true);
 GRANT SELECT ON public.products TO anon, authenticated; GRANT UPDATE ON public.products TO authenticated;`);
 const original=(await db.query('SELECT * FROM public.products')).rows[0],policies=(await db.query("SELECT * FROM pg_policies WHERE tablename='products' ORDER BY policyname")).rows;
 await db.exec(sql);await db.exec(sql);
 const migrated=(await db.query('SELECT * FROM public.products')).rows[0];assert.equal(migrated.measurements_v2,null);delete migrated.measurements_v2;assert.deepEqual(migrated,original);assert.deepEqual((await db.query("SELECT * FROM pg_policies WHERE tablename='products' ORDER BY policyname")).rows,policies);
 const data={version:1,layout:'list',showLegacy:false,groups:[{id:'list',title:'Заміри',fields:[{id:'length',label:'Довжина жакета',value:'62 см'},{id:'skirt-length',label:'Довжина спідниці',value:'74 см'}]}]};
 const rpc=(expected,next)=>db.query('SELECT public.vh_save_product_measurements($1,$2::jsonb,$3::jsonb) AS saved',['legacy',expected==null?null:JSON.stringify(expected),next==null?null:JSON.stringify(next)]);
 await db.exec("SET ROLE anon; SET request.jwt.claim.role='anon';");await assert.rejects(()=>rpc(null,data),e=>e.code==='42501');
 await db.exec("RESET ROLE; SET ROLE authenticated; SET request.jwt.claim.role='authenticated'; SET request.jwt.claim.sub='customer';");await assert.rejects(()=>rpc(null,data),e=>e.code==='42501');await assert.rejects(()=>db.query("UPDATE public.products SET measurements_v2=$1::jsonb WHERE id='legacy'",[JSON.stringify(data)]),e=>e.code==='42501');
 await db.exec("SET request.jwt.claim.sub='admin';");
 for(const invalid of [{}, {...data,version:2},{...data,groups:[{...data.groups[0],fields:[{id:'x',label:'',value:'Filled'}]}]}])await assert.rejects(()=>rpc(null,invalid),e=>e.code==='22023');
 const saved=(await rpc(null,data)).rows[0].saved;assert.deepEqual(saved,{id:'legacy',measurements_v2:data});
 const changed=structuredClone(data);changed.groups[0].fields[0].value='63 см';await assert.rejects(()=>rpc(null,changed),e=>e.code==='40001');assert.deepEqual((await db.query("SELECT measurements_v2 FROM products WHERE id='legacy'")).rows[0].measurements_v2,data);
 assert.deepEqual((await rpc(data,changed)).rows[0].saved.measurements_v2,changed);
 const row=(await db.query("SELECT * FROM products WHERE id='legacy'")).rows[0];delete row.measurements_v2;assert.deepEqual(row,original,'RPC changed original product data');
 await db.exec("SET request.jwt.claim.sub='customer';");await assert.rejects(()=>db.query("UPDATE public.products SET measurements_v2=NULL WHERE id='legacy'"),e=>e.code==='42501');
 await db.exec("RESET ROLE; SET ROLE anon; SET request.jwt.claim.role='anon';");assert.deepEqual((await db.query("SELECT measurements_v2 FROM products WHERE id='legacy'")).rows[0].measurements_v2,changed,'Anonymous storefront cannot read saved measurements');
 console.log('PASS: repeatable migration preserves all original data/policies; admin RPC persists only measurements, validates payloads, rejects stale writes; anon/customer cannot write even with broad old policies; public reads work. Isolated PostgreSQL only.');
}finally{await db.close()}
const incompatible=new PGlite();try{
 await incompatible.exec("CREATE TABLE public.products(id text,measurements_v2 text);INSERT INTO public.products VALUES('old','keep raw');");await assert.rejects(()=>incompatible.exec(sql));await incompatible.exec('ROLLBACK');assert.deepEqual((await incompatible.query('SELECT * FROM public.products')).rows,[{id:'old',measurements_v2:'keep raw'}]);
}finally{await incompatible.close()}
