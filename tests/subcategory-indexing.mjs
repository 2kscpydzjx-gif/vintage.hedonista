import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,writeFileSync,mkdirSync,copyFileSync,rmSync,readdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {subcategoryHasProducts,subcategoryIndexing} from '../scripts/subcategory-indexing.mjs';
const sub={id:'empty',category_id:'accessories',slug:'пояси',name:'Пояси'};
const product={id:'fixture',slug:'fixture-product',name:'Публічна річ',price:500,status:'published',category_id:'accessories',subcategory_id:'empty',brand:'Fixture',cover_image:'https://example.test/photo.webp',short_description:'Test copy',description:'Test description'};
for(const status of ['published','reserved','sold'])assert.equal(subcategoryHasProducts(sub,[{...product,status}]),true);
for(const p of [{...product,status:'draft'},{...product,category_id:'wrong'},{...product,subcategory_id:null},{...product,slug:''}])assert.equal(subcategoryHasProducts(sub,[p]),false);
const source='<html><head><meta name="robots" content="max-image-preview:large"></head><body><h1>Пояси</h1></body></html>';
const empty=subcategoryIndexing(source,false);assert.match(empty,/noindex,follow/);assert.ok(empty.includes('max-image-preview:large'));assert.equal(subcategoryIndexing(empty,false),empty);assert.equal(subcategoryIndexing(empty,true),source);assert.throws(()=>subcategoryIndexing('<main></main>',false),/head is missing/);
const root=fileURLToPath(new URL('../',import.meta.url)),work=mkdtempSync(join(tmpdir(),'vintazhka-subcategory-'));
try{
 mkdirSync(join(work,'scripts'));mkdirSync(join(work,'admin'));
 for(const file of readdirSync(root).filter(name=>name.endsWith('.html')))copyFileSync(join(root,file),join(work,file));
 for(const file of ['index.html','admin.html','cms-builder.html'])copyFileSync(join(root,'admin',file),join(work,'admin',file));
 for(const file of ['config.js','catalog-seo-content.json'])copyFileSync(join(root,file),join(work,file));
 for(const file of ['generate-sitemap.mjs','seo-editorial.mjs','product-routes.mjs','seo-head.mjs','app-icons.mjs','seo-deployment.mjs','subcategory-indexing.mjs','audit-seo.mjs','clean-urls.mjs','build-product-jsonld.cjs'])copyFileSync(join(root,'scripts',file),join(work,'scripts',file));
 const fixture=join(work,'fixture.json'),mock=join(work,'mock-fetch.mjs');
 writeFileSync(mock,`import {readFileSync} from 'node:fs';
 const data=JSON.parse(readFileSync(${JSON.stringify(fixture)},'utf8'));
 globalThis.fetch=async(url,options={})=>{if(options.method&&options.method!=='GET')throw Error('No writes allowed');const u=new URL(url),table=u.pathname.split('/').pop();let rows=data[table];if(!Array.isArray(rows))throw Error('Unexpected data request');if(table==='products')rows=rows.filter(p=>['published','reserved','sold'].includes(p.status));return new Response(JSON.stringify(rows),{status:200})};`);
 const base=readFileSync(join(root,'config.js'),'utf8').match(/siteUrl\s*:\s*['"]([^'"]+)/)[1];
 const emptyUrl=new URL('seo-subcategory/aksesuary/'+encodeURIComponent(sub.slug)+'/index.html',base).href;
 const emptyPage=join(work,'seo-subcategory/aksesuary',sub.slug,'index.html');
 function run(status){
  const data={products:[{...product,id:'always',slug:'always',subcategory_id:'stock'},...(status?[{...product,status}]:[]),{...product,id:'draft',slug:'draft-product',status:'draft'}],news:[],categories:[{id:'accessories',slug:'aksesuary',name:'Аксесуари'}],subcategories:[sub,{id:'stock',category_id:'accessories',slug:'bags',name:'Сумки'}],vh_catalog_seo_blocks:[],vh_seo_metadata:[]};
  writeFileSync(fixture,JSON.stringify(data));
  execFileSync(process.execPath,['--import',mock,join(work,'scripts/generate-sitemap.mjs')],{stdio:'pipe'});
  execFileSync(process.execPath,[join(work,'scripts/build-product-jsonld.cjs')],{stdio:'pipe'});
  execFileSync(process.execPath,[join(work,'scripts/audit-seo.mjs')],{stdio:'pipe'});
  return {xml:readFileSync(join(work,'sitemap.xml'),'utf8'),page:readFileSync(emptyPage,'utf8'),parent:readFileSync(join(work,'seo-category/aksesuary/index.html'),'utf8')};
 }
 let result=run(null);assert.ok(!result.xml.includes(emptyUrl));assert.match(result.page,/noindex,follow/);assert.ok(result.page.includes('<h1'));assert.ok(result.parent.includes(encodeURIComponent(sub.slug)),'Empty subcategory disappeared from navigation');
 // The audit must catch a missing directive even though the page is excluded.
 writeFileSync(emptyPage,subcategoryIndexing(result.page,true));assert.throws(()=>execFileSync(process.execPath,[join(work,'scripts/audit-seo.mjs')],{stdio:'pipe'}));
 for(const status of ['published','reserved','sold']){result=run(status);assert.ok(result.xml.includes(emptyUrl));assert.doesNotMatch(result.page,/noindex|data-vh-empty-subcategory/)}
 result=run('draft');assert.ok(!result.xml.includes(emptyUrl));assert.match(result.page,/noindex,follow/);
 // A wrongly indexed empty page must also fail the audit.
 writeFileSync(join(work,'sitemap.xml'),result.xml.replace('</urlset>','<url><loc>'+emptyUrl+'</loc></url></urlset>'));assert.throws(()=>execFileSync(process.execPath,[join(work,'scripts/audit-seo.mjs')],{stdio:'pipe'}));
 console.log('PASS: real generator and auditor handle empty/populated/draft/reserved/sold transitions, preserve Unicode URLs/navigation, and reject mismatched sitemap/noindex without network or database writes.');
}finally{rmSync(work,{recursive:true,force:true})}
