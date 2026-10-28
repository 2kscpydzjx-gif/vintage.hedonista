/* Shared purchase feedback. No form values, contacts or order IDs are persisted. */
(()=>{'use strict';
 const fields={
  order:['oFirstName','oLastName','oPhone','oCity','oEmail','oDelivery'],
  cart:['checkoutName','checkoutLastName','checkoutContact','checkoutCity','checkoutEmail','checkoutDelivery']
 };
 const labels=['ім’я','прізвище','номер телефону','місто','email','відділення Нової пошти'],publicErrors=new WeakSet();
 const rootFor=kind=>document.querySelector(kind==='order'?'#orderModal .order-card-v126':'#checkoutForm');
 function problem(message){const error=new Error(message);publicErrors.add(error);return error}
 function fieldError(input,message){
  const id=input.id+'-error';let note=document.getElementById(id);
  if(!note){note=document.createElement('span');note.id=id;note.className='vh-field-error';input.insertAdjacentElement('afterend',note)}
  note.textContent=message;input.setAttribute('aria-invalid','true');
  const described=new Set((input.getAttribute('aria-describedby')||'').split(/\s+/).filter(Boolean));described.add(id);input.setAttribute('aria-describedby',[...described].join(' '));
 }
 function clearField(input){
  document.getElementById(input.id+'-error')?.remove();input.removeAttribute('aria-invalid');
  const described=(input.getAttribute('aria-describedby')||'').split(/\s+/).filter(id=>id&&id!==input.id+'-error');
  if(described.length)input.setAttribute('aria-describedby',described.join(' '));else input.removeAttribute('aria-describedby');
 }
 function clear(kind){const root=rootFor(kind);if(!root)return;root.querySelectorAll('[aria-invalid=true]').forEach(clearField);root.querySelector('.vh-checkout-feedback')?.remove()}
 function clearToast(){const toast=document.getElementById('toast');if(toast){toast.classList.remove('show');toast.textContent=''}}
 function feedback(kind,message,validation=false){
  const root=rootFor(kind);if(!root)return;let box=root.querySelector('.vh-checkout-feedback');
  if(!box){box=document.createElement('div');box.className='vh-checkout-feedback';box.setAttribute('role','alert');box.setAttribute('aria-atomic','true');box.tabIndex=-1;
   const before=root.querySelector(kind==='order'?'.order-v126-grid':'.checkout-fields');root.insertBefore(box,before||root.firstChild)}
  box.dataset.validation=String(validation);box.textContent=message;
  if(!validation){box.focus({preventScroll:true});box.scrollIntoView({block:'nearest',behavior:'instant'})}
  clearToast();
 }
 function validate(kind){
  clear(kind);let first=null;
  fields[kind].forEach((id,index)=>{
   const input=document.getElementById(id),value=input?.value.trim()||'';if(!input)return;let message='';
   if(!value)message='Заповніть '+labels[index]+'.';
   else if(index===2&&(!/^\+?[\d\s().-]+$/.test(value)||value.replace(/\D/g,'').length<9||value.replace(/\D/g,'').length>15))message='Вкажіть коректний номер телефону, наприклад +380671234567.';
   else if(index===4&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value))message='Перевірте правильність email.';
   if(message){fieldError(input,message);first=first||input}
  });
  if(!first)return true;
  feedback(kind,'Перевірте позначені поля. Дані залишилися у формі.',true);first.focus({preventScroll:true});first.scrollIntoView({block:'nearest',behavior:'instant'});return false;
 }
 function error(kind,error,{submitted=false}={}){
  const raw=String(error?.message||'');let message;
  if(publicErrors.has(error))message=raw;
  else if(raw.includes('PRODUCT_NOT_AVAILABLE'))message='Товар уже зарезервовано або продано. Перевірте склад замовлення.';
  else if(submitted&&(/fetch|network|timeout|timed out|connection|abort/i.test(raw)||navigator.onLine===false))message='Не вдалося отримати підтвердження замовлення. Воно могло бути прийняте. Перед повторним оформленням перевірте особистий кабінет або зв’яжіться з нами.';
  else if(navigator.onLine===false||/fetch|network|timeout|timed out|connection/i.test(raw))message='Немає зв’язку із сервером. Перевірте інтернет і спробуйте ще раз. Дані залишилися у формі.';
  else message='Не вдалося оформити замовлення. Спробуйте пізніше або зв’яжіться з нами. Дані залишилися у формі.';
  feedback(kind,message);return message;
 }
 function busy(kind,value){const root=rootFor(kind);if(root)root.setAttribute('aria-busy',String(value))}
 function success(kind,{items=[],total,orderNumber}={}){
  clearToast();
  const root=kind==='order'?rootFor(kind):document.querySelector('.checkout-grid');if(!root)return;
  const section=document.createElement('section');section.className='checkout-success vh-order-success';section.tabIndex=-1;section.setAttribute('role','status');section.setAttribute('aria-live','polite');
  const add=(tag,text,className)=>{const el=document.createElement(tag);el.textContent=text;if(className)el.className=className;section.append(el);return el};
  add('div','VINTAGE HEDONISTA','kicker');add('h2','ЗАМОВЛЕННЯ ПРИЙНЯТО');
  if(orderNumber&&/^[\p{L}\p{N}# /_-]{1,60}$/u.test(String(orderNumber)))add('p','Номер замовлення: '+orderNumber);
  if(items.length){const list=add('ul','');for(const item of items){const li=document.createElement('li');li.textContent=String(item.name||'Товар');list.append(li)}}
  if(Number.isFinite(total))add('p','Разом: '+new Intl.NumberFormat('uk-UA').format(total)+' грн','vh-order-success-total');
  add('p','Дякуємо! Ми зв’яжемося з вами для підтвердження наявності та деталей. Оплата на сайті не списувалася.');
  const link=add('a','ПОВЕРНУТИСЯ ДО КАТАЛОГУ →');link.href=new URL('catalog.html',document.baseURI).href;
  if(kind==='order'){
   clear(kind);root.querySelector('.vh-order-success')?.remove();root.classList.add('vh-order-confirmed');root.append(section);
   // Closing a dialog while its request runs cannot hide an accepted purchase.
   root.closest('#orderModal')?.classList.remove('hidden');document.body.classList.add('vh-modal-open');
  }else root.replaceChildren(section);
  section.focus({preventScroll:true});section.scrollIntoView({block:'nearest',behavior:'instant'});
 }
 function reset(kind){const root=rootFor(kind);if(!root)return;clear(kind);root.classList.remove('vh-order-confirmed');root.querySelector('.vh-order-success')?.remove();busy(kind,false)}
 document.addEventListener('input',event=>{
  const input=event.target;if(!input.matches?.('#orderModal input,#checkoutForm input'))return;
  if(input.getAttribute('aria-invalid')==='true')clearField(input);
  const root=input.closest('.order-card-v126,#checkoutForm'),box=root?.querySelector('.vh-checkout-feedback');
  if(box?.dataset.validation==='true'&&!root.querySelector('[aria-invalid=true]'))box.remove();
 });
 window.VHCheckoutFeedback={validate,clear,feedback,error,busy,success,reset,problem};
})();
