const assert=require('node:assert/strict');
const fs=require('node:fs');
const {fixture}=require('./cms-browser-fixture.cjs');
const base='http://127.0.0.1:8765';
const legacyKey='label:div:nth-of-type(1)>a:nth-of-type(4)';
const numbers='+380 67 111 22 33 +380 50 444 55 66';
const revision={shared:{cmsPageDraft:{existing:{'existing-1':{mapped:{[legacyKey]:numbers,contactsEmailText:'shop@example.com',contactsPhoneLink:'tel:+380671112233'}}}}}};
async function intact(page,expected){
 await page.locator('#contactsPhoneText').filter({hasText:expected}).waitFor();
 assert.equal(await page.locator('#contactsPhoneLink > .contact-icon svg path').count(),1,'Phone icon was removed by a text edit');
 assert.equal(await page.locator('#contactsPhoneLink > .contact-label').textContent(),'ТЕЛЕФОН');
 assert.equal(await page.locator('#contactsPhoneLink > .contact-arrow svg').count(),1);
 assert.equal(await page.locator('#contactsPhoneLink').getAttribute('href'),'tel:+380671112233');
 assert.equal(await page.locator('#contactsEmailText').textContent(),'shop@example.com');
 assert.equal(await page.locator('.contact-line > .contact-icon svg').count(),4);
}
(async()=>{const f=await fixture();try{
 f.set('contacts','published',revision);f.set('contacts','draft',revision);
 const original=structuredClone(f.records.get('contacts:published'));
 const p=await f.context.newPage();await p.emulateMedia({reducedMotion:'reduce'});
 await p.goto(base+'/contacts.html');await p.waitForFunction(()=>window.__VH_PUBLISHED_READY);
 await intact(p,numbers);
 // Cached pages with the previous model must load the new one before applying edits.
 await f.context.route('**/contacts.html?old-model=1',route=>route.fulfill({contentType:'text/html',body:fs.readFileSync(require('node:path').join(__dirname,'../contacts.html'),'utf8').replace('<script defer src="cms-model.js?v=9"></script>','<script>window.VHCMSModel={version:8}</script>')}));
 await p.goto(base+'/contacts.html?old-model=1');await p.waitForFunction(()=>window.__VH_PUBLISHED_READY);
 assert.equal(await p.evaluate(()=>window.VHCMSModel.version),9);await intact(p,numbers);
 for(const width of [390,820,1366]){
  await p.setViewportSize({width,height:900});
  assert.ok(await p.locator('#contactsPhoneLink .contact-icon').evaluate(el=>{const r=el.getBoundingClientRect();return r.width>0&&r.height>0}));
  assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Contact fields overflow viewport');
 }
 const editor=await f.context.newPage();editor.on('dialog',d=>d.accept());
 await editor.goto(base+'/admin/cms-builder.html?page=contacts');
 await editor.waitForFunction(()=>document.querySelectorAll('.existing-row').length>=3&&!document.querySelector('#save').disabled);
 await editor.locator('[data-cms-id="existing-1"] .existing-select').click();
 const frame=editor.frameLocator('#siteFrame');await intact(frame,numbers);
 const descriptors=await editor.locator('#siteFrame').evaluate(el=>{const doc=el.contentDocument,section=doc.querySelector('[data-cms-legacy="existing-1"]');return el.contentWindow.VHCMSModel.fields(section,'contacts').filter(f=>f.type==='text').map(f=>({id:f.id,tag:f.el.tagName,contact:f.el.matches('.contact-line')}))});
 assert.equal(descriptors.some(f=>f.contact),false,'Whole contact rows must not be rich-text fields');
 assert.ok(descriptors.some(f=>f.id==='contactsPhoneText'));
 // Identify the existing named value rather than relying on translated labels.
 const value=editor.locator('#existingEditor .vh-rte-content').filter({hasText:numbers});
 assert.equal(await value.count(),1,'Phone text should have one editor');
 await value.fill('+380 67 111 22 33');await intact(frame,'+380 67 111 22 33');
 await editor.locator('#save').click();await editor.locator('#status').filter({hasText:'перевірено на сервері'}).waitFor();
 assert.equal(f.records.get('contacts:draft').shared.cmsPageDraft.existing['existing-1'].mapped.contactsPhoneText,'+380 67 111 22 33');
 assert.equal(f.records.get('contacts:draft').shared.cmsPageDraft.existing['existing-1'].mapped[legacyKey],numbers,'Legacy values should be retained for recovery');
 assert.deepEqual(f.records.get('contacts:published'),original,'Editing the draft changed published content');
 await editor.reload();await editor.waitForFunction(()=>!document.querySelector('#save').disabled);
 await intact(editor.frameLocator('#siteFrame'),'+380 67 111 22 33');
 // Publish only inside the isolated fixture, then load through the public renderer.
 await editor.locator('#publish').click();await editor.locator('#status').filter({hasText:'Публікацію перевірено'}).waitFor();
 await p.reload();await p.waitForFunction(()=>window.__VH_PUBLISHED_READY);await intact(p,'+380 67 111 22 33');
 fs.mkdirSync('test-results/contact-fields',{recursive:true});
 await p.screenshot({path:'test-results/contact-fields/contacts.png',fullPage:true});
 assert.deepEqual(f.errors,[]);
 console.log('PASS: legacy contact values recover icons/labels/arrows; individual edits survive save, reload and isolated publication without changing links or other contacts.');
}finally{await f.browser.close()}})().catch(error=>{console.error(error);process.exit(1)});
