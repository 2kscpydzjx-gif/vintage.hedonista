const assert=require('node:assert/strict'),{fixture}=require('./cms-browser-fixture.cjs'),{seedAdmin}=require('./admin-fixture.cjs');
(async()=>{const f=await fixture({isMobile:true,hasTouch:true});try{
 f.session(null);f.auth(async({method})=>method==='signInWithPassword'?{data:null,error:{code:'invalid_credentials',message:'private-provider-error'}}:{data:null,error:null});
 const p=await f.context.newPage();for(const width of [320,390,820]){
  await p.setViewportSize({width,height:700});await p.goto('http://127.0.0.1:8765/admin/index.html');assert.match(p.url(),/admin\/index.html/);
  for(const id of ['email','password']){assert.equal(await p.locator('#'+id).evaluate(el=>el.labels.length),1);const box=await p.locator('#'+id).boundingBox();assert.ok(box.x>=0&&box.x+box.width<=width&&box.height>=44);assert.ok(await p.locator('#'+id).evaluate(el=>parseFloat(getComputedStyle(el).fontSize)>=16))}
  await p.locator('#email').fill('admin@example.test');await p.locator('#password').fill('wrong-password');await p.locator('#password').press('Enter');await p.locator('#error').filter({hasText:'Неправильний email або пароль'}).waitFor();assert.doesNotMatch(await p.locator('#error').textContent(),/private-provider/);assert.equal(await p.locator('#email').inputValue(),'admin@example.test');assert.equal(await p.locator('#loginBtn').isEnabled(),true);
  await p.setViewportSize({width,height:350});await p.locator('#loginBtn').scrollIntoViewIfNeeded();assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 }
 assert.equal(f.authCalls.filter(c=>c.method==='signInWithPassword').length,3);
 await p.setViewportSize({width:390,height:700});let release;f.auth(async({method})=>{if(method==='signInWithPassword'){await new Promise(resolve=>release=resolve);return {data:null,error:{code:'invalid_credentials'}}}return {data:null,error:null}});
 await p.evaluate(()=>{loginForm.requestSubmit();loginForm.requestSubmit()});await p.waitForFunction(()=>document.getElementById('loginBtn').disabled);assert.equal(f.authCalls.filter(c=>c.method==='signInWithPassword').length,4);release();await p.waitForFunction(()=>!document.getElementById('loginBtn').disabled);
 f.auth(async()=>({data:{user:{id:'not-admin'}},error:null}));f.rpc(async()=>({data:false,error:null}));await p.locator('#loginBtn').click();await p.locator('#error').filter({hasText:'не має прав адміністратора'}).waitFor();assert.match(p.url(),/index.html/);assert.ok(f.authCalls.some(c=>c.method==='signOut'));
 await seedAdmin(f);f.auth(async({method})=>{if(method==='signInWithPassword')f.session({user:{id:'test-admin'}});return {data:{user:{id:'test-admin'}},error:null}});await p.locator('#loginBtn').click();await p.waitForURL('**/admin.html');await p.waitForFunction(()=>typeof VH_ADMIN_HISTORY_READY!=='undefined'&&VH_ADMIN_HISTORY_READY);
 assert.deepEqual(f.errors,[]);console.log('PASS: mobile login labels/autofill, Enter, safe errors, short viewport, duplicate-submit guard, non-admin refusal and successful admin navigation. Auth requests isolated.');
}finally{await f.browser.close()}})().catch(e=>{console.error(e);process.exit(1)});
