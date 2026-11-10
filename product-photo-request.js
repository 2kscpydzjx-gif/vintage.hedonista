(function(){
 let contactRead,sequence=0;
 const icon=body=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">${body}</svg>`;
 const icons={telegram:icon('<path d="m3 10 17-6-4 16-5-5-3 3v-5l9-6-11 5Z"/>'),email:icon('<rect x="3" y="5" width="18" height="14" rx="1"/><path d="m3 6 9 7 9-7"/>'),instagram:icon('<rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r=".75" fill="currentColor" stroke="none"/>'),copy:icon('<rect x="8" y="8" width="12" height="13" rx="1"/><path d="M16 8V3H3v13h5"/>')};
 function social(value,type){
  const text=String(value||'').trim();if(!text)return '';
  return /^https?:\/\//i.test(text)?text:`https://${type==='telegram'?'t.me':'instagram.com'}/${text.replace(/^@/,'')}`;
 }
 function publishedContacts(client){
  if(!contactRead)contactRead=(async()=>{
   let timer;
   try{
    const query=client.from('vh_page_revisions').select('shared').eq('page_key','contacts').eq('revision_status','published').maybeSingle();
    const result=await Promise.race([Promise.resolve(query),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Contact read timed out')),5000)})]);
    if(result.error)return {};
    return Object.assign({},...Object.values(result.data?.shared?.cmsPageDraft?.existing||{}).map(edit=>edit?.mapped||{}));
   }catch{return {}}finally{clearTimeout(timer)}
  })();
  return contactRead;
 }
 function contacts(settings,mapped){
  const defaults={contactsTelegramLink:settings.contacts_telegram_url||social(settings.contacts_telegram_text||settings.telegram||'Vintazhka','telegram'),contactsInstagramLink:settings.contacts_instagram_url||social(settings.contacts_instagram_text||settings.instagram||'vintage_hedonista','instagram'),contactsEmailLink:'mailto:'+(settings.contacts_email_text||settings.email||'vintazhka.shop@gmail.com')};
  return Object.fromEntries(Object.entries(defaults).map(([id,fallback])=>[id,typeof mapped[id]==='string'?mapped[id]:typeof mapped['static:#'+id+':0']==='string'?mapped['static:#'+id+':0']:fallback]));
 }
 function webLink(value,hosts){
  try{const url=new URL(value);return url.protocol==='https:'&&!url.username&&!url.password&&hosts.includes(url.hostname)?url:null}catch{return null}
 }
 function fitMessage(node){const field=node.querySelector('#photoRequestMessage');field.style.height='auto';field.style.height=Math.min(field.scrollHeight,240)+'px'}
 function release(node){if(!node._locked)return;node._locked=false;document.documentElement.style.overflow=node._previousOverflow||'';if(node._opener?.isConnected)node._opener.focus({preventScroll:true})}
 function close(node){node.close();release(node)}
 function dialog(){
  let node=document.getElementById('photoRequest');if(node)return node;
  node=document.createElement('dialog');node.id='photoRequest';node.className='vh-photo-request-dialog';node.setAttribute('aria-labelledby','photoRequestTitle');node.setAttribute('aria-describedby','photoRequestIntro');
  node.innerHTML=`<div class="vh-photo-request-top"><h2 id="photoRequestTitle">Запит додаткових фото</h2><button type="button" id="photoRequestClose" aria-label="Закрити запит додаткових фото" autofocus>${icon('<path d="m6 6 12 12M18 6 6 18"/>')}</button></div><p id="photoRequestProduct"></p><p id="photoRequestIntro">Оберіть зручний спосіб зв’язку. Назва та посилання на товар уже додані до запиту.</p><label for="photoRequestMessage">Текст запиту</label><textarea id="photoRequestMessage" rows="4" readonly></textarea><div class="vh-photo-request-actions"><a id="photoRequestTelegram" target="_blank" rel="noopener" hidden>${icons.telegram}<span>Telegram</span></a><a id="photoRequestInstagram" target="_blank" rel="noopener" hidden>${icons.instagram}<span>Instagram</span></a><a id="photoRequestEmail" hidden>${icons.email}<span>Email</span></a></div><button type="button" id="photoRequestCopy">${icons.copy}<span>Скопіювати запит</span></button><p class="vh-photo-request-hint">Для Instagram скопіюйте текст і вставте його в повідомлення.</p><p id="photoRequestStatus" role="status" aria-live="polite"></p>`;
  document.body.append(node);
  if(window.ResizeObserver){let width=0;new ResizeObserver(()=>{if(node.open&&node.clientWidth!==width){width=node.clientWidth;fitMessage(node)}}).observe(node)}
  node.querySelector('#photoRequestClose').addEventListener('click',()=>close(node));
  node.addEventListener('cancel',event=>{event.preventDefault();close(node)});
  node.addEventListener('keydown',event=>{
   if(event.key!=='Tab')return;
   const items=[...node.querySelectorAll('button,a[href],textarea')].filter(el=>!el.hidden&&el.getClientRects().length&&el.tabIndex>=0),first=items[0],last=items.at(-1);
   if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus()}
   else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus()}
  });
  node.addEventListener('click',event=>{const r=node.getBoundingClientRect();if(event.target===node&&(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom))close(node)});
  node.addEventListener('close',()=>{if(!node.open)release(node)});
  node.querySelector('#photoRequestCopy').addEventListener('click',async()=>{
   const field=node.querySelector('#photoRequestMessage'),status=node.querySelector('#photoRequestStatus');
   try{await navigator.clipboard.writeText(field.value);status.textContent='Запит скопійовано.'}
   catch{field.focus();field.select();status.textContent=typeof document.execCommand==='function'&&document.execCommand('copy')?'Запит скопійовано.':'Текст виділено — скопіюйте його та вставте в повідомлення.'}
  });
  return node;
 }
 async function open({name,url,settings={},client,opener}){
  if(!name||!url)return;
  const node=dialog(),generation=++sequence;
  node.querySelector('#photoRequestProduct').textContent=name;
  const message=`Вітаю! Хочу запросити додаткові фото товару «${name}», щоб уточнити колір, фактуру та деталі.\n\n${url}`;
  const field=node.querySelector('#photoRequestMessage');field.value=message;
  const status=node.querySelector('#photoRequestStatus');status.textContent='Завантажуємо способи зв’язку…';
  for(const id of ['photoRequestTelegram','photoRequestInstagram','photoRequestEmail'])node.querySelector('#'+id).hidden=true;
  if(!node.open){release(node);node._opener=opener||document.activeElement;node._previousOverflow=document.documentElement.style.overflow;node.showModal();node._locked=true;document.documentElement.style.overflow='hidden'}
  fitMessage(node);
  const mapped=await publishedContacts(client);if(!node.open||generation!==sequence)return;
  const links=contacts(settings,mapped),telegram=webLink(links.contactsTelegramLink,['t.me','telegram.me']);
  if(telegram&&/^\/[a-zA-Z0-9_]{5,32}\/?$/.test(telegram.pathname)){telegram.searchParams.delete('profile');telegram.searchParams.set('text',message);node.querySelector('#photoRequestTelegram').href=telegram.href;node.querySelector('#photoRequestTelegram').hidden=false}
  const instagram=webLink(links.contactsInstagramLink,['instagram.com','www.instagram.com']);
  if(instagram){node.querySelector('#photoRequestInstagram').href=instagram.href;node.querySelector('#photoRequestInstagram').hidden=false}
  try{
   const email=new URL(links.contactsEmailLink);
   if(email.protocol==='mailto:'&&/^[^\s?#]+@[^\s?#]+$/.test(email.pathname)){email.search=new URLSearchParams({subject:'Додаткові фото — '+name,body:message}).toString().replace(/\+/g,'%20');node.querySelector('#photoRequestEmail').href=email.href;node.querySelector('#photoRequestEmail').hidden=false}
  }catch{}
  if(status.textContent==='Завантажуємо способи зв’язку…')status.textContent='';
 }
 window.VHPhotoRequest={open};
})();
