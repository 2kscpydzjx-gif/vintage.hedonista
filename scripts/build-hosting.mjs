/* Build only tracked public assets. Source files and CMS records are never rewritten. */
import {readFile,mkdir,writeFile,rm,readdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {transform} from 'esbuild';
import {configuredSite,launchSite,siteBase,rebaseSiteReferences,snapshotBase,localNavigation,robots,prettySiteReferences} from './seo-deployment.mjs';
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
const cloudflare=process.env.CF_PAGES==='1'||process.argv.includes('--cloudflare-test');
const cloudflarePreview=cloudflare&&(process.argv.includes('--cloudflare-test')||process.env.CF_PAGES_BRANCH!==(process.env.VH_PRODUCTION_BRANCH||'main'));
const preview=cloudflarePreview||process.env.VERCEL_ENV==='preview'||process.env.VERCEL_PROJECT_ID==='prj_npe9JPYcE2zOAPUENtqSWZAy9kHA';
const sourceSite=configuredSite(new URL('../',import.meta.url));
// Explicit opt-in for the real domain; normal production builds keep the current site.
const domainBuild=process.argv.includes('--launch-domain');
const targetSite=siteBase(process.env.SITE_BASE_URL||((preview||domainBuild)?launchSite(new URL('../',import.meta.url)):sourceSite));
const publicConfig=await readFile(path.join(root,'config.js'),'utf8');
const supabaseOrigin=new URL(publicConfig.match(/supabaseUrl\s*:\s*['"]([^'"]+)/)[1]).origin;
const previewGuard=cloudflarePreview?await readFile(path.join(root,'preview-readonly.js'),'utf8'):'';
await rm(out,{recursive:true,force:true});await mkdir(out,{recursive:true});let before=0,after=0,count=0;
for(const file of await files()){
 let content=await readFile(path.join(root,file));
 if(/\.(?:html|js|json|xml|txt)$/.test(file)){
  let text=rebaseSiteReferences(content.toString(),sourceSite,targetSite);
  if(cloudflare)text=prettySiteReferences(text,targetSite);
  if(file.endsWith('.html'))text=localNavigation(snapshotBase(text,file),[targetSite,sourceSite]);
  if(file==='config.js'&&cloudflare)text+='\nwindow.VH_CONFIG.prettyUrls=true;\n';
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
 if(cloudflarePreview&&file.endsWith('.html')){
  const html=content.toString(),guard='<script>window.VH_DEPLOYMENT='+JSON.stringify({readOnlyData:true,supabaseOrigin})+';'+previewGuard+'</script>';
  content=Buffer.from(html.replace(/<meta\b[^>]*charset=[^>]*>/i,match=>match+guard));
 }
 const dest=path.join(out,file);await mkdir(path.dirname(dest),{recursive:true});await writeFile(dest,content);count++;
}
if(cloudflare){
 const headers='/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: strict-origin-when-cross-origin\n'+(cloudflarePreview?'  X-Robots-Tag: noindex, nofollow, noarchive\n':'')+'\nhttps://:project.pages.dev/*\n  X-Robots-Tag: noindex, nofollow, noarchive\n\nhttps://:version.:project.pages.dev/*\n  X-Robots-Tag: noindex, nofollow, noarchive\n';
 await writeFile(path.join(out,'_headers'),headers);
}
console.log(JSON.stringify({files:count,scriptAndStyleBytes:{before,after,saved:before-after},preview,cloudflare,readOnlyData:cloudflarePreview,siteUrl:targetSite}));
