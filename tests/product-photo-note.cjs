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
 f.set('contacts','published',{shared:{cmsPageDraft:{existing:{'existing-1':{mapped:{contactsTelegramLink:'https://t.me/published_shop',contactsEmailLink:'mailto:published@example.test',contactsEmailText:'published@example.test'}}}}}});
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
 const destination=await page.locator('#productPhotoRequestLink').getAttribute('href'),fragment=new URLSearchParams(new URL(destination).hash.slice(1));
 assert.equal(fragment.get('photo_product'),name);assert.match(fragment.get('photo_url'),new RegExp(p.slug));
 await page.locator('#productPhotoRequestLink').click();await page.waitForFunction(()=>window.__VH_PUBLISHED_READY);await page.locator('#photoRequest').waitFor();
 await page.waitForFunction(()=>document.querySelector('#photoRequestEmail')?.href.includes('published%40')||document.querySelector('#photoRequestEmail')?.href.includes('published@'));
 assert.equal(await page.locator('#photoRequestProduct').textContent(),name);assert.equal(await page.locator('#photoRequest img').count(),0,'Product text was interpreted as markup');
 const message=await page.locator('#photoRequestMessage').inputValue();assert.ok(message.includes(name)&&message.includes(fragment.get('photo_url')));
 const email=new URL(await page.locator('#photoRequestEmail').getAttribute('href'));assert.equal(email.pathname,'published@example.test');assert.equal(email.searchParams.get('body'),message);
 const telegram=new URL(await page.locator('#photoRequestTelegram').getAttribute('href'));assert.equal(telegram.pathname,'/published_shop');assert.equal(telegram.searchParams.get('text'),message);
 assert.equal(await page.locator('#contactsTelegramLink').getAttribute('href'),'https://t.me/published_shop','Existing CMS contact changed');
 await page.locator('#photoRequestCopy').click();assert.equal(await page.evaluate(()=>window.__photoClipboard),message);
 assert.match(await page.locator('#photoRequestStatus').textContent(),/скопійовано/);
 await page.evaluate(()=>{navigator.clipboard.writeText=async()=>{throw Error('denied')};document.execCommand=()=>false});
 await page.locator('#photoRequestCopy').click();assert.match(await page.locator('#photoRequestStatus').textContent(),/Текст виділено/);
 assert.equal(await page.locator('#photoRequestMessage').evaluate(el=>el.selectionEnd-el.selectionStart),message.length);
 for(const width of [320,390,768,820,1366,1920]){
  await page.setViewportSize({width,height:1000});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Contact request overflow '+width);
  for(const action of await page.locator('.vh-photo-request-actions a:not([hidden]),.vh-photo-request-actions button').all())assert.ok(await action.evaluate(el=>el.getBoundingClientRect().height>=44));
 }
 await page.setViewportSize({width:390,height:1000});await page.locator('#photoRequestTitle').focus();await page.locator('#photoRequest').screenshot({path:path.join(root,'test-results/photo-note/request-mobile.png')});
 await page.reload();await page.locator('#photoRequestMessage').waitFor();assert.equal(await page.locator('#photoRequestMessage').inputValue(),message,'Reload lost product context');
 await page.evaluate(()=>{document.querySelector('#contactsTelegramLink').href='https://t.me/joinchat/fixture';vhRenderPhotoRequest()});assert.equal(await page.locator('#photoRequestTelegram').isVisible(),false,'Unsupported Telegram links must use the copy/email fallback');
 await page.goto(base+'/contacts.html#'+new URLSearchParams({photo_product:'Unsafe',photo_url:'https://unrelated.example/product/unsafe/'}));await page.waitForFunction(()=>!document.querySelector('#photoRequest'));
 await page.goto(base+'/contacts.html');await page.waitForFunction(()=>window.__VH_PUBLISHED_READY);assert.equal(await page.locator('#photoRequest').count(),0,'Ordinary contacts page received product context');
 await page.goto(base+'/contacts.html#'+new URLSearchParams({photo_product:'Unsafe',photo_url:'https://unrelated.example/product/unsafe/'}));await page.waitForFunction(()=>window.__VH_PUBLISHED_READY);assert.equal(await page.locator('#photoRequest').count(),0,'Unrelated URL accepted');
 if(built){
  const snapshots=fs.existsSync(path.join(assets,'product'))?walk(path.join(assets,'product')).filter(x=>x.endsWith('.html')):walk(path.join(assets,'seo-product')).filter(x=>x.endsWith('index.html'));
  assert.ok(snapshots.length>0);for(const file of snapshots){const html=fs.readFileSync(file,'utf8');assert.equal((html.match(/data-vh-photo-note/g)||[]).length,1,'Missing/duplicate notice '+file);assert.ok(html.includes(copy));}
  if(fs.existsSync(path.join(assets,'product'))){await page.goto(base+'/product/'+p.slug+'/');await page.waitForFunction(()=>typeof currentProduct!=='undefined'&&currentProduct);const href=await page.locator('#productPhotoRequestLink').getAttribute('href');assert.equal(new URL(href).pathname,'/contacts');assert.equal(new URLSearchParams(new URL(href).hash.slice(1)).get('photo_url'),'https://vintazhka.com.ua/product/'+p.slug+'/');}
 }
 assert.deepEqual(f.errors,[]);assert.equal(f.calls.filter(x=>x.op!=='select').length,0);assert.equal(f.rpcCalls.length,0);assert.equal(f.functionCalls.length,0);
 console.log('PASS: '+(built?'hosting build':'source')+' photography notice, 6 widths, product→contact context, published CMS recipients, Telegram/email drafts, clipboard/fallback, safe text/URLs, reload and no remote writes/messages.');
}finally{await f.browser.close()}})().catch(error=>{console.error(error);process.exit(1)});
