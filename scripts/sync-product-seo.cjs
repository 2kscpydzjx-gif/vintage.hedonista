#!/usr/bin/env node
// Portable Supabase -> existing static SEO HTML synchronization.
// Dry run by default. --write updates ONLY existing pages and known product fields.
// No GitHub API, credentials with write access, or deployment dependency.
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const config=fs.readFileSync(path.join(root,'config.js'),'utf8');
const url=process.env.SUPABASE_URL||config.match(/supabaseUrl\s*:\s*["']([^"']+)["']/)?.[1];
const key=process.env.SUPABASE_PUBLISHABLE_KEY||config.match(/supabaseKey\s*:\s*["'](sb_publishable_[^"']+)["']/)?.[1];
const write=process.argv.includes('--write');
if(!url||!key||!/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(url)){console.error('Missing or invalid public Supabase configuration');process.exit(1);}
const escapeHTML=s=>String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const decode=s=>String(s??'').replace(/&quot;/g,'"').replace(/&#(?:39|x27);/gi,"'").replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>');
const strip=s=>decode(s.replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim());
const getField=(html,id)=>{const m=html.match(new RegExp('(<[^>]+\\bid=["\\x27]'+id+'["\\x27][^>]*>)([\\s\\S]*?)(<\\/[^>]+>)','i'));return m?strip(m[2]):null;};
const replaceField=(html,id,value)=>{
 const re=new RegExp('(<[^>]+\\bid=["\\x27]'+id+'["\\x27][^>]*>)([\\s\\S]*?)(<\\/[^>]+>)','i');
 return re.test(html)?html.replace(re,(_,a,b,c)=>a+escapeHTML(value)+c):html;
};
async function products(){
 let all=[];
 while(true){
  const u=new URL(url.replace(/\/$/,'')+'/rest/v1/products');
  u.searchParams.set('select','id,name,slug,status,price,brand,short_description,cover_image');
  u.searchParams.set('status','in.(published,reserved,sold)');
  u.searchParams.set('limit','1000');u.searchParams.set('offset',String(all.length));
  const res=await fetch(u,{headers:{apikey:key,Authorization:'Bearer '+key,'Accept-Profile':'public'}});
  if(!res.ok)throw Error('Supabase read failed: HTTP '+res.status);
  const batch=await res.json();if(!Array.isArray(batch))throw Error('Unexpected Supabase response');
  all.push(...batch);if(batch.length<1000)break;
 }
 return all;
}
async function main(){
 const all=await products(),changed=[],missing=[],skipped=[],differences=[];
 for(const p of all){
  if(!p.slug||p.slug==='.'||p.slug==='..'||/[\/\\]/.test(p.slug)){skipped.push({id:p.id,reason:'Invalid slug'});continue;}
  const base=path.join(root,'seo-product');
  const raw=path.join(base,p.slug,'index.html'),encoded=path.join(base,encodeURIComponent(p.slug),'index.html');
  const file=fs.existsSync(raw)?raw:fs.existsSync(encoded)?encoded:null;
  if(!file){missing.push(p.slug);continue;}
  const original=fs.readFileSync(file,'utf8');let html=original;
  if(getField(html,'productName')===null){skipped.push({slug:p.slug,reason:'Missing productName'});continue;}
  html=replaceField(html,'productName',p.name);
  if(getField(html,'productPrice')!==null&&p.price!==null&&p.price!==undefined)html=replaceField(html,'productPrice',p.price+' грн');
  if(getField(html,'productBrandFact')!==null)html=replaceField(html,'productBrandFact',p.brand||'—');
  if(getField(html,'productShortDescription')!==null&&p.short_description!==null)html=replaceField(html,'productShortDescription',p.short_description);
  if(p.cover_image){
   html=html.replace(/(<img\b[^>]*\bid=["']galleryMainImg["'][^>]*\bsrc=["'])([^"']*)(["'])/i,(_,a,b,c)=>a+escapeHTML(p.cover_image)+c);
  }
  // Rebuild only our own static Product JSON-LD; preserve unrelated SEO tags.
  const jsonRe=/<script\b(?=[^>]*\bid=["']vh-static-product-jsonld["'])[^>]*>[\s\S]*?<\/script>/i;
  const existing=html.match(jsonRe);
  if(existing){
   const schema=JSON.parse(existing[0].replace(/^<script[^>]*>/i,'').replace(/<\/script>$/i,''));
   schema.name=p.name;
   if(p.short_description!==null)schema.description=p.short_description||'';
   if(p.brand)schema.brand={'@type':'Brand',name:p.brand};else delete schema.brand;
   if(p.cover_image)schema.image=[p.cover_image];
   if(p.price!==null&&p.price!==undefined){
    schema.offers={...(schema.offers||{}),'@type':'Offer',priceCurrency:'UAH',price:String(p.price),itemCondition:'https://schema.org/UsedCondition'};
   }
   const safe=JSON.stringify(schema).replace(/</g,'\\u003c');
   html=html.replace(jsonRe,'<script type="application/ld+json" id="vh-static-product-jsonld">'+safe+'</script>');
  }else{skipped.push({slug:p.slug,reason:'Missing static JSON-LD'});continue;}
  if(html!==original){
   const fields=[];
   const inspect=(field,before,after)=>{if(String(before??'')!==String(after??''))fields.push({field,before,after});};
   for(const [id,field] of [['productName','name'],['productPrice','price'],['productBrandFact','brand'],['productShortDescription','short_description']]){
    inspect(field,getField(original,id),getField(html,id));
   }
   const image=s=>decode(s.match(/<img\b[^>]*\bid=["']galleryMainImg["'][^>]*>/i)?.[0]?.match(/\bsrc=["']([^"']*)["']/i)?.[1]||'');
   inspect('cover_image',image(original),image(html));
   const schema=s=>{
    const match=s.match(/<script\b(?=[^>]*\bid=["']vh-static-product-jsonld["'])[^>]*>([\s\S]*?)<\/script>/i);
    return match?JSON.parse(match[1]):null;
   };
   const before=schema(original),after=schema(html);
   for(const [field,read] of [['jsonld.name',x=>x?.name],['jsonld.description',x=>x?.description],['jsonld.brand',x=>x?.brand?.name],['jsonld.image',x=>x?.image?.[0]],['jsonld.price',x=>x?.offers?.price]])inspect(field,read(before),read(after));
   if(fields.length){changed.push(p.slug);differences.push({id:p.id,slug:p.slug,fields});if(write)fs.writeFileSync(file,html);}
  }
 }
 const report={mode:write?'write':'dry-run',checked:all.length,changedCount:changed.length,missingCount:missing.length,skippedCount:skipped.length,changed,missing,skipped,differences};
 fs.writeFileSync(path.join(root,'seo-sync-report.json'),JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({mode:report.mode,checked:report.checked,changed:report.changedCount,missing:report.missingCount,skipped:report.skippedCount}));
 if(missing.length||skipped.length)process.exitCode=1;
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
