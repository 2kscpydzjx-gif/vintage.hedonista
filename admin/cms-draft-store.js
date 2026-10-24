/* Page-scoped recovery journal. Never stores authentication or customer data. */
((root,factory)=>{const api=factory();if(typeof module==='object')module.exports=api;else root.VHCMSDraftStore=api})(typeof window==='object'?window:globalThis,()=>{
 'use strict';
 const clone=value=>JSON.parse(JSON.stringify(value));
 const stable=value=>JSON.stringify(value,(_,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.entries(v).sort(([a],[b])=>a.localeCompare(b))):v);
 const keys=page=>({blocks:page==='home'?'vh-cms-lab-step55-v1':'vh-cms-lab-step56-'+page,existing:'vh-cms-existing-step65-'+page,order:'vh-cms-order-step72-'+page,meta:'vh-cms-state-v1-'+page});
 const shellKey='vh-cms-shared-shell-step71';
 function create(storage){
  const read=(key,fallback)=>{try{const value=JSON.parse(storage.getItem(key));return value===null?clone(fallback):value}catch{return clone(fallback)}};
  const write=(key,value)=>storage.setItem(key,JSON.stringify(value));
  function snapshot(page){const k=keys(page);return page==='shared'?{shared:read(shellKey,{})}:{blocks:read(k.blocks,[]),existing:read(k.existing,{}),order:read(k.order,[])}}
  function hasLocal(page){const k=keys(page);return (page==='shared'?[shellKey]:[k.blocks,k.existing,k.order]).some(key=>storage.getItem(key)!==null)}
  function fromRevision(page,data){return page==='shared'?{shared:data?.shared||{}}:{blocks:data?.blocks||[],existing:data?.shared?.cmsPageDraft?.existing||{},order:data?.shared?.cmsPageDraft?.order||[]}}
  function backup(page,reason,remote){
   const key='vh-cms-recovery-v1-'+page,entries=read(key,[]);
   const entry={at:new Date().toISOString(),reason,local:snapshot(page),remote:remote?clone(remote):null};
   if(stable(entries.at(-1)?.local)!==stable(entry.local)||remote)write(key,[...entries.slice(-7),entry]);
   return entry;
  }
  function restore(page,value){const k=keys(page);if(page==='shared')write(shellKey,value.shared||{});else{write(k.blocks,value.blocks||[]);write(k.existing,value.existing||{});write(k.order,value.order||[])}}
  function touch(page){const key=keys(page).meta,meta=read(key,{});write(key,{...meta,dirty:true,editedAt:new Date().toISOString()})}
  function hydrate(page,remote){
   const k=keys(page),meta=read(k.meta,{}),local=snapshot(page),server=fromRevision(page,remote),token=remote?.updated_at||null;
   // Older constructors have no metadata. Retain their local content for recovery.
   const differs=stable(local)!==stable(server),keep=hasLocal(page)&&differs&&(meta.dirty||!meta.loaded);
   backup(page,'before-server-load',remote);
   if(keep){
    const conflict=!!meta.loaded&&meta.base!==token;
    write(k.meta,{...meta,loaded:true,dirty:true,base:meta.loaded?meta.base:token,conflict});
    return {value:local,token:meta.loaded?meta.base:token,recovered:true,conflict};
   }
   restore(page,server);write(k.meta,{loaded:true,dirty:false,base:token,conflict:false});
   return {value:server,token,recovered:false,conflict:false};
  }
  function saved(page,value,token){const k=keys(page),dirty=stable(snapshot(page))!==stable(value);write(k.meta,{loaded:true,dirty,base:token,conflict:false});return dirty}
  function useServer(page,remote){backup(page,'use-server-version',remote);const value=fromRevision(page,remote);restore(page,value);write(keys(page).meta,{loaded:true,dirty:false,base:remote?.updated_at||null,conflict:false});return value}
  function exportLocal(){const result={};for(let i=0;i<storage.length;i++){const key=storage.key(i);if(/^vh-(?:cms-|published-cache-|site-settings-v)/.test(key))result[key]=read(key,null)}return result}
  return {snapshot,hasLocal,fromRevision,backup,restore,touch,hydrate,saved,useServer,exportLocal,meta:page=>read(keys(page).meta,{})};
 }
 return {create,keys,stable};
});
