const assert=require('node:assert/strict'),fs=require('node:fs');
const {fixture}=require('./cms-browser-fixture.cjs');
const {seedAdmin,base,product}=require('./admin-fixture.cjs');
const M=require('../measurements.js');

(async()=>{
 const f=await fixture({reducedMotion:'reduce'});
 try{
  await seedAdmin(f);f.user(null);f.session(null);
  const records=[
   {...product,id:'legacy-jacket',slug:'legacy-jacket',measurement_shoulders:'40',measurement_chest:'52',measurement_length:'76',measurement_sleeve:'60'},
   {...product,id:'legacy-corset',slug:'legacy-corset',categories:{name:'Аксесуари'},subcategories:{name:'Корсети'},measurement_chest:'38-41',measurement_length:'32'},
   {...product,id:'legacy-ranges',slug:'legacy-ranges',measurement_chest:'Напівобхват грудей 48–49 см',measurement_length:' 62,5 см ',measurement_height:0,measurement_waist:'35–40 см'},
   {...product,id:'empty',slug:'empty',categories:{name:'Взуття'}},
   {...product,id:'current',slug:'current',measurement_chest:'99',measurements_v2:{version:1,layout:'list',showLegacy:false,groups:[{id:'list',title:'Заміри',fields:[{id:'chest',label:'Напівобхват грудей',value:'46 см'},{id:'length',label:'Довжина жакета',value:'62 см'}]}]}},
   {...product,id:'grouped',slug:'grouped',measurement_chest:'54 см',measurements_v2:{version:1,showLegacy:true,groups:M.sets.jacket_skirt.parts.map(([key,title],i)=>({...M.group(key,title),fields:[{id:'length',label:'Довжина',value:i?'74 см':'62 см'}]}))}}
  ];
  f.data('products',records);const before=structuredClone(records),p=await f.context.newPage();
  for(const record of records){
   await p.goto(base+'/product.html?slug='+record.slug);
   await p.waitForFunction(()=>typeof currentProduct!=='undefined'&&currentProduct);
   await p.getByRole('button',{name:'ЗАМІРИ',exact:false}).first().click();
   const host=p.locator('#productMeasurementsV148');await host.locator('.vh-measurement-row').first().waitFor();
   const values=await host.locator('.vh-measurement-row b').allTextContents();
   if(record.id==='legacy-jacket')assert.deepEqual(values,['40','52','76','60']);
   if(record.id==='legacy-corset')assert.deepEqual(values,['38-41','32']);
   if(record.id==='legacy-ranges')assert.deepEqual(values,['Напівобхват грудей 48–49 см',' 62,5 см ','35–40 см','0']);
   if(record.id==='empty')assert.deepEqual(values,['—']);
   if(record.id==='current')assert.deepEqual(values,['46 см','62 см']);
   if(record.id==='grouped')assert.deepEqual(values,['62 см','74 см','54 см']);
   for(const width of [320,390,600,760,820,1280,1440]){
    await p.setViewportSize({width,height:1000});await host.scrollIntoViewIfNeeded();
    assert.ok(await host.evaluate(el=>el.scrollWidth<=el.clientWidth+1),record.id+' host overflow at '+width);
    assert.ok(await host.evaluate(el=>[...el.querySelectorAll('.vh-measurement-row')].every(row=>{
     const cell=row.getBoundingClientRect();return [...row.children].every(child=>{const r=child.getBoundingClientRect();return r.left>=cell.left-1&&r.right<=cell.right+1&&child.scrollWidth<=child.clientWidth+1});
    })),record.id+' clipped value at '+width);
    if(record.id==='legacy-jacket')assert.ok(await host.locator('b').evaluateAll(nodes=>nodes.every(node=>{
     const tops=[];for(let i=0;i<node.firstChild.length;i++){const r=document.createRange();r.setStart(node.firstChild,i);r.setEnd(node.firstChild,i+1);tops.push(Math.round(r.getBoundingClientRect().top))}return new Set(tops).size===1;
    })),'Jacket digits split at '+width);
    assert.ok(await host.evaluate(el=>{
     const bottom=Math.max(...[...el.querySelectorAll('.vh-measurement-row')].map(row=>row.getBoundingClientRect().bottom));
     const accordion=el.closest('.product-accordion');return bottom<=accordion.getBoundingClientRect().bottom+1&&accordion.nextElementSibling.getBoundingClientRect().top>=bottom-1;
    }),record.id+' accordion clips or overlaps at '+width);
    if(['legacy-jacket','legacy-corset','legacy-ranges'].includes(record.id)&&[390,1280].includes(width)){
     fs.mkdirSync('test-results/measurements',{recursive:true});await host.screenshot({path:'test-results/measurements/'+record.id+'-'+width+'.png'});
    }
   }
  }
  assert.equal(f.calls.some(call=>call.op!=='select'),false,'Storefront attempted a write');
  assert.deepEqual(f.getData('products'),before,'Reading measurements modified product data');
  assert.deepEqual(f.errors,[]);
  console.log('PASS: legacy digits, hidden corset fields, ranges/units/zero, empty values, current and grouped formats at seven widths; no writes.');
 }finally{await f.browser.close()}
})().catch(error=>{console.error(error);process.exitCode=1});
