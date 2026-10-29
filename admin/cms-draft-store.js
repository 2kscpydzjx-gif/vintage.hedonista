/* Page-scoped recovery journal. Never stores authentication or customer data. */
((root,factory)=>{const api=factory();if(typeof module==='object')module.exports=api;else root.VHCMSDraftStore=api})(typeof window==='object'?window:globalThis,()=>{
 'use strict';
 const clone=value=>JSON.parse(JSON.stringify(value));
 const stable=value=>JSON.stringify(value,(_,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.entries(v).sort(([a],[b])=>a.localeCompare(b))):v);
 const keys=page=>({blocks:page==='home'?'vh-cms-lab-step55-v1':'vh-cms-lab-step56-'+page,existing:'vh-cms-existing-step65-'+page,order:'vh-cms-order-step72-'+page,meta:'vh-cms-state-v1-'+page});
 const shellKey='vh-cms-shared-shell-step71';
 const shellKeys=['headerLogo','footerLogo','nav','footerText','footerCopyright','instagram','telegram'];
 const shellValues=value=>Object.fromEntries(shellKeys.filter(key=>Object.prototype.hasOwnProperty.call(value||{},key)).map(key=>[key,clone(value[key])]));
 const withShell=(shared,value)=>({...Object.fromEntries(Object.entries(shared||{}).filter(([key])=>!shellKeys.includes(key))),...shellValues(value)});
 const object=value=>value&&typeof value==='object'&&!Array.isArray(value);
 function mergeValues(base,local,remote,path=''){
  if(stable(local)===stable(base))return {value:remote,conflicts:[]};
  if(stable(remote)===stable(base)||stable(local)===stable(remote))return {value:local,conflicts:[]};
  if(object(local)&&object(remote)&&(base===undefined||object(base))){const value={},conflicts=[];for(const key of new Set([...Object.keys(base||{}),...Object.keys(local),...Object.keys(remote)])){const merged=mergeValues(base?.[key],local[key],remote[key],path?path+'.'+key:key);if(merged.value!==undefined)value[key]=merged.value;conflicts.push(...merged.conflicts)}return {value,conflicts}}
  return {value:local,conflicts:[path]};
 }
 function create(storage){
  const read=(key,fallback)=>{try{const value=JSON.parse(storage.getItem(key));return value===null?clone(fallback):value}catch{return clone(fallback)}};
  const write=(key,value)=>storage.setItem(key,JSON.stringify(value));
  function snapshot(page){const k=keys(page);return page==='shared'?{shared:shellValues(read(shellKey,{}))}:{blocks:read(k.blocks,[]),existing:read(k.existing,{}),order:read(k.order,[])}}
  function hasLocal(page){const k=keys(page);return (page==='shared'?[shellKey]:[k.blocks,k.existing,k.order]).some(key=>storage.getItem(key)!==null)}
  function fromRevision(page,data){return page==='shared'?{shared:shellValues(data?.shared)}:{blocks:data?.blocks||[],existing:data?.shared?.cmsPageDraft?.existing||{},order:data?.shared?.cmsPageDraft?.order||[]}}
  function backup(page,reason,remote){
   const key='vh-cms-recovery-v1-'+page,entries=read(key,[]);
   const entry={at:new Date().toISOString(),reason,local:snapshot(page),remote:remote?clone(remote):null};
   if(stable(entries.at(-1)?.local)!==stable(entry.local)||remote)write(key,[...entries.slice(-7),entry]);
   return entry;
  }
  function restore(page,value){const k=keys(page);if(page==='shared')write(shellKey,shellValues(value.shared));else{write(k.blocks,value.blocks||[]);write(k.existing,value.existing||{});write(k.order,value.order||[])}}
  function touch(page){const key=keys(page).meta,meta=read(key,{});write(key,{...meta,dirty:true,editedAt:new Date().toISOString()})}
  function hydrate(page,remote){
   const k=keys(page),meta=read(k.meta,{}),local=snapshot(page),server=fromRevision(page,remote),token=remote?.updated_at||null;
   const base=baseline(page,meta);
   // Older constructors have no metadata. Retain their local content for recovery.
   const differs=stable(local)!==stable(server),keep=hasLocal(page)&&differs&&(meta.dirty||!meta.loaded);
   backup(page,'before-server-load',remote);
   if(keep){
    let value=local,conflict=!!meta.loaded&&meta.base!==token,conflicts=[];
    if(page==='shared'&&!meta.loaded)value=mergeValues({shared:{}},local,server).value;
    if(conflict&&base){if(page==='shared'){const merged=mergeValues(base,local,server);value=merged.value;conflicts=merged.conflicts;conflict=conflicts.length>0;}else if(stable(base)===stable(server))conflict=false;}
    const nextToken=conflict?meta.base:token;restore(page,value);
    write(k.meta,{...meta,loaded:true,dirty:true,base:nextToken,baseValue:conflict?base:server,conflict,conflicts});
    return {value,token:nextToken,recovered:true,conflict};
   }
   restore(page,server);write(k.meta,{loaded:true,dirty:false,base:token,baseValue:server,conflict:false});
   return {value:server,token,recovered:false,conflict:false};
  }
  function baseline(page,meta){if(meta.baseValue)return meta.baseValue;const entry=[...read('vh-cms-recovery-v1-'+page,[])].reverse().find(item=>item.remote&&(item.remote.updated_at||null)===(meta.base||null));return entry?fromRevision(page,entry.remote):null}
  function rebase(page,value,remote){const meta=read(keys(page).meta,{}),server=fromRevision(page,remote),base=baseline(page,meta);if((meta.base||null)===(remote?.updated_at||null))return {value,conflict:false};if(!base)return {value,conflict:true};if(page==='shared'){const merged=mergeValues(base,value,server);return {...merged,conflict:merged.conflicts.length>0}}return {value,conflict:stable(base)!==stable(server)}}
  function saved(page,value,token){const k=keys(page),dirty=stable(snapshot(page))!==stable(value);write(k.meta,{loaded:true,dirty,base:token,baseValue:value,conflict:false});return dirty}
  function useServer(page,remote){backup(page,'use-server-version',remote);const value=fromRevision(page,remote);restore(page,value);write(keys(page).meta,{loaded:true,dirty:false,base:remote?.updated_at||null,baseValue:value,conflict:false});return value}
  function keepLocal(page,remote){const local=snapshot(page),server=fromRevision(page,remote),base=baseline(page,read(keys(page).meta,{}));backup(page,'keep-local-version',remote);const value=page==='shared'&&base?mergeValues(base,local,server).value:local;restore(page,value);write(keys(page).meta,{loaded:true,dirty:true,base:remote?.updated_at||null,baseValue:server,conflict:false});return value}
  function exportLocal(){const result={};for(let i=0;i<storage.length;i++){const key=storage.key(i);if(/^vh-(?:cms-|published-cache-|site-settings-v)/.test(key))result[key]=read(key,null)}return result}
  return {snapshot,hasLocal,fromRevision,backup,restore,touch,hydrate,saved,useServer,keepLocal,rebase,exportLocal,meta:page=>read(keys(page).meta,{})};
 }
 return {create,keys,stable,shellValues,withShell};
});
