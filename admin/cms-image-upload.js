/* New uploads only: preserve existing URLs, crop coordinates and source files. */
(()=>{'use strict';
 async function animatedPng(file){
  const view=new DataView(await file.slice(0,65536).arrayBuffer());
  for(let at=8;at+8<=view.byteLength;){
   const length=view.getUint32(at),name=String.fromCharCode(...new Uint8Array(view.buffer,at+4,4));
   if(name==='acTL')return true;if(name==='IDAT'||length>view.byteLength-at-12)break;at+=length+12;
  }
  return false;
 }
 async function prepare(file,{preserve=false}={}){
  if(!file?.size)throw Error('Фото порожнє');
  if(file.size>25*1024*1024)throw Error('Фото понад 25 МБ');
  if(preserve||!['image/jpeg','image/png'].includes(file.type)||file.size<131072)return {file,optimized:false};
  if(file.type==='image/png'&&await animatedPng(file))return {file,optimized:false};
  if(typeof createImageBitmap!=='function')return {file,optimized:false};
  let bitmap;try{bitmap=await createImageBitmap(file,{imageOrientation:'from-image'})}catch{throw Error('Не вдалося прочитати фото. Спробуйте інший файл.')}
  try{
   if(bitmap.width*bitmap.height>80000000)throw Error('Фото має надто велику роздільність');
   const scale=Math.min(1,2400/Math.max(bitmap.width,bitmap.height)),canvas=document.createElement('canvas');
   canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));
   const context=canvas.getContext('2d',{alpha:file.type==='image/png'});if(!context)throw Error('Не вдалося підготувати фото');
   context.imageSmoothingEnabled=true;context.imageSmoothingQuality='high';context.drawImage(bitmap,0,0,canvas.width,canvas.height);
   const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/webp',.9));
   if(!blob||blob.type!=='image/webp'||blob.size>=file.size*.9)return {file,optimized:false};
   return {file:new File([blob],(file.name.replace(/\.[^.]+$/,'')||'photo')+'.webp',{type:'image/webp'}),optimized:true,width:canvas.width,height:canvas.height};
  }finally{bitmap.close()}
 }
 window.VHCMSImageUpload={prepare};
})();
