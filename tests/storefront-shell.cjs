const assert=require('node:assert/strict');
const {devices}=require('playwright');
const {fixture}=require('./cms-browser-fixture.cjs');
const base='http://127.0.0.1:8765';
const profiles=[
 ['iPhone 15 Pro Max',{...devices['iPhone 13 Pro Max'],viewport:{width:430,height:932}}],
 ['iPad Air',{...devices['iPad Mini'],viewport:{width:820,height:1180}}],
 ['iPad Pro',{...devices['iPad Pro 11'],viewport:{width:1024,height:1366}}]
];
async function shell(p){return p.evaluate(()=>{const header=document.querySelector('body>header').getBoundingClientRect(),nav=document.querySelector('header .nav').getBoundingClientRect();return {y:scrollY,headerTop:header.top,headerBottom:header.bottom,navTop:nav.top,navBottom:nav.bottom,height:innerHeight,width:innerWidth,overflow:document.documentElement.scrollWidth>innerWidth}})}
async function clients(p){
 const result=await p.evaluate(()=>window.__cmsTestClients.map(c=>c.options?.auth));
 assert.equal(result.length,2,'content modules must reuse the public client');
 assert.equal(new Set(result.map(a=>a.storageKey)).size,2,'public reads must not share customer auth storage');
 assert.equal(result[0].storageKey,'vintage-hedonista-customer-auth');
 assert.equal(result[1].persistSession,false);assert.equal(result[1].autoRefreshToken,false);assert.equal(result[1].detectSessionInUrl,false);
}
(async()=>{for(const [name,{defaultBrowserType,...options}] of profiles){const f=await fixture({...options,reducedMotion:'reduce'});try{
 f.user(null);f.settings({hero_main_image:base+'/assets/test-upload.png'});
 await f.context.addInitScript(()=>{try{sessionStorage.setItem('vh_intro_seen_v96','1')}catch{}});
 const settingsRequests=[];await f.context.route('**/rest/v1/site_settings?**',route=>{settingsRequests.push(route.request().headers());return route.fallback()});
 const p=await f.context.newPage();await p.goto(base+'/index.html');await p.waitForFunction(()=>window.VHCMSBoot.state==='ready');await clients(p);assert.equal(settingsRequests.length,1,'reuse the startup settings response');assert.equal(settingsRequests[0]['accept-profile'],'public','startup request must explicitly use the public schema');
 const menu=p.locator('.vh-mobile-menu-btn');
 for(const offset of [500,1400]){
  await p.evaluate(y=>scrollTo(0,y),offset);await p.waitForTimeout(80);
  const before=await shell(p);assert.ok(before.y>100,name+' setup must actually scroll');assert.equal(before.headerTop,0,name+' header disappeared after scroll');
  await menu.click();await p.waitForFunction(()=>document.body.classList.contains('vh-mobile-menu-open'));await p.waitForTimeout(280);
  const open=await shell(p);assert.equal(open.headerTop,0,name+' menu moved header offscreen');assert.equal(open.navTop,open.headerBottom);assert.equal(open.navBottom,open.height);assert.ok(!open.overflow);assert.ok(Math.abs(open.y-before.y)<1,name+' opening menu jumped page');
  assert.ok(await p.locator('header nav a').evaluateAll(links=>links.every(a=>{const r=a.getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight})),name+' menu link outside viewport');
  if(offset===500)await p.locator('.vh-menu-backdrop').click({position:{x:8,y:50}});else await p.keyboard.press('Escape');
  await p.waitForFunction(()=>!document.body.classList.contains('vh-mobile-menu-open'));assert.ok(Math.abs((await shell(p)).y-before.y)<1,name+' closing menu jumped page');
 }
 // Switching the device in DevTools while the drawer is open keeps its close control visible.
 await menu.click();const cdp=await f.context.newCDPSession(p);const landscape={width:options.viewport.height,height:options.viewport.width};await cdp.send('Emulation.setDeviceMetricsOverride',{...landscape,deviceScaleFactor:2,mobile:true});await p.waitForFunction(w=>innerWidth===w,landscape.width);const resized=await shell(p);assert.equal(resized.headerTop,0);assert.equal(resized.navTop,resized.headerBottom);assert.equal(resized.navBottom,resized.height);await menu.click();await p.waitForFunction(()=>!document.body.classList.contains('vh-mobile-menu-open'));await cdp.detach();
 for(const page of ['catalog.html','about.html','journal.html','delivery.html','contacts.html','capsule.html','capsule-1.html']){
  if(page==='capsule-1.html')f.data('capsule_styles',[{id:'s',slug:'s',title:'Style',is_active:true}]);
  await p.goto(base+'/'+page);await p.waitForFunction(()=>!window.VHCMSBoot||window.VHCMSBoot.state==='ready');await p.waitForLoadState('load');await clients(p);await p.evaluate(()=>scrollTo(0,500));assert.equal((await shell(p)).headerTop,0,name+' scrolled header on '+page);
 }
 assert.deepEqual(f.errors,[]);assert.equal(f.calls.filter(c=>c.op!=='select').length,0);
}finally{await f.browser.close()}}
console.log('PASS: scrolled header, menu open/close without jumps, reachable links and DevTools rotation on phone/Air/Pro; one isolated public client across content, CMS, SEO and capsules.');
})().catch(e=>{console.error(e);process.exit(1)});
