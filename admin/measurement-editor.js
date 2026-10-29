/* Optional grouped measurements; review deployments persist only browser drafts. */
(()=>{'use strict';
 const M=window.VHMeasurements,section=document.getElementById('productMeasurementsSection');if(!M||!section)return;
 const $=id=>document.getElementById(id),grid=$('measurementFieldsV148'),panel=document.createElement('div');panel.id='measurementEditor';section.insertBefore(panel,grid);
 const legacyIds=['pMeasureShoulders','pMeasureChest','pMeasureWaist','pMeasureHips','pMeasureLength','pMeasureSleeve','pMeasureInseam','pMeasureInsole','pMeasureHead','pMeasureWidth','pMeasureHeight','pMeasureDepth'];
 const review=location.hostname.endsWith('.vercel.app')||window.VH_CONFIG?.measurementsStorage!=='database';
 let product=null,data={version:1,showLegacy:true,groups:[]},original=null,initialLegacy={},active=false,unsupported=false,history=[],localConflict=null,selectedTemplate=null;
 const element=(tag,text,cls)=>{const node=document.createElement(tag);if(text!=null)node.textContent=text;if(cls)node.className=cls;return node};
 const legacyValues=()=>Object.fromEntries(M.legacyKeys.map((key,i)=>['measurement_'+key,$(legacyIds[i])?.value||'']));
 const legacyChanged=()=>legacyIds.some(id=>($(id)?.value||'')!==initialLegacy[id]);
 function status(text,error=false){const node=$('measurementEditorStatus');if(node){node.textContent=text;node.classList.toggle('error',error)}}
 function remember(){history.push(M.clone(data));history=history.slice(-20)}
 function persist(){if(!active&&!legacyChanged())return;const changed=Object.fromEntries(M.legacyKeys.flatMap((key,i)=>$(legacyIds[i]).value!==initialLegacy[legacyIds[i]]?[['measurement_'+key,$(legacyIds[i]).value]]:[])),base=Object.fromEntries(M.legacyKeys.flatMap((key,i)=>Object.prototype.hasOwnProperty.call(changed,'measurement_'+key)?[['measurement_'+key,initialLegacy[legacyIds[i]]]]:[]));localStorage.setItem(M.draftKey(product?.id),JSON.stringify({version:1,base:original,data:active?data:null,legacy:changed,legacyBase:base,at:new Date().toISOString()}))}
 function changed(){active=true;try{persist();status(review?'Чернетку замірів збережено в цьому браузері.':'Є незбережені зміни замірів.')}catch{status('Браузер не зберіг чернетку. Завантажте резервну копію.',true)}}
 function button(text,fn,parent){const node=element('button',text);node.type='button';node.onclick=fn;parent.append(node);return node}
 function input(label,value,fn,parent,placeholder=''){const box=element('label',label,'measurement-input'),node=document.createElement('input');node.className='input';node.value=value;node.placeholder=placeholder;node.setAttribute('aria-label',label);node.oninput=()=>fn(node.value);box.append(node);parent.append(box);return node}
 function select(label,options,value,fn,parent){const box=element('label',label,'measurement-input'),node=document.createElement('select');node.setAttribute('aria-label',label);for(const [key,title] of options)node.add(new Option(title,key));node.value=value;node.onchange=()=>fn(node.value);box.append(node);parent.append(box);return node}
 function backup(){const blob=new Blob([JSON.stringify({format:'vh-product-measurements',version:1,productId:product?.id||null,original,legacy:legacyValues(),pending:localConflict,data},null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='product-measurements-'+(product?.id||'new')+'.json';a.hidden=true;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000)}
 function render(){
  panel.replaceChildren();const note=element('p',review?'Тестові заміри: чернетка цього розділу зберігається тільки у вашому браузері. Зміни замірів через загальну кнопку «Зберегти» також не записуються в робочу базу.':'Шаблон замірів можна вибирати незалежно від категорії. Комплект залишається одним товаром.','measurement-mode');panel.append(note);
  if(unsupported){panel.append(element('p','Збережений формат не підтримується цим редактором. Дані залишено без змін.','measurement-error'));button('Завантажити дані',backup,panel);return}
  if(localConflict){panel.append(element('p','На сервері заміри змінилися після створення локальної чернетки. Обидві версії збережено.','measurement-error'));button('Завантажити обидві версії',backup,panel);button('Відновити мою локальну чернетку',()=>{try{const pending=localConflict;if(pending.data){data=M.validate(pending.data,true);active=true}for(const [i,key] of M.legacyKeys.entries())if(Object.prototype.hasOwnProperty.call(pending.legacy||{},'measurement_'+key))$(legacyIds[i]).value=pending.legacy['measurement_'+key];localConflict=null;legacyIds.forEach(id=>$(id).disabled=false);changed();render()}catch(e){status(e.message,true)}},panel);button('Працювати із серверними замірами',()=>{const key=M.draftKey(product?.id);localStorage.setItem(key+':recovery',JSON.stringify(localConflict));localStorage.removeItem(key);localConflict=null;legacyIds.forEach(id=>$(id).disabled=false);render()},panel);const message=element('p');message.id='measurementEditorStatus';message.setAttribute('role','status');panel.append(message);return}
  const help=element('p','Для нових полів чітко вказано спосіб вимірювання. Значення вводьте як є: «46 см», «35–40 см», «регулюється». Старі заміри не перераховуються.');panel.append(help);
  const controls=element('div',null,'measurement-tools');panel.append(controls);
  const template=select('Шаблон нового виробу',Object.entries(M.templates).map(([key,t])=>[key,t.title]),selectedTemplate||M.guess({name:$('pCategory')?.selectedOptions[0]?.textContent},{name:$('pSubcategory')?.selectedOptions[0]?.textContent}),()=>{},controls);template.id='measurementNewTemplate';
  template.onchange=()=>{selectedTemplate=template.value;template.dataset.manual='true'};
  button('Додати виріб / складову',()=>{if(data.groups.length>=12)return status('Можна додати до 12 складових.',true);remember();data.groups.push(M.group(template.value));changed();render()},controls);
  const preset=select('Готовий комплект',Object.entries(M.sets).map(([key,set])=>[key,set.title]),'jacket_pants',()=>{},controls);
  button('Додати комплект',()=>{const set=M.sets[preset.value];if(data.groups.length+set.parts.length>12)return status('Забагато складових.',true);remember();data.groups.push(...set.parts.map(([key,title])=>M.group(key,title)));changed();render()},controls);
  const groups=element('div',null,'measurement-groups');panel.append(groups);
  for(const [index,part] of data.groups.entries()){
   const card=element('section',null,'measurement-part');card.dataset.groupId=part.id;groups.append(card);
   input('Назва складової '+(index+1),part.title,value=>{part.title=value;changed()},card,'Наприклад: Жакет');
   select('Шаблон складової '+(index+1),Object.entries(M.templates).map(([key,t])=>[key,t.title]),part.template||'custom',value=>{const next=M.changeTemplate(part,value);if(next.fields.length>40){render();status('Новий шаблон перевищує ліміт 40 полів. Заповнені значення залишено без змін.',true);return}remember();data.groups[index]=next;changed();render();status('Заповнені заміри збережено, навіть якщо їх немає в новому шаблоні.')},card);
   const actions=element('div',null,'measurement-actions');card.append(actions);
   button('Вище',()=>{if(!index)return;remember();[data.groups[index-1],data.groups[index]]=[part,data.groups[index-1]];changed();render()},actions).disabled=index===0;
   button('Нижче',()=>{if(index===data.groups.length-1)return;remember();[data.groups[index+1],data.groups[index]]=[part,data.groups[index+1]];changed();render()},actions).disabled=index===data.groups.length-1;
   button('Прибрати складову',()=>{if(part.fields.some(f=>f.value.trim())&&!confirm('Прибрати цю складову з її замірами? Дію можна скасувати.'))return;remember();data.groups.splice(index,1);changed();render()},actions);
   for(const field of part.fields){const row=element('div',null,'measurement-field-row');row.dataset.fieldId=field.id;card.append(row);input('Назва заміру',field.label,value=>{field.label=value;changed()},row);input('Значення: '+field.label,field.value,value=>{field.value=value;changed()},row,'Наприклад: 46 см або 35–40 см');button('Прибрати замір',()=>{if(field.value.trim()&&!confirm('Прибрати заповнений замір? Дію можна скасувати.'))return;remember();part.fields=part.fields.filter(f=>f!==field);changed();render()},row)}
   button('Додати власний замір',()=>{if(part.fields.length>=40)return status('Можна додати до 40 замірів у складовій.',true);remember();part.fields.push({id:M.uid(),label:'',value:''});changed();render()},card);
  }
  const legacyToggle=element('label',null,'measurement-check'),check=document.createElement('input');check.type='checkbox';check.checked=data.showLegacy;check.onchange=()=>{remember();data.showLegacy=check.checked;changed()};legacyToggle.append(check,document.createTextNode('Показувати раніше введені заміри на сторінці товару'));panel.append(legacyToggle);
  panel.append(element('p','Раніше введені значення залишаються в полях нижче. Для комплекту перенесіть потрібні значення вручну до відповідних складових. Приховування старого блоку не видаляє ці дані.'));
  const actions=element('div',null,'measurement-actions');panel.append(actions);
  button('Зберегти заміри локально',()=>{try{if(active)M.validate(data);persist();status('Заміри збережено в цьому браузері. Робочу базу не змінено.')}catch(e){status(e.message,true)}},actions);
  const preview=button('Переглянути заміри в товарі',()=>{try{if(active)M.validate(data);persist();const url=new URL('../product.html',location.href);url.searchParams.set('slug',product.slug);url.searchParams.set('vh-measurements-preview',product.id);window.open(url.href,'_blank','noopener')}catch(e){status(e.message,true)}},actions);preview.disabled=!product?.id;
  button('Завантажити резервну копію',backup,actions);
  const file=document.createElement('input');file.type='file';file.accept='application/json,.json';file.hidden=true;
  file.onchange=async()=>{try{if(!file.files[0])return;const imported=JSON.parse(await file.files[0].text());if(imported.format!=='vh-product-measurements'||imported.version!==1||String(imported.productId||'')!==String(product?.id||''))throw Error('Ця копія належить іншому товару або має непідтримуваний формат.');const next=M.validate(imported.data,true);localStorage.setItem(M.draftKey(product?.id)+':import-recovery',JSON.stringify({data,legacy:legacyValues()}));remember();data=next;active=true;changed();render();status('Додаткові групи імпортовано в чернетку. Старі поля замірів не змінено.')}catch(e){status(e.message,true)}finally{file.value=''}};
  button('Імпортувати чернетку замірів',()=>file.click(),actions);actions.append(file);
  button('Скасувати останню зміну структури',()=>{if(!history.length)return;data=history.pop();changed();render()},actions).disabled=!history.length;
  const message=element('p',null);message.id='measurementEditorStatus';message.setAttribute('role','status');panel.append(message);
 }
 function load(row){product=row||null;original=row?.measurements_v2==null?null:M.clone(row.measurements_v2);initialLegacy=Object.fromEntries(legacyIds.map(id=>[id,$(id)?.value||'']));history=[];active=original!=null;unsupported=false;localConflict=null;selectedTemplate=null;data={version:1,showLegacy:true,groups:[]};legacyIds.forEach(id=>$(id).disabled=false);
  try{if(original)data=M.validate(original)}catch{unsupported=true}
  let restored=false;try{const local=JSON.parse(localStorage.getItem(M.draftKey(row?.id))||'null');if(local&&!unsupported){const legacyConflict=M.legacyKeys.some((key,i)=>Object.prototype.hasOwnProperty.call(local.legacy||{},'measurement_'+key)&&local.legacyBase?.['measurement_'+key]!==initialLegacy[legacyIds[i]]&&local.legacy['measurement_'+key]!==initialLegacy[legacyIds[i]]);if(M.stable(local.base)!==M.stable(original)&&M.stable(local.data)!==M.stable(original)||legacyConflict)localConflict=local;else{if(local.data){data=M.validate(local.data,true);active=true}for(const [i,key] of M.legacyKeys.entries())if(Object.prototype.hasOwnProperty.call(local.legacy||{},'measurement_'+key))$(legacyIds[i]).value=local.legacy['measurement_'+key];restored=true}}}catch{}
  if(unsupported||localConflict)legacyIds.forEach(id=>$(id).disabled=true);
  render();if(restored)status('Відновлено локальну чернетку замірів цього товару.');
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
