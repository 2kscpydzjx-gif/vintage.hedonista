const assert=require('node:assert/strict');
const {fixture}=require('./cms-browser-fixture.cjs');
const base='http://127.0.0.1:8765';
(async()=>{const f=await fixture();try{
 const pages={home:'index.html',about:'about.html',catalog:'catalog.html',capsules:'capsule.html',journal:'journal.html',delivery:'delivery.html',contacts:'contacts.html'};
 const presets=['left','right','stacked','text-top','text-only','wide','framed','gradient-hero','three-photos','original'];
 for(const [key,file] of Object.entries(pages)){
  f.set(key,'published',{blocks:[{id:'new-'+key,type:'editorial',title:'NEW BLOCK '+key,body:'<p>Saved body</p>',image:base+'/assets/test-upload.png',visible:true,design:{layoutVersion:1,photoPreset:'text-top'}}]});
  const page=await f.context.newPage();await page.goto(base+'/'+file);await page.waitForFunction(()=>window.__VH_PUBLISHED_READY);
  assert.equal(await page.locator('.vh-cms-live-block').count(),1,key+': new block must publish on this page');
  assert.match(await page.locator('.vh-cms-live-block .vh-cms-copy').textContent(),/NEW BLOCK/);
  for(const preset of presets){
   const result=await page.evaluate(({key,preset,base})=>{
    const model=window.VHCMSModel,section=model.sections(document,key)[0];
    const dynamicBefore=[...section.querySelectorAll('#productGrid,#newArrivals,#journalCategories,#journalSort')];
    const controlsBefore=key==='catalog'?[...section.querySelectorAll('input,select,button')]:[];
    const all=model.fields(section,key),heading=all.find(f=>f.type==='text'&&f.el.matches('h1,h2,h3'));
    const edit={title:'PRESERVED TITLE',layoutImages:{0:base+'/assets/test-upload.png',1:base+'/assets/test-upload.png',2:base+'/assets/test-upload.png'},customButtons:[{label:'CUSTOM LINK',url:'catalog.html'}]};
    const design={layoutVersion:1,photoPreset:preset,photoWidth:65,minHeight:320,cropDevices:{desktop:{x:20,y:30,zoom:120},tablet:{x:40,y:45,zoom:110},mobile:{x:80,y:60,zoom:115}}};
    model.applyDesign(section,design,key,edit);
    const root=section.querySelector('.vh-cms-composition'),source=heading?.el;
    const copy=root?.querySelector('.vh-cms-copy'),photo=root?.querySelector('.vh-cms-photo');
    const rect=node=>node?.getBoundingClientRect();
    return {sourceText:source?.textContent,rootCount:section.querySelectorAll('.vh-cms-composition').length,copyText:copy?.textContent||section.textContent,photos:root?.querySelectorAll(':scope>.vh-cms-photo').length||0,textAbove:copy&&photo?rect(copy).bottom<=rect(photo).top+1:null,photoAbove:copy&&photo?rect(photo).bottom<=rect(copy).top+1:null,dynamicPreserved:dynamicBefore.every(el=>el.isConnected),controlsVisible:controlsBefore.every(el=>el.isConnected&&el.closest('[data-vh-layout]')===null),customLinks:section.querySelectorAll('.vh-cms-custom-buttons a').length};
   },{key,preset,base});
   assert.equal(result.sourceText,'PRESERVED TITLE',key+': source content lost for '+preset);
   assert.match(result.copyText,/PRESERVED TITLE/,key+': projection lost text for '+preset);
   assert.equal(result.rootCount,preset==='original'?0:1,key+': duplicate layouts for '+preset);
   assert.equal(result.dynamicPreserved,true,key+': dynamic content lost for '+preset);
   assert.equal(result.controlsVisible,true,key+': catalog controls hidden for '+preset);
   assert.equal(result.customLinks,1,key+': custom button missing for '+preset);
   if(preset==='text-top')assert.equal(result.textAbove,true,key+': text must be above photo');
   if(preset==='stacked')assert.equal(result.photoAbove,true,key+': photo must be above text');
   if(preset==='framed')assert.equal(result.photos,2);
   if(preset==='three-photos')assert.equal(result.photos,3);
  }
  // A second publication/render event cannot duplicate added blocks.
  await page.evaluate(()=>window.dispatchEvent(new Event('vh:service-rendered')));
  assert.equal(await page.locator('.vh-cms-live-block').count(),1,key+': render is not idempotent');
  await page.close();
 }
 const page=await f.context.newPage();await page.goto(base+'/contacts.html');await page.waitForFunction(()=>window.__VH_PUBLISHED_READY);
 const crops=await page.evaluate(({base})=>{const section=document.querySelector('[data-cms-legacy="existing-0"]');const design={layoutVersion:1,photoPreset:'left',cropDevices:{desktop:{x:20,y:30,zoom:120},mobile:{x:80,y:60,zoom:115}}};window.VHCMSModel.applyDesign(section,design,'contacts',{layoutImages:{0:base+'/assets/test-upload.png'}});return true},{base});assert.equal(crops,true);
 await page.setViewportSize({width:1440,height:900});assert.equal(await page.locator('[data-cms-legacy="existing-0"] .vh-cms-photo img').evaluate(el=>getComputedStyle(el).objectPosition),'20% 30%');
 await page.setViewportSize({width:390,height:844});assert.equal(await page.locator('[data-cms-legacy="existing-0"] .vh-cms-photo img').evaluate(el=>getComputedStyle(el).objectPosition),'80% 60%');
 await page.evaluate(()=>{const section=document.querySelector('[data-cms-legacy="existing-0"]');window.VHCMSModel.motion(section,'none');window.VHCMSModel.motion(section,'fade-up',800)});assert.equal(await page.locator('[data-cms-legacy="existing-0"]').evaluate(el=>getComputedStyle(el).animationName),'vhUnifiedUp');await page.emulateMedia({reducedMotion:'reduce'});assert.equal(await page.locator('[data-cms-legacy="existing-0"]').evaluate(el=>getComputedStyle(el).animationName),'none');
 assert.deepEqual(f.errors,[],'Browser errors: '+f.errors.join('; '));
 console.log('PASS: 10 layouts × 7 pages, both vertical orders, native content retained, catalog controls and live collections preserved, custom links, responsive crop, motion and idempotent publication.');
}finally{await f.browser.close()}})().catch(e=>{console.error(e);process.exit(1)});
