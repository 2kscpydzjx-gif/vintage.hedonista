/* One mounted photo editor, used by native blocks, added blocks and logos. */
(()=>{'use strict';
 const make=(tag,className,text)=>{const node=document.createElement(tag);if(className)node.className=className;if(text)node.textContent=text;return node};
 function create(options){
  const root=make('section','cms-photo-editor'),heading=make('h3',null,'Фотографії блоку');
  const select=make('select','cms-photo-select');select.setAttribute('aria-label','Вибрати фотографію');
  const count=make('p','cms-photo-count'),empty=make('p','cms-photo-empty','Для цього блоку ще немає фото. Виберіть макет із фотографією.');
  const controls=make('div','cms-photo-controls'),actions=make('div','cms-photo-actions');
  const file=make('input');file.type='file';file.accept='image/jpeg,image/png,image/webp,image/avif,image/gif';file.hidden=true;
  const upload=make('button',null,'Завантажити / замінити'),remove=make('button','secondary','Прибрати фото');
  upload.type=remove.type='button';upload.onclick=()=>file.click();actions.append(upload,remove,file);
  const deviceBar=make('div','cms-photo-devices'),deviceNames={desktop:'Комп’ютер',tablet:'Планшет',mobile:'Телефон'};
  const stage=make('div','cms-photo-stage'),image=make('img'),placeholder=make('span','cms-photo-placeholder','Фото не вибрано');
  image.alt='Кадрування вибраної фотографії';image.draggable=false;stage.append(image,placeholder);
  const status=make('p','cms-photo-status');status.setAttribute('role','status');
  const fitLabel=make('label','cms-photo-fit','Відображення'),fit=make('select');fit.setAttribute('aria-label','Відображення фотографії');
  fit.append(new Option('Заповнити область','cover'),new Option('Показати повністю','contain'));fitLabel.append(fit);
  const cropFields=make('div','cms-photo-crop-fields'),inputs={};
  for(const [key,name,min,max] of [['zoom','Масштаб',50,200],['x','Горизонталь',0,100],['y','Вертикаль',0,100]]){
   const row=make('label','cms-photo-range'),label=make('span',null,name),range=make('input'),number=make('input');
   range.type='range';number.type='number';for(const input of [range,number]){input.min=min;input.max=max;input.step='1';input.setAttribute('aria-label',name+(input===number?', %':''));input.dataset.cropControl=key;}
   const change=(input,final=false)=>{if(input.value===''||!Number.isFinite(Number(input.value))){if(final){input.value=crop()[key]}return}const value=Number(input.value);if(!final&&(value<Number(input.min)||value>Number(input.max)))return;const bounded=clamp(value,Number(input.min),Number(input.max));if(final)input.value=bounded;updateCrop({[key]:bounded})};
   range.oninput=()=>change(range);number.oninput=()=>change(number);number.onchange=()=>change(number,true);row.append(label,range,number);cropFields.append(row);inputs[key]={range,number};
  }
  const cropActions=make('div','cms-photo-actions'),center=make('button','secondary','Центрувати'),reset=make('button','secondary','Скинути кадрування'),inherit=make('button','secondary','Як на комп’ютері');
  for(const button of [center,reset,inherit])button.type='button';cropActions.append(center,reset,inherit);
  const linkDetails=make('details','cms-photo-url'),linkSummary=make('summary',null,'Посилання на фотографію'),url=make('input');
  url.type='text';url.placeholder='https://… або шлях до фото';url.setAttribute('aria-label','Посилання на фотографію');const original=make('a','cms-photo-original','Відкрити оригінал');original.target='_blank';original.rel='noopener';original.hidden=true;linkDetails.append(linkSummary,url,original);
  const hint=make('p','cms-photo-hint','Перетягуйте фото у рамці. Для кожного фото можна окремо налаштувати комп’ютер, планшет і телефон.');
  controls.append(actions,deviceBar,stage,status,fitLabel,cropFields,cropActions,linkDetails,hint);root.append(heading,select,count,empty,controls);
  let activeKey=null,device=options.initialDevice||'desktop',busy=false,drag=null,lastSource='',signature='';
  const items=()=>options.getItems(),item=()=>items().find(value=>value.key===activeKey),crop=()=>options.getCrop?.(item(),device)||{fit:'contain',x:50,y:50,zoom:100};
  const clamp=(n,a,b)=>Math.max(a,Math.min(b,Number(n)));
  function paint(){
   const value=crop(),minimum=value.fit==='contain'?50:100;
   fit.value=value.fit;image.style.objectFit=value.fit;image.style.objectPosition=value.x+'% '+value.y+'%';image.style.transformOrigin=value.x+'% '+value.y+'%';image.style.transform='scale('+value.zoom/100+')';
   for(const key of ['zoom','x','y'])for(const input of Object.values(inputs[key])){input.min=key==='zoom'?minimum:0;if(!(input.type==='number'&&document.activeElement===input)&&input.value!==String(value[key]))input.value=value[key];}
   deviceBar.querySelectorAll('button').forEach(button=>{const active=button.dataset.photoDevice===device;button.classList.toggle('active',active);button.setAttribute('aria-pressed',active)});
   inherit.hidden=device==='desktop';
  }
  function updateCrop(patch){
   if(!item()||busy)return;const value={...crop(),...patch};value.zoom=clamp(value.zoom,value.fit==='contain'?50:100,200);value.x=clamp(value.x,0,100);value.y=clamp(value.y,0,100);
   options.setCrop(item(),device,value);paint();
  }
  function refresh(){
   const list=items();if(!list.some(value=>value.key===activeKey))activeKey=list[0]?.key||null;
   const next=JSON.stringify(list.map(value=>[value.key,value.title,value.used]));
   if(next!==signature){select.replaceChildren(...list.map(value=>new Option(value.title+(value.used===false?' · поза макетом':''),value.key)));signature=next;}
   select.value=activeKey||'';empty.hidden=list.length>0;controls.hidden=!list.length;select.hidden=list.length<2;
   count.textContent=list.length?'Фото '+(list.findIndex(value=>value.key===activeKey)+1)+' з '+list.length:'';
   const current=item(),source=current?.url&&current.url!=='__removed__'?current.url:'';
   if(source!==lastSource){lastSource=source;status.textContent='';if(source){image.src=source;image.hidden=false;placeholder.hidden=true}else{image.removeAttribute('src');image.hidden=true;placeholder.hidden=false}}
   if(!source){image.hidden=true;placeholder.hidden=false}
   if(document.activeElement!==url)url.value=source;original.hidden=!/^https?:\/\//i.test(current?.originalUrl||'')||current.originalUrl===source;if(!original.hidden)original.href=current.originalUrl;else original.removeAttribute('href');
   remove.disabled=busy||!source;upload.disabled=busy;select.disabled=busy;
   for(const input of [fit,...Object.values(inputs).flatMap(value=>Object.values(value)),center,reset,inherit])input.disabled=busy||!source;
   const aspect=options.getAspect?.(current,device);const ratio=aspect>0?Math.max(.01,aspect):4/3;stage.style.aspectRatio=String(ratio);stage.style.maxWidth=280*ratio+'px';
   const allowCrop=options.allowCrop!==false;for(const node of [deviceBar,fitLabel,cropFields,cropActions,hint])node.hidden=!allowCrop;
   if(allowCrop)paint();else{image.style.objectFit='contain';image.style.transform='none'}
  }
  for(const [key,name] of Object.entries(deviceNames)){const button=make('button',null,name);button.type='button';button.dataset.photoDevice=key;button.onclick=()=>{device=key;options.onDevice?.(key);refresh();requestAnimationFrame(refresh)};deviceBar.append(button)}
  select.onchange=()=>{activeKey=select.value;refresh()};fit.onchange=()=>updateCrop({fit:fit.value});
  center.onclick=()=>updateCrop({x:50,y:50});reset.onclick=()=>updateCrop({fit:'cover',x:50,y:50,zoom:100});inherit.onclick=()=>updateCrop(options.getCrop(item(),'desktop'));
  remove.onclick=()=>{if(item()){options.setSource(item(),'__removed__');refresh()}};
  url.onchange=()=>{const value=url.value.trim();if(value&&!window.VHCMSModel.validImage(value)){status.textContent='Вкажіть коректне посилання на фотографію.';return}if(item()){options.setSource(item(),value||'__removed__');refresh()}};
  file.onchange=async()=>{
   const chosen=file.files?.[0],target=item();if(!chosen||!target)return;busy=true;refresh();status.textContent='Завантаження фотографії…';
   try{const value=await options.upload(chosen,target);options.setSource(target,typeof value==='string'?value:value.url,typeof value==='string'?undefined:value.originalUrl);status.textContent='Фото завантажено. Збережіть чернетку.'}catch(error){status.textContent='Не вдалося завантажити фото: '+error.message;options.onError?.(error)}finally{file.value='';busy=false;refresh()}
  };
  image.onload=()=>{if(image.src&&image.naturalWidth)status.textContent=image.naturalWidth+' × '+image.naturalHeight+' px'};
  image.onerror=()=>{status.textContent='Фото не завантажилось. Замініть файл або перевірте посилання.'};
  stage.onpointerdown=event=>{if(busy||options.allowCrop===false||event.button!==0||!lastSource||!image.naturalWidth)return;event.preventDefault();stage.setPointerCapture(event.pointerId);drag={pointer:event.pointerId,startX:event.clientX,startY:event.clientY,crop:{...crop()}}};
  stage.onpointermove=event=>{
   if(!drag||drag.pointer!==event.pointerId)return;const rect=stage.getBoundingClientRect(),c=drag.crop,scale=(c.fit==='contain'?Math.min:Math.max)(rect.width/image.naturalWidth,rect.height/image.naturalHeight)*c.zoom/100;
   const overflowX=image.naturalWidth*scale-rect.width,overflowY=image.naturalHeight*scale-rect.height;
   updateCrop({x:Math.abs(overflowX)>1?drag.crop.x-(event.clientX-drag.startX)/overflowX*100:drag.crop.x,y:Math.abs(overflowY)>1?drag.crop.y-(event.clientY-drag.startY)/overflowY*100:drag.crop.y});
  };
  const stop=()=>{drag=null};stage.onpointerup=stop;stage.onpointercancel=stop;stage.onlostpointercapture=stop;
  refresh();return {element:root,refresh,setDevice:value=>{device=value;refresh()},get activeKey(){return activeKey},get device(){return device}};
 }
 window.VHCMSPhotoEditor={create};
})();
