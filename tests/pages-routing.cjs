// Exercise the same Pages asset handler/parser used by Wrangler, including
// rejected redirect rules and native HTML normalization after a 200 rewrite.
const assert=require('node:assert/strict');
process.env.WRANGLER_SEND_METRICS='false';
const {unstable_generateASSETSBinding}=require('wrangler');
async function pagesHandler(dist,png){
 const abort=new AbortController(),warnings=[];
 const fetch=await unstable_generateASSETSBinding({directory:dist,signal:abort.signal,log:{debug(){},log(){},info(){},warn:message=>warnings.push(String(message)),error:message=>warnings.push(String(message))}});
 if(warnings.length){abort.abort();assert.fail('Cloudflare rejected routing configuration: '+warnings.map(s=>s.slice(0,600)).join('\n'))}
 const handler=async(request,response)=>{
  try{
   const url=new URL(request.url,'http://'+request.headers.host);
   if(url.pathname==='/assets/test-upload.png'){response.writeHead(200,{'Content-Type':'image/png'});return response.end(png)}
   const init={method:request.method,headers:request.headers};
   if(!['GET','HEAD'].includes(request.method)){init.body=request;init.duplex='half'}
   const result=await fetch(new Request(url,init));
   response.writeHead(result.status,Object.fromEntries(result.headers));response.end(Buffer.from(await result.arrayBuffer()));
  }catch(error){response.writeHead(500,{'Content-Type':'text/plain'});response.end(String(error))}
 };
 handler.close=()=>abort.abort();
 return handler;
}
module.exports={pagesHandler};
