const assert=require('node:assert/strict');
const {fixture}=require('./cms-browser-fixture.cjs');
const base='http://127.0.0.1:8765',photo=base+'/assets/test-upload.png';
const description='Від романтики до гранжу, від класики до бохо. Досліджуйте різні стилі та знаходьте натхнення в капсулах, де кожна деталь має значення.';
const styles=['BLACK & WHITE','PREPPY','OFFICE CORE','SMART CASUAL','BOHO','DENIM'].map((title,i)=>({id:'style-'+i,slug:'style-'+i,title,page_title:title,page_description:description,is_active:true,hero_image:photo}));
const capsule=(i,style=styles[0])=>({id:'capsule-'+i,style_id:style.id,title:'Капсула '+(i+1),description,cover_image:photo,is_active:true});
(async()=>{const f=await fixture({reducedMotion:'reduce'});try{
 f.user(null);f.session(null);
 f.data('capsule_styles',styles);f.data('capsules',[0,1,2].map(i=>capsule(i)));
 f.data('capsule_looks',[0,1,2].flatMap(i=>[0,1].map(j=>({id:'look-'+i+'-'+j,capsule_id:'capsule-'+i,title:'Образ '+j,is_main:j===0,image_url:photo}))));
 f.set('home','published',{shared:{cmsPageDraft:{existing:{'existing-0':{design:{photoPreset:'gradient-hero'},mapped:{'static:#heroTitle:0':'VINTAZHKA — МИСТЕЦТВО БУТИ СОБОЮ','static:#heroDescription:0':description}}}}}});
 f.set('capsules','published',{shared:{cmsPageDraft:{existing:{'existing-0':{design:{layoutVersion:1,photoPreset:'gradient-hero',headingSize:44},mapped:{'static:.capsule-hero-copy h1:0':'МИСТЕЦТВО ПОЄДНУВАТИ','static:.capsule-hero-copy p:0':description}}}}}});
 const p=await f.context.newPage();
 const metrics=(el,pseudo)=>{const c=getComputedStyle(el,pseudo);return ['fontFamily','fontSize','fontWeight','lineHeight','color','letterSpacing'].map(k=>c[k])};
 const snapshot=async selectors=>Promise.all(selectors.map(s=>p.locator(s).evaluate(metrics,s==='.capsule-style-hero-copy'?'::before':null)));
 for(const width of [320,360,390,430,600,760,768,820,1024,1250,1366,1440,1920]){
  await p.setViewportSize({width,height:900});
  await p.goto(base+'/index.html');await p.waitForFunction(()=>VHCMSBoot.state==='ready');
  const home=await snapshot(['#heroEyebrow','#heroTitle','#heroDescription']);
  await p.goto(base+'/capsule.html');await p.waitForFunction(()=>VHCMSBoot.state==='ready');
  assert.deepEqual(await snapshot(['.capsule-hero>.vh-cms-composition .capsule-kicker','.capsule-hero>.vh-cms-composition h1','.capsule-hero>.vh-cms-composition p']),home,'index hero differs from home at '+width);
  await p.goto(base+'/capsule-1.html?style=style-0');await p.waitForFunction(()=>document.querySelector('#capsuleCurrentLabel').textContent.includes('/'));
  assert.deepEqual(await snapshot(['.capsule-style-hero-copy','.capsule-style-hero-copy h1','.capsule-style-hero-copy p']),home,'detail hero differs from home at '+width);
  for(const selector of ['.capsule-style-hero-copy h1','.capsule-style-hero-copy p','.capsule-info','.capsule-info-description'])assert.equal(await p.locator(selector).evaluate(el=>getComputedStyle(el).textAlign),'center');
  const nav=p.locator('.capsule-page-nav');
  assert.equal(await nav.locator('#capsuleCurrentLabel').textContent(),'КАПСУЛА 01 / 03');
  assert.equal(await nav.locator('#capsuleGroupPrev').isDisabled(),true);
  for(const text of ['Попередня капсула','Наступна капсула']){const box=await nav.getByRole('button',{name:text}).boundingBox();assert.ok(box.height>=44&&box.x>=0&&box.x+box.width<=width+1,'tap target at '+width)}
  await nav.getByRole('button',{name:'Наступна капсула'}).click();await p.waitForFunction(()=>document.querySelector('#capsuleCurrentLabel').textContent==='КАПСУЛА 02 / 03');
  assert.equal(await p.locator('.capsule-info h1').textContent(),'Капсула 2');
  await p.locator('#capsuleNext').click();await p.waitForFunction(()=>document.querySelector('.capsule-buy-meta span').textContent==='ОБРАЗ 02');assert.equal(await p.locator('#capsuleCurrentLabel').textContent(),'КАПСУЛА 02 / 03','look navigation changed capsule');
  await nav.getByRole('button',{name:'Наступна капсула'}).focus();await p.keyboard.press('Enter');await p.waitForFunction(()=>document.querySelector('#capsuleCurrentLabel').textContent==='КАПСУЛА 03 / 03');
  assert.equal(await p.locator('#capsuleGroupNext').isDisabled(),true);
  await nav.getByRole('button',{name:'Попередня капсула'}).click();await p.waitForFunction(()=>document.querySelector('#capsuleCurrentLabel').textContent==='КАПСУЛА 02 / 03');
  assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,'horizontal overflow at '+width);
  assert.equal(await p.locator('.capsule-style-hero-copy').evaluate(el=>el.scrollHeight>el.clientHeight+1),false,'hero scroll at '+width);
 }
 // Every published style uses the same detail template, including long headings.
 for(const style of styles){f.data('capsules',[capsule(0,style)]);await p.goto(base+'/capsule-1.html?style='+style.slug);await p.waitForFunction(()=>document.querySelector('#capsuleCurrentLabel').textContent==='КАПСУЛА 01 / 01');assert.equal(await p.locator('#capsuleStyleHeroCopy h1').textContent(),style.title);assert.ok(await p.locator('#capsuleGroupPrev').isDisabled());assert.ok(await p.locator('#capsuleGroupNext').isDisabled())}
 // Long published copy grows naturally; normal-motion capsule switching still completes.
 f.data('capsule_styles',[{...styles[0],page_title:'BLACK & WHITE — МИСТЕЦТВО ПОЄДНУВАТИ',page_description:description.repeat(3)}]);
 f.data('capsules',[0,1,2].map(i=>capsule(i)));
 await p.setViewportSize({width:320,height:700});await p.emulateMedia({reducedMotion:'no-preference'});
 await p.goto(base+'/capsule-1.html?style=style-0');await p.waitForFunction(()=>document.querySelector('#capsuleCurrentLabel').textContent==='КАПСУЛА 01 / 03');
 await p.locator('#capsuleGroupNext').click();await p.waitForFunction(()=>document.querySelector('#capsuleCurrentLabel').textContent==='КАПСУЛА 02 / 03');await p.waitForTimeout(650);
 assert.equal(await p.locator('.capsule-showcase-grid').evaluate(el=>Number(getComputedStyle(el).opacity)),1);
 assert.equal(await p.locator('.capsule-style-hero-copy').evaluate(el=>el.scrollHeight>el.clientHeight+1),false);
 assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
 f.data('capsules',[]);await p.goto(base+'/capsule-1.html?style=style-0');await p.getByText('У стилі «BLACK & WHITE» поки немає опублікованих капсул.').waitFor();assert.equal(await p.locator('.capsule-page-nav').isVisible(),false);
 assert.equal(f.calls.filter(c=>c.op!=='select').length,0);assert.deepEqual(f.errors,[]);
 console.log('PASS: home/index/detail hero typography matches at 13 widths, centred copy, labelled accessible capsule navigation and boundaries, separate looks, six styles, single/empty capsules and no writes.');
}finally{await f.browser.close()}})().catch(error=>{console.error(error);process.exitCode=1});
