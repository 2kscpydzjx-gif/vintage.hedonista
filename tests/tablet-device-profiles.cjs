const assert=require('node:assert/strict');
const {devices}=require('playwright');
const {fixture}=require('./cms-browser-fixture.cjs');
const base='http://127.0.0.1:8765',photo=base+'/assets/tablet-editorial.svg';
const profiles=[
 ['iPhone 13',devices['iPhone 13']],
 ...['iPad Mini','iPad Mini landscape','iPad (gen 7)','iPad (gen 7) landscape','iPad Pro 11','iPad Pro 11 landscape'].map(name=>[name,devices[name]]),
 ['iPad Air',{...devices['iPad Mini'],viewport:{width:820,height:1180}}],
 ['iPad Air landscape',{...devices['iPad Mini landscape'],viewport:{width:1180,height:820}}],
 ['Surface Pro 7',{viewport:{width:912,height:1368},deviceScaleFactor:2,hasTouch:true}],
 ['Surface Pro 7 landscape',{viewport:{width:1368,height:912},deviceScaleFactor:2,hasTouch:true}]
];
const ready=async p=>p.waitForFunction(()=>window.VHCMSBoot?.state==='ready');
async function frameFits(p){
 const frame=p.locator('#editorialMedia');await frame.scrollIntoViewIfNeeded();
 await p.waitForFunction(()=>document.querySelector('#editorialMedia img')?.naturalWidth===1600);
 const geometry=await frame.evaluate(el=>{const img=el.querySelector('img'),r=el.getBoundingClientRect(),i=img.getBoundingClientRect();return {fit:getComputedStyle(img).objectFit,dx:Math.abs(r.width-i.width),dy:Math.abs(r.height-i.height),x:Math.abs(r.left-i.left),y:Math.abs(r.top-i.top)}});
 assert.equal(geometry.fit,'cover','default editorial photo leaves letterboxing');
 assert.ok(geometry.dx<1&&geometry.dy<1&&geometry.x<1&&geometry.y<1,'photo does not fill its frame: '+JSON.stringify(geometry));
}
(async()=>{for(const [name,descriptor] of profiles){
 const {defaultBrowserType,...options}=descriptor;
 const f=await fixture({...options,reducedMotion:'reduce'});
 try{
  f.settings({homepage_editorial_image:photo,journal_page_title:'HEDONISTA JOURNAL'});
  await f.context.route('**/assets/tablet-editorial.svg',route=>route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1200"><path fill="#986" d="M0 0h1600v1200H0z"/></svg>'}));
  const p=await f.context.newPage();await p.goto(base+'/index.html');await ready(p);
  assert.equal(await p.evaluate(()=>devicePixelRatio),options.deviceScaleFactor,name+' DPR');
  assert.equal(await p.evaluate(()=>matchMedia('(pointer:coarse)').matches),true,name+' touch');
  const menu=p.locator('.vh-mobile-menu-btn');assert.equal(await menu.isVisible(),true,name+' header');
  const header=await p.locator('header .brand,header .header-icon-btn,header .vh-mobile-menu-btn').evaluateAll(els=>els.map(el=>{const r=el.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom}}));
  assert.ok(header.every(r=>r.left>=0&&r.right<=options.viewport.width&&r.top>=0&&r.bottom<=72),name+' header geometry');
  await menu.click();assert.equal(await menu.getAttribute('aria-expanded'),'true');assert.equal(await p.locator('header .nav').evaluate(el=>el.inert),false);
  const nav=await p.locator('header .nav').evaluate(el=>({width:el.clientWidth,scroll:el.scrollWidth,top:el.getBoundingClientRect().top}));
  assert.ok(nav.width>=250&&nav.width<=360&&nav.scroll<=nav.width,name+' drawer width');assert.equal(nav.top,options.viewport.width<=760?64:72);
  await p.keyboard.press('Escape');
  if(options.viewport.width>760)await frameFits(p);
  if(name==='iPad Mini'){
   // DevTools changes viewport metrics without reloading the already rendered CMS page.
   const cdp=await f.context.newCDPSession(p);
   for(const [width,height] of [[1368,912],[820,1180],[1180,820],[768,1024]]){
    await cdp.send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:2,mobile:true});
    await p.waitForFunction(w=>innerWidth===w,width);await frameFits(p);
    assert.equal(await menu.isVisible(),true,'resized tablet header '+width);
    assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'resized document overflow '+width);
   }
   await cdp.detach();
   // A deliberately saved crop remains authoritative, including contain and zoom.
   f.set('home','published',{shared:{cmsPageDraft:{existing:{'existing-3':{mediaSettings:{'unified:image':{desktop:{fit:'contain',x:70,y:30,zoom:125}}}}}}}});
   await p.reload();await ready(p);await p.locator('#editorialMedia').scrollIntoViewIfNeeded();
   await p.waitForFunction(()=>document.querySelector('#editorialMedia img')?.hasAttribute('data-vh-native-photo'));
   const crop=await p.locator('#editorialMedia img').evaluate(el=>({fit:getComputedStyle(el).objectFit,position:getComputedStyle(el).objectPosition,zoom:new DOMMatrixReadOnly(getComputedStyle(el).transform).a}));
   assert.deepEqual(crop,{fit:'contain',position:'70% 30%',zoom:1.25});
  }
  await p.goto(base+'/capsule-1.html');await p.locator('footer').scrollIntoViewIfNeeded();
  const footer=await p.locator('footer').evaluate(el=>{const r=el.getBoundingClientRect();return {left:r.left,right:r.right,buttons:[...el.querySelectorAll('.footer-social-btn')].map(a=>{const s=a.querySelector('svg'),r=s.getBoundingClientRect();return {width:r.width,height:r.height,fill:getComputedStyle(s).fill}}),overflow:[...el.querySelectorAll('p,a')].filter(n=>n.textContent.trim()&&n.clientWidth&&n.scrollWidth>n.clientWidth+2).map(n=>n.textContent)}});
  assert.ok(footer.left>=0&&footer.right<=options.viewport.width,name+' footer width');assert.deepEqual(footer.overflow,[],name+' footer text');
  const tablet=options.viewport.width>760&&options.viewport.width<=1199;
  assert.equal(footer.buttons.length,2);assert.ok(footer.buttons.every(s=>s.width>=16&&s.width<=24&&s.height===s.width&&(!tablet||s.width===18)&&s.fill==='none'),name+' footer icons: '+JSON.stringify(footer.buttons));
  await p.goto(base+'/journal.html');await ready(p);
  const heading=await p.locator('#journalPageTitle,#journalPageSubtitle').evaluateAll(els=>els.map(el=>{const r=el.getBoundingClientRect();return {left:r.left,right:r.right,scroll:el.scrollWidth,client:el.clientWidth}}));
  assert.ok(heading.every(r=>r.left>=0&&r.right<=options.viewport.width&&r.scroll<=r.client+2),name+' journal heading outside screen: '+JSON.stringify(heading));
  assert.deepEqual(f.errors,[],name+' browser errors');
 }finally{await f.browser.close()}
}console.log('PASS: 11 touch/DPR device profiles, compact phone drawer, tablet header/footer, editorial photo fill, DevTools resizing and saved crop preservation.');
})().catch(e=>{console.error(e);process.exit(1)});
