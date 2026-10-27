const assert=require('node:assert/strict');const {fixture}=require('./cms-browser-fixture.cjs');
const base='http://127.0.0.1:8765';
const title='СТИЛЬ В ДЕТАЛЯХ. ГАРМОНІЯ В ПОЄДНАННЯХ';
const body='Відкривай готові капсули в окремих стилях, де речі гармонійно доповнюють одна одну. Менше випадкових покупок — більше продуманих образів. Обирай свій стиль, підбирай капсулу та знаходь натхнення для власних образів.';
const fits=el=>{const r=el.getBoundingClientRect();return {width:r.width,height:r.height,scrollWidth:el.scrollWidth,clientWidth:el.clientWidth,scrollHeight:el.scrollHeight,clientHeight:el.clientHeight}};
(async()=>{const f=await fixture();try{
 f.settings({homepage_capsules_title:title,homepage_capsules_text:body,about_hero_title:'МИНУЛЕ, ЯКЕ НАДИХАЄ. СТИЛЬ, ЩО ПІДКРЕСЛЮЄ ІНДИВІДУАЛЬНІСТЬ'});
 f.set('home','published',{shared:{cmsPageDraft:{existing:{'existing-2':{design:{layoutVersion:1,photoPreset:'framed',heightMode:'fixed',height:490,photoWidth:65,padding:21,headingSize:30,bodySize:15},layoutImages:{0:base+'/assets/test-upload.png',1:base+'/assets/test-upload.png'}}}}}});
 for(const width of [320,390,600,760,761,768,820,900,901,1024,1199,1200,1440]){
  const p=await f.context.newPage();await p.setViewportSize({width,height:900});await p.emulateMedia({reducedMotion:'reduce'});await p.goto(base+'/index.html');await p.waitForFunction(()=>window.VHCMSBoot.state==='ready');
  const compact=width<=1199,menu=p.locator('.vh-mobile-menu-btn');
  assert.equal(await menu.isVisible(),compact,'header breakpoint '+width);
  if(compact){
   const controls=await p.locator('header .header-icon-btn,header .vh-mobile-menu-btn').evaluateAll(els=>els.map(el=>{const r=el.getBoundingClientRect();return {left:r.left,right:r.right,width:r.width,height:r.height}}));
   assert.equal(controls.length,4);assert.ok(controls.every(r=>r.width>=44&&r.height>=44&&r.left>=0&&r.right<=width),'small/overflowing header controls '+width);
   const nav=p.locator('header .nav');assert.equal(await nav.evaluate(el=>el.inert),true);
   await menu.click();await p.waitForFunction(()=>document.querySelector('.vh-mobile-menu-btn').getAttribute('aria-expanded')==='true');
   await nav.waitFor({state:'visible'});assert.equal(await nav.evaluate(el=>el.inert),false);
   const links=await nav.locator('a').evaluateAll(els=>els.map(el=>({height:el.getBoundingClientRect().height,font:Number.parseFloat(getComputedStyle(el).fontSize)})));assert.ok(links.every(r=>r.height>=(width<=760?43:44)&&r.font>=(width<=760?11:14)));
   if(width<=760){assert.ok(Math.abs(await nav.evaluate(el=>el.getBoundingClientRect().width)-Math.min(width*.82,330))<1,'phone drawer no longer has its compact width');assert.ok(links.every(r=>r.font===11),'phone menu typography changed')}
   await p.keyboard.press('Escape');await p.waitForFunction(()=>document.querySelector('header .nav').inert);assert.equal(await menu.getAttribute('aria-expanded'),'false');
   await menu.click();await p.locator('.vh-menu-backdrop').click({position:{x:4,y:20}});await p.waitForFunction(()=>!document.body.classList.contains('vh-mobile-menu-open'));
  }
  const copy=p.locator('.homepage-capsules>.vh-cms-composition>.vh-cms-copy');await copy.evaluate(el=>el.scrollIntoView({block:'center'}));
  const visible=await copy.evaluate(el=>{const r=el.getBoundingClientRect();return {scroll:el.scrollHeight,client:el.clientHeight,children:[...el.children].filter(n=>n.getBoundingClientRect().height>0).map(n=>({top:n.getBoundingClientRect().top-r.top,bottom:n.getBoundingClientRect().bottom-r.bottom,text:n.textContent}))}});
  assert.ok(visible.children.every(r=>r.top>=-1&&r.bottom<=1),'clipped CMS copy '+width);
  assert.ok(visible.scroll<=visible.client+2,'nested CMS text scroll '+width);
  assert.match(visible.children.map(x=>x.text).join(' '),/ПЕРЕГЛЯНУТИ КАПСУЛИ/);
  if(width>1024)assert.equal(Math.round(await p.locator('.homepage-capsules>.vh-cms-composition').evaluate(el=>el.getBoundingClientRect().height)),490,'desktop fixed height changed');
  assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await p.close();
 }
 for(const width of [320,390,600,768,820,901,1024,1199]){
  const p=await f.context.newPage();await p.setViewportSize({width,height:1000});await p.emulateMedia({reducedMotion:'reduce'});await p.goto(base+'/capsule.html');await p.waitForFunction(()=>window.VHCMSBoot.state==='ready');
  const h=await p.locator('.capsule-hero h1').evaluate(fits);assert.ok(h.scrollWidth<=h.clientWidth+2,'capsule title clips at '+width);
  await p.goto(base+'/about.html');await p.waitForFunction(()=>window.VHCMSBoot.state==='ready');
  const about=await p.locator('#aboutHeroTitle').evaluate(fits);assert.ok(about.scrollWidth<=about.clientWidth+2,'about title clips at '+width);
  await p.close();
 }
 for(const width of [768,820,1024]){
  const p=await f.context.newPage();await p.setViewportSize({width,height:900});await p.goto(base+'/capsule-1.html');
  const footer=await p.locator('footer .footer-social-btn').evaluateAll(els=>els.map(el=>{const s=el.querySelector('svg'),r=s.getBoundingClientRect(),b=el.getBoundingClientRect();return {width:r.width,height:r.height,buttonHeight:b.height,fill:getComputedStyle(s).fill,stroke:getComputedStyle(s).stroke}}));
  assert.equal(footer.length,2);assert.ok(footer.every(r=>r.width===18&&r.height===18&&r.buttonHeight>=44&&r.fill==='none'&&r.stroke!=='none'));await p.close();
 }
 // Rotation through desktop and a short landscape viewport must restore navigation and scrolling.
 const rotate=await f.context.newPage();await rotate.setViewportSize({width:844,height:390});await rotate.goto(base+'/contacts.html');await rotate.waitForFunction(()=>window.VHCMSBoot.state==='ready');await rotate.locator('.vh-mobile-menu-btn').click();
 const panel=await rotate.locator('header .nav').evaluate(el=>({height:el.clientHeight,scroll:el.scrollHeight}));assert.ok(panel.height<=390-72&&panel.scroll>=panel.height);
 await rotate.setViewportSize({width:1440,height:900});await rotate.waitForFunction(()=>!document.body.classList.contains('vh-mobile-menu-open'));assert.equal(await rotate.locator('header .nav').evaluate(el=>el.inert),false);
 await rotate.setViewportSize({width:768,height:1024});await rotate.waitForFunction(()=>document.querySelector('header .nav').inert);await rotate.locator('.vh-mobile-menu-btn').click();await rotate.locator('header .nav a[href="catalog.html"]').click();await rotate.waitForURL('**/catalog.html');await rotate.waitForFunction(()=>window.VHCMSBoot.state==='ready');assert.equal(await rotate.locator('header .nav').evaluate(el=>el.inert),true);await rotate.close();
 const touch=await fixture({viewport:{width:1366,height:1024},hasTouch:true});
 try{const p=await touch.context.newPage();await p.goto(base+'/contacts.html');await p.waitForFunction(()=>window.VHCMSBoot.state==='ready');assert.equal(await p.locator('.vh-mobile-menu-btn').isVisible(),true);assert.equal(await p.locator('.vh-mobile-menu-btn').evaluate(el=>el.getBoundingClientRect().width),44);await p.close();assert.deepEqual(touch.errors,[])}finally{await touch.browser.close()}
 assert.deepEqual(f.errors,[]);console.log('PASS: full CMS copy/CTA, responsive headings, 44px compact header, usable drawer/navigation/rotation and capsule footer at phone/tablet/breakpoint widths; fixed desktop height retained.');
}finally{await f.browser.close()}})().catch(e=>{console.error(e);process.exit(1)});
