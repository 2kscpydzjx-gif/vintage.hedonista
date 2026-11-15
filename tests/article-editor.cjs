const assert=require('node:assert/strict'),fs=require('node:fs');
const {fixture}=require('./cms-browser-fixture.cjs'),{seedAdmin,base}=require('./admin-fixture.cjs');
const expand=p=>p.evaluate(()=>{const root=document.querySelector('#newsForm');for(const el of root.querySelectorAll('.constructor-collapsed,.article-step-collapsed'))el.querySelector('.constructor-section-toggle,.article-step-toggle')?.click();for(const d of root.querySelectorAll('details:not(.vh-image-adjustments)'))d.open=true});
const canvas='#journalBlockEditor .vh-rte-canvas';
async function end(p){await p.locator(canvas).evaluate(el=>{el.focus();const range=document.createRange();range.selectNodeContents(el);range.collapse(false);const sel=getSelection();sel.removeAllRanges();sel.addRange(range);el.dispatchEvent(new MouseEvent('mouseup',{bubbles:true}))})}
async function imageFile(p,padded=false){const url=await p.evaluate(padded=>{const c=document.createElement('canvas');c.width=padded?800:300;c.height=600;const ctx=c.getContext('2d');ctx.fillStyle='#eadbc7';ctx.fillRect(0,0,c.width,c.height);ctx.fillStyle='#244ba2';ctx.fillRect(padded?100:0,0,padded?600:300,600);return c.toDataURL('image/png')},padded);return {name:padded?'old-padded.png':'portrait.png',mimeType:'image/png',buffer:Buffer.from(url.split(',')[1],'base64')}}
async function imageSize(img){return img.evaluate(async e=>{const r=await fetch(e.src),b=await createImageBitmap(await r.blob());const size=[b.width,b.height];b.close();return size})}
(async()=>{const f=await fixture({persistTables:true,reducedMotion:'reduce'});try{
 await seedAdmin(f);const original=f.getData('news')[0];f.data('news',[original,{...original,id:'published-article',slug:'old-public-address',status:'published'}]);
 const p=await f.context.newPage();await p.setViewportSize({width:1440,height:1000});
 await p.goto(base+'/admin/admin.html');await p.waitForFunction(()=>typeof VH_ADMIN_HISTORY_READY!=='undefined'&&VH_ADMIN_HISTORY_READY);
 await p.evaluate(()=>editNews('published-article'));await expand(p);
 assert.equal(await p.locator('#nSlug').inputValue(),'old-public-address','opening renamed a public URL');
 await p.locator('#nTitle').fill('Нова назва статті');assert.equal(await p.locator('#nSlug').inputValue(),'nova-nazva-statti');
 await p.locator('#nSlug').fill('custom-address');await p.locator('#nTitle').fill('Ще одна назва');assert.equal(await p.locator('#nSlug').inputValue(),'custom-address');
 await p.locator('#newsSlugFromTitle').click();assert.equal(await p.locator('#nSlug').inputValue(),'shche-odna-nazva');
 assert.equal(f.calls.filter(c=>c.table==='news'&&c.op!=='select').length,0);
 await p.evaluate(()=>editNews('admin-article'));await expand(p);
 // Legacy articles may end at a non-editable picture without a trailing paragraph.
 await p.locator(canvas+' figure img').click();await p.keyboard.press('Delete');assert.equal(await p.locator(canvas+' figure').count(),0);await p.locator('#journalBlockEditor').getByRole('button',{name:'Скасувати зміну',exact:true}).click();await p.keyboard.type('Після повернення фото');assert.ok((await p.locator(canvas).textContent()).includes('Після повернення фото'));assert.equal(await p.locator(canvas+' figure').count(),1);
 await p.evaluate(()=>editNews('admin-article'));await expand(p);
 // Formatting shares undo/redo with typing rather than maintaining a separate browser stack.
 const firstParagraph=p.locator(canvas+' p').first(),paragraphBefore=await firstParagraph.innerHTML();
 await firstParagraph.evaluate(el=>{el.focus();const r=document.createRange();r.selectNodeContents(el);const s=getSelection();s.removeAllRanges();s.addRange(r);el.dispatchEvent(new MouseEvent('mouseup',{bubbles:true}))});
 await p.locator('#journalBlockEditor').getByRole('button',{name:'Жирний',exact:true}).click();assert.ok(await firstParagraph.locator('b,strong').count());
 await p.locator('#journalBlockEditor').getByRole('button',{name:'Скасувати зміну',exact:true}).click();assert.equal(await firstParagraph.innerHTML(),paragraphBefore);
 await p.locator('#journalBlockEditor').getByRole('button',{name:'Повторити зміну',exact:true}).click();assert.ok(await firstParagraph.locator('b,strong').count());
 await p.locator('#journalBlockEditor').getByRole('button',{name:'Скасувати зміну',exact:true}).click();
 // Pasting Word markup cannot temporarily introduce black text or retain its styling.
 await end(p);await p.locator(canvas).evaluate(el=>{const dt=new DataTransfer();dt.setData('text/html','<p class="MsoNormal" style="color:black;background:white"><span style="color:#000;font-family:Calibri">Текст із Word <b>жирний</b></span></p><h2>Розділ із документа</h2><ul><li>Пункт списку</li></ul><script>window.badPaste=true</script>');el.dispatchEvent(new ClipboardEvent('paste',{clipboardData:dt,bubbles:true,cancelable:true}))});
 assert.ok(await p.locator(canvas).getByText('Текст із Word',{exact:false}).count());assert.equal(await p.locator(canvas+' script,'+canvas+' [style*="color"],'+canvas+' .MsoNormal').count(),0);
 assert.equal(await p.locator(canvas+' b').textContent(),'жирний');assert.equal(await p.evaluate(()=>window.badPaste),undefined);
 assert.equal(await p.locator(canvas+' p').last().evaluate(el=>getComputedStyle(el).color),await p.locator(canvas).evaluate(el=>getComputedStyle(el).color));
 // Real file insertion and pointer/keyboard width controls, plus arbitrary horizontal placement.
 await end(p);await p.locator('#journalBlockEditor input[type=file]').setInputFiles(await imageFile(p));await p.waitForFunction(()=>document.querySelectorAll('#journalBlockEditor figure').length===2);
 let fig=p.locator(canvas+' figure').last();assert.deepEqual(await imageSize(fig.locator('img')),[300,600]);
 await fig.locator('img').click();await fig.locator('select').selectOption('60');await fig.locator('summary').click();
 await fig.getByLabel('Ширина фото у відсотках').fill('37');await fig.getByLabel('Положення фото по горизонталі').fill('75');assert.equal(await fig.getAttribute('data-vh-width'),'37');assert.equal(await fig.getAttribute('data-vh-x'),'75');assert.equal(await fig.getAttribute('data-vh-align'),'free');
 assert.equal(await fig.evaluate(el=>el.style.getPropertyValue('--vh-photo-offset')),'47.25%');
 const resize=fig.getByRole('button',{name:'Змінити ширину фото перетягуванням'});await resize.focus();await p.keyboard.press('ArrowRight');assert.equal(await fig.getAttribute('data-vh-width'),'38');
 await resize.scrollIntoViewIfNeeded();const grip=await resize.boundingBox();await p.mouse.move(grip.x+grip.width/2,grip.y+grip.height/2);await p.mouse.down();await p.mouse.move(grip.x+grip.width/2+30,grip.y+grip.height/2,{steps:4});await p.mouse.up();assert.ok(Number(await fig.getAttribute('data-vh-width'))>38);
 const resizedWidth=await fig.getAttribute('data-vh-width');await p.locator('#journalBlockEditor').getByRole('button',{name:'Скасувати зміну',exact:true}).click();assert.equal(await fig.getAttribute('data-vh-width'),'38');await p.locator('#journalBlockEditor').getByRole('button',{name:'Повторити зміну',exact:true}).click();assert.equal(await fig.getAttribute('data-vh-width'),resizedWidth);
 const index=()=>fig.evaluate(el=>[...el.parentElement.children].indexOf(el));const before=await index();await fig.getByRole('button',{name:'Фото на один блок вище',exact:true}).click();assert.equal(await index(),before-1);
 await fig.getByRole('button',{name:'Перетягнути фото між абзацами',exact:true}).focus();await p.keyboard.press('Alt+ArrowDown');assert.equal(await index(),before);
 // Exercise native HTML drag/drop with its own transfer payload and a real target block.
 await fig.locator('summary').click();await fig.getByRole('button',{name:'Перетягнути фото між абзацами',exact:true}).evaluate(el=>{window.__photoTransfer=new DataTransfer();el.dispatchEvent(new DragEvent('dragstart',{dataTransfer:window.__photoTransfer,bubbles:true,clientX:el.getBoundingClientRect().left+5}))});
 await p.locator(canvas+' h2').evaluate(el=>{const box=el.getBoundingClientRect();el.dispatchEvent(new DragEvent('dragover',{dataTransfer:window.__photoTransfer,bubbles:true,cancelable:true,clientY:box.top+1,clientX:box.left+20}));el.dispatchEvent(new DragEvent('drop',{dataTransfer:window.__photoTransfer,bubbles:true,cancelable:true,clientY:box.top+1,clientX:box.left+20}))});
 assert.equal(await fig.evaluate(el=>el.nextElementSibling.tagName),'H2');assert.equal(await p.locator('.vh-image-drop-marker').count(),0);
 // A second photo retains its pixels and the first photo can be reselected and edited.
 await end(p);await p.locator('#journalBlockEditor input[type=file]').setInputFiles(await imageFile(p,true));await p.waitForFunction(()=>document.querySelectorAll('#journalBlockEditor figure').length===3);
 const padded=p.locator(canvas+' figure').last(),img=padded.locator('img');
 assert.deepEqual(await imageSize(img),[800,600]);assert.equal(await p.getByRole('button',{name:'Прибрати однотонні поля з фото',exact:true}).count(),0);
 assert.equal(await padded.locator('.vh-image-controls').isVisible(),true);
 await p.locator('#journalBlockEditor').getByRole('button',{name:'Скасувати зміну',exact:true}).click();assert.equal(await p.locator(canvas+' figure').count(),2);await p.locator('#journalBlockEditor').getByRole('button',{name:'Повторити зміну',exact:true}).click();assert.equal(await p.locator(canvas+' figure').count(),3);
 const firstPhoto=p.locator(canvas+' figure[data-vh-align=free]');await firstPhoto.locator('img').click();await firstPhoto.locator('select').selectOption('60');
 assert.equal(await firstPhoto.getAttribute('data-vh-width'),'60');assert.equal(await padded.locator('.vh-image-controls').isVisible(),false);
 await padded.locator('img').click();assert.equal(await padded.locator('.vh-image-controls').isVisible(),true);assert.equal(await firstPhoto.locator('.vh-image-controls').isVisible(),false);
 // Delete just this photo, undo it with its controls, redo the deletion, then restore.
 const imageSource=await img.getAttribute('src');await padded.getByRole('button',{name:'Видалити фото',exact:true}).click();assert.equal(await p.locator(canvas+' figure').count(),2);
 const undo=p.locator('#journalBlockEditor').getByRole('button',{name:'Скасувати зміну',exact:true}),redo=p.locator('#journalBlockEditor').getByRole('button',{name:'Повторити зміну',exact:true});
 await undo.click();assert.equal(await p.locator(canvas+' figure').count(),3);assert.equal(await p.locator(canvas+' figure').last().locator('img').getAttribute('src'),imageSource);assert.equal(await p.locator(canvas+' figure').last().locator('.vh-image-controls').isVisible(),true);
 await redo.click();assert.equal(await p.locator(canvas+' figure').count(),2);await undo.click();assert.equal(await p.locator(canvas+' figure').count(),3);
 // Typing hides picture controls; text undo/redo uses the same document history.
 await end(p);await p.keyboard.type('History text');assert.equal(await p.locator(canvas+' .vh-image-controls:visible').count(),0);assert.ok((await p.locator(canvas).textContent()).includes('History text'));
 await p.keyboard.press('Control+z');assert.ok(!(await p.locator(canvas).textContent()).includes('History text'));await p.keyboard.press('Control+Shift+z');assert.ok((await p.locator(canvas).textContent()).includes('History text'));await p.keyboard.press('Control+z');await p.keyboard.press('Control+y');assert.ok((await p.locator(canvas).textContent()).includes('History text'));await undo.click();await redo.click();assert.ok((await p.locator(canvas).textContent()).includes('History text'));
 await undo.click();await end(p);await p.keyboard.type('Replacement text');assert.equal(await redo.isEnabled(),false);
 // Native deletion of a selected photo follows the same undo path.
 await p.locator(canvas+' figure').last().locator('img').click();await p.keyboard.press('Delete');assert.equal(await p.locator(canvas+' figure').count(),2);await undo.click();assert.equal(await p.locator(canvas+' figure').count(),3);
 // A long article scrolls inside the window while its toolbar and the page stay still.
 await p.locator(canvas).evaluate(el=>{for(let i=0;i<45;i++){const p=document.createElement('p');p.textContent='Довгий абзац '+i+' — '+('Збережений текст статті. '.repeat(10));el.append(p)}el.dispatchEvent(new Event('input',{bubbles:true}))});
 for(const width of [1440,390]){
  await p.setViewportSize({width,height:900});await p.locator('#journalBlockEditor .vh-rte').evaluate(el=>el.scrollIntoView({block:'center'}));
  const before=await p.locator('#journalBlockEditor .vh-rte-toolbar').boundingBox(),windowY=await p.evaluate(()=>scrollY);
  await p.locator(canvas).evaluate(el=>el.scrollTop=el.scrollHeight);
  const after=await p.locator('#journalBlockEditor .vh-rte-toolbar').boundingBox();assert.ok(Math.abs(before.y-after.y)<1);assert.equal(await p.evaluate(()=>scrollY),windowY);
  const layout=await p.locator(canvas).evaluate(el=>({scroll:el.scrollTop,overflow:getComputedStyle(el).overflowY,height:el.clientHeight,content:el.scrollHeight,pageOverflow:document.documentElement.scrollWidth>innerWidth+1}));
  assert.ok(layout.scroll>100&&layout.content>layout.height);assert.equal(layout.overflow,'scroll');assert.equal(layout.pageOverflow,false);
  assert.equal(await p.locator('#journalBlockEditor .vh-rte-toolbar').evaluate(el=>document.elementFromPoint(el.getBoundingClientRect().left+12,el.getBoundingClientRect().top+12)?.closest('.vh-rte-toolbar')===el),true);
  await p.locator(canvas).evaluate(el=>el.scrollTop=0);await p.locator(canvas).hover();const pageBeforeWheel=await p.evaluate(()=>scrollY);await p.mouse.wheel(0,500);await p.waitForFunction(()=>document.querySelector('#journalBlockEditor .vh-rte-canvas').scrollTop>100);assert.equal(await p.evaluate(()=>scrollY),pageBeforeWheel,'wheel escaped the editor');
 }
 await p.setViewportSize({width:1440,height:1000});
 // The full save pipeline uses actual encoding with original proportions, on in-memory tables only.
 await p.evaluate(()=>{window.__articleSizes=[];const prepare=prepareArticleImage;prepareArticleImage=async(...args)=>{const out=await prepare(...args),bitmap=await createImageBitmap(out);window.__articleSizes.push([bitmap.width,bitmap.height]);bitmap.close();return out}});
 await p.locator('#nImage').setInputFiles(await imageFile(p));await p.locator('#nGallery').setInputFiles(await imageFile(p));
 const expectedTitle=await p.locator('#nTitle').inputValue();await p.locator('#saveNewsBtn').click();await p.waitForFunction(()=>!document.querySelector('#saveNewsBtn').disabled);
 const saved=f.getData('news').find(r=>r.id==='admin-article');assert.equal(saved.status,'draft');assert.equal(saved.title,expectedTitle);assert.ok(saved.content.includes('VH_HTML_V1:'));assert.ok(saved.content.includes('data-vh-align="free"'));assert.ok(saved.content.includes('data-vh-x='));assert.ok(saved.content.includes('Довгий абзац 44'));assert.ok(saved.content.includes('Текст із Word'));assert.ok(!saved.content.includes('vh-image-controls'));assert.ok(!saved.content.includes('data:image/'));
 assert.deepEqual((await p.evaluate(()=>window.__articleSizes)).sort(),[[300,600],[300,600],[300,600],[800,600]].sort());
 assert.equal(f.functionCalls.length,0);assert.equal(f.getData('news').find(r=>r.id==='published-article').slug,'old-public-address');
 const uploadedHtml=await p.locator('#journalArticleHtml').inputValue();await undo.click();assert.ok(!(await p.locator('#journalArticleHtml').inputValue()).includes('data:image/'));await redo.click();assert.equal(await p.locator('#journalArticleHtml').inputValue(),uploadedHtml,'save broke document history');
 const uploads=f.calls.filter(c=>c.op==='upload').length;assert.equal(await p.locator('#nImage').evaluate(el=>el.files.length),0);assert.equal(await p.locator('#nGallery').evaluate(el=>el.files.length),0);await p.locator('#saveNewsBtn').click();await p.waitForFunction(()=>!document.querySelector('#saveNewsBtn').disabled);assert.equal(f.calls.filter(c=>c.op==='upload').length,uploads,'unchanged photos uploaded again');assert.equal(f.getData('news').find(r=>r.id==='admin-article').cover_image,saved.cover_image);assert.deepEqual(f.getData('news').find(r=>r.id==='admin-article').gallery_images,saved.gallery_images);
 await p.evaluate(()=>editNews('admin-article'));await expand(p);assert.equal(await p.locator(canvas+' figure[data-vh-align=free]').count(),1);assert.ok(await p.locator(canvas).textContent());
 assert.equal(await undo.isEnabled(),false,'history leaked from the previous document instance');
 // Sanitizing malicious layout attributes cannot turn into arbitrary CSS or script.
 const clean=await p.evaluate(()=>VHRichEditor.safeHTML('<figure data-vh-width="999" data-vh-align="free" data-vh-x="50;position:fixed" style="position:fixed"><img src="javascript:alert(1)" onerror="bad()"></figure>'));
 assert.ok(!clean.includes('position:fixed')&&!clean.includes('javascript:')&&!clean.includes('onerror'));assert.ok(clean.includes('data-vh-width="100"'));assert.ok(!clean.includes('data-vh-x'));
 const publicRow={...saved,status:'published'};f.data('news',[publicRow]);f.user(null);f.session(null);const front=await f.context.newPage();
 for(const width of [1440,390]){await front.setViewportSize({width,height:900});await front.goto(base+'/article.html?slug='+encodeURIComponent(saved.slug));await front.locator('.article-editorial h1').waitFor();const position=await front.locator('.article-v71-content figure[data-vh-align=free]').evaluate(el=>{const box=el.getBoundingClientRect(),parent=el.parentElement.getBoundingClientRect();return {width:box.width,left:box.left-parent.left,parent:parent.width,w:Number(el.dataset.vhWidth),x:Number(el.dataset.vhX),overflow:document.documentElement.scrollWidth>innerWidth+1}});assert.equal(position.overflow,false);if(width>760){assert.ok(Math.abs(position.width-position.parent*position.w/100)<2);assert.ok(Math.abs(position.left-position.parent*(100-position.w)*position.x/10000)<2)}else{assert.ok(Math.abs(position.width-position.parent)<2);assert.ok(Math.abs(position.left)<1)}}
 // Removing the only image leaves a usable text caret and the whole operation is reversible.
 await p.evaluate(()=>openNewsForm());await expand(p);await p.locator('#journalBlockEditor input[type=file]').setInputFiles(await imageFile(p));await p.waitForFunction(()=>document.querySelectorAll('#journalBlockEditor figure').length===1);
 await p.locator(canvas+' figure').getByRole('button',{name:'Видалити фото',exact:true}).click();assert.equal(await p.locator(canvas+' figure').count(),0);
 await p.keyboard.type('Після видалення');assert.ok((await p.locator(canvas).textContent()).includes('Після видалення'));
 await undo.click();await undo.click();assert.equal(await p.locator(canvas+' figure').count(),1);await redo.click();await redo.click();assert.equal(await p.locator(canvas+' figure').count(),0);assert.ok((await p.locator(canvas).textContent()).includes('Після видалення'));
 // Source-mode edits share history without forcing a mode change.
 await p.locator('#journalBlockEditor [data-mode=html]').click();await p.locator('#journalBlockEditor .vh-rte-code').fill('<p>HTML редагування</p>');await undo.click();assert.ok((await p.locator('#journalBlockEditor .vh-rte-code').inputValue()).includes('Після видалення'));await redo.click();assert.equal(await p.locator('#journalBlockEditor .vh-rte-code').inputValue(),'<p>HTML редагування</p>');await p.locator('#journalBlockEditor [data-mode=visual]').click();assert.equal((await p.locator(canvas).textContent()).trim(),'HTML редагування');
 assert.deepEqual(f.errors,[]);fs.mkdirSync('test-results/article-editor',{recursive:true});await p.setViewportSize({width:1440,height:1000});await p.locator(canvas).scrollIntoViewIfNeeded();await p.screenshot({path:'test-results/article-editor/editor-desktop.png'});
 console.log('PASS: Word paste readability/sanitizing, portrait encoding without padding, arbitrary image width/position, pointer resize and block moves/drag, click-only photo controls, exact image proportions, unified text/photo undo/redo, deletion/reselection and inner scrolling on desktop/mobile, automatic/manual slugs, isolated draft save/reopen and no live writes.');
}finally{await f.browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
