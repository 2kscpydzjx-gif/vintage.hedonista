const assert=require('node:assert/strict');
const fs=require('node:fs');
const {fixture}=require('./cms-browser-fixture.cjs');
const {seedAdmin,base,product}=require('./admin-fixture.cjs');
const wait=async(fn,message)=>{for(let i=0;i<120;i++){if(await fn())return;await new Promise(r=>setTimeout(r,70))}throw Error(message)};
const expand=async p=>{await p.waitForFunction(()=>document.querySelector('#productForm.active #productMeasurementsSection')?.dataset.constructorReady==='1');await p.evaluate(()=>document.querySelectorAll('#productForm .constructor-collapsed .constructor-section-toggle').forEach(button=>button.click()))};
const open=async p=>{await p.goto(base+'/admin/admin.html?page=products');await p.waitForFunction(()=>document.querySelector('#app')&&!document.querySelector('#app').classList.contains('hidden'));await p.evaluate(()=>editProduct('admin-product'));await expand(p);await p.locator('#measurementEditor').waitFor()};
(async()=>{for(const database of [false,true]){const f=await fixture({persistTables:true,reducedMotion:'reduce'});try{
 seedAdmin(f);const old={...product,measurement_chest:' 54 см ',measurement_length:'72 см',measurement_waist:'35–40 см',shoulders:'46 см',description:'Опис товару',product_images:[]};f.data('products',[old]);
 if(database)await f.context.route('**/admin/config.js',route=>route.fulfill({contentType:'text/javascript',body:fs.readFileSync(require('node:path').join(__dirname,'../admin/config.js'),'utf8')+'\nwindow.VH_CONFIG.measurementsStorage="database";'}));
 const p=await f.context.newPage();p.on('dialog',d=>d.accept());await open(p);
 assert.equal(await p.locator('#pMeasureWaist').isVisible(),true,'An existing hidden-category measurement disappeared');
 const editor=p.locator('#measurementEditor');await editor.getByLabel('Готовий комплект',{exact:true}).selectOption('jacket_skirt');await editor.getByRole('button',{name:'Додати комплект',exact:true}).click();
 let parts=editor.locator('.measurement-part');assert.equal(await parts.count(),2);
 await parts.nth(0).getByLabel('Значення: Довжина виробу',{exact:true}).fill('62 см');await parts.nth(1).getByLabel('Значення: Довжина виробу',{exact:true}).fill('74 см');
 await parts.nth(1).getByLabel('Значення: Напівобхват талії',{exact:true}).fill('35–40 см');
 await parts.nth(1).getByRole('button',{name:'Додати власний замір',exact:true}).click();let custom=parts.nth(1).locator('.measurement-field-row').last();
 await custom.getByLabel('Назва заміру',{exact:true}).fill('Ширина подолу');await custom.locator('input').nth(1).fill('88 см');
 await p.locator('#pCategory').selectOption('admin-category-2');assert.equal(await parts.count(),2);assert.equal(await parts.nth(0).getByLabel('Значення: Довжина виробу',{exact:true}).inputValue(),'62 см');
 await p.locator('#pCategory').selectOption('admin-category');
 await editor.getByRole('button',{name:'Зберегти заміри локально',exact:true}).click();
 const draft=await p.evaluate(()=>JSON.parse(localStorage.getItem('vh-measurements-preview-v1:admin-product')));assert.deepEqual(draft.legacy,{},'Unchanged legacy fields must not be replayed as local edits');
 await parts.nth(0).getByLabel('Назва складової 1',{exact:true}).fill('');
 await p.reload();await p.waitForFunction(()=>document.querySelector('#measurementEditor .measurement-part'));await expand(p);
 assert.equal(await parts.nth(0).getByLabel('Назва складової 1',{exact:true}).inputValue(),'','Incomplete typed draft was discarded');await parts.nth(0).getByLabel('Назва складової 1',{exact:true}).fill('Жакет');
 assert.equal(await parts.nth(0).getByLabel('Значення: Довжина виробу',{exact:true}).inputValue(),'62 см');assert.equal(await parts.nth(1).getByLabel('Значення: Довжина виробу',{exact:true}).inputValue(),'74 см');
 // Switching a component template retains filled fields that the next template lacks.
 await parts.nth(1).getByLabel('Шаблон складової 2',{exact:true}).selectOption('corset');
 assert.equal(await parts.nth(1).getByLabel('Значення: Довжина виробу',{exact:true}).inputValue(),'74 см');
 assert.equal(await parts.nth(1).getByLabel('Значення: Ширина подолу',{exact:true}).inputValue(),'88 см');
 await p.locator('#saveProductBtn').click();
 if(!database){
  await p.locator('#measurementEditorStatus').filter({hasText:'тільки локально'}).waitFor();assert.equal(f.calls.some(c=>c.table==='products'&&c.op!=='select'),false,'Review measurements wrote to production-facing product API');
 }else{
  await wait(()=>f.getData('products')[0].measurements_v2?.groups.length===2,'Structured measurements were not saved');await wait(async()=>!await p.locator('#saveProductBtn').isDisabled(),'Save never finished');
  const row=f.getData('products')[0];for(const key of ['measurement_chest','measurement_length','measurement_waist','shoulders'])assert.equal(row[key],old[key],'Legacy value changed: '+key);
  const write=f.calls.find(c=>c.table==='products'&&c.op==='update'&&c.values?.measurements_v2);assert.ok(write.filters.some(([key,value])=>key==='measurements_v2'&&value===null),'Missing atomic empty-column guard');
  assert.equal(Object.keys(write.values).some(key=>key.startsWith('measurement_')),false,'Unedited flat fields were rewritten');
 }
 const popup=f.context.waitForEvent('page');await editor.getByRole('button',{name:'Переглянути заміри в товарі',exact:true}).click();const view=await popup;await view.waitForLoadState();await view.waitForFunction(()=>typeof currentProduct!=='undefined'&&currentProduct);
 await view.getByRole('button',{name:'ЗАМІРИ',exact:false}).first().click();await view.locator('#productMeasurementsV148 .vh-measurement-group').first().waitFor();
 assert.match(await view.locator('#productMeasurementsV148').textContent(),/62 см/);assert.match(await view.locator('#productMeasurementsV148').textContent(),/74 см/);assert.match(await view.locator('#productMeasurementsV148').textContent(),/54 см/);
 for(const width of [320,390,820,1366]){await view.setViewportSize({width,height:900});assert.ok(await view.locator('#productMeasurementsV148').evaluate(el=>el.scrollWidth<=el.clientWidth+1),'Measurements overflow at '+width)}
 if(database){
  const url=new URL(view.url());url.searchParams.delete('vh-measurements-preview');await view.goto(url.href);await view.waitForFunction(()=>typeof currentProduct!=='undefined'&&currentProduct);assert.match(await view.locator('#productMeasurementsV148').textContent(),/74 см/);assert.equal(await view.locator('.vh-measurements-preview-note').count(),0);
  // A second administrator's JSONB edit must make the original compare-and-set fail.
  await parts.nth(0).getByLabel('Значення: Довжина виробу',{exact:true}).fill('63 см');const other=f.getData('products')[0];other.measurements_v2.showLegacy=false;f.data('products',[other]);
  await p.locator('#saveProductBtn').click();await p.locator('#toast').filter({hasText:'змінилися паралельно'}).waitFor();assert.equal(f.getData('products')[0].measurements_v2.groups[0].fields.find(f=>f.id==='length').value,'62 см');
  await p.reload();await p.waitForFunction(()=>document.querySelector('#measurementEditor'));await expand(p);await p.locator('#measurementEditor').getByRole('button',{name:'Відновити мою локальну чернетку',exact:true}).waitFor();
  await editor.getByRole('button',{name:'Відновити мою локальну чернетку',exact:true}).click();
  f.columnAvailable('products','measurements_v2',false);const writes=f.calls.filter(c=>c.table==='products'&&c.op!=='select').length;
  await p.locator('#saveProductBtn').click();await p.locator('#toast').filter({hasText:'потребує підготовленого поля'}).waitFor();assert.equal(f.calls.filter(c=>c.table==='products'&&c.op!=='select').length,writes,'Missing schema must fail before product writes');f.columnAvailable('products','measurements_v2',true);
 }else{
  // Normal public navigation ignores a browser draft unless explicitly requested.
  const url=new URL(view.url());url.searchParams.delete('vh-measurements-preview');await view.goto(url.href);await view.waitForFunction(()=>typeof currentProduct!=='undefined'&&currentProduct);assert.equal(await view.locator('.vh-measurement-group').count(),0);assert.match(await view.locator('#productMeasurementsV148').textContent(),/54 см/);
  const next=structuredClone(draft.data);next.groups[0].title='Жакет після імпорту';const file=editor.locator('input[type=file]');const before=await p.locator('#pMeasureChest').inputValue();
  await file.setInputFiles({name:'wrong.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({format:'vh-product-measurements',version:1,productId:'other',data:next}))});await p.locator('#measurementEditorStatus').filter({hasText:'іншому товару'}).waitFor();assert.equal(await parts.nth(0).getByLabel('Назва складової 1',{exact:true}).inputValue(),'Жакет');
  await file.setInputFiles({name:'correct.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({format:'vh-product-measurements',version:1,productId:'admin-product',data:next}))});await p.locator('#measurementEditorStatus').filter({hasText:'імпортовано'}).waitFor();assert.equal(await parts.nth(0).getByLabel('Назва складової 1',{exact:true}).inputValue(),'Жакет після імпорту');assert.equal(await p.locator('#pMeasureChest').inputValue(),before,'Import altered legacy fields');
 }
 await p.setViewportSize({width:390,height:844});await expand(p);await p.locator('#measurementEditor').scrollIntoViewIfNeeded();
 assert.ok(await p.locator('#measurementEditor').evaluate(el=>el.scrollWidth<=el.clientWidth+1),'Mobile editor overflow');
 if(!database){for(const button of await editor.locator('button').all())assert.ok(await button.evaluate(el=>el.getBoundingClientRect().height>=44));}
 assert.deepEqual(f.errors,[]);
 console.log('PASS: '+(database?'isolated database persistence/CAS':'review local-only save')+', independent suit parts, ranges/custom fields, retained legacy bytes, template/category changes, reload, product preview and responsive layout.');
}catch(error){const p=f.context.pages()[0];console.error({errors:f.errors,active:await p.locator('.page.active').getAttribute('id'),measurementClass:await p.locator('#productMeasurementsSection').getAttribute('class'),toast:await p.locator('#toast').textContent()});throw error}finally{await f.browser.close()}}})().catch(e=>{console.error(e);process.exit(1)});
