// Public GET requests only. This script never changes store records or uploaded images.
import {readFile,writeFile,mkdir,rename} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {configuredSite,launchSite} from './seo-deployment.mjs';
import {merchantFeed,addProductImagesToSitemap} from './merchant-feed.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const settings=JSON.parse(await readFile(path.join(root,'scripts/merchant-settings.json'),'utf8'));
const config=await readFile(path.join(root,'config.js'),'utf8');
const sourceBase=configuredSite(new URL('../',import.meta.url)),siteUrl=launchSite(new URL('../',import.meta.url));
const fixture=process.argv.find(arg=>arg.startsWith('--fixture='))?.slice('--fixture='.length);
async function publicProducts(){
 const origin=config.match(/supabaseUrl\s*:\s*['"]([^'"]+)/)?.[1],key=config.match(/supabaseKey\s*:\s*['"]([^'"]+)/)?.[1];
 if(!origin||!key)throw Error('Missing public store configuration');
 const products=[];
 for(let offset=0;;offset+=1000){
  const url=new URL('/rest/v1/products',origin);
  url.search=new URLSearchParams({select:'id,slug,name,status,price,brand,size,color,condition,material,short_description,description,cover_image,product_images(image_url,sort_order),categories(name),subcategories(name)',status:'in.(published,reserved,sold)',order:'id',limit:'1000',offset:String(offset)});
  const response=await fetch(url,{headers:{apikey:key,'Accept-Profile':'public'},signal:AbortSignal.timeout(30000)});
  if(!response.ok)throw Error('Merchant public products read: HTTP '+response.status);
  const rows=await response.json();if(!Array.isArray(rows))throw Error('Unexpected product response');
  products.push(...rows);if(rows.length<1000)return products;
 }
}
const products=fixture?JSON.parse(await readFile(path.resolve(fixture),'utf8')):await publicProducts();
const result=merchantFeed(products,{siteUrl,settings});
const sitemap=addProductImagesToSitemap(await readFile(path.join(root,'sitemap.xml'),'utf8'),products,sourceBase,siteUrl);
// Prepare both documents before replacing artifacts. Failed reads keep the old feed.
for(const [file,content] of [['google-merchant.xml',result.xml],['sitemap.xml',sitemap]]){
 const target=path.join(root,file),temporary=target+'.tmp';await writeFile(temporary,content);await rename(temporary,target);
}
await mkdir(path.join(root,'work'),{recursive:true});
await writeFile(path.join(root,'work/merchant-report.json'),JSON.stringify(result.report,null,2)+'\n');
console.log(JSON.stringify({included:result.report.included,excluded:result.report.excluded.length,warnings:result.report.warnings.length,report:'work/merchant-report.json'}));
