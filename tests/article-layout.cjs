const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {fixture}=require('./cms-browser-fixture.cjs');
const base='http://127.0.0.1:8765',photo=base+'/assets/test-upload.png';
const title='Топ-10 вінтажних речей, які варто мати в сучасному гардеробі';
const rows=[
 {id:'rich',slug:'rich-article',title,category:'СТИЛЬ',cover_image:photo,excerpt:'<p>Збережений <strong>вступ</strong> без видимих HTML-тегів.</p>',content:'VH_HTML_V1:<p>Оригінальний текст статті.</p><h2>Перший розділ</h2><p>Опис розділу з <a href="/catalog">каталогом</a>.</p><figure data-vh-width="40" data-vh-align="left"><img src="'+photo+'" alt="Деталь речі"><figcaption>Підпис фотографії</figcaption></figure><p>Текст поруч із фотографією. '+('Вінтажні деталі. '.repeat(30))+'</p><ul><li>Збережений пункт</li></ul><blockquote>Цитата</blockquote>',gallery_images:[photo,photo]},
 {id:'blocks',slug:'block-article',title:'Коротка історія',category:'ІСТОРІЇ РЕЧЕЙ',cover_image:photo,excerpt:'Короткий вступ',content:'VH_BLOCKS_V1:'+JSON.stringify([{type:'paragraph',text:'Абзац із блокового редактора.'},{type:'heading',text:'Розділ із блоків',after:'Збережений опис.'},{type:'image',url:photo,caption:'Фото з блоків'}])},
 {id:'plain',slug:'plain-article',title:'Довга назва без обкладинки та з різними форматами тексту',cover_image:null,excerpt:'',content:'Звичайний текст.\n\n## Звичайний розділ\nОпис розділу.\n\n- Пункт перший\n- Пункт другий'}
].map(row=>({...row,status:'published'}));
(async()=>{const f=await fixture({reducedMotion:'reduce'});try{
 f.user(null);f.session(null);f.data('news',rows);
 const p=await f.context.newPage();
 for(const width of [320,360,390,430,600,760,768,820,1024,1366,1920]){
  await p.setViewportSize({width,height:900});await p.goto(base+'/article.html?slug=rich-article');await p.locator('.article-editorial h1').waitFor();
  assert.equal(await p.locator('main h1').count(),1);assert.equal(await p.locator('main h1').textContent(),title);
  assert.equal(await p.locator('.article-v71-masthead').textContent(),'СТИЛЬ');
  assert.equal(await p.locator('.article-v71-cover img').getAttribute('alt'),title);assert.equal(await p.locator('.article-v71-cover img').getAttribute('fetchpriority'),'high');
  assert.equal(await p.locator('.article-v71-deck').textContent(),'Збережений вступ без видимих HTML-тегів.');assert.equal(await p.locator('.article-v71-content figure').getAttribute('data-vh-width'),'40');
  const layout=await p.locator('.article-editorial').evaluate(el=>{const box=s=>el.querySelector(s).getBoundingClientRect().toJSON(),h=el.querySelector('h1');return {cover:box('.article-v71-cover'),panel:box('.article-v71-cover-intro'),heading:box('h1'),content:box('.article-v71-content'),background:getComputedStyle(el.closest('main')).backgroundColor,align:getComputedStyle(h).textAlign,overflow:document.documentElement.scrollWidth>innerWidth+1}});
  assert.ok(layout.cover.top<layout.panel.top&&layout.panel.top<layout.cover.bottom,'cover/panel overlap at '+width);
  assert.ok(Math.abs(layout.panel.bottom-layout.cover.bottom)<1,'whole title panel ends inside cover at '+width);
  assert.ok(layout.panel.top-layout.cover.top>=219,'visible photo above title at '+width);
  assert.ok(layout.heading.bottom<=layout.cover.bottom,'heading leaves photo at '+width);
  assert.ok(layout.heading.left>=layout.panel.left&&layout.heading.right<=layout.panel.right+1,'title overflow at '+width);
  assert.ok(layout.content.top>=layout.panel.bottom,'body overlaps title at '+width);assert.ok(layout.content.width<=780.5);
  assert.equal(layout.align,'center');assert.equal(layout.background,'rgb(255, 255, 255)');assert.equal(layout.overflow,false,'page overflow at '+width);
  assert.ok(await p.locator('.article-v71-content a').getAttribute('href'));assert.equal(await p.locator('.article-v71-gallery img').count(),2);
  if(width<=760)assert.equal(await p.locator('.article-v71-content figure').evaluate(el=>getComputedStyle(el).float),'none');
 }
 for(const row of rows.slice(1)){
  await p.goto(base+'/article.html?slug='+row.slug);await p.locator('.article-editorial h1').waitFor();assert.equal(await p.locator('main h1').textContent(),row.title);
  assert.ok(await p.locator('.article-v71-content').textContent());assert.equal(await p.locator('.article-v71-cover').count(),row.cover_image?1:0);
  if(!row.cover_image){assert.equal(await p.locator('.article-editorial').evaluate(el=>el.classList.contains('has-cover')),false);assert.equal(await p.locator('.article-v71-cover-intro').evaluate(el=>parseFloat(getComputedStyle(el).marginTop)),0)}
 }
 await p.goto(base+'/article.html?slug=unpublished');await p.getByText('Статтю не знайдено або вона ще не опублікована').waitFor();assert.equal(await p.locator('.article-editorial').count(),0);
 assert.deepEqual(f.errors,[]);assert.equal(f.calls.filter(c=>c.op!=='select').length,0);assert.equal(f.functionCalls.length,0);
 console.log('PASS: whole title panel inside photo at 11 widths, readable body, rich excerpt, three body formats, saved image alignment/gallery/links, no-cover and missing articles, one H1 and no writes.');
}finally{await f.browser.close()}
 const staticFixture=await fixture({javaScriptEnabled:false});try{
  // Published article slugs can change independently of the layout code.
  const snapshots=fs.readdirSync(path.join(__dirname,'../seo-article'),{withFileTypes:true}).filter(entry=>entry.isDirectory()&&fs.existsSync(path.join(__dirname,'../seo-article',entry.name,'index.html')));
  assert.ok(snapshots.length,'No published article snapshots to verify');
  const p=await staticFixture.context.newPage();let covers=0;
  for(const entry of snapshots){
   const response=await p.goto(base+'/seo-article/'+encodeURIComponent(entry.name)+'/index.html');
   assert.equal(response.status(),200,'Article snapshot unavailable: '+entry.name);
   assert.equal(await p.locator('main h1').count(),1);assert.equal(await p.locator('.article-editorial').count(),1);
   if(await p.locator('.article-v71-cover').count()){
    assert.ok(await p.locator('.article-editorial').evaluate(el=>el.firstElementChild.matches('.article-v71-cover')));
    assert.equal(await p.locator('.article-v71-cover-intro h1').evaluate(el=>getComputedStyle(el).textAlign),'center');covers++;
   }
  }
  assert.ok(covers,'No covered article snapshot verified');
  console.log('PASS: all '+snapshots.length+' current article snapshots use the same layout before JavaScript runs.');
 }finally{await staticFixture.browser.close()}
})().catch(error=>{console.error(error);process.exitCode=1});
