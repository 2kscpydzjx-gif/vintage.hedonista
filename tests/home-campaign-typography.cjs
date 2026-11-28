const assert=require('node:assert/strict'),fs=require('node:fs');
const {fixture}=require('./cms-browser-fixture.cjs');
const {mockCampaignPhotos}=require('./campaign-photos.cjs');
const originalTitle='VINTAZHKA — МИСТЕЦТВО БУТИ СОБОЮ';
const record={shared:{cmsPageDraft:{existing:{'existing-0':{design:{photoPreset:'gradient-hero'},mapped:{
 'static:#heroTitle:0':originalTitle,
 'static:#heroEyebrow:0':'ОДЯГ З МИНУЛОГО. СТИЛЬ ПОЗА ЧАСОМ.',
 'static:#heroDescription:0':'<p>Виняткові вінтажні речі з Європи, де якість зустрічається з неповторним стилем. Благородні матеріали, виразні силуети та продумані капсули для вашого гардероба.</p>'
}}}}}};
const native=['#heroEyebrow','#heroTitle','#heroDescription p','#heroCatalogBtn'];
const campaign=['.vh-hero-promo__eyebrow','.vh-hero-promo__title','.vh-hero-promo__description','.vh-hero-promo__button'];
const measure=(p,selectors)=>p.evaluate(list=>list.map(selector=>{const el=document.querySelector(selector),r=el.getBoundingClientRect(),s=getComputedStyle(el);return {x:r.x,y:r.y,w:r.width,h:r.height,font:s.fontFamily,size:s.fontSize,weight:s.fontWeight,line:s.lineHeight,spacing:s.letterSpacing,align:s.textAlign}}),selectors);
(async()=>{
 const f=await fixture({reducedMotion:'reduce'});
 try{
  f.user(null);f.session(null);f.set('home','published',record);await mockCampaignPhotos(f.context,f.png);
  await f.context.addInitScript(()=>{try{localStorage.setItem('vh_campaign_dismissed_black-friday-2026','1')}catch{}});
  const p=await f.context.newPage();
  for(const width of [320,390,430,768,820,1024,1366,1536,1920,2560]){
   await p.setViewportSize({width,height:900});await p.goto('http://127.0.0.1:8765/index.html');await p.locator('.vh-hero-controls').waitFor();await p.evaluate(()=>document.fonts.ready);
   const before=await measure(p,native);await p.getByRole('button',{name:'Наступний слайд',exact:true}).click();await p.locator('.vh-hero-promo').waitFor({state:'visible'});
   if(width>760)await p.locator('.vh-hero-promo__copy[data-vh-copy-synced]').waitFor();
   const after=await measure(p,campaign);
   for(let i=0;i<before.length;i++){
    for(const name of ['font','size','weight','line','spacing','align'])assert.equal(after[i][name],width<=760&&i<3&&name==='align'?'left':before[i][name],width+' '+campaign[i]+' '+name);
    if(width>760)assert.ok(Math.abs(after[i].x-before[i].x)<.5&&Math.abs(after[i].y-before[i].y)<.5,'copy anchor differs from original at '+width+' '+campaign[i]);
    if(i<3)assert.ok(Math.abs(after[i].w-before[i].w)<.5,'copy width differs at '+width);
   }
   assert.ok(after[1].y+after[1].h<=after[2].y+1,'heading overlaps body at '+width);
   assert.ok(after[2].y+after[2].h<=after[3].y+1,'body overlaps CTA at '+width);
   if(width>760)assert.ok(Math.abs(after[1].h-before[1].h)<1,'heading block height differs at '+width);
   else{
    const box=await p.locator('.hero').boundingBox(),copy=await p.locator('.vh-hero-promo__copy').boundingBox();
    assert.ok(copy.y>=box.y+box.height*.38,'mobile copy still covers the upper image');
    assert.ok(copy.y+copy.height<=box.y+box.height-20,'mobile copy runs off the bottom');
   }
   assert.equal(await p.locator('.vh-hero-promo__discount').innerText(),'ЗНИЖКИ ДО -20%');
   assert.equal(await p.locator('.vh-hero-promo__description').innerText(),'Вінтаж із характером. Ціни, яких ви чекали.\n\nУнікальні знахідки в єдиному екземплярі.');
   assert.equal(await p.locator('.vh-hero-promo__button').innerText(),'ВІДКРИТИ РОЗПРОДАЖ →');
   const countdown=await p.locator('.vh-hero-promo__countdown').boundingBox(),heroBox=await p.locator('.hero').boundingBox();
   assert.ok(countdown.y>=after[3].y+after[3].h+6,'Hero countdown is not below the CTA at '+width);
   assert.ok(countdown.x>=heroBox.x&&countdown.x+countdown.width<=heroBox.x+heroBox.width+1,'Hero countdown overflows horizontally at '+width);
   assert.ok(countdown.y+countdown.height<=heroBox.y+heroBox.height-3,'Hero countdown is clipped at '+width);
   assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   await p.locator('.vh-hero-promo img').evaluate(el=>el.decode());
   if([390,1366,1920].includes(width)){fs.mkdirSync('test-results/black-friday',{recursive:true});await p.locator('.hero').screenshot({path:'test-results/black-friday/matched-copy-'+width+'.png'})}
   await p.getByRole('button',{name:'Попередній слайд',exact:true}).click();assert.deepEqual(await measure(p,native),before,'original slide changed');
  }
  // Resize while the promotion stays selected: copied styles must update too.
  await p.getByRole('button',{name:'Наступний слайд',exact:true}).click();await p.setViewportSize({width:390,height:900});await p.waitForTimeout(40);
  assert.equal((await measure(p,campaign))[1].size,(await measure(p,native))[1].size);
  assert.deepEqual(f.records.get('home:published').shared,record.shared);assert.equal(f.calls.some(c=>c.op!=='select'),false);assert.deepEqual(f.errors,[]);
  console.log('PASS: desktop campaign matches original fonts/anchors; mobile keeps typography with lower, left-aligned copy and clear upper photo at ten widths. Correct sale copy, no overlaps, resize updates and unchanged CMS data.');
 }finally{await f.browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
