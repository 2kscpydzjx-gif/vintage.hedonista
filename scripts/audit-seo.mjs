import {readFileSync,existsSync} from 'node:fs';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const xml=readFileSync(join(root,'sitemap.xml'),'utf8');
const urls=[...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m=>m[1].replaceAll('&amp;','&'));
let errors=[];let checked=0;
for(const address of urls){
 const u=new URL(address);
 if(!/^\/vintage\.hedonista\/seo-(product|article)\//.test(u.pathname))continue;
 const path=decodeURIComponent(u.pathname.replace(/^\/vintage\.hedonista\//,'')); // URL is encoded, disk folder is Unicode
 const file=join(root,path);checked++;
 if(!existsSync(file)){errors.push('Missing: '+path);continue}
 const html=readFileSync(file,'utf8');
 const canonical=html.match(/<link rel="canonical" href="([^"]+)"/i)?.[1];
 if(canonical!==address)errors.push('Canonical mismatch: '+path);
 if(!/<h1\b[^>]*>[^<]+<\/h1>/i.test(html))errors.push('Missing H1: '+path);
 if(/<img\b[^>]*\balt="[^"]*"[^>]*\balt=/i.test(html))errors.push('Duplicate ALT: '+path);
 if(!/<base\b[^>]*id="vh-seo-base"/i.test(html))errors.push('Missing root base: '+path);
}
if(errors.length){console.error(errors.slice(0,30).join('\n'));process.exitCode=1}
else console.log(`SEO audit OK: ${checked} snapshot HTML files, canonical and H1 verified (${urls.length} sitemap URLs).`);
