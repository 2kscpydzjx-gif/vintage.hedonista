const assert=require('node:assert/strict'),fs=require('node:fs');
const {fixture}=require('./cms-browser-fixture.cjs');
const base='http://127.0.0.1:8765';
(async()=>{const f=await fixture();try{
 f.user(null);f.session(null);
 const shared={nav:{3:{label:'HEDONISTA JOURNAL',href:'journal.html'}},headerLogo:base+'/assets/test-upload.png?header',footerLogo:base+'/assets/test-upload.png?footer',footerText:'Актуальний підвал',footerCopyright:'© Vintazhka',instagram:'https://instagram.com/example',telegram:'https://t.me/example',cmsPageDraft:{existing:{'existing-0':{mapped:{title:'HOME TITLE MUST NOT REPLACE PRODUCT'}}}}};
 f.set('home','published',{blocks:[{id:'home-extra',type:'text',title:'HOME BLOCK MUST NOT APPEAR',body:'<p>Home only</p>'}],shared});
 const product={id:'p',slug:'vovnyanyi-zhaket-kardyhan',name:'Тестовий товар',price:1200,status:'published',cover_image:base+'/assets/test-upload.png',description:'Незмінений опис',product_images:[]};
 const articleSlug=fs.readdirSync(require('node:path').join(__dirname,'../seo-article'))[0];
 f.data('products',[product]);f.data('news',[{id:'article',slug:articleSlug,title:'Тестова стаття',status:'published',content:'<p>Текст статті</p>',excerpt:'Вступ',cover_image:product.cover_image,published_at:'2026-10-31T08:00:00Z',created_at:'2026-10-31T08:00:00Z'}]);
 const p=await f.context.newPage();
 for(const route of ['product.html?slug='+product.slug,'seo-product/'+product.slug+'/index.html','article.html?slug='+encodeURIComponent(articleSlug),'seo-article/'+encodeURIComponent(articleSlug)+'/index.html','checkout.html','account.html','capsule-1.html']){
  if(route==='account.html'){const user={id:'customer',email:'customer@example.test',user_metadata:{}};f.user(user);f.session({user,access_token:'fixture'});f.data('customer_profiles',[{id:user.id,full_name:'Тестовий покупець'}])}else{f.user(null);f.session(null)}
  const start=f.calls.length;await p.goto(base+'/'+route);await p.waitForFunction(()=>window.__VH_SHELL_READY===true);
  if(route.startsWith('product.html')||route.startsWith('seo-product/'))await p.waitForFunction(()=>document.querySelector('#productName')?.textContent==='Тестовий товар'&&document.querySelector('#galleryCount')?.textContent==='1 / 1');
  if(route==='account.html')await p.locator('.vh124-account-hero').waitFor();
  assert.equal(await p.locator('header nav a').nth(3).textContent(),'HEDONISTA JOURNAL',route);
  assert.equal(await p.locator('.vh-header-logo').getAttribute('src'),shared.headerLogo);
  assert.equal(await p.locator('.vh-footer-logo-img').getAttribute('src'),shared.footerLogo);
  assert.equal(await p.locator('.footer-v64-center').textContent(),shared.footerText);
  assert.equal(await p.locator('.footer-v64-copy').textContent(),shared.footerCopyright);
  assert.equal(await p.locator('[data-footer-instagram]').getAttribute('href'),shared.instagram);
  assert.equal(await p.locator('[data-footer-telegram]').getAttribute('href'),shared.telegram);
  const reads=f.calls.slice(start).filter(c=>c.table==='vh_page_revisions');assert.equal(reads.length,1,route+' duplicate shell query');assert.equal(reads[0].columns,'shared,updated_at');assert.ok(reads[0].filters.some(([key,value])=>key==='revision_status'&&value==='published'));
  // Compare in one event-loop turn: unrelated image/RAF arrow positioning must
  // not run between the baseline and this synchronous shell operation.
  const content=await p.evaluate(()=>{
   const main=document.querySelector('main'),before=main?.innerHTML;
   VHCMSShell.apply({nav:{3:{label:'New label',href:'javascript:alert(1)'}},footerText:'New footer'});
   return {before,after:main?.innerHTML};
  });
  assert.equal(content.after,content.before,'shared settings replaced page content');
  assert.equal(await p.locator('header nav a').nth(3).getAttribute('href'),'journal.html');
  assert.ok(!(await p.locator('body').innerText()).includes('HOME BLOCK MUST NOT APPEAR'));
  assert.equal(await p.evaluate(()=>!!window.VHCMSModel),false,'standalone page downloaded the block editor model');
 }
 f.user(null);f.session(null);
 // Existing CMS pages keep their single owner and public client.
 for(const route of ['index.html','catalog.html','contacts.html']){
  const start=f.calls.length;await p.goto(base+'/'+route);await p.waitForFunction(()=>window.VHCMSBoot.state==='ready');
  assert.equal(await p.locator('header nav a').nth(3).textContent(),'HEDONISTA JOURNAL');
  assert.equal(f.calls.slice(start).filter(c=>c.table==='vh_page_revisions'&&c.filters.some(([key,value])=>key==='page_key'&&value==='home')).length,1,'duplicate home publication read');
  assert.equal(await p.evaluate(()=>window.__cmsTestClients.length),2,'duplicate public client');
 }
 await p.goto(base+'/product.html?slug='+product.slug);await p.waitForFunction(()=>window.__VH_SHELL_READY);f.failRead(true);
 await p.reload();await p.waitForFunction(()=>window.__VH_SHELL_READY);assert.equal(await p.locator('header nav a').nth(3).textContent(),'HEDONISTA JOURNAL','read failure lost cached shell');
 f.failRead(false);f.records.delete('home:published');await p.reload();await p.waitForFunction(()=>window.__VH_SHELL_READY);
 assert.equal(await p.evaluate(()=>localStorage.getItem('vh-published-cache-v1-home-shell')),null,'successful empty publication kept stale cache');
 assert.equal(f.calls.filter(c=>c.op!=='select'&&c.table!=='customer_profiles').length,0);assert.deepEqual(f.errors,[]);
 console.log('PASS: published header/footer on products, articles, checkout, account and capsules; body/handlers remain untouched, cached fallback and empty responses work; CMS pages retain one shell query and public client.');
}finally{await f.browser.close()}})().catch(error=>{console.error(error);process.exitCode=1});
