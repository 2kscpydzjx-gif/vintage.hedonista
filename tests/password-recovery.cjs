const assert=require('node:assert/strict');
const {fixture}=require('./cms-browser-fixture.cjs');
const base='http://127.0.0.1:8765';
const sdk=`(()=>{
 const q=table=>{const result={};for(const method of ['select','eq','in','order','limit','maybeSingle','single'])result[method]=()=>result;result.then=resolve=>{if(table==='orders')window.__accountDataPending=true;return new Promise(r=>setTimeout(r,table==='orders'?(window.__accountDelay||0):0)).then(()=>resolve({data:table==='site_settings'?{id:1}:table==='vh_page_revisions'?null:[],error:null}))};return result};
 const callbacks=[];window.__sendRecovery=()=>callbacks.forEach(cb=>cb('PASSWORD_RECOVERY'));
 const auth={getSession:async()=>({data:{session:window.__expired?null:{user:{id:'isolated-customer'}}},error:null}),getUser:async()=>({data:{user:window.__signedIn?{id:'isolated-customer',email:'customer@example.test'}:null},error:null}),onAuthStateChange:cb=>{callbacks.push(cb);return {data:{subscription:{unsubscribe(){}}}}},resetPasswordForEmail:async(email,options)=>{await window.__recoveryCall({op:'request',email,options});return {error:window.__requestError?{message:'test error'}:null}},updateUser:async payload=>{await window.__recoveryCall({op:'update',payload});return {error:window.__updateError?{message:'test error'}:null}}};
 window.supabase={createClient:()=>({from:q,auth,rpc:async()=>({data:true,error:null})})};
})()`;
(async()=>{const f=await fixture(),calls=[];try{
 await f.context.exposeBinding('__recoveryCall',async(_,input)=>{calls.push(input);await new Promise(r=>setTimeout(r,80))});
 await f.context.route('**/npm/@supabase/supabase-js@2',route=>route.fulfill({contentType:'text/javascript',body:sdk}));
 for(const width of [1440,390]){
  const p=await f.context.newPage();await p.setViewportSize({width,height:850});
  await p.goto(base+'/account.html#access_token=isolated-test&refresh_token=isolated-test&type=recovery');
  await p.waitForSelector('#vhRecoveryForm');assert.equal(new URL(p.url()).hash,'','recovery credentials remain in URL');
  await p.fill('#vhRecoveryPassword','new-password-123');await p.fill('#vhRecoveryConfirm','different-password');
  await p.click('#vhRecoveryForm button');await p.waitForFunction(()=>document.querySelector('#vhRecoveryMessage')?.textContent.includes('не збігаються'));
  const before=calls.filter(x=>x.op==='update').length;
  await p.fill('#vhRecoveryConfirm','new-password-123');await p.evaluate(()=>{window.__updateError=true});await p.click('#vhRecoveryForm button');
  await p.waitForFunction(()=>document.querySelector('#vhRecoveryMessage')?.textContent.includes('Не вдалося змінити'));
  assert.equal(await p.locator('#vhRecoveryForm button').isEnabled(),true);
  await p.evaluate(()=>{window.__updateError=false});await p.click('#vhRecoveryForm button');
  await p.getByRole('heading',{name:'ПАРОЛЬ ЗМІНЕНО'}).waitFor();assert.equal(calls.filter(x=>x.op==='update').length,before+2);
  assert.deepEqual(calls.filter(x=>x.op==='update').at(-1).payload,{password:'new-password-123'});
  assert.equal(await p.locator('a[href="account.html"]').count(),1);assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await p.close();
 }
 const expired=await f.context.newPage();await expired.addInitScript(()=>{window.__expired=true});
 await expired.goto(base+'/account.html#error=access_denied&error_code=otp_expired&error_description=Expired');
 await expired.waitForSelector('#vhRecoveryRequest');assert.equal(new URL(expired.url()).hash,'');
 await expired.fill('#vhRecoveryEmail','customer@example.test');await expired.evaluate(()=>{window.__requestError=true});await expired.click('#vhRecoveryRequest button');
 await expired.waitForFunction(()=>document.querySelector('#vhRecoveryMessage')?.textContent.includes('Не вдалося надіслати'));
 await expired.evaluate(()=>{window.__requestError=false});await expired.click('#vhRecoveryRequest button');await expired.waitForFunction(()=>document.querySelector('#vhRecoveryMessage')?.textContent.includes('ви отримаєте лист'));
 assert.equal(calls.at(-1).options.redirectTo,base+'/account.html');await expired.close();
 // An expired session without an explicit provider error also gets the retry form.
 const noSession=await f.context.newPage();await noSession.addInitScript(()=>{window.__expired=true});await noSession.goto(base+'/account.html#type=recovery');await noSession.waitForSelector('#vhRecoveryRequest');await noSession.close();
 for(const path of ['/index.html','/seo-category/aksesuary/index.html']){
  const login=await f.context.newPage();await login.goto(base+path);await login.waitForFunction(()=>window.VHCMSBoot.state==='ready');await login.locator('[data-header-profile]').click();await login.waitForSelector('#vhAuthLogin');
  await login.fill('#vhAuthLogin','customer@example.test');await login.click('#vhAuthReset');await login.waitForFunction(()=>document.querySelector('#vhAuthMessage')?.textContent.includes('ви отримаєте лист'));
  assert.equal(calls.at(-1).options.redirectTo,base+'/account.html');await login.close();
 }
 // Recovery emitted after SDK initialization also takes precedence over account content.
 const event=await f.context.newPage();await event.addInitScript(()=>{window.__signedIn=true});await event.goto(base+'/account.html');await event.waitForFunction(()=>document.querySelector('#accountPageMount h1'));assert.equal(await event.locator('#vhRecoveryForm').count(),0);await event.evaluate(()=>window.__sendRecovery());await event.waitForSelector('#vhRecoveryForm');assert.equal(await event.locator('#vhRecoveryForm').count(),1);await event.close();
 const racing=await f.context.newPage();await racing.addInitScript(()=>{window.__signedIn=true;window.__accountDelay=500});await racing.goto(base+'/account.html');await racing.waitForFunction(()=>window.__accountDataPending);await racing.evaluate(()=>window.__sendRecovery());await racing.waitForSelector('#vhRecoveryForm');await racing.waitForTimeout(600);assert.equal(await racing.locator('#vhRecoveryForm').count(),1,'account data replaced recovery form');await racing.close();
 assert.deepEqual(f.errors,[]);console.log('PASS: recovery request, customer session, password confirmation/update, errors/retry, expired links, URL cleanup and desktop/phone. All auth writes isolated.');
}finally{await f.browser.close()}})().catch(e=>{console.error(e);process.exit(1)});
