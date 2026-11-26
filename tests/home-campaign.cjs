const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {fixture}=require('./cms-browser-fixture.cjs');
const {campaign,mockCampaignPhotos,verifyFrame}=require('./campaign-photos.cjs');
const base='http://127.0.0.1:8765',photo=base+'/assets/test-upload.png';
const root=path.resolve(__dirname,process.env.VH_TEST_BUILT==='1'?'../dist':'..');
const categories=[{id:'outerwear-id',slug:'outerwear',name:'Верхній одяг',is_active:true},{id:'shoes-id',slug:'shoes',name:'Взуття',is_active:true}];
const product=(id,price,old_price,category=categories[0])=>({id,slug:id,name:'Вінтажна річ '+id,price,old_price,brand:'Archive',size:'M',color:'Чорний',season:'Демісезон',status:'published',created_at:'2026-11-26T10:00:00Z',category_id:category.id,categories:category,cover_image:photo,is_new:true,product_images:[]});
const offers=Array.from({length:14},(_,i)=>product('sale-'+i,800+i*10,1000+i*10,i===13?categories[1]:categories[0]));
const products=[...offers,product('regular',950,null),product('equal',500,500),product('increased',600,500),product('missing-old',500,'')];
const revision={shared:{cmsPageDraft:{existing:{'existing-0':{design:{photoPreset:'gradient-hero'},images:{image0:photo}}}}}};
(async()=>{
 const f=await fixture({reducedMotion:'reduce',hasTouch:true});
 try{
  // Exercise carousel/catalog independently of the timed popup's dedicated suite.
  await f.context.addInitScript(()=>{try{localStorage.setItem('vh_campaign_dismissed_black-friday-2026','1')}catch{}});
  f.user(null);f.session(null);f.settings({hero_title:'VINTAZHKA — МИСТЕЦТВО БУТИ СОБОЮ',hero_main_image:photo,hero_top_image:photo,hero_bottom_image:photo});
  f.data('products',products);f.data('categories',categories);f.set('home','published',revision);
  await mockCampaignPhotos(f.context,f.png);
  let clean=false;
  await f.context.route('**/config.js',r=>r.fulfill({contentType:'text/javascript',body:fs.readFileSync(path.join(root,'config.js'),'utf8')+(clean?'\nwindow.VH_CONFIG.cleanUrls=true;window.VH_CONFIG.prettyUrls=true;':'')}));
  await f.context.route(base+'/catalog**',r=>r.request().resourceType()==='document'?r.fulfill({contentType:'text/html; charset=utf-8',body:fs.readFileSync(path.join(root,'catalog.html'),'utf8').replace('<head>','<head><base href="/">')}):r.fallback());
  const actualPhoto=process.env.VH_CAMPAIGN_PHOTO;
  if(actualPhoto)await f.context.route('**/assets/test-upload.png*',r=>r.fulfill({contentType:'image/png',body:fs.readFileSync(actualPhoto)}));
  const p=await f.context.newPage();
  for(const width of [320,390,820,1440]){
   await p.setViewportSize({width,height:900});await p.goto(base+'/index.html');await p.waitForFunction(()=>VHCMSBoot?.state==='ready');await p.locator('.vh-hero-controls').waitFor();
   const hero=p.locator('.hero'),initial=await hero.boundingBox(),original=await p.locator('#heroTitle').innerText();
   assert.equal(await p.locator('h1').count(),1);assert.equal(await hero.getAttribute('data-vh-slide'),'0');
   assert.equal(await p.locator('.vh-hero-promo img').getAttribute('src'),null,'second photo should not compete with first Hero load');
   await p.getByRole('button',{name:'Наступний слайд',exact:true}).click();
   await p.locator('.vh-hero-promo').waitFor({state:'visible'});
   const photoNode=p.locator('.vh-hero-promo img');await photoNode.evaluate(el=>el.decode());
   assert.equal(await photoNode.evaluate(el=>el.currentSrc),width<=760?campaign.mobileImage:campaign.image,'responsive campaign photo');
   await verifyFrame(photoNode,width<=760?campaign.mobileImageFrame:campaign.imageFrame);
   const visible=await hero.boundingBox();assert.ok(Math.abs(visible.height-initial.height)<1,'slide changes Hero height at '+width);
   assert.equal(await p.locator('#heroTitle').evaluate(el=>!!el.closest('[inert]')),true);
   assert.equal(await p.locator('.vh-hero-promo').getAttribute('aria-hidden'),'false');
   assert.equal(await p.getByRole('button',{name:'Слайд 2: Чорна п’ятниця'}).getAttribute('aria-pressed'),'true');
   const href=await p.getByRole('link',{name:'ПЕРЕГЛЯНУТИ ЗНИЖКИ'}).getAttribute('href');assert.equal(new URL(href).searchParams.get('sale'),'1');
   const appearance=await p.locator('.vh-hero-promo__button').evaluate(el=>{const s=getComputedStyle(el);return {color:s.color,background:s.backgroundColor,size:parseFloat(s.fontSize)}});
   assert.notEqual(appearance.color,appearance.background,'CTA text blends into background');assert.ok(appearance.size>=10,'CTA label is too small');
   for(const el of [p.locator('.vh-hero-controls'),p.locator('.vh-hero-promo__button'),p.locator('.vh-hero-promo__title')]){
    const b=await el.boundingBox();assert.ok(b.x>=initial.x-1&&b.x+b.width<=initial.x+initial.width+1,'campaign UI overflows at '+width);
   }
   assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'horizontal overflow '+width);
   if(width===390||width===1440){fs.mkdirSync('test-results/black-friday',{recursive:true});await hero.screenshot({path:'test-results/black-friday/promotion-'+width+'.png'})}
   await p.getByRole('button',{name:'Попередній слайд',exact:true}).click();assert.equal(await p.locator('#heroTitle').innerText(),original);assert.equal(await p.locator('#heroCatalogBtn').isVisible(),true);
   // A horizontal touch gesture changes slides; vertical motion does not.
   const box=await hero.boundingBox(),x=box.x+box.width*.75,y=box.y+120;
   await hero.dispatchEvent('pointerdown',{pointerId:11,isPrimary:true,button:0,clientX:x,clientY:y});
   await hero.dispatchEvent('pointerup',{pointerId:11,isPrimary:true,button:0,clientX:x-90,clientY:y+5});
   assert.equal(await hero.getAttribute('data-vh-slide'),'1','horizontal swipe');
   await hero.dispatchEvent('pointerdown',{pointerId:12,isPrimary:true,button:0,clientX:x,clientY:y});
   await hero.dispatchEvent('pointerup',{pointerId:12,isPrimary:true,button:0,clientX:x-5,clientY:y+100});
   assert.equal(await hero.getAttribute('data-vh-slide'),'1','vertical scroll changed slide');
   if(width===390){
    const touch=await f.context.newCDPSession(p),r=await hero.boundingBox(),point={x:r.x+r.width*.8,y:r.y+130};
    await touch.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[point]});
    await touch.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:point.x-120,y:point.y}]});
    await touch.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    assert.equal(await hero.getAttribute('data-vh-slide'),'0','real mobile swipe did not change the slide');
    await p.getByRole('button',{name:'Наступний слайд',exact:true}).click();await touch.detach();
   }
   await p.getByRole('button',{name:'Наступний слайд',exact:true}).focus();await p.keyboard.press('ArrowRight');assert.equal(await hero.getAttribute('data-vh-slide'),'0');
   await p.evaluate(()=>window.dispatchEvent(new Event('vh:home-rendered')));assert.equal(await p.locator('.vh-hero-controls').count(),1,'CMS reapply duplicated controls');
  }
  await p.getByRole('button',{name:'Наступний слайд',exact:true}).click();await p.getByRole('link',{name:'ПЕРЕГЛЯНУТИ ЗНИЖКИ'}).click();
  await p.waitForFunction(()=>document.querySelector('#catalogSaleOnly')?.checked&&document.querySelectorAll('.catalog-luxury-card').length===12);
  assert.equal(new URL(p.url()).searchParams.get('sale'),'1');await p.locator('#catalogSaleNotice').waitFor({state:'visible'});
  assert.equal(await p.locator('#catalogSaleCount').innerText(),'14');
  assert.equal(await p.locator('.catalog-luxury-card .catalog-luxury-price del').count(),12);
  assert.equal(await p.locator('.catalog-luxury-card .catalog-badge.sale').count(),12);
  if(actualPhoto)await p.screenshot({path:'test-results/black-friday/catalog-sale-desktop.png',fullPage:true});
  await p.locator('#catalogLoadMore').click();assert.equal(await p.locator('.catalog-luxury-card').count(),14);
  assert.equal(await p.locator('.catalog-luxury-card').filter({hasText:'regular'}).count(),0);
  assert.ok(f.calls.some(c=>c.table==='products'&&c.columns?.split(',').includes('old_price')),'catalog did not read the existing old price');
  const cases=await p.evaluate(()=>[null,'',0,-10,500,499,501,'900','invalid',Infinity].map(old_price=>productHasDiscount({price:500,old_price})));
  assert.deepEqual(cases,[false,false,false,false,false,false,true,true,false,false]);
  await p.locator('input[name="category"][value="outerwear"]').check();assert.equal(new URL(p.url()).searchParams.get('sale'),'1');
  await p.reload();await p.waitForFunction(()=>document.querySelector('#catalogSaleOnly')?.checked);assert.equal(new URL(p.url()).searchParams.get('category'),'outerwear');
  await p.locator('#catalogClearSale').click();assert.equal(new URL(p.url()).searchParams.has('sale'),false);assert.equal(new URL(p.url()).searchParams.get('category'),'outerwear');assert.equal(await p.locator('#catalogSaleOnly').isChecked(),false);
  await p.locator('#catalogSaleOnly').check();await p.locator('#resetCatalogFilters').click();assert.equal(new URL(p.url()).searchParams.has('sale'),false);assert.equal(await p.locator('#catalogSaleNotice').isVisible(),false);
  clean=true;await p.goto(base+'/catalog/outerwear/?sale=1&utm_source=campaign-test');await p.waitForFunction(()=>document.querySelector('#catalogSaleOnly')?.checked);
  assert.equal(await p.locator('input[name="category"][value="outerwear"]').isChecked(),true);
  await p.locator('#catalogClearSale').click();assert.equal(new URL(p.url()).pathname,'/catalog/outerwear/');assert.equal(new URL(p.url()).searchParams.has('sale'),false);assert.equal(new URL(p.url()).searchParams.get('utm_source'),'campaign-test');
  await p.locator('#catalogSaleOnly').check();await p.reload();await p.waitForFunction(()=>document.querySelector('#catalogSaleOnly')?.checked);
  f.data('products',[product('only-regular',950,null)]);await p.reload();await p.locator('.catalog-no-results').waitFor();assert.equal(await p.locator('#catalogSaleNotice').isVisible(),true);await p.locator('#catalogClearSale').click();assert.equal(await p.locator('.catalog-luxury-card').count(),1);
  // Switching off the campaign restores the original first slide and focusability.
  clean=false;await p.goto(base+'/index.html');await p.locator('.vh-hero-controls').waitFor();await p.getByRole('button',{name:'Наступний слайд',exact:true}).click();
  await p.evaluate(()=>{window.VH_HOME_CAMPAIGN={...VH_HOME_CAMPAIGN,enabled:false};VHHomeCampaign.refresh()});
  assert.equal(await p.locator('.vh-hero-controls,.vh-hero-promo').count(),0);assert.equal(await p.locator('#heroCatalogBtn').isVisible(),true);assert.equal(await p.locator('#heroTitle').evaluate(el=>!!el.closest('[inert]')),false);
  assert.deepEqual(f.records.get('home:published').shared,revision.shared);assert.equal(f.calls.some(c=>c.op!=='select'),false,'unexpected live content write');assert.deepEqual(f.errors,[]);
  console.log('PASS: two-slide Hero at four widths, manual controls/keyboard/swipe, stable height, deferred photo, CMS reapply, sale CTA/filter/old prices/pagination/category URLs/reload/reset/empty state, and campaign off switch. No content writes.');
 }finally{await f.browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
