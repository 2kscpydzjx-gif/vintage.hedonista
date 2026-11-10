const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {fixture}=require('./cms-browser-fixture.cjs');
const {base,product}=require('./admin-fixture.cjs');
const root=path.resolve(__dirname,'..'),built=process.env.VH_TEST_BUILT==='1',assets=path.join(root,built?'dist':'.');
const copy='Студійне освітлення та налаштування екрана вашого пристрою можуть впливати на відображення кольору й відтінку речі. Щоб уточнити колір, фактуру або окремі деталі, ви можете запросити додаткові фото перед покупкою.';
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.woff2':'font/woff2','.ico':'image/x-icon','.webmanifest':'application/manifest+json'};
function walk(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(dir,e.name)):[path.join(dir,e.name)])}
(async()=>{const f=await fixture({reducedMotion:'reduce'});try{
 f.user(null);f.session(null);
 // Every request stays in the isolated fixture, including clean URL fallbacks.
 await f.context.route(base+'/**',route=>{
  let name=decodeURIComponent(new URL(route.request().url()).pathname).slice(1);
  if(name==='assets/test-upload.png')return route.fulfill({contentType:'image/png',body:f.png});
  if(name.endsWith('/'))name=name.slice(0,-1)+'.html';
  if(!path.extname(name))name+='.html';
  let file=path.resolve(assets,name);
  if(!file.startsWith(assets+path.sep))return route.abort();
  if(!fs.existsSync(file)&&/^product\//.test(name))file=path.join(assets,'product.html');
  try{return route.fulfill({contentType:mime[path.extname(file)]||'application/octet-stream',body:fs.readFileSync(file)})}catch{return route.fulfill({status:404,body:'Missing fixture asset'})}
 });
 const name='Вінтажний жакет «Été & шовк» <img src=x onerror=alert(1)>',p={...product,name,product_images:[{image_url:base+'/assets/test-upload.png',sort_order:0},{image_url:base+'/assets/test-upload.png?second',sort_order:1}]};
 f.data('products',[p]);f.settings({contacts_telegram_url:'https://t.me/fixture_shop',contacts_email_text:'old@example.test'});
 // Published CMS links take priority over legacy settings, without being changed.
 f.set('contacts','published',{shared:{cmsPageDraft:{existing:{'existing-1':{mapped:{contactsInstagramLink:'https://instagram.com/published_shop/',contactsTelegramLink:'https://t.me/published_shop',contactsEmailLink:'mailto:published@example.test',contactsEmailText:'published@example.test'}}}}}});
 const page=await f.context.newPage();
 await page.addInitScript(()=>{window.__photoClipboard='';Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text=>{window.__photoClipboard=text}}})});
 await page.goto(base+'/product.html?slug='+p.slug);await page.waitForFunction(()=>typeof currentProduct!=='undefined'&&currentProduct);
 assert.equal(await page.locator('[data-vh-photo-note]').count(),1);assert.equal(await page.locator('[data-vh-photo-note] p').textContent(),copy);
 assert.ok(await page.locator('[data-vh-photo-note]').evaluate(el=>el.previousElementSibling.classList.contains('product-thumbs-wrap')));
 for(const width of [320,390,768,820,1366,1920]){
  await page.setViewportSize({width,height:1000});const note=page.locator('[data-vh-photo-note]');
  assert.ok(await note.isVisible());assert.ok(await note.evaluate(el=>el.scrollWidth<=el.clientWidth+1),'Note overflow '+width);
  assert.ok(await page.locator('#productPhotoRequestLink').evaluate(el=>el.getBoundingClientRect().height>=44));
  assert.ok(await note.evaluate(el=>el.getBoundingClientRect().top>=el.previousElementSibling.getBoundingClientRect().bottom-1),'Note overlaps gallery '+width);
 }
 await page.setViewportSize({width:1366,height:1000});fs.mkdirSync(path.join(root,'test-results/photo-note'),{recursive:true});
 await page.locator('.product-gallery-column').screenshot({path:path.join(root,'test-results/photo-note/product-desktop.png')});
 const trigger=page.locator('#productPhotoRequestLink');await trigger.scrollIntoViewIfNeeded();
 const originalUrl=page.url(),originalPages=f.context.pages().length,previousOverflow=await page.evaluate(()=>document.documentElement.style.overflow);
 await trigger.click();const modal=page.getByRole('dialog',{name:'Запит додаткових фото',exact:true});await modal.waitFor();
 await page.waitForFunction(()=>document.querySelector('#photoRequestEmail')?.href.includes('published@'));
 assert.equal(page.url(),originalUrl,'Opening the dialog navigated away from the product');assert.equal(f.context.pages().length,originalPages,'Opening the dialog opened a window');
 assert.equal(await page.evaluate(()=>document.documentElement.style.overflow),'hidden');
 assert.equal(await page.locator('#photoRequestProduct').textContent(),name);assert.equal(await modal.locator('img').count(),0,'Product name was interpreted as markup');
 const canonical=await page.evaluate(()=>VHProductRoutes.canonical(currentProduct)),message=await page.locator('#photoRequestMessage').inputValue();assert.ok(message.includes(name)&&message.includes(canonical));
 const email=new URL(await page.locator('#photoRequestEmail').getAttribute('href'));assert.equal(email.pathname,'published@example.test');assert.equal(email.searchParams.get('body'),message);
 const telegram=new URL(await page.locator('#photoRequestTelegram').getAttribute('href'));assert.equal(telegram.pathname,'/published_shop');assert.equal(telegram.searchParams.get('text'),message);
 assert.equal(await page.locator('#photoRequestInstagram').getAttribute('href'),'https://instagram.com/published_shop/');
 assert.equal(await modal.locator('.vh-photo-request-actions a svg').count(),3,'A contact icon is missing');
 await page.locator('#photoRequestCopy').click();assert.equal(await page.evaluate(()=>window.__photoClipboard),message);
 assert.match(await page.locator('#photoRequestStatus').textContent(),/скопійовано/);
 await page.evaluate(()=>{navigator.clipboard.writeText=async()=>{throw Error('denied')};document.execCommand=()=>false});
 await page.locator('#photoRequestCopy').click();assert.match(await page.locator('#photoRequestStatus').textContent(),/Текст виділено/);
 assert.equal(await page.locator('#photoRequestMessage').evaluate(el=>el.selectionEnd-el.selectionStart),message.length);
 for(const [width,height] of [[320,900],[390,844],[768,1000],[820,1000],[1366,1000],[1920,1080],[390,360]]){
  await page.setViewportSize({width,height});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Page overflow '+width);
  assert.ok(await modal.evaluate(el=>el.scrollWidth<=el.clientWidth+1),'Dialog overflow '+width);
  assert.ok(await modal.evaluate(el=>{const r=el.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth+1&&r.top>=0&&r.bottom<=innerHeight+1}),'Dialog escapes viewport '+width+'x'+height);
  for(const action of await modal.locator('a:not([hidden]),button').all())assert.ok(await action.evaluate(el=>el.getBoundingClientRect().height>=44));
 }
 await page.setViewportSize({width:390,height:844});await page.locator('#photoRequestClose').focus();
 for(let i=0;i<10;i++){await page.keyboard.press('Tab');assert.ok(await modal.evaluate(el=>el.contains(document.activeElement)),'Focus escaped the modal')}
 await page.locator('#photoRequestClose').click();await modal.waitFor({state:'hidden'});
 assert.equal(await page.evaluate(()=>document.documentElement.style.overflow),previousOverflow);assert.ok(await trigger.evaluate(el=>document.activeElement===el),'Focus was not returned to the request button');
 const scrollBefore=await page.evaluate(()=>scrollY);await page.keyboard.press('Enter');await modal.waitFor();await page.keyboard.press('Escape');await modal.waitFor({state:'hidden'});assert.ok(Math.abs(await page.evaluate(()=>scrollY)-scrollBefore)<2,'Closing moved the product page');
 await trigger.click();await modal.waitFor();const r=await modal.boundingBox();await page.mouse.click(Math.max(1,r.x-8),r.y+10);await modal.waitFor({state:'hidden'});
 assert.equal(f.calls.filter(x=>x.table==='vh_page_revisions'&&x.filters.some(([k,v])=>k==='page_key'&&v==='contacts')).length,1,'Contact reads should be cached across opens');
 assert.ok(!f.calls.some(x=>x.table==='vh_page_revisions'&&x.filters.some(([k,v])=>k==='revision_status'&&v==='draft')),'A private draft was requested');
 // Unsupported recipients stay hidden; copying remains available.
 f.set('contacts','published',{shared:{cmsPageDraft:{existing:{'existing-1':{mapped:{contactsTelegramLink:'https://t.me/joinchat/fixture',contactsEmailLink:'javascript:alert(1)'}}}}}});
 await page.reload();await page.waitForFunction(()=>typeof currentProduct!=='undefined'&&currentProduct);await trigger.click();await modal.waitFor();await page.waitForFunction(()=>document.querySelector('#photoRequestStatus')?.textContent==='');
 assert.equal(await page.locator('#photoRequestTelegram').isVisible(),false);assert.equal(await page.locator('#photoRequestEmail').isVisible(),false);assert.ok(await page.locator('#photoRequestCopy').isVisible());await page.keyboard.press('Escape');
 await page.goto(base+'/contacts.html');await page.waitForFunction(()=>window.__VH_PUBLISHED_READY);assert.equal(await page.locator('#photoRequest').count(),0,'Ordinary contacts page received a dialog');
 if(built){
  const snapshots=fs.existsSync(path.join(assets,'product'))?walk(path.join(assets,'product')).filter(x=>x.endsWith('.html')):walk(path.join(assets,'seo-product')).filter(x=>x.endsWith('index.html'));
  assert.ok(snapshots.length>0);for(const file of snapshots){const html=fs.readFileSync(file,'utf8');assert.equal((html.match(/data-vh-photo-note/g)||[]).length,1,'Missing/duplicate notice '+file);assert.ok(html.includes(copy));}
  if(fs.existsSync(path.join(assets,'product'))){await page.goto(base+'/product/'+p.slug+'/');await page.waitForFunction(()=>typeof currentProduct!=='undefined'&&currentProduct);const before=page.url();await trigger.click();await modal.waitFor();assert.equal(page.url(),before);assert.ok((await page.locator('#photoRequestMessage').inputValue()).includes('https://vintazhka.com.ua/product/'+p.slug+'/'));await page.keyboard.press('Escape');}
 }
 assert.deepEqual(f.errors,[]);assert.equal(f.calls.filter(x=>x.op!=='select').length,0);assert.equal(f.rpcCalls.length,0);assert.equal(f.functionCalls.length,0);
 console.log('PASS: '+(built?'hosting build':'source')+' photography notice, in-page dialog, 7 viewport sizes, published contacts/icons, Telegram/email drafts, clipboard fallback, focus trap/return, Escape/backdrop/close, scroll preservation and no remote writes/messages.');
}finally{await f.browser.close()}})().catch(error=>{console.error(error);process.exit(1)});
