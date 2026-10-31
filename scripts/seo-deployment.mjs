import {readFileSync} from 'node:fs';

export function siteBase(value){
 const url=new URL(value);
 if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash||!url.pathname.endsWith('/'))throw Error('Site URL must be an HTTPS base URL ending in /, without credentials, query or hash');
 return url.href;
}
export function configuredSite(root){
 const config=readFileSync(new URL('config.js',root),'utf8');
 const value=config.match(/siteUrl\s*:\s*['"]([^'"]+)/)?.[1];
 if(!value)throw Error('Missing siteUrl in config.js');
 return siteBase(value);
}
export function launchSite(root){return siteBase(JSON.parse(readFileSync(new URL('launch-site.json',root),'utf8')).siteUrl)}
export function pageAddress(page,base){return new URL(page==='index.html'&&new URL(base).pathname==='/'?'':page,base).href}
export function prettyAddress(value){const url=new URL(value);url.pathname=url.pathname.replace(/\/index\.html$/,'/').replace(/\.html$/,'');return url.href}
export function prettySiteReferences(content,base){
 const escaped=base.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
 return content.replace(new RegExp(escaped+'[^\\s"\'<>`]*','g'),value=>prettyAddress(value));
}
export function rebaseSiteReferences(content,from,to){
 let result=content.replaceAll(from,to);
 if(new URL(to).pathname==='/')result=result.replaceAll(new URL('index.html',to).href,to);
 return result;
}
export function snapshotBase(html,file){
 if(!file.startsWith('seo-')||!file.endsWith('.html'))return html;
 // Assets/navigation stay on the host being viewed, including previews and subdirectories.
 const relative='../'.repeat(file.split('/').length-1);
 return html.replace(/<base\b(?=[^>]*\bid="vh-seo-base")[^>]*>/i,'<base id="vh-seo-base" href="'+relative+'">')
  .replace(/<script>if\(location\.hostname==="127\.0\.0\.1"\|\|location\.hostname==="localhost"\)\{document\.getElementById\("vh-seo-base"\)\.href=location\.origin\+"\/"\}<\/script>/g,'');
}
export function localNavigation(html,bases){
 return html.replace(/(<a\b[^>]*\bhref=")([^"]+)(")/gi,(all,start,href,end)=>{
  const base=bases.find(value=>href.startsWith(value));
  return base?start+(href.slice(base.length)||'./')+end:all;
 });
}
export function robots(base){return 'User-agent: *\nAllow: '+new URL(base).pathname+'\nDisallow: '+new URL('admin/',base).pathname+'\nSitemap: '+new URL('sitemap.xml',base).href+'\n'}
