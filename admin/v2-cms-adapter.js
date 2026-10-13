/* V2 CMS adapter: explicit message protocol, no demo writes.
   Loaded by the approved V2 interface once integration is wired. */
(()=>{'use strict';
const allowed=new Set(['ready','pages','blocks','select-block','set-field','set-layout','set-image','save-draft','publish','status']);
const pending=new Map();let seq=0,transport=null;
function connect(send){if(typeof send!=='function')throw new TypeError('CMS transport required');transport=send;}
function request(type,payload={}){
 if(!allowed.has(type))return Promise.reject(Error('Unsupported CMS action: '+type));
 if(!transport)return Promise.reject(Error('CMS not connected'));
 const id='v2-'+(++seq);
 return new Promise((resolve,reject)=>{
  pending.set(id,{resolve,reject});
  try{transport({protocol:'vh-cms-v2',id,type,payload});}
  catch(error){pending.delete(id);reject(error);}
 });
}
function receive(message){
 if(!message||message.protocol!=='vh-cms-v2'||!message.replyTo)return false;
 const task=pending.get(message.replyTo);if(!task)return false;
 pending.delete(message.replyTo);
 if(message.ok===true)task.resolve(message.data);
 else task.reject(Error(message.error||'CMS operation failed'));
 return true;
}
Object.defineProperty(window,'V2CmsAdapter',{value:Object.freeze({connect,request,receive}),configurable:false});
})();
