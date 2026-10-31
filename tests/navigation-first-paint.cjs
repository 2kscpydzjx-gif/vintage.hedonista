const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {fixture}=require('./cms-browser-fixture.cjs');
const snapshot=JSON.parse(fs.readFileSync(path.join(__dirname,'../scripts/published-navigation.json'),'utf8'));
const base='http://127.0.0.1:8765',published=snapshot.nav['3'].label;
(async()=>{
 for(const scenario of [
  {name:'first visit',label:published,cache:null},
  {name:'newer saved publication',label:'АКТУАЛЬНИЙ ЖУРНАЛ',cache:{updated_at:'2030-01-01T00:00:00Z',shared:{nav:{3:{label:'АКТУАЛЬНИЙ ЖУРНАЛ',href:'journal.html'}}}}},
  {name:'older cache',label:published,cache:{updated_at:'2000-01-01T00:00:00Z',shared:{nav:{3:{label:'СТАРИЙ ЖУРНАЛ',href:'journal.html'}}}}}
 ]){
  const f=await fixture();try{
   f.user(null);f.session(null);f.delay(1500);
   f.set('home','published',{updated_at:scenario.name==='newer saved publication'?scenario.cache.updated_at:snapshot.updated_at,shared:{nav:{3:{label:scenario.label,href:'journal.html'}}}});
   f.data('products',[{id:'p',slug:'vovnyanyi-zhaket-kardyhan',name:'Тестовий товар',price:1200,status:'published',cover_image:base+'/assets/test-upload.png',product_images:[]}]);
   await f.context.addInitScript(({cache})=>{
    try{if(cache)localStorage.setItem('vh-published-cache-v1-home-shell',JSON.stringify(cache));else localStorage.removeItem('vh-published-cache-v1-home-shell')}catch{}
    window.__navPaintFrames=[];requestAnimationFrame(function record(){const header=document.querySelector('body>header'),link=header?.querySelectorAll('nav a')[3];if(link&&getComputedStyle(header).visibility!=='hidden'&&getComputedStyle(header).opacity!=='0')window.__navPaintFrames.push({label:link.textContent,headerHeight:header.getBoundingClientRect().height,ready:!!window.__VH_SHELL_READY});if(window.__navPaintFrames.length<240)requestAnimationFrame(record)});
   },{cache:scenario.cache});
   const p=await f.context.newPage();
   for(const route of ['product.html?slug=vovnyanyi-zhaket-kardyhan',null,'seo-product/vovnyanyi-zhaket-kardyhan/index.html']){
    if(route)await p.goto(base+'/'+route,{waitUntil:'domcontentloaded'});else await p.reload({waitUntil:'domcontentloaded'});await p.waitForFunction(()=>window.__navPaintFrames.length>=3);
    assert.equal(await p.evaluate(()=>!!window.__VH_SHELL_READY),false,'publication was not delayed');
    assert.equal(await p.locator('header nav a').nth(3).textContent(),scenario.label,scenario.name+' before publication');
    await p.waitForFunction(()=>window.__VH_SHELL_READY===true);
    const frames=await p.evaluate(()=>window.__navPaintFrames);
    assert.ok(frames.length>3);assert.ok(frames.some(frame=>!frame.ready));
    assert.deepEqual([...new Set(frames.map(frame=>frame.label))],[scenario.label],scenario.name+' painted an old label');
    assert.ok(frames.every(frame=>frame.headerHeight>0),'header was hidden');
   }
   assert.equal(f.calls.filter(call=>call.op!=='select').length,0);assert.deepEqual(f.errors,[]);
  }finally{await f.browser.close()}
 }
 console.log('PASS: first visit, refresh and nested product show the published nav before a delayed API response; newer cache primes before paint, older cache cannot replace the build snapshot; header stays visible.');
})().catch(error=>{console.error(error);process.exitCode=1});
