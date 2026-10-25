/* Inlined in <head> by scripts/sync-cms-boot.cjs, before any source blocks can paint. */
(()=>{'use strict';
 const root=document.documentElement;let state='pending',timer,status;
 const start=()=>{clearTimeout(timer);timer=setTimeout(()=>fail(),25000)};
 function paint(){
  if(!document.body)return;
  // The branded intro owns normal startup. Only failures need a status message.
  if(state!=='error'){status?.remove();status=null;return}
  if(!status){status=document.createElement('div');status.id='vh-cms-load-status';document.body.append(status)}
  status.replaceChildren();status.setAttribute('role','alert');status.setAttribute('aria-live','polite');
  const message=document.createElement('p');message.textContent='Не вдалося завантажити сторінку. Спробуйте ще раз.';status.append(message);
  const retry=document.createElement('button');retry.type='button';retry.textContent='Спробувати ще раз';retry.onclick=()=>location.reload();status.append(retry);
 }
 function hold(){state='pending';root.classList.add('vh-cms-booting');root.dataset.vhCmsLoad=state;start();paint()}
 function ready(){const changed=state!=='ready';state='ready';clearTimeout(timer);root.dataset.vhCmsLoad=state;paint();root.classList.remove('vh-cms-booting');if(changed)window.dispatchEvent(new Event('vh:cms-ready'))}
 function fail(){state='error';clearTimeout(timer);root.classList.add('vh-cms-booting');root.dataset.vhCmsLoad=state;paint()}
 window.VHCMSBoot={hold,ready,fail,get state(){return state}};
 hold();document.addEventListener('DOMContentLoaded',paint,{once:true});
})();
