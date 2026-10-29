const assert=require('node:assert/strict'),fs=require('node:fs'),{fixture}=require('./cms-browser-fixture.cjs');
const base='http://127.0.0.1:8765';
const pane=(p,name)=>p.locator('.cms-mobile-nav [data-pane='+name+']').click();
const within=async(locator,width)=>{const r=await locator.boundingBox();assert.ok(r&&r.x>=-.5&&r.x+r.width<=width+.5,'outside viewport '+JSON.stringify(r));return r};
(async()=>{const f=await fixture({isMobile:true,hasTouch:true,reducedMotion:'reduce'});try{
 f.set('about','draft',{shared:{cmsPageDraft:{existing:{'existing-0':{mapped:{aboutHeroTitle:'Збережений заголовок',aboutHeroImage:base+'/assets/test-upload.png'},unknownSetting:'keep'}}}}});
 const published=JSON.stringify([...f.records].filter(([key])=>key.endsWith(':published'))),p=await f.context.newPage();fs.mkdirSync('test-results/admin-mobile',{recursive:true});
 for(const width of [320,390,430,600,768,820,1024,1180]){
  await p.setViewportSize({width,height:900});await p.goto(base+'/admin/cms-builder.html?page=about');await p.waitForFunction(()=>document.querySelectorAll('.existing-row').length===8&&!document.getElementById('save').disabled);
  assert.equal(await p.locator('body').getAttribute('data-cms-pane'),'blocks');assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  for(const selector of ['#save','#publish','#studioPage','#studioUndo','#studioRedo','#studioSeoToggle','[data-studio-device=mobile]']){const r=await within(p.locator(selector),width);assert.ok(r.height>=44&&r.width>=44,'small toolbar '+selector)}
  // A hidden preview still has real geometry; its visible iframe cannot cover the block list.
  assert.ok(await p.locator('#siteFrame').evaluate(el=>el.getBoundingClientRect().width>200));assert.equal(await p.locator('#siteFrame').evaluate(el=>el.inert),true);
  const row=p.locator('.existing-row[data-cms-id="existing-0"] .existing-select');await row.click();await p.waitForFunction(()=>document.body.dataset.cmsPane==='inspector');
  const title='Мобільний заголовок '+width;await p.locator('#existingEditor .vh-rte-content').first().fill(title);
  await pane(p,'preview');await p.frameLocator('#siteFrame').locator('#aboutHeroTitle').filter({hasText:title}).waitFor();assert.equal(await p.locator('#siteFrame').evaluate(el=>el.inert),false);
  const token=await p.locator('#siteFrame').evaluate(el=>el.contentWindow.mobileFrameToken=crypto.randomUUID());
  await pane(p,'blocks');await pane(p,'inspector');assert.equal(await p.locator('#existingEditor .vh-rte-content').first().textContent(),title);assert.equal(await p.locator('#siteFrame').evaluate(el=>el.contentWindow.mobileFrameToken),token,'pane switch reloaded the live page');
  await p.locator('[data-inspector-tab=media]').click();const upload=p.locator('#existingEditor .cms-photo-editor input[type=file]');f.uploadDelay(180);await upload.setInputFiles({name:'mobile-photo.png',mimeType:'image/png',buffer:f.png});await p.waitForFunction(()=>document.getElementById('save').disabled);await p.waitForFunction(()=>!document.getElementById('save').disabled);
  const photo=p.locator('#existingEditor .cms-photo-editor');await photo.locator('.cms-photo-fit select').selectOption('cover');const x=photo.locator('input[type=number][data-crop-control=x]');await x.fill('25');await x.dispatchEvent('change');
  await pane(p,'preview');await pane(p,'inspector');assert.equal(await x.inputValue(),'25');
  if(width===390){
   const zoom=photo.locator('input[type=number][data-crop-control=zoom]');await zoom.fill('150');await zoom.dispatchEvent('change');const stage=photo.locator('.cms-photo-stage');await stage.scrollIntoViewIfNeeded();const r=await stage.boundingBox(),client=await f.context.newCDPSession(p);const pos={x:r.x+r.width/2,y:r.y+r.height/2};
   await client.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[pos]});await client.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:pos.x+22,y:pos.y+18}]});await client.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await client.detach();assert.notEqual(await x.inputValue(),'25','touch crop did not respond');
   await p.screenshot({path:'test-results/admin-mobile/cms-photo.png'});
  }
  const crop=await x.inputValue();await p.locator('#save').click();await p.waitForFunction(()=>!document.getElementById('save').disabled);assert.match(f.records.get('about:draft').shared.cmsPageDraft.existing['existing-0'].mapped.aboutHeroTitle,new RegExp(title));assert.equal(f.records.get('about:draft').shared.cmsPageDraft.existing['existing-0'].unknownSetting,'keep');
  await p.locator('#studioSeoToggle').click();await p.locator('#pageSeoPanel[role=dialog]').waitFor();await within(p.locator('#cmsMobileSeoClose'),width);await p.keyboard.press('Escape');await p.waitForFunction(()=>!document.getElementById('pageSeoPanel').classList.contains('studio-seo-open'));assert.equal(await p.locator('#studioSeoToggle').evaluate(el=>el===document.activeElement),true);
  for(const tab of ['content','media','design','animation']){
   await p.locator('[data-inspector-tab='+tab+']').click();
   await p.locator('.editor').evaluate(root=>root.querySelectorAll('details:not([open])>summary').forEach(summary=>summary.click()));
   const bad=await p.locator('.editor').evaluate(root=>[...root.querySelectorAll('button,input:not([type=file]),select,textarea,[contenteditable=true]')].filter(el=>el.getClientRects().length&&!el.closest('[hidden]')).map(el=>{const r=el.getBoundingClientRect();return {id:el.id,cls:el.className,type:el.type,x:r.x,right:r.right,height:r.height}}).filter(r=>r.x<-.5||r.right>innerWidth+.5||(!['checkbox','radio'].includes(r.type)&&r.height<43.5)));
   assert.deepEqual(bad,[],'unusable inspector '+tab+' '+width);
  }
  await p.reload();await p.waitForFunction(()=>document.querySelectorAll('.existing-row').length===8&&!document.getElementById('save').disabled);await p.locator('.existing-row[data-cms-id="existing-0"] .existing-select').click();assert.equal(await p.locator('#existingEditor .vh-rte-content').first().textContent(),title);
  await p.locator('[data-inspector-tab=media]').click();assert.equal(await p.locator('#existingEditor input[type=number][data-crop-control=x]').inputValue(),crop);
  // Desktop round-trip restores the normal workspace without losing mobile edits.
  await p.setViewportSize({width:1440,height:1000});await p.waitForFunction(()=>!document.getElementById('siteFrame').inert);assert.equal(await p.locator('.cms-mobile-nav').isVisible(),false);assert.equal(await p.locator('#siteFrame').evaluate(el=>el.inert),false);assert.equal(await p.locator('.editor').isVisible(),true);
  if(width===390){await p.setViewportSize({width,height:900});await pane(p,'blocks');await p.screenshot({path:'test-results/admin-mobile/cms-blocks.png'})}
 }
 await p.setViewportSize({width:390,height:900});await p.evaluate(()=>{Object.defineProperty(visualViewport,'height',{configurable:true,value:420});visualViewport.dispatchEvent(new Event('resize'))});await p.waitForFunction(()=>document.querySelector('body>main').getBoundingClientRect().height<=420.5);
 await p.locator('#studioSeoToggle').click();await p.locator('#pageSeoPanel[role=dialog]').waitFor();await p.locator('#pageSeoPanel').evaluate(el=>el.scrollTop=el.scrollHeight);await within(p.locator('#cmsMobileSeoClose'),390);const dismiss=await p.locator('#cmsMobileSeoClose').boundingBox();assert.ok(dismiss.y>=0&&dismiss.y+dismiss.height<=420);await p.locator('#cmsMobileSeoClose').click();
 await p.evaluate(()=>{delete visualViewport.height;visualViewport.dispatchEvent(new Event('resize'))});
 assert.equal(JSON.stringify([...f.records].filter(([key])=>key.endsWith(':published'))),published,'mobile editor published content');assert.deepEqual(f.errors,[]);console.log('PASS: mobile workspace at eight widths, reachable toolbar, mounted frame, text/photo/crop preservation across panes/save/reload/desktop, native touch crop and SEO dialog focus; publications unchanged.');
}finally{await f.browser.close()}})().catch(e=>{console.error(e);process.exit(1)});
