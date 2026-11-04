const assert=require('node:assert/strict');const {fixture}=require('./cms-browser-fixture.cjs');
const base='http://127.0.0.1:8765';
const photo='https://yffwjgwwkapdrpwyjwfp.supabase.co/storage/v1/object/public/vintage-media/cms/capsules/existing-existing-0-static--capsule-hero-photo-0/1793784727483-bc6a7ff8-fc7d-4bf5-8c4d-75f4d140d5a1.webp';
const description='Від романтики до гранжу, від класики до бохо. Досліджуйте різні стилі та знаходьте натхнення в капсулах, де кожна деталь має значення.';
(async()=>{const f=await fixture();try{
 f.user(null);f.session(null);f.delay(450);
 f.data('capsule_page_settings',[{id:1,hero_kicker:'VINTAGE HEDONISTA',hero_title:'КАПСУЛИ',hero_subtitle:'',hero_description:'Previous description',hero_image:base+'/assets/test-upload.png',mood_title:'ОБЕРИ СВІЙ НАСТРІЙ.',mood_text:'Романтика, бунтарство чи стримана елегантність? Досліджуй стилі, експериментуй із поєднаннями та створюй особливий настрій для свого гардеробу.'}]);
 f.data('capsule_styles',[{id:'preppy',title:'PREPPY',slug:'preppy',is_active:true,image_url:base+'/assets/test-upload.png'}]);
 f.set('capsules','published',{shared:{cmsPageDraft:{existing:{'existing-0':{design:{layout:'photo-left',photoPreset:'left',photoWidth:50},mapped:{'static:.capsule-hero-copy h1:0':'МИСТЕЦТВО ПОЄДНУВАТИ','static:.capsule-hero-copy p:0':description,'static:.capsule-hero-photo:0':base+'/assets/test-upload.png'}}}}}});
 const records=JSON.stringify([...f.records]);
 await f.context.route(photo,route=>route.fulfill({contentType:'image/png',body:f.png}));
 for(const [index,width] of [320,360,390,430,600,760,768,820,1024,1366,1440,1920].entries()){
  const p=await f.context.newPage();await p.setViewportSize({width,height:900});await p.goto(base+'/capsule.html');await p.waitForFunction(()=>VHCMSBoot.state==='ready');
  const hero=p.locator('.capsule-hero');assert.equal(await hero.getAttribute('data-vh-layout'),'gradient-hero');
  assert.equal(await hero.locator(':scope>.vh-cms-composition').count(),1);assert.equal(await hero.locator('.vh-cms-photo img').getAttribute('src'),photo);
  assert.equal(await hero.locator('.vh-cms-copy .capsule-kicker').textContent(),'VINTAZHKA');assert.equal(await hero.locator('.vh-cms-copy h1').textContent(),'МИСТЕЦТВО ПОЄДНУВАТИ');assert.equal(await hero.locator('.vh-cms-copy p').textContent(),description);
  await p.waitForFunction(()=>[...document.querySelectorAll('.capsule-hero [data-vh-page-entry]')].some(el=>el.dataset.vhPagePhase==='running'));
  const state=await hero.locator('[data-vh-page-phase=running]').evaluateAll(nodes=>nodes.map(el=>({opacity:Number(getComputedStyle(el).opacity),animations:el.getAnimations().map(a=>({state:a.playState,time:a.currentTime}))})));
  assert.ok(state.some(s=>s.opacity<.98&&s.animations.some(a=>a.state==='running'&&a.time<900)),'hero did not visibly enter at '+width);
  await p.waitForTimeout(1500);
  const layout=await p.locator('.capsule-page').evaluate(el=>{const box=node=>node.getBoundingClientRect().toJSON(),hero=el.querySelector('.capsule-hero'),copy=hero.querySelector('.vh-cms-copy'),intro=el.querySelector('.capsule-intro'),title=intro.querySelector('h2'),text=intro.querySelector('p');return {hero:box(hero),copy:box(copy),paragraph:box(copy.querySelector('p')),intro:box(intro),title:box(title),text:box(text),innerScroll:copy.scrollHeight>copy.clientHeight+1,overflow:document.documentElement.scrollWidth>innerWidth+1}});
  assert.equal(layout.innerScroll,false);assert.equal(layout.overflow,false);assert.ok(layout.paragraph.bottom<=layout.hero.bottom+1);
  assert.ok(layout.intro.height<(width<=760?250:220),'intro is oversized at '+width);
  if(width<=760)assert.ok(layout.title.bottom<=layout.text.top);else assert.ok(layout.title.right<layout.text.left);
  await p.evaluate(()=>dispatchEvent(new Event('vh:capsules-rendered')));assert.equal(await hero.locator(':scope>.vh-cms-composition').count(),1);
  const card=p.locator('a.capsule-card'),destination=await card.getAttribute('href');assert.match(destination,/capsule-1(?:\.html)?\?style=preppy/);
  assert.equal(await card.locator('a,button').count(),0,'nested interactive elements');assert.equal(await card.getAttribute('aria-labelledby'),await card.locator('h3').getAttribute('id'));
  // Exercise the photo, title, visual CTA and native keyboard link on phone/tablet/desktop.
  if(index%4===0){await card.scrollIntoViewIfNeeded();await card.click({position:{x:35,y:35}})}
  else if(index%4===1)await card.locator('h3').click();
  else if(index%4===2)await card.locator('.capsule-card-link').click();
  else{await card.focus();assert.equal(await card.evaluate(el=>document.activeElement===el),true);await p.keyboard.press('Enter')}
  await p.waitForURL(/capsule-1(?:\.html)?\?style=preppy/);await p.close();
 }
 const p=await f.context.newPage();await p.emulateMedia({reducedMotion:'reduce'});await p.goto(base+'/capsule.html');await p.waitForFunction(()=>VHCMSBoot.state==='ready');assert.equal(await p.locator('.capsule-hero [data-vh-page-entry]').count(),0);assert.equal(await p.locator('.capsule-hero .vh-cms-copy').evaluate(el=>Number(getComputedStyle(el).opacity)),1);await p.close();
 assert.equal(JSON.stringify([...f.records]),records);assert.equal(f.calls.filter(c=>c.op!=='select').length,0);assert.deepEqual(f.errors,[]);
 console.log('PASS: capsule gradient/photo/brand, published text, visible entry, compact intro, 12 responsive widths, no nested scroll/overflow, repeat CMS render, whole-card photo/title/CTA/keyboard navigation, reduced motion and no data writes.');
}finally{await f.browser.close()}})().catch(error=>{console.error(error);process.exitCode=1});
