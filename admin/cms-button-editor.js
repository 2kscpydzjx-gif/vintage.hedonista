/* Existing CTA positioning. Data and history stay in cms-builder.js. */
(()=>{'use strict';
 const make=(tag,cls,text)=>{const node=document.createElement(tag);if(cls)node.className=cls;if(text)node.textContent=text;return node};
 function create(options){
  const root=make('section','cms-native-buttons-editor'),heading=make('h4',null,'НАЯВНІ КНОПКИ'),select=make('select'),controls=make('div'),status=make('p','cms96-help');
  select.setAttribute('aria-label','Вибрати наявну кнопку');
  const mode=make('select');mode.setAttribute('aria-label','Розташування кнопки');mode.append(new Option('Оригінальне розташування','original'),new Option('У тексті · вирівнювання','flow'),new Option('Вільно в межах блоку','free'));
  const align=make('select');align.setAttribute('aria-label','Вирівнювання наявної кнопки');align.append(new Option('Ліворуч','left'),new Option('По центру','center'),new Option('Праворуч','right'));
  const devices=make('div','cms-photo-devices'),names={desktop:'Комп’ютер',tablet:'Планшет',mobile:'Телефон'};
  let key=null,device=options.initialDevice||'desktop',editing=false,doc=null,drag=null,signature='';const axes={};
  const value=()=>options.getPosition(key,device),node=()=>options.getNode(key),bound=n=>Math.max(0,Math.min(100,n));
  const save=patch=>{if(key)options.setPosition(key,device,patch);refresh()};
  for(const [axis,title] of [['x','Горизонталь'],['y','Вертикаль']]){
   const row=make('label','cms-dimension'),label=make('span',null,title),range=make('input'),number=make('input');range.type='range';number.type='number';
   for(const input of [range,number]){input.min=0;input.max=100;input.step=1;input.setAttribute('aria-label',title+' кнопки'+(input===number?', %':''));input.dataset.buttonAxis=axis;input.oninput=()=>{if(input.value===''||Number(input.value)<0||Number(input.value)>100)return;save({[axis]:Number(input.value)})}}
   number.onchange=()=>save({[axis]:bound(Number(number.value)||0)});row.append(label,range,number);axes[axis]={row,range,number};controls.append(row);
  }
  const styleDetails=make('details','cms-button-appearance'),styleTitle=make('summary',null,'Вигляд і розмір кнопки'),styleFields=make('div','cms-button-style-fields');styleDetails.append(styleTitle,styleFields);
  const appearance=make('select');appearance.setAttribute('aria-label','Стиль наявної кнопки');
  appearance.append(new Option('Оригінальний вигляд','original'),new Option('Суцільна','solid'),new Option('Контурна','outline'),new Option('М’яке тло','soft'),new Option('Текстова','text'));
  appearance.onchange=()=>save({appearance:appearance.value,backgroundColor:null,textColor:null,borderColor:null});styleFields.append(appearance);
  const dimensions={};
  const metrics=()=>{const target=node();if(!target)return {};const style=target.ownerDocument.defaultView.getComputedStyle(target);return {width:target.offsetWidth,height:target.offsetHeight,fontSize:parseFloat(style.fontSize),paddingX:parseFloat(style.paddingLeft),paddingY:parseFloat(style.paddingTop),radius:parseFloat(style.borderTopLeftRadius),borderWidth:parseFloat(style.borderTopWidth),backgroundColor:style.backgroundColor,textColor:style.color,borderColor:style.borderTopColor}};
  function dimension(key,title,min,max,fallback){
   const row=make('label','cms-dimension'),label=make('span',null,title),range=make('input'),number=make('input');range.type='range';number.type='number';
   const update=(input,final=false)=>{if(input.value===''){if(final)refresh();return}let v=Number(input.value);if(!Number.isFinite(v))return;if(!final&&(v<min||v>max))return;v=Math.max(min,Math.min(max,v));save({[key]:v});if(final)number.value=v};
   for(const input of [range,number]){input.min=min;input.max=max;input.step=1;input.dataset.buttonStyle=key;input.setAttribute('aria-label',title+' кнопки'+(input===number?', px':''));input.oninput=()=>update(input)}number.onchange=()=>update(number,true);
   row.append(label,range,number);styleFields.append(row);dimensions[key]={row,range,number,fallback,min,max};return row;
  }
  const sizes={};for(const [key,title,min,max,fallback] of [['width','Ширина',40,800,160],['height','Висота',24,200,44]]){
   const sizeMode=make('select');sizeMode.setAttribute('aria-label',title+' кнопки: режим');sizeMode.append(new Option(title+' · як в оригіналі','original'),new Option(title+' · за вмістом','auto'),new Option(title+' · точна','fixed'));styleFields.append(sizeMode);
   dimension(key,title,min,max,fallback);sizes[key]=sizeMode;sizeMode.onchange=()=>save({[key]:sizeMode.value==='original'?null:sizeMode.value==='auto'?'auto':Math.max(min,Math.min(max,Number(dimensions[key].number.value)||fallback))});
  }
  dimension('fontSize','Текст',8,48,12);dimension('paddingX','Відступи з боків',0,80,16);dimension('paddingY','Відступи згори/знизу',0,80,10);dimension('radius','Заокруглення',0,100,0);dimension('borderWidth','Товщина рамки',0,10,1);
  const colors={};for(const [key,title,fallback] of [['backgroundColor','Тло','#0d0c09'],['textColor','Колір тексту','#eee1ce'],['borderColor','Колір рамки','#b7956d']]){
   const row=make('label','cms-button-color'),label=make('span',null,title),input=make('input');input.type='color';input.setAttribute('aria-label',title+' кнопки');input.oninput=()=>save({[key]:input.value});row.append(label,input);styleFields.append(row);colors[key]={input,fallback};
  }
  const transparentLabel=make('label','cms-button-transparent'),transparent=make('input');transparent.type='checkbox';transparent.setAttribute('aria-label','Прозоре тло кнопки');transparent.onchange=()=>save({backgroundColor:transparent.checked?'transparent':colors.backgroundColor.input.value});transparentLabel.append(transparent,document.createTextNode('Прозоре тло'));styleFields.append(transparentLabel);
  const resetStyle=make('button','secondary','Скинути вигляд кнопки');resetStyle.type='button';resetStyle.onclick=()=>save({appearance:'original',width:null,height:null,fontSize:null,paddingX:null,paddingY:null,radius:null,borderWidth:null,backgroundColor:null,textColor:null,borderColor:null});styleFields.append(resetStyle);
  const asHex=(color,fallback)=>{if(/^#[a-f0-9]{6}$/i.test(color||''))return color;const rgb=String(color||'').match(/[\d.]+/g);if(!rgb||rgb.length<3)return fallback;return '#'+rgb.slice(0,3).map(n=>Math.max(0,Math.min(255,Math.round(Number(n)))).toString(16).padStart(2,'0')).join('')};
  function paintStyle(){
   const current=value(),computed=metrics();appearance.value=current.appearance||'original';
   for(const [key,control] of Object.entries(dimensions)){const specified=current[key]!=null&&current[key]!=='auto'?current[key]:computed[key]??control.fallback;const v=Math.max(control.min,Math.min(control.max,specified));for(const input of [control.range,control.number])if(document.activeElement!==input)input.value=Math.round(v);if(sizes[key]){sizes[key].value=current[key]==null?'original':current[key]==='auto'?'auto':'fixed';control.row.hidden=current[key]==null||current[key]==='auto'}}
   for(const [key,control] of Object.entries(colors))if(document.activeElement!==control.input)control.input.value=asHex(current[key]??computed[key],control.fallback);transparent.checked=current.backgroundColor==='transparent'||(!current.backgroundColor&&computed.backgroundColor==='rgba(0, 0, 0, 0)');
  }
  const dragButton=make('button','secondary','Перемістити у перегляді'),reset=make('button','secondary','Повернути на початкове місце');dragButton.type=reset.type='button';
  dragButton.onclick=()=>{editing=!editing;if(editing&&value().mode!=='free')save({mode:'free'});refresh()};
  reset.onclick=()=>{editing=false;options.setPosition(key,device,{mode:'original',align:'left',x:50,y:80});refresh()};
  const inherit=make('button','secondary','Як на комп’ютері');inherit.type='button';inherit.onclick=()=>{options.reset(key,device);refresh()};
  const actions=make('div','cms-photo-actions');actions.append(dragButton,reset,inherit);
  for(const [id,title] of Object.entries(names)){const button=make('button',null,title);button.type='button';button.dataset.buttonDevice=id;button.onclick=()=>{device=id;editing=false;options.onDevice(id);refresh()};devices.append(button)}
  select.onchange=()=>{key=select.value;editing=value().mode==='free';refresh()};mode.onchange=()=>{editing=mode.value==='free';save({mode:mode.value})};align.onchange=()=>save({align:align.value});
  controls.prepend(devices,mode,align);controls.append(actions,styleDetails,status);root.append(heading,select,controls);
  const mark=()=>{doc?.querySelectorAll('[data-vh-button-drag]').forEach(el=>el.removeAttribute('data-vh-button-drag'));if(editing){const target=node();if(target)target.dataset.vhButtonDrag='true'}dragButton.classList.toggle('active',editing);dragButton.setAttribute('aria-pressed',editing)};
  function down(event){
   const target=node();if(!editing||!target||!target.contains(event.target)||event.button!==0)return;
   const host=target.closest('.vh-cms-button-layer')?.parentElement;if(!host)return;
   event.preventDefault();event.stopImmediatePropagation();const rect=target.getBoundingClientRect();
   drag={target,host,pointer:event.pointerId,offsetX:event.clientX-rect.left,offsetY:event.clientY-rect.top,x:value().x,y:value().y};target.dataset.vhButtonCaptured='true';target.setPointerCapture(event.pointerId);
  }
  function move(event){
   if(!drag||drag.pointer!==event.pointerId)return;event.preventDefault();const rect=drag.host.getBoundingClientRect(),target=drag.target,width=target.offsetWidth,height=target.offsetHeight;
   drag.x=bound((event.clientX-rect.left-drag.offsetX)/Math.max(1,rect.width-width)*100);drag.y=bound((event.clientY-rect.top-drag.offsetY)/Math.max(1,rect.height-height)*100);
   target.style.setProperty('left','calc('+drag.x+'% - '+width*drag.x/100+'px)','important');target.style.setProperty('top','calc('+drag.y+'% - '+height*drag.y/100+'px)','important');
   for(const axis of ['x','y'])axes[axis].range.value=axes[axis].number.value=Math.round(drag[axis]);
  }
  function up(event){if(!drag||drag.pointer!==event.pointerId)return;event.preventDefault();event.stopImmediatePropagation();const position={x:Math.round(drag.x),y:Math.round(drag.y),mode:'free'};drag.target.removeAttribute('data-vh-button-captured');drag=null;save(position)}
  const suppress=event=>{if(editing&&node()?.contains(event.target)){event.preventDefault();event.stopImmediatePropagation()}};
  const cancel=event=>{if(event.key!=='Escape'||!editing)return;event.preventDefault();if(drag){drag.target.removeAttribute('data-vh-button-captured');drag=null;options.reconcile?.()}editing=false;refresh()};
  function detach(){if(!doc)return;for(const [type,fn] of [['pointerdown',down],['pointermove',move],['pointerup',up],['pointercancel',up],['click',suppress],['keydown',cancel]])doc.removeEventListener(type,fn,true);doc.querySelectorAll('[data-vh-button-drag]').forEach(el=>el.removeAttribute('data-vh-button-drag'));doc=null}
  function refresh(){
   const items=options.getItems();if(!items.some(item=>item.id===key))key=items[0]?.id||null;
   const next=JSON.stringify(items.map(item=>[item.id,item.label]));if(next!==signature){select.replaceChildren(...items.map(item=>new Option(item.label,item.id)));signature=next}
   root.hidden=!items.length;select.value=key||'';controls.hidden=!key;if(!key)return;
   const current=value();paintStyle();mode.value=current.mode;align.value=current.align;align.hidden=current.mode!=='flow';for(const axis of ['x','y']){axes[axis].row.hidden=current.mode!=='free';for(const input of [axes[axis].range,axes[axis].number])if(document.activeElement!==input)input.value=Math.round(current[axis])}
   devices.querySelectorAll('button').forEach(button=>{const active=button.dataset.buttonDevice===device;button.classList.toggle('active',active);button.setAttribute('aria-pressed',active)});inherit.hidden=device==='desktop';
   status.textContent=editing?'Перетягніть виділену кнопку у перегляді. Вона залишиться всередині свого блоку.':'Позиція й вигляд зберігаються окремо для кожної кнопки та екрана.';
   const nextDoc=options.getDocument();if(nextDoc!==doc){detach();doc=nextDoc;if(doc){for(const [type,fn] of [['pointerdown',down],['pointermove',move],['pointerup',up],['pointercancel',up],['click',suppress],['keydown',cancel]])doc.addEventListener(type,fn,true)}}mark();
  }
  refresh();return {element:root,refresh,setDevice(value){device=value;editing=false;refresh()},destroy(){editing=false;detach()}};
 }
 window.VHCMSButtonEditor={create};
})();
