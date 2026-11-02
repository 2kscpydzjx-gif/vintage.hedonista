const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {fixture}=require('./cms-browser-fixture.cjs');
const root=path.resolve(__dirname,'../dist'),origin='https://vintazhka.com.ua';
(async()=>{const f=await fixture({reducedMotion:'reduce'});try{
 f.user(null);f.session(null);await f.context.addInitScript(()=>{try{localStorage.setItem('vh_analytics_consent_v1',JSON.stringify({value:'denied',at:Date.now()}))}catch{}});
 await f.context.route(origin+'/**',route=>{let name=decodeURIComponent(new URL(route.request().url()).pathname);if(name.endsWith('/'))name+='index.html';let file=path.resolve(root,'.'+name);if(!path.extname(file))file+='.html';if(!file.startsWith(root+path.sep))return route.abort();const type={'.html':'text/html','.css':'text/css','.js':'text/javascript','.png':'image/png','.webp':'image/webp','.ico':'image/x-icon','.webmanifest':'application/manifest+json','.woff2':'font/woff2'}[path.extname(file)]||'text/plain';return fs.existsSync(file)?route.fulfill({contentType:type,body:fs.readFileSync(file)}):route.fulfill({status:404,body:''})});
 const p=await f.context.newPage();
 for(const width of [320,390,430,600,760,768,820,1024,1366,1920]){
  await p.setViewportSize({width,height:900});
  for(const page of ['index.html','catalog.html','contacts.html','privacy.html']){
   await p.goto(origin+'/'+page);await p.waitForFunction(()=>window.VHCMSBoot?window.VHCMSBoot.state==='ready':window.__VH_SHELL_READY);if(!await p.evaluate(()=>!!window.VHAnalytics))await p.addScriptTag({url:origin+'/analytics.js'});await p.locator('[data-vh-analytics-settings]').waitFor({state:'visible'});
   await p.evaluate(async()=>{await document.fonts.ready;document.documentElement.style.setProperty('scroll-behavior','auto','important');for(let i=0;i<5;i++){scrollTo({top:document.documentElement.scrollHeight,behavior:'instant'});await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))}});
   const v=await p.locator('footer').evaluate(el=>{const rect=el.getBoundingClientRect(),b=document.body.getBoundingClientRect();return {bottom:rect.bottom,bodyBottom:b.bottom,height:innerHeight,scroll:document.documentElement.scrollHeight,at:scrollY,overflow:document.documentElement.scrollWidth>innerWidth,links:[...el.querySelectorAll('.vh-footer-navigation a,.vh-footer-legal a,.vh-footer-legal button:not([hidden])')].map(a=>{const r=a.getBoundingClientRect();return {x:r.x,right:r.right,height:r.height}}),cookieInside:!!el.querySelector('.vh-footer-bottom [data-vh-analytics-settings]'),cookieMargin:getComputedStyle(el.querySelector('[data-vh-analytics-settings]')).marginBottom}});
   assert.ok(Math.abs(v.bodyBottom-v.bottom)<1,'space below footer '+width+' '+page);assert.ok(Math.abs(v.bottom-v.height)<2,'footer does not reach viewport edge '+width+' '+page+' '+JSON.stringify(v));assert.equal(v.cookieInside,true);assert.equal(v.cookieMargin,'0px');assert.ok(!v.overflow);assert.ok(v.links.every(r=>r.x>=0&&r.right<=width));if(width<=760)assert.ok(v.links.every(r=>r.height>=44));
   assert.equal(await p.locator('[data-vh-analytics-settings]').count(),1);assert.match(await p.locator('.vh-footer-navigation [data-vh-privacy-link]').getAttribute('href'),/privacy\.html$/);
  }
 }
 await p.locator('[data-vh-analytics-settings]').click();await p.locator('#vh-analytics-choice').waitFor();assert.match(await p.locator('#vh-analytics-choice a').getAttribute('href'),/privacy\.html$/);await p.getByRole('button',{name:'Відхилити',exact:true}).click();assert.equal(await p.locator('#vh-analytics-choice').count(),0);
 await p.setViewportSize({width:1440,height:1400});await p.goto(origin+'/contacts.html');await p.waitForFunction(()=>VHCMSBoot.state==='ready');await p.evaluate(()=>{for(const el of document.body.children)if(!el.matches('header,footer,script,style'))el.style.display='none'});assert.ok(Math.abs(await p.locator('footer').evaluate(el=>el.getBoundingClientRect().bottom)-1400)<2,'short page leaves blank space after the footer');
 await p.goto(origin+'/index.html');await p.waitForFunction(()=>VHCMSBoot.state==='ready');await p.locator('[data-header-profile]').click();await p.waitForSelector('#vhAuthForm');await p.evaluate(()=>vhShowAuth('register'));assert.match(await p.locator('#vh125LoginRoot .vh-privacy-note a').getAttribute('href'),/privacy\.html$/);
 await p.goto(origin+'/checkout.html');assert.equal(await p.locator('#checkoutForm .vh-privacy-note a').count(),1);assert.equal(await p.locator('#checkoutForm .vh-privacy-note a').getAttribute('target'),'_blank');
 // Follow the footer's actual link to the complete, locally hosted document.
 await p.locator('footer [data-vh-privacy-link]').click();await p.waitForURL('**/privacy.html');
 assert.equal(await p.locator('main h1').innerText(),'Політика конфіденційності');
 assert.equal(await p.locator('main section h2').count(),10);
 assert.equal(await p.locator('main time').getAttribute('datetime'),'2026-11-01');
 assert.equal(await p.locator('main a[href="mailto:vintazhka.shop@gmail.com"]').count(),2);
 assert.equal(await p.locator('main a[href="tel:+380508700923"]').innerText(),'+380 50 870 09 23');
 const pdf=fs.readFileSync(path.join(root,'assets/documents/privacy-policy-2026-11-01.pdf'));
 assert.equal(require('node:crypto').createHash('sha256').update(pdf).digest('hex'),'410643599c348782f764c4bc2d9194ef3498a224b1d5f85c0ab9d25b7e448998','original PDF changed');
 assert.equal(await p.locator('main a[download]').getAttribute('href'),'assets/documents/privacy-policy-2026-11-01.pdf');
 // Guests open the existing login drawer without any page navigation. Signed-in
 // customers follow the same entry point to their profile, including SEO snapshots.
 const category=fs.readdirSync(path.join(root,'seo-category'))[0];
 f.data('customer_profiles',[{id:'footer-customer',first_name:'Олена',last_name:'Тестова'}]);
 for(const width of [390,1366])for(const page of ['index.html','catalog.html','privacy.html','seo-category/'+category+'/index.html']){
  f.user(null);f.session(null);await p.setViewportSize({width,height:900});await p.goto(origin+'/'+page);
  await p.locator('footer [data-vh-footer-account]').waitFor();
  const before=p.url();let navigations=0;const navigation=frame=>{if(frame===p.mainFrame())navigations++};p.on('framenavigated',navigation);
  await p.locator('[data-vh-footer-account]').focus();await p.keyboard.press('Enter');
  await p.locator('#vhAuthForm').waitFor();assert.equal(p.url(),before);assert.equal(navigations,0);
  assert.equal(await p.locator('#vh125LoginOverlay [role=dialog]').evaluate(el=>el.contains(document.activeElement)),true);
  await p.locator('[data-vh-close="profile"]').click();
  // State changes after page load must be picked up, rather than relying on a stale flag.
  f.user({id:'footer-customer',email:'fixture@example.test',user_metadata:{first_name:'Олена',last_name:'Тестова'}});
  await p.locator('[data-vh-footer-account]').click();await p.waitForURL('**/account.html');
  await p.locator('#accountPageMount .vh124-dashboard').waitFor();
  assert.match(await p.locator('#accountPageMount').innerText(),/Олена/);p.off('framenavigated',navigation);
 }
 f.user(null);f.session(null);await p.goto(origin+'/privacy.html');
 if(!await p.evaluate(()=>!!window.VHAnalytics))await p.addScriptTag({url:origin+'/analytics.js'});
 await p.locator('[data-vh-analytics-settings]').waitFor({state:'visible'});
 // The real read-only preview notice must not cover legal links or cookie controls.
 await p.evaluate(()=>{window.VH_DEPLOYMENT={readOnlyData:true,supabaseOrigin:'https://fixture.invalid'}});
 await p.addScriptTag({content:fs.readFileSync(path.join(__dirname,'../preview-readonly.js'),'utf8')});
 for(const width of [320,390,768,1366]){
  await p.setViewportSize({width,height:900});
  await p.locator('[data-vh-analytics-settings]').waitFor({state:'visible'});
  await p.evaluate(async()=>{await document.fonts.ready;for(let i=0;i<5;i++){scrollTo({top:document.documentElement.scrollHeight,behavior:'instant'});await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))}});
  const bounds=await p.evaluate(()=>({notice:document.querySelector('#vh-cloudflare-preview-notice').getBoundingClientRect().top,links:[...document.querySelectorAll('footer [data-vh-privacy-link],footer [data-vh-analytics-settings]')].map(el=>el.getBoundingClientRect().bottom),overflow:document.documentElement.scrollWidth>innerWidth}));
  assert.ok(bounds.links.every(bottom=>bottom<=bounds.notice),'preview notice covers footer controls '+width);assert.equal(bounds.overflow,false);
 }
 assert.deepEqual(f.errors,[]);assert.equal(f.calls.filter(c=>c.op!=='select').length,0);
 console.log('PASS: footer at ten widths, complete PDF policy and original download, guest login/authenticated profile from desktop/mobile/SEO, unobscured preview controls, consent/reg/checkout links and no data writes.');
}finally{await f.browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
