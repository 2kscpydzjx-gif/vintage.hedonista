// Local Pages fixture: first matching _redirects rule, then native HTML paths.
// 200 rewrites serve the target file while leaving the browser URL unchanged.
const fs=require('node:fs'),path=require('node:path');
function pagesHandler(dist,png){
 const rules=fs.readFileSync(path.join(dist,'_redirects'),'utf8').trim().split('\n').filter(Boolean).map(line=>{
  const [source,target,status]=line.split(/\s+/),keys=[];
  const pattern=source.split('/').map(part=>part.startsWith(':')?(keys.push(part.slice(1)),'([^/]+)'):part.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('/');
  return {pattern:new RegExp('^'+pattern+'$'),target,status:Number(status),keys};
 });
 return (request,response)=>{
  let url=new URL(request.url,'http://preview.local'),rewritten=false;
  for(const rule of rules){
   const match=url.pathname.match(rule.pattern);if(!match)continue;
   const values=Object.fromEntries(rule.keys.map((key,i)=>[key,match[i+1]]));
   const target=new URL(rule.target.replace(/:([a-z]+)/g,(_,key)=>values[key]),url);
   for(const [key,value] of url.searchParams)if(!target.searchParams.has(key))target.searchParams.append(key,value);
   if(rule.status!==200){response.writeHead(rule.status,{Location:target.pathname+target.search});return response.end()}
   url=target;rewritten=true;break;
  }
  const canonical=url.pathname.replace(/\/index\.html$/,'/').replace(/\.html$/,'');
  if(!rewritten&&canonical!==url.pathname){response.writeHead(301,{Location:canonical+url.search});return response.end()}
  let relative;try{relative=decodeURIComponent(url.pathname).replace(/^\//,'')}catch{response.writeHead(400);return response.end()}
  const file=path.resolve(dist,relative.endsWith('/')||!relative?relative+'index.html':/\.[^/]+$/.test(relative)?relative:relative+'.html');
  const found=file.startsWith(dist+path.sep)&&fs.existsSync(file)&&fs.statSync(file).isFile();
  const types={'.html':'text/html; charset=utf-8','.js':'application/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.woff2':'font/woff2','.webp':'image/webp','.png':'image/png','.webmanifest':'application/manifest+json','.pdf':'application/pdf','.ico':'image/x-icon'};
  if(relative==='assets/test-upload.png'){response.writeHead(200,{'Content-Type':'image/png'});return response.end(png)}
  response.writeHead(found?200:404,{'Content-Type':found?(types[path.extname(file)]||'application/octet-stream'):'text/html; charset=utf-8'});response.end(fs.readFileSync(found?file:path.join(dist,'404.html')));
 };
}
module.exports={pagesHandler};
