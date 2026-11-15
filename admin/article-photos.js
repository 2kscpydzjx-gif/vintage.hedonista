/* Article photos keep their own aspect ratio; existing files change only on request. */
(function(){
 async function decode(source){
  const response=await fetch(source);if(!response.ok)throw new Error('Не вдалося відкрити фото');
  return createImageBitmap(await response.blob());
 }
 async function trimPadding(source){
  const bitmap=await decode(source),canvas=document.createElement('canvas');
  const scale=Math.min(1,2400/bitmap.width,2400/bitmap.height);
  canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));
  const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close();
  const {width:w,height:h}=canvas,data=ctx.getImageData(0,0,w,h).data;
  const pixel=(x,y)=>{const i=(y*w+x)*4;return [data[i],data[i+1],data[i+2],data[i+3]]};
  const same=(a,b)=>a.every((v,i)=>Math.abs(v-b[i])<=18);
  function edge(vertical,reverse){
   const length=vertical?w:h,cross=vertical?h:w,ref=vertical?pixel(reverse?w-1:0,Math.floor(h/2)):pixel(Math.floor(w/2),reverse?h-1:0);
   if(ref[3]<250)return {count:0,ref};
   let count=0;
   for(let n=0;n<Math.floor(length*.35);n++){
    const at=reverse?length-1-n:n;let good=0,total=0;
    for(let k=Math.floor(cross*.05);k<cross*.95;k+=Math.max(1,Math.floor(cross/200))){total++;if(same(vertical?pixel(at,k):pixel(k,at),ref))good++}
    if(good/total<.98)break;count++;
   }
   return {count:count===Math.floor(length*.35)?0:count,ref};
  }
  const left=edge(true,false),right=edge(true,true),top=edge(false,false),bottom=edge(false,true);
  const sides=left.count>=2&&right.count>=2&&same(left.ref,right.ref),ends=top.count>=2&&bottom.count>=2&&same(top.ref,bottom.ref);
  const x=sides?left.count:0,y=ends?top.count:0,cw=w-x-(sides?right.count:0),ch=h-y-(ends?bottom.count:0);
  if(!sides&&!ends)return null;
  const crop=document.createElement('canvas');crop.width=cw;crop.height=ch;
  crop.getContext('2d').drawImage(canvas,x,y,cw,ch,0,0,cw,ch);
  return crop.toDataURL('image/webp',.9);
 }
 window.VHArticlePhotos={trimPadding};
})();
