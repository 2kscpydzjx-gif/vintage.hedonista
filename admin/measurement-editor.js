/* Optional grouped measurements; review deployments persist only browser drafts. */
(()=>{'use strict';
 const M=window.VHMeasurements,section=document.getElementById('productMeasurementsSection');if(!M||!section)return;
 const $=id=>document.getElementById(id),grid=$('measurementFieldsV148'),panel=document.createElement('div');panel.id='measurementEditor';section.insertBefore(panel,grid);
 const legacyBox=document.createElement('details');legacyBox.id='measurementLegacy';const legacySummary=document.createElement('summary');legacySummary.textContent='Попередні заміри';legacyBox.append(legacySummary);const legacyNote=document.createElement('p');legacyNote.textContent='Ці значення збережені окремо. Їх відображення на сайті можна змінити в розділі «Додатково».';legacyBox.append(legacyNote);section.insertBefore(legacyBox,grid);legacyBox.append(grid);
 const legacyIds=['pMeasureShoulders','pMeasureChest','pMeasureWaist','pMeasureHips','pMeasureLength','pMeasureSleeve','pMeasureInseam','pMeasureInsole','pMeasureHead','pMeasureWidth','pMeasureHeight','pMeasureDepth'];
 const review=location.hostname.endsWith('.vercel.app')||window.VH_CONFIG?.measurementsStorage!=='database';
 let product=null,data={version:1,showLegacy:true,groups:[]},original=null,initialLegacy={},active=false,unsupported=false,history=[],localConflict=null,selectedTemplate=null,selectedSet='jacket_pants',selectedGroup=null,uiTab='edit',setupOpen=false,setupMode='single';
 const element=(tag,text,cls)=>{const node=document.createElement(tag);if(text!=null)node.textContent=text;if(cls)node.className=cls;return node};
 const legacyValues=()=>Object.fromEntries(M.legacyKeys.map((key,i)=>['measurement_'+key,$(legacyIds[i])?.value||'']));
 const legacyChanged=()=>legacyIds.some(id=>($(id)?.value||'')!==initialLegacy[id]);
 function status(text,error=false){const node=$('measurementEditorStatus');if(node){node.textContent=text;node.classList.toggle('error',error)}}
 function remember(){history.push(M.clone(data));history=history.slice(-20)}
 function persist(){if(!active&&!legacyChanged())return;const changed=Object.fromEntries(M.legacyKeys.flatMap((key,i)=>$(legacyIds[i]).value!==initialLegacy[legacyIds[i]]?[['measurement_'+key,$(legacyIds[i]).value]]:[])),base=Object.fromEntries(M.legacyKeys.flatMap((key,i)=>Object.prototype.hasOwnProperty.call(changed,'measurement_'+key)?[['measurement_'+key,initialLegacy[legacyIds[i]]]]:[]));localStorage.setItem(M.draftKey(product?.id),JSON.stringify({version:1,base:original,data:active?data:null,legacy:changed,legacyBase:base,at:new Date().toISOString()}))}
 function changed(){active=true;try{persist();status(review?'Чернетку замірів збережено в цьому браузері.':'Є незбережені зміни замірів.')}catch{status('Браузер не зберіг чернетку. Завантажте резервну копію.',true)}}
 function button(text,fn,parent){const node=element('button',text);node.type='button';node.onclick=fn;parent.append(node);return node}
 function input(label,value,fn,parent,placeholder=''){const box=element('label',label,'measurement-input'),node=document.createElement('input');node.className='input';node.value=value;node.placeholder=placeholder;node.setAttribute('aria-label',label);node.oninput=()=>fn(node.value);box.append(node);parent.append(box);return node}
 function select(label,options,value,fn,parent){const box=element('label',label,'measurement-input'),node=document.createElement('select');node.className='input';node.setAttribute('aria-label',label);for(const [key,title] of options)node.add(new Option(title,key));node.value=value;node.onchange=()=>fn(node.value);box.append(node);parent.append(box);return node}
 function backup(){const blob=new Blob([JSON.stringify({format:'vh-product-measurements',version:1,productId:product?.id||null,original,legacy:legacyValues(),pending:localConflict,data},null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='product-measurements-'+(product?.id||'new')+'.json';a.hidden=true;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000)}
 function openProduct(){try{if(active)M.validate(data);persist();const url=new URL('../product.html',location.href);url.searchParams.set('slug',product.slug);url.searchParams.set('vh-measurements-preview',product.id);window.open(url.href,'_blank','noopener')}catch(e){status(e.message,true)}}
 function render(){
  const scroll=window.scrollY;
  if($('measurementHintV148'))$('measurementHintV148').hidden=!!data.groups.length;
  panel.replaceChildren();legacyBox.hidden=uiTab==='preview';legacySummary.textContent=data.groups.length?'Попередні заміри — збережені окремо':'Поточні заміри';
  panel.append(element('p',review?'Тестова чернетка · зберігається лише в цьому браузері':'Заміри товару','measurement-mode'));
  const message=element('p');message.id='measurementEditorStatus';message.setAttribute('role','status');panel.append(message);
  if(unsupported){panel.append(element('p','Цей формат замірів доступний лише для перегляду. Збережені дані не змінено.','measurement-error'));button('Завантажити дані',backup,panel);return}
  if(localConflict){panel.append(element('p','На сервері є інша версія замірів. Ваша локальна чернетка збережена.','measurement-error'));button('Завантажити обидві версії',backup,panel);button('Відновити мою локальну чернетку',()=>{try{const pending=localConflict;if(pending.data){data=M.validate(pending.data,true);active=true}for(const [i,key] of M.legacyKeys.entries())if(Object.prototype.hasOwnProperty.call(pending.legacy||{},'measurement_'+key))$(legacyIds[i]).value=pending.legacy['measurement_'+key];localConflict=null;legacyIds.forEach(id=>$(id).disabled=false);changed();render()}catch(e){status(e.message,true)}},panel);button('Працювати із серверними замірами',()=>{const key=M.draftKey(product?.id);localStorage.setItem(key+':recovery',JSON.stringify(localConflict));localStorage.removeItem(key);localConflict=null;legacyIds.forEach(id=>$(id).disabled=false);render()},panel);return}
  const toolbar=element('div',null,'measurement-toolbar');panel.append(toolbar);
  button('Зберегти чернетку',()=>{try{if(active)M.validate(data);persist();status('Чернетку замірів збережено. Робочу базу не змінено.')}catch(e){status(e.message,true)}},toolbar);
  button('Відкрити картку товару',openProduct,toolbar).disabled=!product?.id;
  const views=element('div',null,'measurement-view-tabs');views.setAttribute('role','tablist');views.setAttribute('aria-label','Режим замірів');panel.append(views);
  for(const [key,title] of [['edit','Редагування'],['preview','Як на сайті']]){const b=button(title,()=>{uiTab=key;render()},views);b.setAttribute('role','tab');b.setAttribute('aria-selected',String(uiTab===key));b.tabIndex=uiTab===key?0:-1;b.classList.toggle('active',uiTab===key)}
  if(uiTab==='preview'){
   panel.append(element('p','Так виглядатиме вміст пункту «ЗАМІРИ». На сайті показуються лише заповнені рядки.','measurement-help'));
   const frame=element('div',null,'measurement-site-frame');frame.append(element('h3','ЗАМІРИ'));const view=element('div');frame.append(view);panel.append(frame);
   try{if(active)M.validate(data);const row={...(product||{}),...legacyValues(),measurements_v2:active?data:null};M.render(view,row,M.legacy(row).filter(f=>f.value.trim()).map(f=>[f.label,f.value]))}catch{view.append(element('p','Заповніть назви складових та замірів, щоб побачити перегляд.'))}
   return;
  }
  if(!data.groups.length&&!setupOpen){
   panel.append(element('p','Можна залишити поточні поля нижче або обрати окремий шаблон для виробу чи комплекту.','measurement-help'));
   button('Налаштувати нові заміри',()=>{setupOpen=true;render()},panel);
  }
  if(setupOpen){
   const setup=element('div',null,'measurement-setup');panel.append(setup);setup.append(element('h4',data.groups.length?'Додати складову':'Для чого потрібні заміри?'));
   const modes=element('div',null,'measurement-choice');setup.append(modes);
   for(const [key,title] of [['single','Один виріб'],['set','Комплект']]){const b=button(title,()=>{setupMode=key;render()},modes);b.classList.toggle('active',setupMode===key);b.setAttribute('aria-pressed',String(setupMode===key))}
   const controls=element('div',null,'measurement-setup-controls');setup.append(controls);
   if(setupMode==='single'){
    const template=select('Тип виробу',Object.entries(M.templates).map(([key,t])=>[key,t.title]),selectedTemplate||M.guess({name:$('pCategory')?.selectedOptions[0]?.textContent},{name:$('pSubcategory')?.selectedOptions[0]?.textContent}),value=>selectedTemplate=value,controls);template.id='measurementNewTemplate';
    button(data.groups.length?'Додати складову':'Створити поля',()=>{if(data.groups.length>=12)return status('Можна додати до 12 складових.',true);remember();const part=M.group(template.value);data.groups.push(part);selectedGroup=part.id;setupOpen=false;legacyBox.open=false;changed();render()},controls);
   }else{
    const preset=select('Готовий комплект',Object.entries(M.sets).map(([key,set])=>[key,set.title]),selectedSet,value=>selectedSet=value,controls);
    button('Створити комплект',()=>{const set=M.sets[preset.value];if(data.groups.length+set.parts.length>12)return status('Забагато складових.',true);remember();const parts=set.parts.map(([key,title])=>M.group(key,title));data.groups.push(...parts);selectedGroup=parts[0].id;setupOpen=false;legacyBox.open=false;changed();render()},controls);
   }
   if(data.groups.length)button('Скасувати додавання',()=>{setupOpen=false;render()},setup);
  }
  if(data.groups.length){
   if(!data.groups.some(part=>part.id===selectedGroup))selectedGroup=data.groups[0].id;
   const tabsRow=element('div',null,'measurement-tabs-row');panel.append(tabsRow);const tabs=element('div',null,'measurement-part-tabs');tabsRow.append(tabs);tabs.setAttribute('role','tablist');tabs.setAttribute('aria-label','Складові товару');
   for(const [i,part] of data.groups.entries()){const b=button(part.title||'Складова '+(i+1),()=>{selectedGroup=part.id;setupOpen=false;render()},tabs);b.id='measurement-tab-'+part.id;b.setAttribute('role','tab');b.setAttribute('aria-selected',String(part.id===selectedGroup));b.tabIndex=part.id===selectedGroup?0:-1;b.classList.toggle('active',part.id===selectedGroup)}
   button('+ Додати складову',()=>{setupMode='single';setupOpen=true;render()},tabsRow);
   const index=data.groups.findIndex(part=>part.id===selectedGroup),part=data.groups[index],card=element('section',null,'measurement-part');card.dataset.groupId=part.id;card.setAttribute('role','tabpanel');card.setAttribute('aria-labelledby','measurement-tab-'+part.id);panel.append(card);
   const title=element('h4',part.title||'Складова '+(index+1));card.append(title);
   const settings=element('details',null,'measurement-part-settings');settings.append(element('summary','Назва та тип складової'));card.append(settings);
   input('Назва складової '+(index+1),part.title,value=>{part.title=value;title.textContent=value||'Складова '+(index+1);$('measurement-tab-'+part.id).textContent=title.textContent;changed()},settings,'Наприклад: Жакет');
   select('Шаблон складової '+(index+1),Object.entries(M.templates).map(([key,t])=>[key,t.title]),part.template||'custom',value=>{const next=M.changeTemplate(part,value);if(next.fields.length>40){render();status('Новий шаблон перевищує ліміт 40 полів. Заповнені значення залишено без змін.',true);return}remember();data.groups[index]=next;changed();render();status('Заповнені поля збережено.')},settings);
   const order=element('div',null,'measurement-actions');settings.append(order);
   button('Вище',()=>{if(!index)return;remember();[data.groups[index-1],data.groups[index]]=[part,data.groups[index-1]];changed();render()},order).disabled=index===0;
   button('Нижче',()=>{if(index===data.groups.length-1)return;remember();[data.groups[index+1],data.groups[index]]=[part,data.groups[index+1]];changed();render()},order).disabled=index===data.groups.length-1;
   button('Прибрати складову',()=>{if(part.fields.some(f=>f.value.trim())&&!confirm('Прибрати цю складову? Дію можна скасувати.'))return;remember();data.groups.splice(index,1);changed();render()},order);
   for(const field of part.fields){
    const row=element('div',null,'measurement-field-row');row.dataset.fieldId=field.id;card.append(row);
    const valueBox=element('label',null,'measurement-value'),label=element('span',field.label||'Власний замір'),value=document.createElement('input');value.className='input';value.value=field.value;value.placeholder='Наприклад: 46 см або 35–40 см';value.setAttribute('aria-label','Значення: '+field.label);value.oninput=()=>{field.value=value.value;changed()};valueBox.append(label,value);row.append(valueBox);
    const menu=element('details',null,'measurement-field-menu'),summary=element('summary','⋯');summary.setAttribute('aria-label','Налаштувати замір '+(field.label||'без назви'));menu.append(summary);row.append(menu);
    const renameParent=field.label?menu:row;const rename=input('Назва заміру',field.label,text=>{field.label=text;label.textContent=text||'Власний замір';value.setAttribute('aria-label','Значення: '+text);summary.setAttribute('aria-label','Налаштувати замір '+(text||'без назви'));changed()},renameParent);rename.dataset.measureRename=field.id;
    button('Прибрати замір',()=>{if((field.value.trim()||field.label!==M.fieldLabels[field.id])&&!confirm('Прибрати цей замір? Дію можна скасувати.'))return;remember();part.fields=part.fields.filter(f=>f!==field);changed();render()},menu);
   }
   button('+ Власний замір',()=>{if(part.fields.length>=40)return status('Можна додати до 40 полів.',true);remember();const id=M.uid();part.fields.push({id,label:'',value:''});changed();render();requestAnimationFrame(()=>panel.querySelector('[data-measure-rename="'+id+'"]')?.focus({preventScroll:true}))},card);
  }
  const advanced=element('details',null,'measurement-advanced');advanced.append(element('summary','Додатково: старі заміри, імпорт і відновлення'));panel.append(advanced);
  const legacyToggle=element('label',null,'measurement-check'),check=document.createElement('input');check.type='checkbox';check.checked=data.showLegacy;check.onchange=()=>{remember();data.showLegacy=check.checked;changed()};legacyToggle.append(check,document.createTextNode('Показувати також попередні заміри на сайті'));advanced.append(legacyToggle);
  advanced.append(element('p','Це впливає лише на відображення. Старі значення залишаються в товарі.'));
  const actions=element('div',null,'measurement-actions');advanced.append(actions);button('Завантажити резервну копію',backup,actions);
  const file=document.createElement('input');file.type='file';file.accept='application/json,.json';file.hidden=true;
  file.onchange=async()=>{try{if(!file.files[0])return;const imported=JSON.parse(await file.files[0].text());if(imported.format!=='vh-product-measurements'||imported.version!==1||String(imported.productId||'')!==String(product?.id||''))throw Error('Ця копія належить іншому товару або має непідтримуваний формат.');const next=M.validate(imported.data,true);localStorage.setItem(M.draftKey(product?.id)+':import-recovery',JSON.stringify({data,legacy:legacyValues()}));remember();data=next;active=true;selectedGroup=data.groups[0]?.id||null;setupOpen=false;legacyBox.open=false;changed();render();status('Групи імпортовано. Старі поля не змінено.')}catch(e){status(e.message,true)}finally{file.value=''}};
  button('Імпортувати чернетку замірів',()=>file.click(),actions);actions.append(file);button('Скасувати останню зміну структури',()=>{if(!history.length)return;data=history.pop();changed();render()},actions).disabled=!history.length;
  requestAnimationFrame(()=>{if(document.contains(panel)&&uiTab==='edit')window.scrollTo(window.scrollX,scroll)});
 }
 panel.addEventListener('keydown',event=>{const tab=event.target.closest('[role=tab]');if(!tab||!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;const list=tab.parentElement,tabs=[...list.querySelectorAll('[role=tab]')],index=tabs.indexOf(tab),next=event.key==='Home'?0:event.key==='End'?tabs.length-1:(index+(event.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length,label=list.getAttribute('aria-label');event.preventDefault();tabs[next].click();[...panel.querySelectorAll('[role=tablist]')].find(node=>node.getAttribute('aria-label')===label)?.querySelectorAll('[role=tab]')[next]?.focus({preventScroll:true})});
 function load(row){product=row||null;original=row?.measurements_v2==null?null:M.clone(row.measurements_v2);initialLegacy=Object.fromEntries(legacyIds.map(id=>[id,$(id)?.value||'']));history=[];active=original!=null;unsupported=false;localConflict=null;selectedTemplate=null;selectedSet='jacket_pants';selectedGroup=null;uiTab='edit';setupMode=/комплект|костюм/i.test($('pCategory')?.selectedOptions[0]?.textContent||'')?'set':'single';data={version:1,showLegacy:true,groups:[]};legacyIds.forEach(id=>$(id).disabled=false);
  try{if(original)data=M.validate(original)}catch{unsupported=true}
  let restored=false;try{const local=JSON.parse(localStorage.getItem(M.draftKey(row?.id))||'null');if(local&&!unsupported){const legacyConflict=M.legacyKeys.some((key,i)=>Object.prototype.hasOwnProperty.call(local.legacy||{},'measurement_'+key)&&local.legacyBase?.['measurement_'+key]!==initialLegacy[legacyIds[i]]&&local.legacy['measurement_'+key]!==initialLegacy[legacyIds[i]]);if(M.stable(local.base)!==M.stable(original)&&M.stable(local.data)!==M.stable(original)||legacyConflict)localConflict=local;else{if(local.data){data=M.validate(local.data,true);active=true}for(const [i,key] of M.legacyKeys.entries())if(Object.prototype.hasOwnProperty.call(local.legacy||{},'measurement_'+key))$(legacyIds[i]).value=local.legacy['measurement_'+key];restored=true}}}catch{}
  if(unsupported||localConflict)legacyIds.forEach(id=>$(id).disabled=true);
  selectedGroup=data.groups[0]?.id||null;setupOpen=!data.groups.length&&!M.legacy(row).some(field=>field.value.trim());legacyBox.open=!data.groups.length&&M.legacy(row).some(field=>field.value.trim());render();if(restored)status('Відновлено локальну чернетку замірів цього товару.');
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
 grid.addEventListener('input',()=>{try{persist()}catch{status('Не вдалося зберегти локальну копію замірів.',true)}});
 function suggest(category,subcategory){const node=$('measurementNewTemplate');if(node&&!selectedTemplate)node.value=M.guess(category,subcategory)}
 window.VHMeasurementEditor={load,prepareSave,protectUpdate,saved,suggest};
})();
