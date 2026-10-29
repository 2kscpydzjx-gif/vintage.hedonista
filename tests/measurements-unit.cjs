const {test}=require('node:test');
const assert=require('node:assert/strict');
const M=require('../measurements.js');
test('subcategory templates cover corsets/accessories without changing category',()=>{
 for(const [name,expected] of [['Корсети','corset'],['Корсет під груди','underbust'],['Ремені','belt'],['Хустки','scarf'],['Прикраси','jewelry'],['Головні убори','headwear']])assert.equal(M.guess({name:'Аксесуари'},{name}),expected);
});
test('two garments retain independent lengths and waists',()=>{
 const groups=M.sets.jacket_skirt.parts.map(([key,title])=>M.group(key,title));groups[0].fields.find(f=>f.id==='length').value='62 см';groups[1].fields.find(f=>f.id==='length').value='74 см';
 const data=M.validate({version:1,showLegacy:true,groups});assert.notEqual(data.groups[0].id,data.groups[1].id);assert.equal(data.groups[0].fields.find(f=>f.id==='length').value,'62 см');assert.equal(data.groups[1].fields.find(f=>f.id==='length').value,'74 см');
});
test('template changes keep every filled original/custom field and do not convert numbers',()=>{
 const part=M.group('upper');part.fields.find(f=>f.id==='sleeve').value=' 62,5 см ';part.fields.push({id:'own',label:'Регулювання',value:'35–40 см'});const snapshot=structuredClone(part),next=M.changeTemplate(part,'skirt');
 assert.deepEqual(part,snapshot);assert.equal(next.fields.find(f=>f.id==='sleeve').value,' 62,5 см ');assert.equal(next.fields.find(f=>f.id==='own').value,'35–40 см');assert.ok(next.fields.some(f=>f.id==='waist_half'&&f.value===''));
});
test('legacy aliases, zero and raw spacing are retained without conversion',()=>{
 const old={measurement_chest:' 54 см ',measurement_waist:0,measure_length:'72 см'},copy=structuredClone(old),rows=M.legacy(old);assert.equal(rows.find(f=>f.key==='measurement_chest').value,' 54 см ');assert.equal(rows.find(f=>f.key==='measurement_waist').value,'0');assert.equal(rows.find(f=>f.key==='measurement_length').value,'72 см');assert.deepEqual(old,copy);
 assert.equal(M.legacy({measurement_shoulders:'',shoulders:'46 см'}).find(f=>f.key==='measurement_shoulders').value,'46 см');
});
test('unknown versions and invalid/duplicate structures fail instead of replacing data',()=>{
 for(const value of [{version:2,showLegacy:true,groups:[]},{version:1,showLegacy:true,groups:new Array(13).fill(M.group())},{version:1,showLegacy:true,groups:[{id:'x',title:'',fields:[]}]}])assert.throws(()=>M.validate(value));
 const part=M.group();part.fields.push({...part.fields[0]});assert.throws(()=>M.validate({version:1,showLegacy:true,groups:[part]}));
});
test('incomplete typed drafts remain recoverable while server validation rejects them',()=>{
 const part=M.group();part.title='';part.fields[0].label='';part.fields[0].value='46 см';const data={version:1,showLegacy:true,groups:[part]};assert.throws(()=>M.validate(data));assert.deepEqual(M.validate(data,true),data);
});
test('switching templates retains custom or renamed labels even before entering values',()=>{
 const part=M.group('upper');part.fields.push({id:'custom',label:'Ширина манжети',value:''});part.fields.find(f=>f.id==='sleeve').label='Рукав від горловини';const next=M.changeTemplate(part,'skirt');assert.ok(next.fields.some(f=>f.id==='custom'&&f.label==='Ширина манжети'&&f.value===''));assert.ok(next.fields.some(f=>f.id==='sleeve'&&f.label==='Рукав від горловини'&&f.value===''));
});
