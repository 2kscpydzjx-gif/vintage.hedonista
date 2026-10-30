/* Build only tracked public assets. Source files and CMS records are never rewritten. */
import {readFile,mkdir,writeFile,rm,readdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {transform} from 'esbuild';
import {configuredSite,launchSite,siteBase,rebaseSiteReferences,snapshotBase,localNavigation,robots} from './seo-deployment.mjs';
const root=fileURLToPath(new URL('../',import.meta.url)),out=path.join(root,'dist');
const publicDirs=['assets','admin','seo-product','seo-category','seo-subcategory','seo-article'];
const publicFile=file=>file.includes('/')?/\.(?:html|css|js|json|png|jpe?g|webp|avif|gif|svg|ico|woff2?|ttf|otf|mp4|webm)$/i.test(file)||/\/(?:OFL|LICENSE|NOTICE)\.txt$/i.test(file):/\.(?:html|css|js)$/.test(file)||['robots.txt','sitemap.xml','catalog-seo-content.json','.nojekyll'].includes(file);
async function files(dir=''){
 const result=[];for(const entry of await readdir(path.join(root,dir),{withFileTypes:true})){
  const file=path.posix.join(dir,entry.name);
  if(entry.isDirectory()&&(dir||publicDirs.includes(entry.name)))result.push(...await files(file));
  else if(entry.isFile()&&publicFile(file))result.push(file);
 }return result;
}
// The Vercel test project remains non-indexable even if its default deployment is production.
const preview=process.env.VERCEL_ENV==='preview'||process.env.VERCEL_PROJECT_ID==='prj_npe9JPYcE2zOAPUENtqSWZAy9kHA';
const sourceSite=configuredSite(new URL('../',import.meta.url));
// Explicit opt-in for the real domain; normal production builds keep the current site.
const domainBuild=process.argv.includes('--launch-domain');
const targetSite=siteBase(process.env.SITE_BASE_URL||((preview||domainBuild)?launchSite(new URL('../',import.meta.url)):sourceSite));
await rm(out,{recursive:true,force:true});await mkdir(out,{recursive:true});let before=0,after=0,count=0;
for(const file of await files()){
 let content=await readFile(path.join(root,file));
 if(/\.(?:html|js|json|xml|txt)$/.test(file)){
  let text=rebaseSiteReferences(content.toString(),sourceSite,targetSite);
  if(file.endsWith('.html'))text=localNavigation(snapshotBase(text,file),[targetSite,sourceSite]);
  if(file==='robots.txt')text=robots(targetSite);
  content=Buffer.from(text);
 }
 if(file.endsWith('.css')||file.endsWith('.js')){
  const result=await transform(content.toString(),{loader:file.endsWith('.css')?'css':'js',minifyWhitespace:true,minifySyntax:false,minifyIdentifiers:false,legalComments:'inline',target:'esnext',charset:'utf8'});
  before+=content.length;content=Buffer.from(result.code);after+=content.length;
 }
 if(preview&&file.endsWith('.html')){
  let html=content.toString().replace(/<meta\b[^>]*name=["']robots["'][^>]*>/gi,'');
  html=html.replace(/<head\b[^>]*>/i,'$&<meta name="robots" content="noindex,nofollow,noarchive">');content=Buffer.from(html);
 }
 if(preview&&file==='robots.txt')content=Buffer.from('User-agent: *\nDisallow: /\n');
 const dest=path.join(out,file);await mkdir(path.dirname(dest),{recursive:true});await writeFile(dest,content);count++;
}
console.log(JSON.stringify({files:count,scriptAndStyleBytes:{before,after,saved:before-after},preview,siteUrl:targetSite}));
