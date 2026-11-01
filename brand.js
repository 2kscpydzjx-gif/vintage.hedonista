/* Public brand labels; historical URLs, auth keys and saved CMS records stay intact. */
(function(root){
 'use strict';
 const socialKeys=new Set(['instagram','telegram','contacts_instagram_text','contacts_telegram_text']);
 function text(value){
  if(typeof value!=='string')return value;
  return value.replace(/\bVintage(?:\s|\\n|<br\s*\/?>)+Hedonista\b/gi,match=>match.startsWith('VINTAGE')?'VINTAZHKA':'Vintazhka')
   .replace(/\bHedonista(?=(?:\s|\\n|<br\s*\/?>)+(?:Journal|Guide)\b)/gi,match=>match==='HEDONISTA'?'VINTAZHKA':'Vintazhka');
 }
 function socialLabel(value,platform='Instagram'){return /^@?vintage[_.]hedonista$/i.test(String(value).trim())?platform:text(value)}
 function content(value,key=''){
  if(typeof value==='string'){
   if(socialKeys.has(key)||/^(?:https?:|data:|blob:)/i.test(value))return value;
   return text(value);
  }
  if(Array.isArray(value))return value.map(item=>content(item));
  if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,content(v,k)]));
  return value;
 }
 const api=Object.freeze({name:'Vintazhka',text,content,socialLabel});
 if(typeof module==='object'&&module.exports)module.exports=api;
 else root.VHBrand=api;
})(globalThis);
