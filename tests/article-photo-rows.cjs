const assert=require('node:assert/strict'),fs=require('node:fs');
const {fixture}=require('./cms-browser-fixture.cjs'),{seedAdmin,base}=require('./admin-fixture.cjs');
const canvas='#journalBlockEditor .vh-rte-canvas',row=canvas+' [data-vh-photo-row]';
const photo=(p,name)=>p.locator(canvas+' figure').filter({has:p.locator('img[alt="Фото '+name+'"]')});
const expand=p=>p.evaluate(()=>{for(const e of document.querySelectorAll('#newsForm .constructor-collapsed,#newsForm .article-step-collapsed'))e.querySelector('.constructor-section-toggle,.article-step-toggle')?.click()});
async function drag(p,source,target,side='right',mode='row'){
 const image=source.locator('img');await image.scrollIntoViewIfNeeded();await target.scrollIntoViewIfNeeded();
 const a=await image.boundingBox(),b=await target.boundingBox();assert.ok(a&&b);
 await p.mouse.move(a.x+a.width*.5,a.y+a.height*.8);await p.mouse.down();await p.mouse.move(a.x+a.width*.5+12,a.y+a.height*.8,{steps:3});
 await p.mouse.move(side==='left'?b.x+8:side==='beside'?b.x+b.width+8:b.x+b.width-8,b.y+b.height*.5,{steps:12});
 await p.waitForFunction(mode=>document.querySelector('.vh-image-drop-marker')?.dataset.placement===mode,mode,{timeout:8000});
 await p.mouse.up();await p.waitForFunction(()=>!document.querySelector('.vh-image-drop-marker'));
}
(async()=>{const f=await fixture({persistTables:true,reducedMotion:'reduce'});try{
 await seedAdmin(f);const original=f.getData('news')[0];const url=name=>base+'/assets/photo-row-'+name+'.png';
 const figure=name=>'<figure data-vh-width="20" data-vh-align="center"><img src="'+url(name)+'" alt="Фото '+name+'"></figure>';
 const text='Абзац для розташування фото поряд із текстом. '+('Вінтажні речі поєднуються з сучасним гардеробом. '.repeat(4));
 f.data('news',[{...original,title:'Фотографії в одному ряду',slug:'photos-in-rows',content:'VH_HTML_V1:<p>Вступ статті.</p>'+figure('A')+figure('B')+'<p>'+text+'</p>'+figure('C')+figure('D')+'<p>Завершення статті.</p>'}]);
 const colors={A:'#a34f36',B:'#48705e',C:'#4568a1',D:'#b09968'};
 for(const [name,color]of Object.entries(colors))await f.context.route(url(name),route=>route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="300" height="180"><rect width="300" height="180" fill="'+color+'"/><text x="135" y="105" font-size="40" fill="white">'+name+'</text></svg>'}));
 const p=await f.context.newPage();await p.setViewportSize({width:1440,height:1000});await p.goto(base+'/admin/admin.html');await p.waitForFunction(()=>typeof VH_ADMIN_HISTORY_READY!=='undefined'&&VH_ADMIN_HISTORY_READY);await p.evaluate(()=>editNews('admin-article'));await expand(p);await p.locator('#journalBlockEditor .vh-rte').evaluate(e=>e.scrollIntoView({block:'center'}));
 assert.equal(await p.locator('.vh-image-adjustments,#journalBlockEditor .vh-image-controls select').count(),0);
 // Real mouse gestures on the pictures themselves, rather than synthesized drop callbacks.
 await drag(p,photo(p,'B'),photo(p,'A').locator('img'),'beside');assert.equal(await p.locator(row).count(),1);assert.equal(await p.locator(row+'>figure').count(),2);assert.equal(await p.locator(row).getAttribute('data-vh-photo-row'),'2');
 await drag(p,photo(p,'C'),photo(p,'B').locator('img'),'beside');assert.equal(await p.locator(row+'>figure').count(),3);assert.equal(await p.locator(row).getAttribute('data-vh-photo-row'),'3');
 const order=()=>p.locator(row+'>figure img').evaluateAll(images=>images.map(img=>img.alt));assert.deepEqual(await order(),['Фото A','Фото B','Фото C']);
 const undo=p.locator('#journalBlockEditor').getByRole('button',{name:'Скасувати зміну',exact:true}),redo=p.locator('#journalBlockEditor').getByRole('button',{name:'Повторити зміну',exact:true});
 await undo.click();assert.equal(await p.locator(row+'>figure').count(),2);await redo.click();assert.equal(await p.locator(row+'>figure').count(),3);
 await p.locator('#saveNewsBtn').click();await p.waitForFunction(()=>!document.querySelector('#saveNewsBtn').disabled);const saved3=f.getData('news')[0];assert.ok(saved3.content.includes('data-vh-photo-row="3"'));
 // Dropping an internal picture outside the editor cannot navigate away or lose the draft.
 const htmlBeforeCancel=await p.locator('#journalArticleHtml').inputValue();const d=await photo(p,'D').locator('img').boundingBox(),header=await p.locator('#pageTitle').boundingBox();
 await p.mouse.move(d.x+d.width/2,d.y+d.height*.8);await p.mouse.down();await p.mouse.move(d.x+d.width/2+12,d.y+d.height*.8,{steps:3});await p.mouse.move(header.x+10,header.y+10,{steps:12});await p.mouse.up();assert.ok(p.url().includes('/admin/admin'));assert.equal(await p.locator('#journalArticleHtml').inputValue(),htmlBeforeCancel);assert.equal(await p.locator(canvas+' figure').count(),4);
 // Mouse placement on the free space alongside a standalone photo replaces numerical offsets.
 const freeImage=await photo(p,'D').locator('img').boundingBox(),canvasBounds=await p.locator(canvas).boundingBox();await p.mouse.move(freeImage.x+freeImage.width/2,freeImage.y+freeImage.height*.8);await p.mouse.down();await p.mouse.move(freeImage.x+freeImage.width/2+12,freeImage.y+freeImage.height*.8,{steps:3});await p.mouse.move(canvasBounds.x+30,freeImage.y+freeImage.height/2,{steps:12});await p.waitForFunction(()=>document.querySelector('.vh-image-drop-marker')?.dataset.placement==='free');await p.mouse.up();assert.equal(await photo(p,'D').getAttribute('data-vh-align'),'free');assert.ok(Number(await photo(p,'D').getAttribute('data-vh-x'))<25);await undo.click();assert.equal(await photo(p,'D').getAttribute('data-vh-align'),'center');
 // A fourth picture stays outside the three-picture row; undo restores the previous placement.
 await drag(p,photo(p,'D'),photo(p,'A').locator('img'),'left','block');assert.equal(await p.locator(row+'>figure').count(),3);assert.equal(await photo(p,'D').evaluate(e=>e.parentElement.hasAttribute('data-vh-photo-row')),false);await undo.click();assert.equal(await photo(p,'D').getAttribute('data-vh-width'),'20');
 const paragraph=p.locator(canvas+' p').filter({hasText:'Абзац для розташування'});
 await drag(p,photo(p,'C'),paragraph,'right','right');assert.equal(await photo(p,'C').getAttribute('data-vh-align'),'right');assert.equal(await photo(p,'C').getAttribute('data-vh-width'),'40');assert.equal(await p.locator(row+'>figure').count(),2);
 await drag(p,photo(p,'B'),photo(p,'A').locator('img'),'left');assert.deepEqual(await order(),['Фото B','Фото A']);
 // Deleting one member unwraps a singleton, and undo restores the row as one operation.
 await photo(p,'B').locator('img').click();await photo(p,'B').getByRole('button',{name:'Видалити фото',exact:true}).click();assert.equal(await p.locator(row).count(),0);assert.equal(await p.locator(canvas+' figure').count(),3);await undo.click();assert.equal(await p.locator(row+'>figure').count(),2);assert.equal(await p.locator(canvas+' figure').count(),4);
 assert.ok((await p.locator(canvas).textContent()).includes(text));await p.locator('#saveNewsBtn').click();await p.waitForFunction(()=>!document.querySelector('#saveNewsBtn').disabled);const saved2=f.getData('news')[0];assert.ok(saved2.content.includes('data-vh-photo-row="2"'));assert.ok(!saved2.content.includes('vh-image-controls')&&!saved2.content.includes('vh-image-drop-marker'));
 await p.evaluate(()=>editNews('admin-article'));await expand(p);assert.equal(await p.locator(row+'>figure').count(),2);assert.deepEqual(await order(),['Фото B','Фото A']);
 const clean=await p.evaluate(()=>VHRichEditor.safeHTML('<div data-vh-photo-row="3;position:fixed" style="position:fixed"><p>Текст</p></div>'));assert.ok(!clean.includes('position:fixed')&&!clean.includes('data-vh-photo-row'));
 fs.mkdirSync('test-results/article-editor',{recursive:true});await p.locator('#journalBlockEditor .vh-rte').evaluate(e=>e.scrollIntoView({block:'center'}));await p.screenshot({path:'test-results/article-editor/photo-rows-editor.png'});
 f.data('news',[{...saved2,status:'published',slug:'two',id:'two'},{...saved3,status:'published',slug:'three',id:'three'}]);f.user(null);f.session(null);const front=await f.context.newPage();
 for(const width of [1440,768,390,320])for(const [slug,count]of [['two',2],['three',3]]){
  await front.setViewportSize({width,height:1000});await front.goto(base+'/article.html?slug='+slug);await front.locator('.article-editorial h1').waitFor();const grid=front.locator('.article-v71-content [data-vh-photo-row]');assert.equal(await grid.locator(':scope>figure').count(),count);
  const layout=await grid.evaluate(e=>{const children=[...e.children].map(f=>f.getBoundingClientRect().toJSON());return {children,width:e.getBoundingClientRect().width,overflow:document.documentElement.scrollWidth>innerWidth+1}});assert.equal(layout.overflow,false);assert.ok(layout.children.every(b=>Math.abs(b.top-layout.children[0].top)<1));assert.ok(Math.abs(layout.children[0].width-layout.children.at(-1).width)<1);
  for(const image of await grid.locator('img').all()){await image.evaluate(e=>e.decode());const b=await image.boundingBox();assert.ok(Math.abs(b.height-b.width*.6)<2,'picture cropped in row')}
  assert.equal(await front.locator('.article-v71-content img').count(),4);assert.ok((await front.locator('.article-v71-content').textContent()).includes(text));
  if(width===1440&&slug==='two'){const wrap=await front.locator('.article-v71-content figure[data-vh-align=right]').evaluate(e=>({float:getComputedStyle(e).float,rect:e.getBoundingClientRect().toJSON(),parent:e.parentElement.getBoundingClientRect().toJSON()}));assert.equal(wrap.float,'right');assert.ok(wrap.rect.left>wrap.parent.left+wrap.parent.width*.5)}
  if(width===390&&slug==='three'){await grid.scrollIntoViewIfNeeded();await front.screenshot({path:'test-results/article-editor/photo-rows-public-mobile.png'})}
 }
 assert.deepEqual(f.errors,[]);assert.equal(f.functionCalls.length,0);console.log('PASS: real mouse photo dragging creates/reorders 2–3-picture rows, limits full rows, extracts photos beside text, normalizes deletion/undo, preserves save/reopen/sanitizing and renders natural photo geometry at four desktop/mobile widths. All writes isolated.');
}finally{await f.browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
