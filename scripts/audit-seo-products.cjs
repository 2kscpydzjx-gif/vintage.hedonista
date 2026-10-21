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
  const response=await fetch(endpoint,{headers:{apikey:key,Authorization:'Bearer '+key,'Accept-Profile':'public'}});
  if(!response.ok){
   const body=(await response.text()).slice(0,800);
   console.error('Supabase request failed:',JSON.stringify({status:response.status,endpoint:endpoint.origin+endpoint.pathname,response:body}));
   throw Error('Supabase read failed: HTTP '+response.status);
  }
  const rows=await response.json();
  if(!Array.isArray(rows))throw Error('Unexpected Supabase response');
  all.push(...rows);
  if(rows.length<1000)break;
  offset+=rows.length;
 }
 const root=path.resolve(__dirname,'..','seo-product');
 const missing=[],outdated=[],invalid=[];
 const metadataRows=[];
 const normalize=s=>String(s??'').replace(/&nbsp;|&#160;|&#xA0;/gi,' ').replace(/&quot;/g,'"').replace(/&#(?:39|x27);/gi,"'").replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();
 const field=(html,id)=>{
  const tag=html.match(new RegExp('<[^>]+\\bid=["\\x27]'+id+'["\\x27][^>]*>([\\s\\S]*?)<\\/[^>]+>','i'));
  return tag?normalize(tag[1]):null;
 };
 const imgSrc=html=>{
  const tag=html.match(/<img\b[^>]*\bid=["']galleryMainImg["'][^>]*>/i);
  return tag?.[0].match(/\bsrc=["']([^"']+)["']/i)?.[1]||null;
 };
 const add=(p,field,expected,actual)=>outdated.push({id:p.id,slug:p.slug,field,expected,actual});
 for(const p of all){
  if(!p.slug||p.slug==='.'||p.slug==='..'||p.slug.includes('/')||p.slug.includes('\\')){invalid.push({id:p.id,reason:'Missing or unsafe slug'});continue;}
  const file=path.join(root,encodeURIComponent(p.slug),'index.html');
  const rawFile=path.join(root,p.slug,'index.html');
  const actual=fs.existsSync(rawFile)?rawFile:fs.existsSync(file)?file:null;
  if(!actual){missing.push({id:p.id,slug:p.slug,status:p.status});continue;}
  const html=fs.readFileSync(actual,'utf8');
  const readTag=(re)=>html.match(re)?.[1]?.trim()||'';
  metadataRows.push({slug:p.slug,
   title:readTag(/<title[^>]*>([^<]*)<\/title>/i),
   description:readTag(/<meta\s+name=["']description["']\s+content=["']([^"']*)/i),
   canonical:readTag(/<link\s+rel=["']canonical["']\s+href=["']([^"']*)/i)
  });
  const name=field(html,'productName');
  if(name===null){invalid.push({id:p.id,slug:p.slug,reason:'No static product title'});continue;}
  if(normalize(p.name)!==name)add(p,'name',normalize(p.name),name);
  const priceText=field(html,'productPrice');
  const price=priceText?.replace(/\s/g,'').replace(',','.').match(/\d+(?:\.\d+)?/)?.[0];
  if(priceText!==null&&Number.isFinite(Number(p.price))&&price!==undefined&&Number(price)!==Number(p.price))add(p,'price',String(p.price),price);
  const brand=field(html,'productBrandFact');
  if(brand!==null&&normalize(p.brand||'')!==normalize(brand==='—'?'':brand))add(p,'brand',normalize(p.brand||''),brand);
  const cover=imgSrc(html);
  if(p.cover_image&&cover&&normalize(p.cover_image)!==normalize(cover))add(p,'cover_image',String(p.cover_image),cover);
  const short=field(html,'productShortDescription');
  if(short!==null&&p.short_description&&normalize(p.short_description)!==short)add(p,'short_description',normalize(p.short_description),short);
  const jsonBlock=html.match(/<script\b(?=[^>]*\bid=["']vh-static-product-jsonld["'])[^>]*>([\s\S]*?)<\/script>/i);
  if(!jsonBlock){invalid.push({id:p.id,slug:p.slug,reason:'No static Product JSON-LD'});continue;}
  try{
   const schema=JSON.parse(jsonBlock[1]);
   if(schema['@type']!=='Product')invalid.push({id:p.id,slug:p.slug,reason:'Incorrect JSON-LD type'});
   if(normalize(schema.name)!==normalize(p.name))add(p,'jsonld.name',normalize(p.name),normalize(schema.name));
   if(schema.offers?.price!==undefined&&Number(schema.offers.price)!==Number(p.price))add(p,'jsonld.price',String(p.price),String(schema.offers.price));
   if(p.cover_image&&schema.image?.length&&normalize(schema.image[0])!==normalize(p.cover_image))add(p,'jsonld.image',String(p.cover_image),String(schema.image[0]));
  }catch(e){invalid.push({id:p.id,slug:p.slug,reason:'Invalid Product JSON-LD: '+e.message});}
 }
 const metadataIssues=[];
 for(const fieldName of ['title','description','canonical']){
  const grouped=new Map();
  for(const row of metadataRows){
   const value=row[fieldName];
   if(!value){metadataIssues.push({field:fieldName,reason:'missing',slug:row.slug});continue;}
   const key=fieldName==='canonical'?value:normalize(value).toLowerCase();
   if(!grouped.has(key))grouped.set(key,[]);
   grouped.get(key).push(row.slug);
  }
  for(const [value,slugs] of grouped)if(slugs.length>1)metadataIssues.push({field:fieldName,reason:'duplicate',value,slugs});
 }
 const affected=new Set(outdated.map(x=>x.id)).size;
 const report={checked:all.length,missingCount:missing.length,invalidCount:invalid.length,outdatedCount:affected,outdatedFields:outdated.length,missing,invalid,outdated,metadataIssuesCount:metadataIssues.length,metadataIssues};
 const output=path.resolve(__dirname,'..','seo-audit-report.json');
 fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({checked:report.checked,missing:missing.length,invalid:invalid.length,outdatedProducts:affected,outdatedFields:outdated.length,metadataIssues:metadataIssues.length,report:'seo-audit-report.json'}));
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
