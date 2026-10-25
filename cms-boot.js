/* Inlined in <head> by scripts/sync-cms-boot.cjs, before any source blocks can paint. */
(()=>{'use strict';
 const root=document.documentElement;let state='pending',timer,status;
 const start=()=>{clearTimeout(timer);timer=setTimeout(()=>fail(),25000)};
 function paint(){
  if(!document.body)return;
  if(state==='ready'){status?.remove();status=null;return}
  if(!status){status=document.createElement('div');status.id='vh-cms-load-status';document.body.append(status)}
  status.replaceChildren();status.setAttribute('role',state==='error'?'alert':'status');status.setAttribute('aria-live','polite');
  const message=document.createElement('p');message.textContent=state==='error'?'Не вдалося завантажити сторінку. Спробуйте ще раз.':'Завантаження сторінки…';status.append(message);
  if(state==='error'){const retry=document.createElement('button');retry.type='button';retry.textContent='Спробувати ще раз';retry.onclick=()=>location.reload();status.append(retry)}
 }
 function hold(){state='pending';root.classList.add('vh-cms-booting');root.dataset.vhCmsLoad=state;start();paint()}
 function ready(){state='ready';clearTimeout(timer);root.dataset.vhCmsLoad=state;paint();root.classList.remove('vh-cms-booting')}
 function fail(){state='error';clearTimeout(timer);root.classList.add('vh-cms-booting');root.dataset.vhCmsLoad=state;paint()}
 window.VHCMSBoot={hold,ready,fail,get state(){return state}};
 hold();document.addEventListener('DOMContentLoaded',paint,{once:true});
})();
