const assert=require('node:assert/strict');
const {fixture}=require('./cms-browser-fixture.cjs');
const base='http://127.0.0.1:8765';
const image=base+'/assets/test-upload.png';
const sample=async(section,ms=1500)=>section.evaluate(async(s,ms)=>{
 let root=s.querySelector(':scope>.vh-cms-composition'),changes=0,min=1,starts=0,missing=0,reconciles=0;
 const start=()=>starts++;s.addEventListener('animationstart',start);
 const observer=new MutationObserver(mutations=>{for(const m of mutations)for(const node of m.addedNodes)if(node.nodeType===8&&node.textContent==='CMS preview order')reconciles++});observer.observe(s.ownerDocument.body,{childList:true,subtree:true});
 const until=performance.now()+ms;
 while(performance.now()<until){const next=s.querySelector(':scope>.vh-cms-composition');if(next!==root){changes++;root=next}min=Math.min(min,Number(getComputedStyle(s).opacity));if(root&&[...root.querySelectorAll('.vh-cms-photo img')].some(img=>!img.complete||!img.naturalWidth))missing++;await new Promise(r=>requestAnimationFrame(r))}
 s.removeEventListener('animationstart',start);observer.disconnect();return {changes,min,starts,missing,reconciles};
},ms);
(async()=>{const f=await fixture();try{
 const edit={animation:'fade-up',duration:700,mapped:{'unified:title':'SLOW FASHION <br>&nbsp; СВІДОМА МОДА','unified:description':'Основний текст про моду.'},design:{layoutVersion:1,photoPreset:'text-top',textLayout:'heading-left',heightMode:'auto',headingWidth:45,crop0:{x:24,y:68,zoom:125}},layoutImages:{0:image}};
 const neighbor={title:'Unchanged neighbor',capsuleImage:image,design:{layoutVersion:1,photoPreset:'right'}};
 const added={id:'stable-added',type:'editorial',title:'Added block',body:'<p>Added body</p>',image,animation:'fade-up',duration:700,design:{layoutVersion:1,photoPreset:'left'}};
 f.set('home','draft',{blocks:[added],shared:{cmsPageDraft:{existing:{'existing-2':neighbor,'existing-3':edit}}}});
 const publishedBefore=structuredClone(f.records.get('home:published'));
 const p=await f.context.newPage();p.on('dialog',d=>d.accept());await p.goto(base+'/admin/cms-builder.html?page=home');await p.waitForFunction(()=>document.querySelectorAll('.existing-row').length>=8&&!document.querySelector('#save').disabled);
 const selectBlock=async id=>{await p.locator('[data-cms-id="'+id+'"] .existing-select').click();await p.locator('[data-inspector-tab=design]').click()};
 await selectBlock('existing-3');const section=p.frameLocator('#siteFrame').locator('[data-cms-legacy="existing-3"]');await section.scrollIntoViewIfNeeded();await p.waitForTimeout(2200);
 const idle=await sample(section,3200);assert.equal(idle.changes,0,'idle normalization rebuilt the composition');assert.equal(idle.starts,0,'idle animation restarted');assert.equal(idle.min,1,'block faded while idle');assert.equal(idle.missing,0);assert.equal(idle.reconciles,0,'mapped text normalization caused a reconciliation loop');
 await section.evaluate(s=>{const doc=s.ownerDocument;s.__stablePhoto=s.querySelector('.vh-cms-photo img');s.__stableCrop={position:getComputedStyle(s.__stablePhoto).objectPosition,transform:getComputedStyle(s.__stablePhoto).transform};s.__neighbor=doc.querySelector('[data-cms-legacy="existing-2"]>.vh-cms-composition');s.__added=doc.querySelector('[data-cms-id="stable-added"].vh-cms-injected-unit');s.__addedCard=s.__added.firstElementChild;});
 const gap=p.locator('#existingEditor input[type=number][data-design-key=textColumnGap]');await gap.scrollIntoViewIfNeeded();
 const during=sample(section,2200);for(const value of [60,75,90,120]){await gap.fill(String(value));await p.waitForTimeout(240)}const edited=await during;assert.equal(edited.min,1,'editing replayed entrance');assert.equal(edited.starts,0);assert.equal(edited.missing,0,'same photo was temporarily unloaded');
 await p.waitForTimeout(500);
 assert.ok(await section.evaluate(s=>{const doc=s.ownerDocument,img=s.querySelector('.vh-cms-photo img');return img===s.__stablePhoto&&getComputedStyle(img).objectPosition===s.__stableCrop.position&&getComputedStyle(img).transform===s.__stableCrop.transform&&doc.querySelector('[data-cms-legacy="existing-2"]>.vh-cms-composition')===s.__neighbor&&doc.querySelector('[data-cms-id="stable-added"].vh-cms-injected-unit')===s.__added&&s.__added.firstElementChild===s.__addedCard}),'editing replaced a loaded image, crop, neighboring or added block');
 const settled=await sample(section,1600);assert.equal(settled.changes,0);assert.equal(settled.reconciles,0);assert.equal(settled.min,1);
 // Genuine source replacement must still be reconciled, including source node identity.
 await section.evaluate(s=>{const title=s.querySelector('#editorialTitle'),replacement=title.cloneNode(true);replacement.textContent='External source initialization';title.replaceWith(replacement)});
 await p.waitForTimeout(1300);assert.match(await section.locator('.vh-cms-copy-heading').textContent(),/SLOW FASHION/);assert.doesNotMatch(await section.textContent(),/External source initialization/);assert.equal((await sample(section,1300)).reconciles,0);
 // Animation preview is explicit, once, and does not rewrite draft settings.
 await p.locator('[data-inspector-tab=animation]').click();await p.locator('#existingEditor button[data-cms-motion-preview]').click();
 await section.evaluate(s=>{if(!s.hasAttribute('data-vh-editor-motion-preview'))throw Error('explicit animation did not start')});
 const preview=await sample(section,1000);assert.ok(preview.min<.95,'preview button must play animation');assert.equal(await section.getAttribute('data-vh-editor-motion-preview'),null);assert.equal((await sample(section,700)).min,1);
 await p.emulateMedia({reducedMotion:'reduce'});await p.locator('#existingEditor button[data-cms-motion-preview]').click();assert.equal(await section.getAttribute('data-vh-editor-motion-preview'),null,'reduced motion ignored');await p.emulateMedia({reducedMotion:'no-preference'});
 const motionSelect=p.locator('#existingEditor [data-cms91-tab=animation] select');await motionSelect.selectOption('none');await p.locator('#existingEditor button[data-cms-motion-preview]').click();assert.equal(await section.getAttribute('data-vh-editor-motion-preview'),null,'none should not animate');await motionSelect.selectOption('fade-up');
 // Added layouts remain quiet as well, and an added block edit preserves its siblings.
 await selectBlock('stable-added');const native=p.frameLocator('#siteFrame').locator('[data-cms-legacy="existing-3"]');await native.evaluate(s=>s.__keep=s.querySelector('.vh-cms-composition'));
 const unit=p.frameLocator('#siteFrame').locator('.vh-cms-injected-unit[data-cms-id="stable-added"]');await unit.evaluate(s=>s.__photo=s.querySelector('.vh-cms-photo img'));
 await p.locator('#editorFields input[type=number][data-design-key=padding]').fill('36');await p.waitForTimeout(500);assert.ok(await native.evaluate(s=>s.__keep===s.querySelector('.vh-cms-composition')));
 assert.ok(await unit.evaluate(s=>s.__photo===s.querySelector('.vh-cms-photo img')),'editing added block replaced its loaded photo');assert.equal((await sample(unit,1200)).min,1);
 assert.deepEqual(f.records.get('home:published'),publishedBefore,'preview changed public data');
 await p.locator('#save').click();await p.locator('#status').filter({hasText:'перевірено на сервері'}).waitFor();assert.equal(f.records.get('home:draft').shared.cmsPageDraft.existing['existing-3'].animation,'fade-up');assert.equal(f.records.get('home:draft').shared.cmsPageDraft.existing['existing-3'].duration,700);
 await p.locator('#publish').click();await p.locator('#status').filter({hasText:'Публікацію перевірено'}).waitFor();
 const pub=await f.context.newPage();await pub.goto(base+'/index.html');await pub.waitForFunction(()=>window.__VH_PUBLISHED_READY);assert.equal(await pub.locator('html').getAttribute('data-vh-cms-editing'),null);const publicMotion=await pub.locator('[data-cms-legacy="existing-3"]').evaluate(s=>({name:getComputedStyle(s).animationName,duration:getComputedStyle(s).animationDuration}));assert.notEqual(publicMotion.name,'none','editor quiet styles leaked into storefront');assert.equal(publicMotion.duration,'0.7s');
 assert.deepEqual(f.errors,[]);console.log('PASS: quiet preview frames, no reconciliation loop, loaded image/crop and unchanged block reuse, genuine source repair, explicit one-shot animation, isolated data and intact storefront motion.');
}finally{await f.browser.close()}})().catch(e=>{console.error(e);process.exit(1)});
