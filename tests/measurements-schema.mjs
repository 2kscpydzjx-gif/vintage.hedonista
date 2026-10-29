import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
const sql=readFileSync(new URL('../supabase/migrations/202610290001_product_measurements.sql',import.meta.url),'utf8');
const db=new PGlite();try{
 await db.exec("CREATE TABLE public.products(id text PRIMARY KEY,name text,price numeric,measurement_chest text,measurement_length text,measurement_waist text);INSERT INTO public.products VALUES('legacy','Костюм',1800,' 54 см ','72 см','35–40 см');");
 const original=(await db.query('SELECT * FROM public.products')).rows[0];await db.exec(sql);await db.exec(sql);
 const migrated=(await db.query('SELECT * FROM public.products')).rows[0];assert.equal(migrated.measurements_v2,null);delete migrated.measurements_v2;assert.deepEqual(migrated,original);
 const data={version:1,showLegacy:true,groups:[{id:'top',title:'Жакет',fields:[{id:'length',label:'Довжина',value:'62 см'}]},{id:'bottom',title:'Спідниця',fields:[{id:'length',label:'Довжина',value:'74 см'}]}]};
 await db.query('UPDATE public.products SET measurements_v2=$1::jsonb WHERE id=$2 AND measurements_v2 IS NULL',[JSON.stringify(data),'legacy']);
 const changed={...data,showLegacy:false};const stale=await db.query("UPDATE public.products SET measurements_v2=$1::jsonb WHERE id='legacy' AND measurements_v2 IS NULL RETURNING id",[JSON.stringify(changed)]);assert.equal(stale.rows.length,0);
 const current=await db.query("UPDATE public.products SET measurements_v2=$1::jsonb WHERE id='legacy' AND measurements_v2=$2::jsonb RETURNING *",[JSON.stringify(changed),JSON.stringify(data)]);assert.equal(current.rows.length,1);
 const row=current.rows[0];assert.equal(row.measurement_chest,original.measurement_chest);assert.equal(row.measurement_length,original.measurement_length);assert.equal(row.measurement_waist,original.measurement_waist);assert.equal(row.price,original.price);
 console.log('PASS: additive/repeatable JSONB migration preserves every legacy row/value and compare-and-set rejects stale structured writes. Isolated PostgreSQL only.');
}finally{await db.close()}
const incompatible=new PGlite();try{
 await incompatible.exec("CREATE TABLE public.products(id text,measurements_v2 text);INSERT INTO public.products VALUES('old','keep raw');");await assert.rejects(()=>incompatible.exec(sql));await incompatible.exec('ROLLBACK');assert.deepEqual((await incompatible.query('SELECT * FROM public.products')).rows,[{id:'old',measurements_v2:'keep raw'}]);
}finally{await incompatible.close()}
