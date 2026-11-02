const assert=require('node:assert/strict');const {fixture}=require('./cms-browser-fixture.cjs');
const base='http://127.0.0.1:8765',photo=base+'/assets/test-upload.png';
const heading='SLOW FASHION - СВІДОМА МОДА ПОЗА ЧАСОМ І ТРЕНДАМИ';
const description='Надаємо новий сенс речам з історією, які доповнюють сучасний гардероб. Обирай унікальні якісні речі та створюй неповторні образи з характером без шкоди навколишньому середовищу.';
const edit={design:{layoutVersion:1,photoPreset:'text-top',heightMode:'fixed',height:693,photoWidth:80,maxPhotoHeight:471,padding:8,headingSize:51,bodySize:15,textLayout:'heading-left',headingWidth:45,headingAlign:'left',headingPosition:'center',headingInsetLeft:12,headingInsetRight:120,bodyInsetLeft:120,textColumnGap:79},mapped:{'unified:title':'&nbsp; &nbsp; SLOW FASHION - СВІДОМА МОДА<br>ПОЗА ЧАСОМ І ТРЕНДАМИ','unified:description':'&nbsp;<br>'+description,'text:div:nth-of-type(2)>div:nth-of-type(1)':'&nbsp;<br>VINTAZHKA'},fieldStyles:{'unified:title':{size:21,lineHeight:1.6},'unified:description':{align:'left'}},layoutImages:{0:photo},mediaSettings:{'layout:0':{mobile:{fit:'cover',x:55,y:3,zoom:100},desktop:{fit:'cover',x:50,y:3,zoom:100}}}};
async function inspect(p,width){
 const value=await p.locator('.vh-home-editorial-flow').evaluate(el=>{
  const copy=el.querySelector('.vh-cms-copy'),heading=copy.querySelector('.vh-cms-copy-heading'),body=copy.querySelector('.vh-cms-copy-body'),title=heading.querySelector('h2'),photo=el.querySelector('.vh-cms-photo');
  const box=node=>{const r=node.getBoundingClientRect(),s=getComputedStyle(node);return {x:r.x,y:r.y,width:r.width,height:r.height,bottom:r.bottom,center:r.x+r.width/2,align:s.textAlign,scroll:node.scrollHeight,client:node.clientHeight,overflow:s.overflowY,font:parseFloat(s.fontSize)}};
  return {copy:box(copy),heading:box(heading),body:box(body),title:box(title),paragraph:box(body.querySelector('p')),photo:box(photo),text:title.textContent,description:body.textContent,rootHeight:el.getBoundingClientRect().height,scrollTop:copy.scrollTop,overflow:document.documentElement.scrollWidth>innerWidth};
 });
 for(const key of ['copy','heading','body']){assert.ok(value[key].scroll<=value[key].client+2,'nested text scroll '+key+' at '+width);assert.notEqual(value[key].overflow,'auto');assert.notEqual(value[key].overflow,'scroll')}
 assert.equal(value.text,heading);assert.ok(value.description.includes(description));assert.ok(!value.overflow);
 assert.ok(value.title.bottom<=value.copy.bottom+1);assert.ok(value.paragraph.bottom<=value.copy.bottom+1);assert.ok(value.copy.bottom<=value.photo.y+1,'photo overlaps copy at '+width);
 assert.ok(Math.abs(value.photo.height-693*.8)<1,'saved photo footprint changed');
 if(width<=760){assert.equal(value.title.align,'center');assert.equal(value.paragraph.align,'center');assert.ok(Math.abs(value.heading.center-value.copy.center)<1);assert.ok(Math.abs(value.body.center-value.copy.center)<1);assert.ok(value.body.y>=value.heading.bottom-1)}
 else{assert.equal(value.title.align,'left');assert.equal(value.paragraph.align,'left');assert.ok(value.heading.x+value.heading.width<value.body.x);assert.ok(Math.abs(value.heading.y+value.heading.height/2-value.body.y-value.body.height/2)<2)}
 assert.ok(value.paragraph.font>=15);assert.equal(value.scrollTop,0);return value;
}
(async()=>{const f=await fixture({reducedMotion:'reduce'});try{
 f.user(null);f.session(null);f.settings({homepage_editorial_title:heading,homepage_editorial_text:description});
 const record={shared:{cmsPageDraft:{existing:{'existing-3':edit,'existing-2':{design:{layoutVersion:1,photoPreset:'framed',heightMode:'fixed',height:490,photoWidth:65},layoutImages:{0:photo,1:photo}}}}}};
 f.set('home','published',record);const original=JSON.stringify([...f.records]);
 await f.context.addInitScript(()=>{try{sessionStorage.setItem('vh_intro_seen_v96','1')}catch{}});
 const p=await f.context.newPage();
 for(const width of [320,360,390,430,600,760,768,820,1024,1366,1440,1920]){
  await p.setViewportSize({width,height:900});await p.goto(base+'/index.html');await p.waitForFunction(()=>window.VHCMSBoot?.state==='ready');await inspect(p,width);
  await p.evaluate(()=>dispatchEvent(new Event('vh:home-rendered')));await inspect(p,width);
  assert.equal(await p.locator('.vh-home-editorial-flow>.vh-cms-composition').count(),1);
  if(width>1024)assert.equal(Math.round(await p.locator('.homepage-capsules>.vh-cms-composition').evaluate(el=>el.getBoundingClientRect().height)),490,'neighbouring fixed-height section changed');
 }
 // More copy must increase the text area instead of shrinking or scrolling it.
 const long=structuredClone(record);long.shared.cmsPageDraft.existing['existing-3'].mapped['unified:description']=description+' '+description+' '+description;
 f.set('home','published',long);await p.setViewportSize({width:390,height:844});await p.reload();await p.waitForFunction(()=>window.VHCMSBoot?.state==='ready');const large=await inspect(p,390);
 assert.ok(large.copy.height>300);await p.locator('.vh-home-editorial-flow .vh-cms-copy').scrollIntoViewIfNeeded();const y=await p.evaluate(()=>scrollY);await p.mouse.move(190,350);await p.mouse.wheel(0,180);await p.waitForTimeout(80);assert.ok(await p.evaluate(before=>scrollY>before,y));
 assert.equal(await p.locator('.vh-home-editorial-flow .vh-cms-copy').evaluate(el=>el.scrollTop),0);
 f.set('home','published',record);assert.equal(JSON.stringify([...f.records]),original);assert.equal(f.calls.filter(c=>c.op!=='select').length,0);assert.deepEqual(f.errors,[]);
 console.log('PASS: real fixed 693px/80% Slow Fashion regression, natural copy height, left/right desktop columns, centred phone copy, all text visible, page scroll, stable photo crop/height, reapply and untouched neighbouring/CMS records at twelve widths.');
}finally{await f.browser.close()}})().catch(error=>{console.error(error);process.exitCode=1});
