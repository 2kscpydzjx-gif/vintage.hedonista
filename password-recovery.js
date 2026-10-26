/* Customer password recovery uses the existing customer session, never the admin client. */
(()=>{
 'use strict';
 const hash=new URLSearchParams(location.hash.slice(1));
 const linkError=hash.has('error')||hash.has('error_code');
 let active=hash.get('type')==='recovery'||linkError,client,rendering=null;
 const message='Посилання недійсне або вже використане. Запросіть новий лист для відновлення.';
 function clearLink(){history.replaceState(history.state,'',location.pathname+location.search)}
 async function request(email){
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw Error('Введіть коректний email для відновлення пароля.');
  const {error}=await client.auth.resetPasswordForEmail(email,{redirectTo:new URL('account.html',document.baseURI).href});
  if(error)throw Error('Не вдалося надіслати лист. Спробуйте ще раз трохи пізніше.');
 }
 function invalid(mount){
  mount.innerHTML=`<div class="wrap"><div class="vh125-auth"><h1>ВІДНОВЛЕННЯ ПАРОЛЯ</h1><p role="status">${message}</p><form id="vhRecoveryRequest" class="vh125-auth-form"><label>EMAIL<input id="vhRecoveryEmail" type="email" autocomplete="email" required></label><button class="vh125-auth-submit" type="submit">НАДІСЛАТИ НОВЕ ПОСИЛАННЯ</button><p id="vhRecoveryMessage" role="status" aria-live="polite"></p></form><a href="index.html">НА ГОЛОВНУ →</a></div></div>`;
  mount.querySelector('form').onsubmit=async event=>{
   event.preventDefault();const button=event.target.querySelector('button'),status=mount.querySelector('#vhRecoveryMessage');
   if(button.disabled)return;button.disabled=true;status.textContent='';
   try{await request(mount.querySelector('input').value.trim());status.textContent='Якщо цей email зареєстрований, ви отримаєте лист із посиланням.'}
   catch(error){status.textContent=error.message}finally{button.disabled=false}
  };
 }
 async function render(mount){
  if(!active||!mount)return false;
  if(mount.dataset.passwordRecovery)return rendering;
  mount.dataset.passwordRecovery='1';
  rendering=(async()=>{
   mount.innerHTML='<div class="wrap"><div class="vh125-auth" role="status">Перевіряємо посилання…</div></div>';
   let session,error;
   try{const result=await client.auth.getSession();session=result.data?.session;error=result.error}catch(e){error=e}
   clearLink();
   if(linkError||error||!session){invalid(mount);return true}
   mount.innerHTML=`<div class="wrap"><div class="vh125-auth"><div class="vh125-auth-kicker">VINTAGE HEDONISTA</div><h1>НОВИЙ ПАРОЛЬ</h1><p>Введіть новий пароль щонайменше з 8 символів.</p><form id="vhRecoveryForm" class="vh125-auth-form"><label>НОВИЙ ПАРОЛЬ<input id="vhRecoveryPassword" type="password" autocomplete="new-password" minlength="8" required></label><label>ПОВТОРІТЬ ПАРОЛЬ<input id="vhRecoveryConfirm" type="password" autocomplete="new-password" minlength="8" required></label><button class="vh125-auth-submit" type="submit">ЗБЕРЕГТИ ПАРОЛЬ</button><p id="vhRecoveryMessage" role="status" aria-live="polite"></p></form></div></div>`;
   mount.querySelector('form').onsubmit=async event=>{
    event.preventDefault();const button=event.target.querySelector('button'),status=mount.querySelector('#vhRecoveryMessage');
    if(button.disabled)return;
    const password=mount.querySelector('#vhRecoveryPassword').value,confirmation=mount.querySelector('#vhRecoveryConfirm').value;
    if(password.length<8){status.textContent='Пароль має містити щонайменше 8 символів.';return}
    if(password!==confirmation){status.textContent='Паролі не збігаються.';return}
    button.disabled=true;status.textContent='Зберігаємо пароль…';
    try{
     const {error}=await client.auth.updateUser({password});
     if(error)throw error;
     active=false;
     mount.innerHTML='<div class="wrap"><div class="vh125-auth"><h1>ПАРОЛЬ ЗМІНЕНО</h1><p role="status">Новий пароль збережено. Використовуйте його для наступного входу.</p><a class="vh125-auth-submit" href="account.html">ПЕРЕЙТИ ДО КАБІНЕТУ →</a></div></div>';
    }catch(error){status.textContent='Не вдалося змінити пароль. Перевірте, чи він відповідає вимогам, або запросіть нове посилання.';button.disabled=false}
   };
   const retry=document.createElement('button');retry.type='button';retry.textContent='ЗАПРОСИТИ НОВЕ ПОСИЛАННЯ';retry.onclick=()=>invalid(mount);
   const actions=document.createElement('div');actions.className='vh125-auth-switch';actions.append(retry);mount.querySelector('.vh125-auth').append(actions);
   return true;
  })();
  return rendering;
 }
 function attach(value){
  client=value;
  client.auth.onAuthStateChange(event=>{
   if(event!=='PASSWORD_RECOVERY')return;
   active=true;
   // Do not await Supabase auth calls inside its auth state callback.
   setTimeout(()=>render(document.getElementById('accountPageMount')),0);
  });
 }
 window.VHPasswordRecovery={attach,render,request,get active(){return active}};
})();
