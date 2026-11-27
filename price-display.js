/* Shared price presentation for the storefront and static product snapshots. */
((root,factory)=>{const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.VHPrices=api})(typeof window==='undefined'?null:window,()=>{
 'use strict';
 const money=value=>Number(value).toLocaleString('uk-UA')+' грн';
 function discount(product){
  if(product?.price==null||product.price===''||product.old_price==null||product.old_price==='')return null;
  const price=Number(product.price),old=Number(product.old_price);
  if(!Number.isFinite(price)||!Number.isFinite(old)||price<0||old<=price)return null;
  // Integer percentages never overstate the saving; allow floating-point currency noise.
  const percent=Math.floor((old-price)/old*100+1e-8);
  return {price,old,saving:Math.round((old-price)*100)/100,percent,badge:percent?'−'+percent+'%':'ЗНИЖКА'};
 }
 function parts(product){
  const d=discount(product);if(!d)return {before:'',after:''};
  return {before:'<div class="vh-price-before" data-vh-price-before><del aria-label="Стара ціна '+money(d.old)+'">'+money(d.old)+'</del><span class="vh-price-discount" aria-label="'+(d.percent?'Знижка '+d.percent+' відсотків':'Знижка')+'">'+d.badge+'</span></div>',after:'<p class="vh-price-saving" data-vh-price-after>Економія '+money(d.saving)+'</p>'};
 }
 function update(element,product){
  if(!element)return;
  const parent=element.parentElement;parent.querySelectorAll('[data-vh-price-before],[data-vh-price-after]').forEach(el=>el.remove());
  element.textContent=money(product.price);const html=parts(product);
  if(html.before)element.insertAdjacentHTML('beforebegin',html.before);
  if(html.after)element.insertAdjacentHTML('afterend',html.after);
 }
 function decorate(html,product){
  html=html.replace(/<div\b[^>]*\bdata-vh-price-before\b[^>]*>[\s\S]*?<\/div>/gi,'').replace(/<p\b[^>]*\bdata-vh-price-after\b[^>]*>[\s\S]*?<\/p>/gi,'');
  const detail=parts(product);
  return html.replace(/(<div\b[^>]*\bid=["']productPrice["'][^>]*>)([\s\S]*?)(<\/div>)/i,(_,start,value,end)=>detail.before+start+value+end+detail.after);
 }
 return Object.freeze({discount,parts,update,decorate});
});
