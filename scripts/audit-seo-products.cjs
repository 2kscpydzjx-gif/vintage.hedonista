#!/usr/bin/env node
// Read-only audit: compare published Supabase products with existing static SEO pages.
// Environment: SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY (public read-only access).
// Does not write to Supabase or GitHub.
const fs=require('node:fs');
const path=require('node:path');
const config=fs.readFileSync(path.resolve(__dirname,'..','config.js'),'utf8');
const url=config.match(/supabaseUrl\s*:\s*["']([^"']+)["']/)?.[1];
const key=config.match(/supabaseKey\s*:\s*["'](sb_publishable_[^"']+)["']/)?.[1];
if(!url||!key){console.error('Public Supabase settings missing in config.js');process.exit(1);}
if(!/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(url)){console.error('Unexpected Supabase URL');process.exit(1);}
async function main(){
 let offset=0,all=[];
 while(true){
  const endpoint=new URL(url.replace(/\/$/,'')+'/rest/v1/products');
  endpoint.searchParams.set('select','id,name,slug,status,price,brand,short_description,cover_image');
  endpoint.searchParams.set('status','in.(published,reserved,sold)');
  endpoint.searchParams.set('limit','1000');
  endpoint.searchParams.set('offset',String(offset));
  const response=await fetch(endpoint,{headers:{apikey:key,Authorization:'Bearer '+key}});
  if(!response.ok)throw Error('Supabase read failed: HTTP '+response.status);
  const rows=await response.json();
  if(!Array.isArray(rows))throw Error('Unexpected Supabase response');
  all.push(...rows);
  if(rows.length<1000)break;
  offset+=rows.length;
 }
 const root=path.resolve(__dirname,'..','seo-product');
 const missing=[],outdated=[],invalid=[];
 for(const p of all){
  if(!p.slug){invalid.push({id:p.id,reason:'Missing slug'});continue;}
  const file=path.join(root,encodeURIComponent(p.slug),'index.html');
  // Slugs may contain Unicode; existing files may use raw Unicode instead of encoded names.
  const rawFile=path.join(root,p.slug,'index.html');
  const actual=fs.existsSync(rawFile)?rawFile:fs.existsSync(file)?file:null;
  if(!actual){missing.push({id:p.id,slug:p.slug,status:p.status});continue;}
  const html=fs.readFileSync(actual,'utf8');
  if(!html.includes('id="productName"'))invalid.push({id:p.id,slug:p.slug,reason:'No static product title'});
  if(!html.includes('id="vh-static-product-jsonld"'))outdated.push({id:p.id,slug:p.slug,reason:'No static JSON-LD'});
 }
 const report={checked:all.length,missingCount:missing.length,invalidCount:invalid.length,outdatedCount:outdated.length,missing,invalid,outdated};
 const output=path.resolve(__dirname,'..','seo-audit-report.json');
 fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({checked:report.checked,missing:missing.length,invalid:invalid.length,outdated:outdated.length,report:'seo-audit-report.json'}));
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
