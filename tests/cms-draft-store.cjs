const {test}=require('node:test');
const assert=require('node:assert/strict');
const {create,keys}=require('../admin/cms-draft-store.js');
function storage(){const map=new Map();return {getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,String(v)),get length(){return map.size},key:i=>[...map.keys()][i]}}
const revision=(text,token='v1')=>({blocks:[],shared:{headerLogo:'keep.webp',cmsPageDraft:{existing:{'existing-0':{mapped:{title:text}}},order:['existing-0']}},updated_at:token});
test('retains older-editor local photos/text and takes a recovery snapshot before hydration',()=>{
 const local=storage(),store=create(local);local.setItem(keys('about').existing,JSON.stringify({'existing-0':{mapped:{title:'my unsaved text',image:'https://example.com/my-photo.webp'}}}));
 const result=store.hydrate('about',revision('server text'));
 assert.equal(result.recovered,true);assert.equal(result.value.existing['existing-0'].mapped.title,'my unsaved text');
 const recovery=JSON.parse(local.getItem('vh-cms-recovery-v1-about'))[0];assert.equal(recovery.remote.shared.cmsPageDraft.existing['existing-0'].mapped.title,'server text');assert.equal(recovery.local.existing['existing-0'].mapped.image,'https://example.com/my-photo.webp');
});
test('remote changes cannot overwrite a dirty draft after refresh',()=>{
 const local=storage(),store=create(local);store.hydrate('home',revision('initial'));const mine=store.snapshot('home');mine.existing['existing-0'].mapped.title='mine';store.restore('home',mine);store.touch('home');
 const result=store.hydrate('home',revision('theirs','v2'));assert.equal(result.conflict,true);assert.equal(result.token,'v1');assert.equal(store.snapshot('home').existing['existing-0'].mapped.title,'mine');
});
test('a confirmed save cannot mark later input as saved',()=>{
 const local=storage(),store=create(local);store.hydrate('contacts',revision('original'));const sent=store.snapshot('contacts');const later=structuredClone(sent);later.existing['existing-0'].mapped.title='typed during save';store.restore('contacts',later);store.touch('contacts');
 assert.equal(store.saved('contacts',sent,'v2'),true);assert.equal(store.meta('contacts').dirty,true);
});
test('page caches and shared shell are isolated; exports exclude auth and customer state',()=>{
 const local=storage(),store=create(local);store.hydrate('about',revision('about'));store.hydrate('contacts',revision('contacts'));store.hydrate('shared',revision('home'));
 assert.equal(store.snapshot('about').existing['existing-0'].mapped.title,'about');assert.equal(store.snapshot('contacts').existing['existing-0'].mapped.title,'contacts');
 local.setItem('vintage-hedonista-admin-auth','secret');local.setItem('cart','customer');const backup=store.exportLocal();assert.equal(backup['vintage-hedonista-admin-auth'],undefined);assert.equal(backup.cart,undefined);
});
test('choosing server keeps recoverable local content and clears the conflict',()=>{
 const local=storage(),store=create(local);store.hydrate('delivery',revision('before'));const mine=store.snapshot('delivery');mine.blocks.push({id:'my-block',title:'mine'});store.restore('delivery',mine);store.touch('delivery');store.useServer('delivery',revision('new','v2'));assert.equal(store.meta('delivery').dirty,false);assert.equal(store.snapshot('delivery').existing['existing-0'].mapped.title,'new');assert.equal(JSON.parse(local.getItem('vh-cms-recovery-v1-delivery')).at(-1).local.blocks[0].id,'my-block');
});
