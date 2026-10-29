/* Editable measurement rows. Test deployments persist browser drafts only. */
(()=>{'use strict';
 const M=window.VHMeasurements,section=document.getElementById('productMeasurementsSection');if(!M||!section)return;
 const $=id=>document.getElementById(id),grid=$('measurementFieldsV148'),panel=document.createElement('div');panel.id='measurementEditor';section.insertBefore(panel,grid);grid.hidden=true;
 const legacyIds=['pMeasureShoulders','pMeasureChest','pMeasureWaist','pMeasureHips','pMeasureLength','pMeasureSleeve','pMeasureInseam','pMeasureInsole','pMeasureHead','pMeasureWidth','pMeasureHeight','pMeasureDepth'];
 const review=location.hostname.endsWith('.vercel.app')||window.VH_CONFIG?.measurementsStorage!=='database';
 let product=null,data={version:1,showLegacy:true,groups:[]},original=null,initialLegacy={},active=false,unsupported=false,history=[],localConflict=null,items=[],listId=M.uid();
 const element=(tag,text,cls)=>{const node=document.createElement(tag);if(text!=null)node.textContent=text;if(cls)node.className=cls;return node};
 const legacyValues=()=>Object.fromEntries(M.legacyKeys.map((key,i)=>['measurement_'+key,$(legacyIds[i])?.value||'']));
 const legacyChanged=()=>legacyIds.some(id=>($(id)?.value||'')!==initialLegacy[id]);
 function status(text,error=false){const node=$('measurementEditorStatus');if(node){node.textContent=text;node.classList.toggle('error',error)}}
 function remember(){history.push(M.clone({data,active,items}));history=history.slice(-20)}
 function persist(){if(!active&&!legacyChanged())return;const changed=Object.fromEntries(M.legacyKeys.flatMap((key,i)=>$(legacyIds[i]).value!==initialLegacy[legacyIds[i]]?[['measurement_'+key,$(legacyIds[i]).value]]:[])),base=Object.fromEntries(M.legacyKeys.flatMap((key,i)=>Object.prototype.hasOwnProperty.call(changed,'measurement_'+key)?[['measurement_'+key,initialLegacy[legacyIds[i]]]]:[]));localStorage.setItem(M.draftKey(product?.id),JSON.stringify({version:1,base:original,data:active?data:null,legacy:changed,legacyBase:base,at:new Date().toISOString()}))}
 function listData(){return {version:1,layout:'list',showLegacy:false,groups:[{id:listId,title:'Заміри',template:'custom',fields:M.clone(items)}]}}
 function changed(){data=listData();active=true;try{persist();status(review?'Чернетку збережено в цьому браузері.':'Є незбережені зміни замірів.');updatePreview()}catch{status('Браузер не зберіг чернетку. Завантажте резервну копію.',true)}}
 function hydrate(){
  items=[];const groups=data.groups||[],multiple=groups.length>1;
  for(const part of groups)for(const field of part.fields)items.push({id:data.layout==='list'?field.id:M.uid(),label:multiple&&part.title.trim()?part.title+' — '+field.label:field.label,value:field.value});
  const old=M.legacy(legacyValues());
  if(!active||data.showLegacy)for(const [i,field] of old.entries())if(field.value.trim()||!active&&!$(legacyIds[i]).closest('[data-measure-key]').classList.contains('hidden'))items.push({id:M.uid(),label:field.label,value:field.value});
 }
 function button(text,fn,parent){const node=element('button',text);node.type='button';node.onclick=fn;parent.append(node);return node}
 function input(label,value,fn,parent,placeholder=''){const box=element('label',label,'measurement-input'),node=document.createElement('input');node.className='input';node.value=value;node.placeholder=placeholder;node.setAttribute('aria-label',label);node.oninput=()=>fn(node.value);box.append(node);parent.append(box);return node}
 function backup(){const blob=new Blob([JSON.stringify({format:'vh-product-measurements',version:1,productId:product?.id||null,original,legacy:legacyValues(),pending:localConflict,data:active?data:null},null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='product-measurements-'+(product?.id||'new')+'.json';a.hidden=true;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000)}
 function openProduct(){try{if(active)M.validate(data);persist();const url=new URL('../product.html',location.href);url.searchParams.set('slug',product.slug);url.searchParams.set('vh-measurements-preview',product.id);window.open(url.href,'_blank','noopener')}catch(e){status(e.message,true)}}
 function updatePreview(){const preview=panel.querySelector('.measurement-preview');if(!preview?.open)return;const host=preview.querySelector('.measurement-site-frame');host.replaceChildren();try{M.render(host,{...(product||{}),...legacyValues(),measurements_v2:M.validate(listData())},[])}catch{host.append(element('p','Заповніть назви пунктів, які мають значення.'))}}
 function render(){
  const scroll=window.scrollY;panel.replaceChildren();if($('measurementHintV148'))$('measurementHintV148').hidden=true;
  panel.append(element('p',review?'Тестова чернетка · зберігається лише в цьому браузері':'Змініть назву, значення або додайте свій пункт.','measurement-mode'));
  const message=element('p');message.id='measurementEditorStatus';message.setAttribute('role','status');panel.append(message);
  if(unsupported){panel.append(element('p','Цей формат замірів доступний лише для перегляду. Збережені дані не змінено.','measurement-error'));button('Завантажити дані',backup,panel);return}
  if(localConflict){
   panel.append(element('p','На сервері є інша версія замірів. Ваша локальна чернетка збережена.','measurement-error'));button('Завантажити обидві версії',backup,panel);
   button('Відновити мою локальну чернетку',()=>{try{const pending=localConflict;if(pending.data){data=M.validate(pending.data,true);active=true}for(const [i,key] of M.legacyKeys.entries())if(Object.prototype.hasOwnProperty.call(pending.legacy||{},'measurement_'+key))$(legacyIds[i]).value=pending.legacy['measurement_'+key];localConflict=null;legacyIds.forEach(id=>$(id).disabled=false);hydrate();persist();render()}catch(e){status(e.message,true)}},panel);
   button('Працювати із серверними замірами',()=>{const key=M.draftKey(product?.id);localStorage.setItem(key+':recovery',JSON.stringify(localConflict));localStorage.removeItem(key);localConflict=null;legacyIds.forEach(id=>$(id).disabled=false);hydrate();render()},panel);return;
  }
  const list=element('div',null,'measurement-list');panel.append(list);
  for(const [index,field] of items.entries()){
   const row=element('div',null,'measurement-field-row');row.dataset.fieldId=field.id;list.append(row);
   const nameInput=input('Назва',field.label,value=>{field.label=value;changed()},row,'Наприклад: Довжина жакета');nameInput.setAttribute('aria-label','Назва заміру '+(index+1));
   const valueInput=input('Значення',field.value,value=>{field.value=value;changed()},row,'Наприклад: 62 см');valueInput.setAttribute('aria-label','Значення заміру '+(index+1));
   const remove=button('×',()=>{if(field.value.trim()&&!confirm('Видалити цей пункт із замірів? Дію можна скасувати.'))return;remember();items.splice(index,1);changed();render()},row);remove.className='measurement-remove';remove.setAttribute('aria-label','Видалити замір '+(index+1));remove.title='Видалити пункт';
  }
  if(!items.length)list.append(element('p','Додайте потрібні заміри кнопкою нижче.','measurement-help'));
  const actions=element('div',null,'measurement-actions');panel.append(actions);
  button('+ Додати пункт',()=>{if(items.length>=500)return status('Досягнуто ліміт 500 пунктів.',true);remember();const field={id:M.uid(),label:'',value:''};items.push(field);changed();render();requestAnimationFrame(()=>panel.querySelector('.measurement-field-row:last-child input')?.focus({preventScroll:true}))},actions);
  if(history.length)button('Скасувати видалення / додавання',()=>{const last=history.pop();data=last.data;active=last.active;items=last.items;try{if(active||legacyChanged())persist();else localStorage.removeItem(M.draftKey(product?.id))}catch{status('Браузер не зберіг відновлені заміри.',true)}render()},actions);
  const preview=element('details',null,'measurement-preview');preview.append(element('summary','Переглянути на сайті'));panel.append(preview);
  preview.addEventListener('toggle',updatePreview);
  preview.append(element('div',null,'measurement-site-frame'));button('Відкрити картку товару',openProduct,preview).disabled=!product?.id;
  const recovery=element('details',null,'measurement-recovery');recovery.append(element('summary','Резервна копія'));panel.append(recovery);button('Завантажити резервну копію',backup,recovery);
  const file=document.createElement('input');file.type='file';file.accept='application/json,.json';file.hidden=true;
  file.onchange=async()=>{try{if(!file.files[0])return;const imported=JSON.parse(await file.files[0].text());if(imported.format!=='vh-product-measurements'||imported.version!==1||String(imported.productId||'')!==String(product?.id||''))throw Error('Ця копія належить іншому товару або має непідтримуваний формат.');const next=imported.data==null?null:M.validate(imported.data,true);localStorage.setItem(M.draftKey(product?.id)+':import-recovery',JSON.stringify({data,legacy:legacyValues()}));remember();data=next||{version:1,showLegacy:true,groups:[]};active=next!=null;hydrate();if(active||legacyChanged())persist();else localStorage.removeItem(M.draftKey(product?.id));render();status('Заміри імпортовано. Старі поля товару не змінено.')}catch(e){status(e.message,true)}finally{file.value=''}};
  button('Імпортувати чернетку замірів',()=>file.click(),recovery);recovery.append(file);
  requestAnimationFrame(()=>{if(document.contains(panel))window.scrollTo(window.scrollX,scroll)});
 }
 function load(row){
  product=row||null;original=row?.measurements_v2==null?null:M.clone(row.measurements_v2);if(row)M.legacy(row).forEach((field,i)=>$(legacyIds[i]).value=field.value);
  initialLegacy=Object.fromEntries(legacyIds.map(id=>[id,$(id)?.value||'']));history=[];listId=M.uid();active=original!=null;unsupported=false;localConflict=null;data={version:1,showLegacy:true,groups:[]};legacyIds.forEach(id=>$(id).disabled=false);
  try{if(original)data=M.validate(original)}catch{unsupported=true}
  let restored=false;try{const local=JSON.parse(localStorage.getItem(M.draftKey(row?.id))||'null');if(local&&!unsupported){const legacyConflict=M.legacyKeys.some((key,i)=>Object.prototype.hasOwnProperty.call(local.legacy||{},'measurement_'+key)&&local.legacyBase?.['measurement_'+key]!==initialLegacy[legacyIds[i]]&&local.legacy['measurement_'+key]!==initialLegacy[legacyIds[i]]);if(M.stable(local.base)!==M.stable(original)&&M.stable(local.data)!==M.stable(original)||legacyConflict)localConflict=local;else{if(local.data){data=M.validate(local.data,true);active=true}for(const [i,key] of M.legacyKeys.entries())if(Object.prototype.hasOwnProperty.call(local.legacy||{},'measurement_'+key))$(legacyIds[i]).value=local.legacy['measurement_'+key];restored=true}}}catch{}
  if(unsupported||localConflict)legacyIds.forEach(id=>$(id).disabled=true);hydrate();render();if(restored)status('Відновлено локальну чернетку замірів цього товару.');
 }
 async function prepareSave(payload,db){
  if(unsupported){for(const key of M.legacyKeys)delete payload['measurement_'+key];return {localOnly:false}}
  if(localConflict)throw Error('Спочатку виберіть локальну або серверну версію замірів.');
  const changedLegacy=legacyChanged();if(product)for(const [i,key] of M.legacyKeys.entries())if(($(legacyIds[i])?.value||'')===initialLegacy[legacyIds[i]])delete payload['measurement_'+key];
  const next=active?M.validate(data):null,structuredChanged=M.stable(next)!==M.stable(original);
  if(review&&(structuredChanged||changedLegacy)){persist();status('Заміри збережено тільки локально. Товар та інші його поля у робочій базі не змінено.');return {localOnly:true}}
  if(structuredChanged){const probe=await db.from('products').select('measurements_v2').limit(0);if(probe.error)throw Error('Збереження нових замірів потребує підготовленого поля measurements_v2 у базі. Робочі дані не змінено.');payload.measurements_v2=next;}
  return {localOnly:false,structuredChanged};
 }
 function protectUpdate(query,payload){if(!Object.prototype.hasOwnProperty.call(payload,'measurements_v2'))return query;return original==null?query.is('measurements_v2',null):query.eq('measurements_v2',JSON.stringify(original))}
 function saved(id){try{localStorage.removeItem(M.draftKey(product?.id));if(id)localStorage.removeItem(M.draftKey(id))}catch{}}
 function suggest(){if(!active&&!localConflict&&!unsupported){hydrate();render()}}
 window.VHMeasurementEditor={load,prepareSave,protectUpdate,saved,suggest};
})();
