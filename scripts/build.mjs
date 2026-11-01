import {readFile,writeFile,mkdir,rm} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('../',import.meta.url));
const output=process.argv.includes('--root')?root:path.join(root,'dist');
const files=JSON.parse(await readFile(path.join(root,'routes.json'),'utf8'));
const origin='https://vintazhka.com.ua';
const escape=value=>String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));

// Keep this function self-contained: it is embedded before the meta refresh.
export function destination(pathname,search='',hash=''){
  const prefix='/vintage.hedonista';
  let targetPath=pathname;
  if(targetPath===prefix)targetPath='/';
  else if(targetPath.startsWith(prefix+'/'))targetPath=targetPath.slice(prefix.length);
  targetPath=targetPath.replace(/\/index\.html$/i,'/').replace(/\.html$/i,'');
  const target=new URL('https://vintazhka.com.ua/');
  target.pathname=targetPath||'/';
  target.search=search;
  target.hash=hash;
  return target.href;
}

export function page(file){
  const fallback=file==='404.html'?origin+'/':destination('/'+file);
  const code='('+destination.toString()+')(location.pathname,location.search,location.hash)';
  return '<!doctype html>\n<html lang="uk"><head><meta charset="utf-8">'+
    '<meta name="viewport" content="width=device-width,initial-scale=1">'+
    '<title>Vintazhka — нова адреса магазину</title>'+
    '<link rel="canonical" href="'+escape(fallback)+'">'+
    '<script>location.replace('+code+');</script>'+
    '<meta http-equiv="refresh" content="0;url='+escape(fallback)+'">'+
    '<style>body{max-width:36rem;margin:15vh auto;padding:1.5rem;font:18px/1.6 system-ui;background:#f1e7d8;color:#211b15}a{color:inherit}</style>'+
    '</head><body><h1>Магазин переїхав</h1><p>Нова адреса Vintazhka — <a href="'+escape(fallback)+'">vintazhka.com.ua</a>.</p></body></html>\n';
}

if(!process.argv.includes('--import-only')){
  if(output!==root)await rm(output,{recursive:true,force:true});
  await mkdir(output,{recursive:true});
  for(const file of new Set([...files,'404.html'])){
    if(!/^(?:[\w.-]+\/)*[\w.-]+\.html$/.test(file)||file.includes('..'))throw Error('Invalid route: '+file);
    await mkdir(path.dirname(path.join(output,file)),{recursive:true});
    await writeFile(path.join(output,file),page(file));
  }
  await writeFile(path.join(output,'.nojekyll'),'');
  // Let crawlers read the redirects. The new site's sitemap stays on its domain.
  await writeFile(path.join(output,'robots.txt'),'User-agent: *\nAllow: /\n');
  await writeFile(path.join(output,'_headers'),'https://:project.pages.dev/*\n  X-Robots-Tag: noindex, nofollow\n\nhttps://:version.:project.pages.dev/*\n  X-Robots-Tag: noindex, nofollow\n');
  console.log('Generated '+new Set([...files,'404.html']).size+' redirect pages for '+origin);
}
