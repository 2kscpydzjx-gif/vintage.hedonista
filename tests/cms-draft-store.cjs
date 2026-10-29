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
test('shared snapshots exclude homepage content and unrelated metadata',()=>{
 const local=storage(),store=create(local);store.hydrate('shared',{...revision('home'),shared:{...revision('home').shared,footerText:'Footer',unknownMeta:'keep on server'}});
 assert.deepEqual(store.snapshot('shared'),{shared:{headerLogo:'keep.webp',footerText:'Footer'}});
});
test('shared edits rebase over homepage saves and merge independent shell fields',()=>{
 const local=storage(),store=create(local);const first={...revision('before'),shared:{...revision('before').shared,footerText:'Before',nav:{0:{label:'Home',href:'index.html'}}}};
 store.hydrate('shared',first);store.restore('shared',{shared:{...store.snapshot('shared').shared,footerText:'My footer'}});store.touch('shared');
 const remote={...revision('new home','v2'),shared:{...first.shared,nav:{0:{label:'Start',href:'index.html'}}}};
 const result=store.hydrate('shared',remote);assert.equal(result.conflict,false);assert.equal(result.token,'v2');assert.equal(store.snapshot('shared').shared.footerText,'My footer');assert.equal(store.snapshot('shared').shared.nav[0].label,'Start');
 assert.equal(store.meta('shared').dirty,true);
});
test('same shell field edited by two administrators remains a recoverable conflict',()=>{
 const local=storage(),store=create(local);store.hydrate('shared',{...revision('home'),shared:{footerText:'Before'}});store.restore('shared',{shared:{footerText:'Mine'}});store.touch('shared');
 const result=store.hydrate('shared',{...revision('home','v2'),shared:{footerText:'Theirs'}});
 assert.equal(result.conflict,true);assert.equal(store.snapshot('shared').shared.footerText,'Mine');
});
test('old shared metadata can recover its baseline from the recovery journal',()=>{
 const local=storage(),store=create(local);const first={...revision('before'),shared:{footerText:'Before'}};
 store.hydrate('shared',first);store.restore('shared',{shared:{footerText:'Mine'}});store.touch('shared');store.backup('shared','before-server-load',first);
 const meta=store.meta('shared');delete meta.baseValue;local.setItem(keys('shared').meta,JSON.stringify(meta));
 const result=store.hydrate('shared',{...revision('new home','v2'),shared:{footerText:'Before'}});
 assert.equal(result.conflict,false);assert.equal(result.token,'v2');assert.equal(store.snapshot('shared').shared.footerText,'Mine');
});
test('a page draft rebases over changes confined to the shared shell',()=>{
 const local=storage(),store=create(local);store.hydrate('home',revision('before'));const mine=store.snapshot('home');mine.existing['existing-0'].mapped.title='Mine';store.restore('home',mine);store.touch('home');
 const remote=revision('before','v2');remote.shared.footerText='New footer';const result=store.hydrate('home',remote);
 assert.equal(result.conflict,false);assert.equal(result.token,'v2');assert.equal(store.snapshot('home').existing['existing-0'].mapped.title,'Mine');
});
test('legacy local shell edits retain independent server settings on first load',()=>{
 const local=storage(),store=create(local);local.setItem('vh-cms-shared-shell-step71',JSON.stringify({footerText:'Mine',cmsPageDraft:{existing:{stale:true}}}));
 store.hydrate('shared',{...revision('home'),shared:{footerText:'Server',telegram:'https://t.me/server'}});
 assert.deepEqual(store.snapshot('shared'),{shared:{footerText:'Mine',telegram:'https://t.me/server'}});
});
