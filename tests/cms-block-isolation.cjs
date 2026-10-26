const assert=require('node:assert/strict');const {fixture}=require('./cms-browser-fixture.cjs');
const base='http://127.0.0.1:8765';
(async()=>{const f=await fixture();try{
 const files={home:'index.html',about:'about.html',catalog:'catalog.html',capsules:'capsule.html',journal:'journal.html',delivery:'delivery.html',contacts:'contacts.html'};
 for(const [page,file] of Object.entries(files)){
  const p=await f.context.newPage();await p.goto(base+'/'+file);await p.waitForFunction(()=>window.__VH_PUBLISHED_READY);await p.emulateMedia({reducedMotion:'reduce'});
  const result=await p.evaluate(({page,base})=>{
   const m=window.VHCMSModel,sections=m.sections(document,page),presets=['left','text-top','framed','gradient-hero','three-photos','text-only','right','stacked'];
   const edits=sections.map((section,i)=>({design:{layoutVersion:1,photoPreset:presets[i%presets.length],photoWidth:i%2?35:65,backgroundMode:i%2?'cream':'dark',padding:24},layoutImages:{0:base+'/assets/test-upload.png'}}));
   const dynamic=[...document.querySelectorAll('#productGrid,.new-arrivals-carousel,.journal-mobile-viewport,.capsule-cards-grid')],handler=()=>{window.__cmsIsolationEvents=(window.__cmsIsolationEvents||0)+1};dynamic.forEach(node=>node.addEventListener('cms-isolation-test',handler));
   sections.forEach((section,i)=>m.applyDesign(section,edits[i].design,page,edits[i]));
   const measure=section=>{const r=section.getBoundingClientRect();return {x:r.x,width:r.width,height:r.height,bg:getComputedStyle(section.querySelector(':scope>.vh-cms-composition')||section).backgroundColor}};
   const before=sections.slice(1).map(measure);for(const preset of ['stacked','right','text-top','original','left'])m.applyDesign(sections[0],{layoutVersion:1,photoPreset:preset,photoWidth:80,padding:24},page,edits[0]);
   const after=sections.slice(1).map(measure);const snapshotsEqual=JSON.stringify(before)===JSON.stringify(after);
   const layers=sections.every(section=>section.querySelectorAll(':scope>.vh-cms-composition').length<=1&&section.querySelectorAll(':scope>.vh-cms-collections').length<=1);
   const collectionsOutsideLayout=dynamic.every(node=>node.isConnected&&!node.closest('.vh-cms-composition'));
   dynamic.forEach(node=>node.dispatchEvent(new Event('cms-isolation-test')));
   const contentHeights=sections.map(section=>({height:section.querySelector(':scope>.vh-cms-composition')?.getBoundingClientRect().height||0,text:section.querySelector('.vh-cms-copy')?.textContent.length||0}));
   return {snapshotsEqual,layers,collectionsOutsideLayout,events:window.__cmsIsolationEvents||0,expectedEvents:dynamic.length,contentHeights};
  },{page,base});
  assert.equal(result.snapshotsEqual,true,page+': editing the first section changed sibling styles or dimensions');assert.equal(result.layers,true,page+': duplicate layout containers');assert.equal(result.collectionsOutsideLayout,true,page+': live collection trapped inside layout grid');assert.equal(result.events,result.expectedEvents,page+': collection event handler lost');
  for(const block of result.contentHeights)if(block.text<500)assert.ok(block.height<1250,page+': short content became a giant block ('+block.height+'px)');
  await p.setViewportSize({width:390,height:844});const overflow=[];
  // content-visibility:auto can retain offscreen desktop geometry after rotation.
  // Check each composition when it is actually rendered in the phone viewport.
  for(const node of await p.locator('.vh-cms-composition').all()){
   await node.scrollIntoViewIfNeeded();
   const bounds=await node.evaluate(el=>({left:el.getBoundingClientRect().left,right:el.getBoundingClientRect().right,width:innerWidth}));
   if(bounds.right>bounds.width+2||bounds.left< -2)overflow.push(bounds);
  }
  assert.deepEqual(overflow,[],page+': a visible composition overflows the phone viewport');await p.close();
 }
 // A formerly huge section must use compact defaults, preserve explicit heights and restore source nodes.
 const p=await f.context.newPage();await p.goto(base+'/about.html');await p.waitForFunction(()=>window.__VH_PUBLISHED_READY);
 const sized=await p.evaluate(()=>{
  const m=window.VHCMSModel,section=document.createElement('section');section.style.minHeight='2400px';section.innerHTML='<h2>Short heading</h2><p>Short text</p><button type="button">Action</button>';document.body.append(section);let clicks=0;section.querySelector('button').onclick=()=>clicks++;
  m.applyDesign(section,{layoutVersion:1,photoPreset:'left'},'about');const auto=section.getBoundingClientRect().height,button=m.nativeButtons(section,'about')[0];const settings={[button.id]:{desktop:{mode:'free',x:100,y:100}}};
  m.applyButtonSettings(section,settings,'about');const projected=section.querySelector('.vh-cms-button-layer button');projected.click();const count=section.querySelectorAll('.vh-cms-composition').length;
  m.applyDesign(section,{layoutVersion:1,photoPreset:'text-top',photoWidth:80},'about');const vertical=section.getBoundingClientRect().height,photo=section.querySelector('.vh-cms-photo').getBoundingClientRect().height;
  m.applyDesign(section,{layoutVersion:1,photoPreset:'left',heightMode:'fixed',height:360},'about');const fixed=section.getBoundingClientRect().height;
  m.applyDesign(section,{layoutVersion:1,photoPreset:'original'},'about');const originalButtons=section.querySelectorAll('button').length,overlays=section.querySelectorAll('.vh-cms-button-layer').length;return {auto,vertical,photo,fixed,clicks,count,originalButtons,overlays};
 });assert.ok(sized.auto<=500,'old 2400px minimum leaked into automatic composition');assert.ok(sized.photo<=480&&sized.vertical<900,'automatic vertical photo is unbounded');assert.equal(sized.fixed,360);assert.equal(sized.clicks,1,'projected native button lost its action');assert.equal(sized.count,1);assert.equal(sized.originalButtons,1);assert.equal(sized.overlays,0);
 assert.deepEqual(f.errors,[]);console.log('PASS: mixed neighboring layouts on seven pages, isolated dimensions/colors, live collections and handlers, phone bounds, compact auto sizes and native button actions.');
}finally{await f.browser.close()}})().catch(error=>{console.error(error);process.exit(1)});
