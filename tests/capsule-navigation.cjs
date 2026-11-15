const assert=require('node:assert/strict');
const {fixture}=require('./cms-browser-fixture.cjs');
const base='http://127.0.0.1:8765';
(async()=>{const f=await fixture({reducedMotion:'reduce'});try{
 f.user(null);f.session(null);
 f.data('capsule_styles',[{id:'style',slug:'test-style',title:'BLACK & WHITE',is_active:true}]);
 const capsules=[0,1,2].map(i=>({id:'capsule-'+i,style_id:'style',title:'Капсула '+(i+1),is_active:true}));
 f.data('capsules',capsules);
 f.data('capsule_looks',capsules.flatMap(c=>[0,1].map(i=>({id:c.id+'-look-'+i,capsule_id:c.id,title:'Образ '+i,is_main:i===0}))));
 const p=await f.context.newPage();
 for(const width of [320,390,820,1366,1920]){
  await p.setViewportSize({width,height:900});await p.goto(base+'/capsule-1.html?style=test-style');
  await p.waitForFunction(()=>document.querySelector('.capsule-info h1').textContent==='Капсула 1');
  const prev=p.getByRole('button',{name:'Попередня капсула'}),next=p.getByRole('button',{name:'Наступна капсула'});
  assert.equal(await prev.textContent(),'Попередня капсула');assert.equal(await next.textContent(),'Наступна капсула');
  for(const button of [prev,next]){const r=await button.boundingBox();assert.ok(r.height>=44&&r.x>=0&&r.x+r.width<=width+1,'tap target at '+width)}
  assert.equal(await prev.isDisabled(),true);await next.click();await p.waitForFunction(()=>document.querySelector('.capsule-info h1').textContent==='Капсула 2');
  assert.equal(await p.locator('#capsuleCurrentLabel').textContent(),'КАПСУЛА 02');
  await p.locator('#capsuleNext').click();await p.waitForFunction(()=>document.querySelector('.capsule-buy-meta span').textContent==='ОБРАЗ 02');assert.equal(await p.locator('#capsuleCurrentLabel').textContent(),'КАПСУЛА 02');
  await next.focus();await p.keyboard.press('Enter');await p.waitForFunction(()=>document.querySelector('.capsule-info h1').textContent==='Капсула 3');assert.equal(await next.isDisabled(),true);
  await prev.click();await p.waitForFunction(()=>document.querySelector('.capsule-info h1').textContent==='Капсула 2');
  assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,'overflow at '+width);
 }
 f.data('capsules',[capsules[0]]);await p.reload();await p.waitForFunction(()=>document.querySelector('.capsule-info h1').textContent==='Капсула 1');assert.equal(await p.locator('#capsuleGroupPrev').isDisabled(),true);assert.equal(await p.locator('#capsuleGroupNext').isDisabled(),true);
 f.data('capsules',[]);await p.reload();await p.getByText('У стилі «BLACK & WHITE» поки немає опублікованих капсул.').waitFor();assert.equal(await p.locator('.capsule-page-nav').isVisible(),false);
 assert.equal(f.calls.filter(c=>c.op!=='select').length,0);assert.deepEqual(f.errors,[]);
 console.log('PASS: labelled capsule buttons, keyboard and boundaries, separate looks, original counter, five responsive widths, single/empty capsules and no writes.');
}finally{await f.browser.close()}})().catch(error=>{console.error(error);process.exitCode=1});
