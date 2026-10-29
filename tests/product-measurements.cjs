const assert=require('node:assert/strict'),fs=require('node:fs');
const {fixture}=require('./cms-browser-fixture.cjs');
const {seedAdmin,base,product}=require('./admin-fixture.cjs');
const wait=async(fn,message)=>{for(let i=0;i<120;i++){if(await fn())return;await new Promise(r=>setTimeout(r,70))}throw Error(message)};
const expand=async p=>{await p.waitForFunction(()=>document.querySelector('#productForm.active #productMeasurementsSection')?.dataset.constructorReady==='1');await p.evaluate(()=>document.querySelectorAll('#productForm .constructor-collapsed .constructor-section-toggle').forEach(button=>button.click()))};
const open=async p=>{await p.goto(base+'/admin/admin.html?page=products');await p.waitForFunction(()=>document.querySelector('#app')&&!document.querySelector('#app').classList.contains('hidden'));await p.evaluate(()=>editProduct('admin-product'));await expand(p);await p.locator('#measurementEditor').waitFor()};
const rowByName=async(p,name)=>{for(const row of await p.locator('#measurementEditor .measurement-field-row').all())if(await row.locator('input').first().inputValue()===name)return row;throw Error('Missing measurement: '+name)};
const value=async(p,name)=>(await rowByName(p,name)).locator('input').nth(1).inputValue();
const edit=async(p,name,nextLabel,nextValue)=>{const row=await rowByName(p,name);if(nextLabel!=null)await row.locator('input').first().fill(nextLabel);if(nextValue!=null)await row.locator('input').nth(1).fill(nextValue)};
const add=async(p,label,number)=>{await p.getByRole('button',{name:'+ Додати пункт',exact:true}).click();const row=p.locator('#measurementEditor .measurement-field-row').last();await row.locator('input').first().fill(label);await row.locator('input').nth(1).fill(number)};
(async()=>{
 for(const database of [false,true]){const f=await fixture({persistTables:true,reducedMotion:'reduce'});try{
  await seedAdmin(f);const old={...product,measurement_chest:' 54 см ',measurement_length:'72 см',measurement_waist:'35–40 см',measurement_height:0,shoulders:'46 см',description:'Опис товару',product_images:[]};f.data('products',[old]);
  if(database)await f.context.route('**/admin/config.js',route=>route.fulfill({contentType:'text/javascript',body:fs.readFileSync(require('node:path').join(__dirname,'../admin/config.js'),'utf8')+'\nwindow.VH_CONFIG.measurementsStorage="database";'}));
  const p=await f.context.newPage();p.on('dialog',d=>d.accept());await open(p);const editor=p.locator('#measurementEditor');
  assert.equal(await editor.locator('select,[role=tablist]').count(),0,'Measurement setup still clutters the editor');assert.equal(await p.locator('#measurementFieldsV148').isVisible(),false,'Old editor is duplicated');
  assert.equal(await value(p,'Талія / пояс'),'35–40 см');assert.equal(await value(p,'Груди'),' 54 см ');assert.equal(await value(p,'Висота'),'0','Zero was lost while loading old values');
  const untouched=await p.evaluate(async()=>{const payload={};return {result:await VHMeasurementEditor.prepareSave(payload,{from(){throw Error('Unexpected schema probe')}}),payload}});assert.equal(untouched.result.structuredChanged,false);assert.equal(Object.hasOwn(untouched.payload,'measurements_v2'),false,'Opening a product changed its data');
  await edit(p,'Груди','Ширина грудей',null);assert.equal(await value(p,'Ширина грудей'),' 54 см ','Renaming changed the value');
  await edit(p,'Довжина виробу','Довжина жакета','62 см');
  await (await rowByName(p,'Талія / пояс')).getByRole('button').click();assert.equal(await editor.locator('input').evaluateAll(nodes=>nodes.some(n=>n.value==='Талія / пояс')),false);
  await editor.getByRole('button',{name:'Скасувати видалення / додавання',exact:true}).click();assert.equal(await value(p,'Талія / пояс'),'35–40 см','Undo failed to restore a deleted value');
  await (await rowByName(p,'Талія / пояс')).getByRole('button').click();
  await add(p,'Довжина спідниці','74 см');await add(p,'Пояс спідниці','35–40 см');
  await add(p,'','88 см');await p.reload();await p.waitForFunction(()=>document.querySelector('#measurementEditor .measurement-field-row'));await expand(p);
  const incomplete=editor.locator('.measurement-field-row').last();assert.equal(await incomplete.locator('input').first().inputValue(),'');assert.equal(await incomplete.locator('input').nth(1).inputValue(),'88 см','Incomplete draft was discarded');await incomplete.locator('input').first().fill('Ширина подолу');
  await p.locator('#pCategory').selectOption('admin-category-2');assert.equal(await value(p,'Довжина жакета'),'62 см');assert.equal(await value(p,'Довжина спідниці'),'74 см');await p.locator('#pCategory').selectOption('admin-category');
  const draft=await p.evaluate(()=>JSON.parse(localStorage.getItem('vh-measurements-preview-v1:admin-product')));assert.deepEqual(draft.legacy,{});assert.equal(draft.data.layout,'list');assert.equal(draft.data.showLegacy,false);
  await editor.locator('.measurement-preview>summary').click();const preview=editor.locator('.measurement-site-frame');await preview.getByText('Довжина спідниці',{exact:true}).waitFor();assert.match(await preview.textContent(),/74 см/);assert.equal(await preview.locator('h3').count(),0,'The simple list still has garment headings');
  await edit(p,'Ширина подолу',null,'89 см');await preview.getByText('89 см',{exact:true}).waitFor();await edit(p,'Ширина подолу',null,'88 см');
  await p.locator('#saveProductBtn').click();
  if(!database){await p.locator('#measurementEditorStatus').filter({hasText:'тільки локально'}).waitFor();assert.equal(f.calls.some(c=>c.table==='products'&&c.op!=='select'),false,'Test measurements wrote to live-facing API');}
  else{
   await wait(()=>f.getData('products')[0].measurements_v2?.layout==='list','List not saved');await wait(async()=>!await p.locator('#saveProductBtn').isDisabled(),'Save never finished');
   const row=f.getData('products')[0];for(const key of ['measurement_chest','measurement_length','measurement_waist','measurement_height','shoulders'])assert.equal(row[key],old[key],'Legacy value changed: '+key);
   const write=f.calls.find(c=>c.table==='products'&&c.op==='update'&&c.values?.measurements_v2);assert.ok(write.filters.some(([key,value])=>key==='measurements_v2'&&value===null));assert.equal(Object.keys(write.values).some(key=>key.startsWith('measurement_')),false);
  }
  await expand(p);if(!await editor.locator('.measurement-preview').evaluate(el=>el.open))await editor.locator('.measurement-preview>summary').click();
  const popup=f.context.waitForEvent('page');await editor.getByRole('button',{name:'Відкрити картку товару',exact:true}).click();const view=await popup;await view.waitForLoadState();await view.waitForFunction(()=>typeof currentProduct!=='undefined'&&currentProduct);
  await view.getByRole('button',{name:'ЗАМІРИ',exact:false}).first().click();const host=view.locator('#productMeasurementsV148');await host.locator('.vh-measurement-row').first().waitFor();
  const text=await host.textContent();for(const label of ['Довжина жакета','Довжина спідниці','Ширина грудей','62 см','74 см','88 см','35–40 см'])assert.ok(text.includes(label),'Missing public row '+label);assert.equal(text.includes('Талія / пояс'),false,'Deleted old row reappeared');assert.equal(await host.locator('h3').count(),0);
  for(const width of [320,390,820,1366]){await view.setViewportSize({width,height:1000});assert.ok(await host.evaluate(el=>el.scrollWidth<=el.clientWidth+1),'Product overflow '+width);assert.equal(await host.evaluate(el=>getComputedStyle(el).gridTemplateColumns.split(' ').length),width<=600?1:2,'Incorrect measurement column count '+width);assert.ok(await host.evaluate(el=>{const bottom=Math.max(...[...el.querySelectorAll('.vh-measurement-row')].map(row=>row.getBoundingClientRect().bottom)),accordion=el.closest('.product-accordion');return bottom<=accordion.getBoundingClientRect().bottom+1&&accordion.nextElementSibling.getBoundingClientRect().top>=bottom-1}),'Product accordion clips or overlaps '+width);}
  if(!database){fs.mkdirSync('test-results/measurements',{recursive:true});await view.setViewportSize({width:390,height:1050});await view.locator('.product-accordions-below').screenshot({path:'test-results/measurements/simple-product-mobile.png'});}
  const url=new URL(view.url());url.searchParams.delete('vh-measurements-preview');await view.goto(url.href);await view.waitForFunction(()=>typeof currentProduct!=='undefined'&&currentProduct);
  if(database){
   assert.match(await host.textContent(),/Довжина спідниці/);await edit(p,'Довжина жакета',null,'63 см');const other=f.getData('products')[0];other.measurements_v2.groups[0].fields[0].value='Інше значення';f.data('products',[other]);
   await p.locator('#saveProductBtn').click();await p.locator('#toast').filter({hasText:'змінилися паралельно'}).waitFor();assert.equal(f.getData('products')[0].measurements_v2.groups[0].fields.find(field=>field.label==='Довжина жакета').value,'62 см');
   await p.reload();await p.waitForFunction(()=>document.querySelector('#measurementEditor'));await expand(p);await editor.getByRole('button',{name:'Відновити мою локальну чернетку',exact:true}).click();assert.equal(await value(p,'Довжина жакета'),'63 см');
   f.columnAvailable('products','measurements_v2',false);const writes=f.calls.filter(c=>c.table==='products'&&c.op!=='select').length;await p.locator('#saveProductBtn').click();await p.locator('#toast').filter({hasText:'потребує підготовленого поля'}).waitFor();assert.equal(f.calls.filter(c=>c.table==='products'&&c.op!=='select').length,writes);f.columnAvailable('products','measurements_v2',true);
  }else{
   assert.equal(await host.locator('.vh-measurements-list').count(),0);assert.equal(await host.locator('.vh-measurement-group').count(),0);assert.match(await host.textContent(),/54 см/);
   const next=structuredClone(draft.data);next.groups[0].fields[0].label='Плечі після імпорту';const file=editor.locator('input[type=file]');const before=await p.locator('#pMeasureChest').inputValue();
   await file.setInputFiles({name:'wrong.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({format:'vh-product-measurements',version:1,productId:'other',data:next}))});await p.locator('#measurementEditorStatus').filter({hasText:'іншому товару'}).waitFor();assert.equal(await value(p,'Плечі'),'46 см');
   await file.setInputFiles({name:'correct.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({format:'vh-product-measurements',version:1,productId:'admin-product',data:next}))});await p.locator('#measurementEditorStatus').filter({hasText:'імпортовано'}).waitFor();assert.equal(await value(p,'Плечі після імпорту'),'46 см');assert.equal(await p.locator('#pMeasureChest').inputValue(),before);
  }
  for(const width of [320,390,820,1366]){await p.setViewportSize({width,height:900});await expand(p);assert.ok(await editor.evaluate(el=>el.scrollWidth<=el.clientWidth+1),'Editor overflow '+width);for(const button of await editor.locator('button').all())if(await button.isVisible())assert.ok(await button.evaluate(el=>el.getBoundingClientRect().height>=44));}
  if(!database){await p.setViewportSize({width:390,height:900});await editor.screenshot({path:'test-results/measurements/simple-editor-mobile.png',style:'.topbar,.admin-mobile-actions{visibility:hidden!important}'});}
  assert.deepEqual(f.errors,[]);console.log('PASS: '+(database?'isolated database CAS/schema':'test local-only')+'; direct rename/value edits, add/delete/undo, legacy/zero preservation, reload, flat preview, import and mobile placement.');
 }finally{await f.browser.close()}}
 // Older grouped drafts remain readable, and editing does not discard either part or legacy values.
 const f=await fixture({persistTables:true,reducedMotion:'reduce'});try{
  await seedAdmin(f);const M=require('../measurements.js'),groups=M.sets.jacket_skirt.parts.map(([key,title])=>M.group(key,title));groups[0].fields.find(field=>field.id==='length').value=' 62,5 см ';groups[1].fields.find(field=>field.id==='length').value='74 см';
  f.data('products',[{...product,measurement_chest:'54 см',measurement_height:0}]);await f.context.addInitScript(data=>location.origin==='http://127.0.0.1:8765'&&localStorage.setItem('vh-measurements-preview-v1:admin-product',JSON.stringify({version:1,base:null,data,legacy:{}})),{version:1,showLegacy:true,groups});
  const p=await f.context.newPage();await open(p);assert.equal(await value(p,'Жакет — Довжина виробу'),' 62,5 см ');assert.equal(await value(p,'Спідниця — Довжина виробу'),'74 см');assert.equal(await value(p,'Груди'),'54 см');assert.equal(await value(p,'Висота'),'0');
  assert.equal(f.calls.some(c=>c.table==='products'&&c.op!=='select'),false);await edit(p,'Жакет — Довжина виробу','Довжина жакета',null);const saved=await p.evaluate(()=>JSON.parse(localStorage.getItem('vh-measurements-preview-v1:admin-product')).data);assert.equal(saved.layout,'list');assert.ok(saved.groups[0].fields.some(field=>field.label==='Спідниця — Довжина виробу'&&field.value==='74 см'));assert.deepEqual(f.errors,[]);
  console.log('PASS: previous grouped browser draft becomes editable rows without losing either garment, raw spacing, legacy values or zero.');
 }finally{await f.browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
