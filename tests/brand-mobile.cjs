const assert=require('node:assert/strict');const {fixture}=require('./cms-browser-fixture.cjs');
const base='http://127.0.0.1:8765';
const product={id:'brand-product',slug:'brand-product',name:'Жакет у клітинку',price:1200,brand:'Marc Cain',status:'published',stock:1,product_images:[]};
(async()=>{const f=await fixture({reducedMotion:'reduce'});try{
 f.user(null);f.session(null);
 f.settings({hero_title:'VINTAGE HEDONISTA — МИСТЕЦТВО БУТИ СОБОЮ',about_philosophy_text:'Vintage Hedonista — це речі з історією.',contacts_page_kicker:'VINTAGE HEDONISTA',contacts_telegram_text:'Vintage Hedonista',contacts_instagram_text:'@vintage_hedonista',contacts_instagram_url:'https://www.instagram.com/vintage_hedonista',contacts_telegram_url:'https://t.me/vintage_hedonista'});
 f.set('home','published',{shared:{nav:{3:{label:'HEDONISTA JOURNAL',href:'journal.html'}},footerText:'Речі Vintage Hedonista з історією',cmsPageDraft:{existing:{'existing-0':{title:'VINTAGE HEDONISTA — МИСТЕЦТВО БУТИ СОБОЮ'}}}}});
 f.data('products',[product]);
 f.data('vh_seo_metadata',[{entity_type:'product',entity_id:product.id,seo_title:'Жакет — Vintage Hedonista',meta_description:'Вінтажний жакет у Vintage Hedonista.'}]);
 const before=JSON.stringify([...f.records]),p=await f.context.newPage();
 await f.context.addInitScript(()=>{try{sessionStorage.setItem('vh_intro_seen_v96','1')}catch{}});
 for(const width of [320,390,430,768,1440]){
  await p.setViewportSize({width,height:900});
  for(const route of ['index.html','catalog.html','product.html?slug='+product.slug,'checkout.html','about.html','journal.html','contacts.html']){
   await p.goto(base+'/'+route);await p.waitForFunction(()=>window.__VH_SHELL_READY||window.__VH_PUBLISHED_READY);
   if(['index.html','catalog.html','about.html','journal.html','contacts.html'].includes(route))await p.waitForFunction(()=>window.VHCMSBoot?.state==='ready');
   if(route.startsWith('product'))await p.waitForFunction(()=>document.title==='Жакет — Vintazhka');
   assert.equal(await p.locator('header nav a').nth(3).textContent(),'VINTAZHKA JOURNAL');
   assert.doesNotMatch(await p.locator('body').innerText(),/Vintage\s+Hedonista|Hedonista\s+(Journal|Guide)|@vintage_hedonista/i,route+' '+width);
   assert.doesNotMatch(await p.title(),/hedonista/i);
   assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),route+' overflow at '+width);
   if(route==='contacts.html'){
    assert.equal(await p.locator('#contactsInstagramLink').getAttribute('href'),'https://www.instagram.com/vintage_hedonista');
    assert.equal(await p.locator('#contactsTelegramLink').getAttribute('href'),'https://t.me/vintage_hedonista');
   }
   if(route==='catalog.html'&&width<=760){
    assert.equal(await p.locator('#catalogSearch').getAttribute('placeholder'),'Назва, бренд або категорія');
    assert.ok(await p.locator('#catalogSortCurrent').evaluate(el=>parseFloat(getComputedStyle(el).fontSize)>=12));
   }
   if(route==='checkout.html'&&width<=760){
    await p.evaluate(product=>{vhSetCart([product]);return initCheckoutPage()},product);
    assert.ok(await p.locator('.checkout-fields label').evaluateAll(els=>els.every(el=>parseFloat(getComputedStyle(el).fontSize)>=11)));
    assert.ok(await p.locator('.checkout-fields input').evaluateAll(els=>els.every(el=>parseFloat(getComputedStyle(el).fontSize)>=16&&el.getBoundingClientRect().height>=44)));
    assert.ok(await p.locator('.checkout-item button').evaluate(el=>el.getBoundingClientRect().width>=44&&el.getBoundingClientRect().height>=44));
   }
  }
 }
 assert.equal(JSON.stringify([...f.records]),before,'customer rendering rewrote the published CMS records');
 assert.equal(f.calls.filter(c=>c.op!=='select').length,0);assert.equal(f.functionCalls.length,0);assert.deepEqual(f.errors,[]);
 console.log('PASS: Vintazhka across CMS, shell, cached labels and metadata at five widths; readable mobile labels and checkout, unchanged product brands/social destinations and no content/price writes.');
}finally{await f.browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
