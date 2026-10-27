const {chromium}=require('playwright');
const fs=require('node:fs');
const sdk=`(()=>{
 const query=table=>{let op='select',values=null,filters=[],single=false,columns=null;const q={};for(const method of ['order','limit','range','in','or','gte','lte','neq','ilike','contains'])q[method]=()=>q;q.select=value=>{columns=value;return q};q.eq=(k,v)=>{filters.push([k,v]);return q};q.maybeSingle=q.single=()=>{single=true;return q};for(const method of ['update','insert','upsert','delete'])q[method]=value=>{op=method;values=value;return q};q.then=(resolve,reject)=>window.__cmsTestQuery({table,op,values,filters,single,columns}).then(resolve,reject);return q};
 window.supabase={createClient:(url,key,options)=>(window.__cmsTestClients=(window.__cmsTestClients||[]),window.__cmsTestClients.push({url,options}),{from:query,rpc:(name,args)=>window.__cmsTestRpc({name,args}),functions:{invoke:(name,args)=>window.__cmsTestFunction({name,args})},auth:{getSession:async()=>({data:{session:{user:{id:'test-admin'}}},error:null}),getUser:async()=>({data:{user:await window.__cmsTestUser()}}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})},storage:{from:()=>({upload:async(path,file)=>{await window.__cmsTestQuery({op:'upload',path,type:file.type,size:file.size});return {error:null}},getPublicUrl:path=>({data:{publicUrl:'http://127.0.0.1:8765/assets/test-upload.png?path='+encodeURIComponent(path)}})})}})};
})()`;
async function fixture(options={}){
 const browser=await chromium.launch({headless:true,...(fs.existsSync('/usr/bin/chromium')?{executablePath:'/usr/bin/chromium',args:['--no-sandbox']}: {})});
 const context=await browser.newContext({viewport:{width:1560,height:1000},...options}),records=new Map(),calls=[],errors=[],tables=new Map();
 const settings={id:1,hero_title:'LEGACY SETTINGS TITLE',contacts_page_title:'LEGACY CONTACTS',delivery_page_title:'LEGACY DELIVERY'};
 let delay=0,failWrite=false,failRead=false,uploadDelay=0,contentDelay=0,user={id:'test-user'},rpcHandler=async()=>({data:true,error:null});
 const rpcCalls=[],functionCalls=[];
 await context.exposeBinding('__cmsTestUser',()=>structuredClone(user));
 await context.exposeBinding('__cmsTestRpc',async(_,input)=>{rpcCalls.push(structuredClone(input));return rpcHandler(input)});
 await context.exposeBinding('__cmsTestFunction',(_,input)=>{functionCalls.push(structuredClone(input));return {data:{ok:true},error:null}});
 const set=(page,status,value)=>records.set(page+':'+status,{page_key:page,revision_status:status,blocks:[],shared:{},updated_at:'2026-10-24T12:00:00.000Z',...structuredClone(value)});
 for(const page of ['home','about','contacts','delivery','catalog','journal','capsules']){set(page,'draft',{});set(page,'published',{})}
 await context.exposeBinding('__cmsTestQuery',async(source,input)=>{
  calls.push(structuredClone(input));
  if(input.op==='upload'){if(uploadDelay)await new Promise(r=>setTimeout(r,uploadDelay));return {error:null}}
  if(input.table==='site_settings')return {data:structuredClone(settings),error:null};
  if(input.table!=='vh_page_revisions'){if(contentDelay)await new Promise(r=>setTimeout(r,contentDelay));const rows=structuredClone(tables.get(input.table)||[]).filter(row=>(input.filters||[]).every(([key,value])=>row[key]===value));return {data:input.single?rows[0]||null:rows,error:null,count:rows.length}};
  const filters=input.filters||[],matches=row=>filters.every(([k,v])=>row[k]===v);
  if(input.op==='select'){if(failRead)return {data:null,error:{message:'Simulated publication read failure'}};const found=[...records.values()].filter(matches).map(x=>structuredClone(x));if(delay)await new Promise(r=>setTimeout(r,delay));return {data:input.single?found[0]||null:found,error:null}}
  if(failWrite)return {data:null,error:{message:'Simulated server write failure'}};
  if(delay)await new Promise(r=>setTimeout(r,delay));
  if(input.op==='update'){const old=[...records.values()].find(matches);if(!old)return {data:[],error:null};const value={...old,...structuredClone(input.values)};records.set(value.page_key+':'+value.revision_status,value);return {data:[value],error:null}}
  const value=structuredClone(input.values),key=value.page_key+':'+value.revision_status;
  if(input.op==='insert'&&records.has(key))return {data:null,error:{message:'Duplicate revision'}};
  records.set(key,value);return {data:[value],error:null};
 });
 const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+y0IoAAAAASUVORK5CYII=','base64');
 await context.route('**/*',async route=>{
  const url=route.request().url();
  if(url.includes('cdn.jsdelivr.net/npm/@supabase/supabase-js'))return route.fulfill({contentType:'text/javascript',body:sdk});
  if(url.includes('/assets/test-upload.png'))return route.fulfill({contentType:'image/png',body:png});
  if(url.startsWith('http://127.0.0.1:8765/'))return route.continue();
  if(url.includes('.supabase.co/rest/v1/site_settings'))return route.fulfill({contentType:'application/json',body:JSON.stringify([settings])});
  return route.abort();
 });
 context.on('page',page=>page.on('pageerror',e=>errors.push(e.message)));
 return {browser,context,records,calls,errors,set,png,rpcCalls,functionCalls,user:value=>user=structuredClone(value),rpc:fn=>rpcHandler=fn,data:(table,rows)=>tables.set(table,structuredClone(rows)),settings:value=>Object.assign(settings,value),delay:v=>delay=v,failWrite:v=>failWrite=v,failRead:v=>failRead=v,contentDelay:v=>contentDelay=v,uploadDelay:v=>uploadDelay=v};
}
module.exports={fixture};
