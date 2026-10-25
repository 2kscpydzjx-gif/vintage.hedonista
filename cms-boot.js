/* Inlined in <head> by scripts/sync-cms-boot.cjs, before any source blocks can paint. */
(()=>{'use strict';
 const root=document.documentElement;let state='pending',timer,status;const visibleJobs=[];
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
 function flushVisible(){if(state!=='ready'||document.body?.classList.contains('vh-intro-active'))return;while(visibleJobs.length){try{visibleJobs.shift()()}catch(error){console.warn('Entry motion failed',error)}}}
 function whenVisible(job){visibleJobs.push(job);flushVisible()}
 document.addEventListener('vh:intro-finished',flushVisible);
 function hold(){state='pending';root.classList.add('vh-cms-booting');root.dataset.vhCmsLoad=state;start();paint()}
 function ready(){const changed=state!=='ready';state='ready';clearTimeout(timer);root.dataset.vhCmsLoad=state;paint();flushVisible();root.classList.remove('vh-cms-booting');if(changed)window.dispatchEvent(new Event('vh:cms-ready'))}
 function fail(){state='error';clearTimeout(timer);root.classList.add('vh-cms-booting');root.dataset.vhCmsLoad=state;paint()}
 window.VHCMSBoot={hold,ready,fail,whenVisible,get state(){return state}};
 hold();document.addEventListener('DOMContentLoaded',paint,{once:true});
})();
