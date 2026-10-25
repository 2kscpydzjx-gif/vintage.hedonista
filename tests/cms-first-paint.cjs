const assert=require('node:assert/strict');const {fixture}=require('./cms-browser-fixture.cjs');
const base='http://127.0.0.1:8765';
const capture=()=>{
 window.__cmsVisibleTitles=[];window.__cmsPaintCount=0;
 function visible(node){for(let el=node;el;el=el.parentElement){const s=getComputedStyle(el);if(s.display==='none'||s.visibility==='hidden'||Number(s.opacity)===0)return false}return node.getBoundingClientRect().height>0}
 function sample(){window.__cmsPaintCount++;const section=document.querySelector('[data-cms-legacy="existing-0"]');if(section){const source=[...section.querySelectorAll('h1,h2')].find(node=>!node.closest('.vh-cms-composition'));const projected=section.querySelector('.vh-cms-copy h1,.vh-cms-copy h2');for(const h of new Set([source,projected].filter(Boolean)))if(visible(h))window.__cmsVisibleTitles.push(h.textContent);}requestAnimationFrame(sample)}requestAnimationFrame(sample);
};
(async()=>{const f=await fixture();try{
 await f.context.addInitScript(capture);f.delay(600);
 const pages={home:'index.html',about:'about.html',catalog:'catalog.html',capsules:'capsule.html',journal:'journal.html',delivery:'delivery.html',contacts:'contacts.html'};
 for(const [page,file] of Object.entries(pages)){
  f.set(page,'published',{shared:{cmsPageDraft:{existing:{'existing-0':{title:'SAVED '+page,design:{layoutVersion:1,photoPreset:'text-top'}}}}}});
  const p=await f.context.newPage();await p.emulateMedia({reducedMotion:'reduce'});await p.goto(base+'/'+file,{waitUntil:'domcontentloaded'});
  await p.waitForFunction(()=>window.VHCMSBoot?.state==='ready');await p.waitForTimeout(100);
  assert.equal(await p.evaluate(()=>window.__VH_PUBLICATION_ERROR),false,page+': failed to initialize');const seen=await p.evaluate(()=>window.__cmsVisibleTitles);assert.ok(seen.length,page+': no final content was painted');assert.ok(seen.every(text=>text==='SAVED '+page),page+': stale title painted: '+JSON.stringify([...new Set(seen)]));assert.equal(await p.locator('#vh-cms-load-status').count(),0);
  if(page==='home'){
   f.contentDelay(700);await p.evaluate(()=>{window.__cmsVisibleTitles=[];void initHome()});await p.waitForFunction(()=>window.VHCMSBoot.state==='pending');await p.waitForFunction(()=>window.VHCMSBoot.state==='ready');assert.ok((await p.evaluate(()=>window.__cmsVisibleTitles)).every(text=>text==='SAVED home'),'late settings painted old home text across an async gap');f.contentDelay(0);
  }
  if(page==='contacts'){
   // A later source initialization must mask its interim text and reapply the same revision.
   await p.evaluate(async()=>{window.__cmsVisibleTitles=[];await initContactsPage()});await p.waitForFunction(()=>window.VHCMSBoot.state==='ready');assert.ok((await p.evaluate(()=>window.__cmsVisibleTitles)).every(text=>text==='SAVED contacts'));
  }await p.close();
 }
 const seo=await f.context.newPage();await seo.goto(base+'/seo-category/aksesuary/index.html');await seo.waitForFunction(()=>window.VHCMSBoot?.state==='ready');await seo.waitForTimeout(50);assert.ok((await seo.evaluate(()=>window.__cmsVisibleTitles)).every(title=>title==='SAVED catalog'),'SEO snapshot flashed old catalog markup');await seo.close();
 f.set('home','draft',{shared:{cmsPageDraft:{existing:{'existing-0':{title:'DRAFT home',design:{layoutVersion:1,photoPreset:'left'}}}}}});
 const editor=await f.context.newPage();await editor.goto(base+'/admin/cms-builder.html?page=home');await editor.waitForFunction(()=>!document.querySelector('#save').disabled&&document.querySelector('#siteFrame').contentWindow.VHCMSBoot?.state==='ready');await editor.waitForTimeout(100);const preview=await editor.locator('#siteFrame').evaluate(el=>el.contentWindow.__cmsVisibleTitles);assert.ok(preview.length);assert.ok(preview.every(title=>title==='DRAFT home'),'preview painted source/public content before its draft: '+JSON.stringify([...new Set(preview)]));await editor.close();
 f.delay(0);f.failRead(true);
 const cached=await f.context.newPage();await cached.addInitScript(()=>localStorage.setItem('vh-published-cache-v1-home',JSON.stringify({blocks:[],shared:{cmsPageDraft:{existing:{'existing-0':{title:'LAST PUBLISHED HOME'}}}}})));
 await cached.goto(base+'/index.html');await cached.waitForFunction(()=>window.VHCMSBoot.state==='ready');assert.equal(await cached.locator('#heroTitle').textContent(),'LAST PUBLISHED HOME','network failure must use the last published revision');await cached.close();
 const failed=await f.context.newPage();await failed.addInitScript(()=>localStorage.removeItem('vh-published-cache-v1-delivery'));await failed.goto(base+'/delivery.html');await failed.waitForFunction(()=>window.VHCMSBoot.state==='error');assert.equal(await failed.locator('#vh-cms-load-status button').isVisible(),true);assert.deepEqual(await failed.evaluate(()=>window.__cmsVisibleTitles),[],'request failure revealed old HTML');await failed.close();f.failRead(false);
 // A genuine null response must not resurrect an obsolete cached publication.
 f.records.delete('contacts:published');const empty=await f.context.newPage();await empty.addInitScript(()=>localStorage.setItem('vh-published-cache-v1-contacts',JSON.stringify({shared:{cmsPageDraft:{existing:{'existing-0':{title:'OBSOLETE CACHE'}}}}})));
 await empty.goto(base+'/contacts.html');await empty.waitForFunction(()=>window.VHCMSBoot.state==='ready');assert.notEqual(await empty.locator('#contactsTitle').textContent(),'OBSOLETE CACHE');assert.equal(await empty.evaluate(()=>localStorage.getItem('vh-published-cache-v1-contacts')),null);await empty.close();
 const missing=await f.context.newPage();await missing.addInitScript(()=>{const original=window.setTimeout;window.setTimeout=(fn,ms,...args)=>original(fn,ms===25000?400:ms,...args)});await missing.route('**/cms-published.js*',route=>route.fulfill({contentType:'text/javascript',body:'/* simulate missing runtime */'}));await missing.goto(base+'/delivery.html');await missing.waitForFunction(()=>window.VHCMSBoot.state==='error');assert.deepEqual(await missing.evaluate(()=>window.__cmsVisibleTitles),[],'missing runtime revealed old blocks');assert.equal(await missing.getByRole('button',{name:'Спробувати ще раз'}).isVisible(),true);
 assert.deepEqual(f.errors,[]);console.log('PASS: first paint contains only final content on seven pages; source reinit, cached fallback, failure/retry, deleted publication and missing runtime never flash old blocks.');
}finally{await f.browser.close()}})().catch(error=>{console.error(error);process.exit(1)});
