const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
process.env.VH_TEST_BUILT='1';
const root=path.resolve(__dirname,'..'),dist=path.join(root,'dist'),base='http://127.0.0.1:8765';
const read=file=>fs.readFileSync(path.join(dist,file),'utf8');
const links=html=>[...html.matchAll(/<link\b[^>]*>/gi)].map(m=>Object.fromEntries([...m[0].matchAll(/([\w-]+)=["']([^"']*)["']/g)].map(a=>[a[1],a[2]])));
const walk=dir=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(dir,e.name)):[path.join(dir,e.name)]);
const pngSize=bytes=>{assert.equal(bytes.subarray(1,4).toString(),'PNG');return [bytes.readUInt32BE(16),bytes.readUInt32BE(20)]};
(async()=>{
 const {renderAppIcons}=await import('../scripts/app-icons.mjs');
 const source='<html><head><title>Keep</title><link href="old.png" rel="icon"><link rel="apple-touch-icon" href="old.png"><meta name="theme-color" content="red"></head><body>Keep body and handlers</body></html>';
 for(const file of ['index.html','admin/index.html']){
  const output=renderAppIcons(source,file);assert.equal(renderAppIcons(output,file),output,'duplicate head icons');assert.match(output,/<body>Keep body and handlers<\/body>/);assert.doesNotMatch(output,/old\.png/);
 }
 let pages=0;for(const file of walk(dist).filter(f=>f.endsWith('.html'))){
  const relative=path.relative(dist,file).split(path.sep).join('/'),html=fs.readFileSync(file,'utf8'),head=html.match(/<head\b[^>]*>([\s\S]*?)<\/head>/i)[1],icons=links(head);
  assert.equal(icons.filter(x=>x.rel==='manifest').length,1,relative);assert.equal(icons.filter(x=>x.rel==='apple-touch-icon').length,1,relative);assert.equal(icons.filter(x=>x.rel==='icon').length,3,relative);
  const doc=new URL('/'+relative,base),baseHref=head.match(/<base\b[^>]*href="([^"]+)"/i)?.[1],address=baseHref?new URL(baseHref,doc):doc;
  const manifest=new URL(icons.find(x=>x.rel==='manifest').href,address),expected=relative.startsWith('admin/')?'/admin/site.webmanifest':'/site.webmanifest';assert.equal(manifest.pathname,expected,'wrong installed app '+relative);
  for(const icon of icons.filter(x=>['manifest','icon','apple-touch-icon'].includes(x.rel))){const url=new URL(icon.href,address);assert.ok(fs.existsSync(path.join(dist,url.pathname)),relative+' missing '+url.pathname)}
  assert.ok(head.includes('name="apple-mobile-web-app-title" content="'+(relative.startsWith('admin/')?'Vintazhka Admin':'Vintazhka')+'"'));pages++;
 }
 const shop=JSON.parse(read('site.webmanifest')),admin=JSON.parse(read('admin/site.webmanifest'));
 for(const [file,manifest] of [['site.webmanifest',shop],['admin/site.webmanifest',admin]]){
  const url=new URL('/'+file,base),id=new URL(manifest.id,url),start=new URL(manifest.start_url,url),scope=new URL(manifest.scope,url);
  assert.equal(id.pathname,file.startsWith('admin/')?'/admin/':'/');assert.ok(start.pathname.startsWith(scope.pathname));assert.equal(manifest.display,'standalone');assert.equal(manifest.lang,'uk');
  for(const icon of manifest.icons){const image=new URL(icon.src,url),bytes=fs.readFileSync(path.join(dist,image.pathname));assert.equal(pngSize(bytes).join('x'),icon.sizes)}
 }
 assert.equal(new URL(admin.start_url,base+'/admin/site.webmanifest').pathname,'/admin/index.html');assert.notEqual(shop.name,admin.name);
 const ico=fs.readFileSync(path.join(dist,'favicon.ico'));assert.equal(ico.readUInt16LE(2),1);assert.equal(ico.readUInt16LE(4),3);
 for(let i=0;i<3;i++){const at=6+i*16,size=ico[at],length=ico.readUInt32LE(at+8),offset=ico.readUInt32LE(at+12);assert.deepEqual(pngSize(ico.subarray(offset,offset+length)),[size,size])}
 assert.deepEqual(pngSize(fs.readFileSync(path.join(dist,'apple-touch-icon.png'))),[180,180]);
 const {fixture}=require('./cms-browser-fixture.cjs'),f=await fixture({reducedMotion:'reduce',viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 try{
  f.user(null);f.session(null);const p=await f.context.newPage();
  const seo=walk(path.join(dist,'seo-product')).find(f=>f.endsWith('.html'));
  for(const file of ['index.html','catalog.html',path.relative(dist,seo).split(path.sep).join('/'),'admin/index.html']){
   await p.goto(base+'/'+file);
   const app=await p.evaluate(async()=>{const link=document.querySelector('link[rel=manifest]'),r=await fetch(link.href);return {ok:r.ok,type:r.headers.get('content-type'),value:await r.json()}});
   assert.equal(app.ok,true);assert.match(app.type,/application\/manifest\+json/);assert.equal(app.value.name,file.startsWith('admin/')?'Vintazhka Admin':'Vintazhka');
   const pixels=await p.evaluate(async()=>{const result=[];for(const source of [document.querySelector('link[rel="apple-touch-icon"]').href,new URL('assets/icons/icon-512.png',document.querySelector('link[rel="icon"]').href.replace(/favicon\.ico.*$/,'' )).href]){const img=new Image();img.src=source;await img.decode();const canvas=document.createElement('canvas');canvas.width=img.width;canvas.height=img.height;const c=canvas.getContext('2d');c.drawImage(img,0,0);const rgba=c.getImageData(0,0,img.width,img.height).data;let opaque=true;for(let i=3;i<rgba.length;i+=4)if(rgba[i]!==255){opaque=false;break}result.push({width:img.width,height:img.height,opaque})}return result});
   assert.deepEqual(pixels,[{width:180,height:180,opaque:true},{width:512,height:512,opaque:true}]);
  }
  assert.deepEqual(f.errors,[]);assert.equal(f.calls.filter(c=>c.op!=='select').length,0);
 }finally{await f.browser.close()}
 console.log('PASS: '+pages+' HTML pages expose the new icon, browser ICO frames, opaque Apple/Android PNGs, distinct shop/admin app identities and start URLs, nested SEO resolution and mobile browser loading; no data writes.');
})().catch(error=>{console.error(error);process.exitCode=1});
