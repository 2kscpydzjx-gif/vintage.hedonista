const assert=require('node:assert/strict');
const {fixture}=require('./cms-browser-fixture.cjs');
const base='http://127.0.0.1:8765';
const wait=async(fn,message)=>{for(let i=0;i<80;i++){if(await fn())return;await new Promise(r=>setTimeout(r,100))}throw Error(message)};
(async()=>{
 const f=await fixture();
 try{
  f.set('about','draft',{shared:{headerLogo:'preserve-logo.webp',customFlag:'preserve',cmsPageDraft:{existing:{'existing-0':{mapped:{aboutHeroTitle:'<strong>MY SAVED TITLE</strong>',aboutHeroImage:base+'/assets/test-upload.png'},unknownSetting:{keep:true}}},order:['existing-0','existing-1','existing-2','existing-3','existing-4','existing-5','existing-6','existing-7'],customMetadata:'keep'}}});
  const page=await f.context.newPage();page.on('dialog',dialog=>dialog.accept());
  await page.goto(base+'/admin/v2-editor.html?page=about');
  await page.waitForFunction(()=>document.querySelectorAll('.existing-row').length===8&&!document.querySelector('#save').disabled);
  assert.match(page.url(),/cms-builder\.html\?page=about$/);
  await page.locator('.existing-row[data-cms-id="existing-0"] .existing-select').click();
  let frame=page.frameLocator('#siteFrame');
  await frame.locator('#aboutHeroTitle').filter({hasText:'MY SAVED TITLE'}).waitFor();
  const texts=page.locator('#existingEditor .vh-rte-content');await texts.first().fill('MY EDITED TITLE');
  await wait(async()=>await frame.locator('#aboutHeroTitle').textContent()==='MY EDITED TITLE','text edit did not reach preview');
  await page.locator('[data-inspector-tab="design"]').click();
  await page.locator('#existingEditor [data-preset="text-top"]').click();
  await frame.locator('[data-cms-legacy="existing-0"][data-vh-layout="text-top"] .vh-cms-composition').waitFor();
  const vertical=await frame.locator('[data-cms-legacy="existing-0"]').evaluate(el=>{const copy=el.querySelector('.vh-cms-copy').getBoundingClientRect(),photo=el.querySelector('.vh-cms-photo').getBoundingClientRect();return copy.bottom<=photo.top+1});
  assert.equal(vertical,true,'text-top must place text above the photograph');
  assert.equal(await frame.locator('[data-cms-legacy="existing-0"] .vh-cms-copy').textContent().then(s=>s.includes('MY EDITED TITLE')),true);
  await page.locator('[data-inspector-tab="content"]').click();
  const upload=page.locator('#existingEditor .cms-layout-media input[type=file]').first();
  f.uploadDelay(400);await upload.setInputFiles({name:'my-photo.png',mimeType:'image/png',buffer:f.png});
  await wait(async()=>await page.locator('#save').isDisabled(),'save should wait for pending uploads');
  await wait(async()=>!await page.locator('#save').isDisabled(),'upload never finished');
  await page.locator('#save').click();
  await wait(async()=>f.records.get('about:draft').shared.cmsPageDraft.existing['existing-0'].mapped.aboutHeroTitle.includes('MY EDITED TITLE'),'text did not save');
  const saved=f.records.get('about:draft');assert.equal(saved.shared.customFlag,'preserve');assert.equal(saved.shared.cmsPageDraft.customMetadata,'keep');assert.equal(saved.shared.cmsPageDraft.existing['existing-0'].unknownSetting.keep,true);assert.equal(saved.shared.cmsPageDraft.existing['existing-0'].design.photoPreset,'text-top');assert.match(saved.shared.cmsPageDraft.existing['existing-0'].layoutImages[0],/assets\/test-upload/);
  await wait(async()=>!await page.locator('#save').isDisabled(),'save verification never finished');
  await page.reload();await page.waitForFunction(()=>document.querySelectorAll('.existing-row').length===8&&!document.querySelector('#save').disabled);
  frame=page.frameLocator('#siteFrame');await frame.locator('[data-cms-legacy="existing-0"][data-vh-layout="text-top"]').waitFor();assert.match(await frame.locator('[data-cms-legacy="existing-0"] .vh-cms-copy').textContent(),/MY EDITED TITLE/);
  await page.locator('#publish').click();await wait(async()=>f.records.get('about:published').shared.cmsPageDraft?.existing?.['existing-0']?.design?.photoPreset==='text-top','publication missing');
  await wait(async()=>!await page.locator('#publish').isDisabled(),'publish verification did not finish');
  const publicPage=await f.context.newPage();await publicPage.goto(base+'/about.html');await publicPage.waitForFunction(()=>window.__VH_PUBLISHED_READY);assert.match(await publicPage.locator('[data-cms-legacy="existing-0"] .vh-cms-copy').textContent(),/MY EDITED TITLE/);assert.match(await publicPage.locator('[data-cms-legacy="existing-0"] .vh-cms-photo img').getAttribute('src'),/test-upload/);
  // Reordering must retain the same field-to-section identity after another frame load.
  await page.locator('.existing-row[data-cms-id="existing-0"] button[title="Перемістити нижче"]').click();
  await page.locator('#save').click();await wait(async()=>f.records.get('about:draft').shared.cmsPageDraft.order[0]==='existing-1','order did not save');await wait(async()=>!await page.locator('#save').isDisabled(),'save remained locked');
  await page.reload();await page.waitForFunction(()=>document.querySelectorAll('.existing-row').length===8&&!document.querySelector('#save').disabled);frame=page.frameLocator('#siteFrame');await frame.locator('[data-cms-legacy="existing-0"] .vh-cms-copy').filter({hasText:'MY EDITED TITLE'}).waitFor();
  // A change made after the page loaded must not silently overwrite another administrator.
  f.records.get('about:draft').updated_at='concurrent-token';
  await page.locator('#save').click();await page.locator('#status').filter({hasText:'Інший адміністратор'}).waitFor();assert.equal(f.records.get('about:draft').updated_at,'concurrent-token');
  // A failed write leaves a recoverable local draft and reports failure.
  await page.locator('[data-side-tab="pages"]').click();await page.locator('.studio-pages-list button').filter({hasText:'Контакти'}).click();await page.waitForFunction(()=>new URLSearchParams(location.search).get('page')==='contacts'&&!document.querySelector('#save').disabled);
  await page.locator('.existing-row[data-cms-id="existing-0"] .existing-select').click();await page.locator('#existingEditor .vh-rte-content').first().fill('CONTACT LOCAL');f.failWrite(true);await page.locator('#save').click();await page.locator('#status').filter({hasText:'Simulated server write failure'}).waitFor();assert.match(await page.evaluate(()=>localStorage.getItem('vh-cms-existing-step65-contacts')),/CONTACT LOCAL/);f.failWrite(false);
  // Save/publication operations block page changes until completion.
  f.delay(300);await page.locator('#save').click();await page.locator('#studioPage').selectOption({label:'Головна сторінка'});assert.match(page.url(),/page=contacts/);await wait(async()=>!await page.locator('#save').isDisabled(),'delayed save did not finish');f.delay(0);assert.match(JSON.stringify(f.records.get('contacts:draft')),/CONTACT LOCAL/);assert.doesNotMatch(JSON.stringify(f.records.get('home:draft')),/CONTACT LOCAL/);
  f.delay(0);
  await page.locator('.existing-row[data-cms-id="existing-0"] .existing-select').click();
  await page.locator('[data-inspector-tab="design"]').click();await page.locator('#existingEditor [data-preset="left"]').click();
  frame=page.frameLocator('#siteFrame');await frame.locator('[data-cms-legacy="existing-0"][data-vh-layout="left"]').waitFor();
  await page.locator('#studioUndo').click();await frame.locator('[data-cms-legacy="existing-0"]:not([data-vh-layout])').waitFor();
  await page.locator('#studioRedo').click();await frame.locator('[data-cms-legacy="existing-0"][data-vh-layout="left"]').waitFor();
  await page.evaluate(()=>localStorage.setItem('vintage-hedonista-admin-auth','DO-NOT-EXPORT'));
  const downloaded=page.waitForEvent('download');await page.locator('#cmsBackup').click();const download=await downloaded;
  const fs=require('node:fs'),backup=fs.readFileSync(await download.path());const data=JSON.parse(backup);assert.equal(data.format,'vh-cms-backup');assert.equal(data.revisions.length,14);assert.doesNotMatch(backup.toString(),/DO-NOT-EXPORT/);
  await page.locator('[data-inspector-tab="content"]').click();await page.locator('#existingEditor .vh-rte-content').first().fill('CHANGE AFTER BACKUP');
  await page.locator('.cms-recovery-history input[type=file]').setInputFiles({name:'backup.json',mimeType:'application/json',buffer:backup});
  await page.locator('#status').filter({hasText:'відновлено з копії'}).waitFor();assert.doesNotMatch(await page.evaluate(()=>localStorage.getItem('vh-cms-existing-step65-contacts')),/CHANGE AFTER BACKUP/);
  await page.screenshot({path:'work/editor-tested.png'});
  assert.deepEqual(f.errors,[],'Browser errors: '+f.errors.join('; '));
  console.log('PASS: edit → layout → upload → save → refresh → publish → storefront; reorder identity, failed writes, concurrent edits and page isolation.');
 }catch(error){console.error(JSON.stringify({records:[...f.records],calls:f.calls.slice(-10),errors:f.errors,pages:await Promise.all(f.context.pages().map(async p=>({url:p.url(),status:await p.locator('#status').textContent().catch(()=>null)})))}));throw error}finally{await f.browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
