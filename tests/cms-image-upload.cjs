const assert=require('node:assert/strict'),{fixture}=require('./cms-browser-fixture.cjs');
const base='http://127.0.0.1:8765';
(async()=>{const f=await fixture({reducedMotion:'reduce'});try{
 const p=await f.context.newPage();await p.goto(base+'/admin/cms-builder.html?page=about');await p.waitForFunction(()=>document.querySelectorAll('.existing-row').length&&!document.querySelector('#save').disabled);
 const prepared=await p.evaluate(async()=>{
  const canvas=document.createElement('canvas');canvas.width=3200;canvas.height=1800;const ctx=canvas.getContext('2d'),pixels=ctx.createImageData(3200,1800);
  let seed=12345;for(let y=0;y<1800;y++)for(let x=0;x<3200;x++){seed=(Math.imul(seed,1664525)+1013904223)|0;const noise=(seed>>>24)&15,i=(y*3200+x)*4;pixels.data[i]=x/16+noise;pixels.data[i+1]=y/9+noise;pixels.data[i+2]=100+noise*2;pixels.data[i+3]=(x<30&&y<30)?0:255}ctx.putImageData(pixels,0,0);
  const source=new File([await new Promise(resolve=>canvas.toBlob(resolve,'image/png'))],'wide-original.png',{type:'image/png'});window.__uploadSource=source;
  const digest=async file=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',await file.arrayBuffer()))).join(',');const before=await digest(source);
  const result=await VHCMSImageUpload.prepare(source),bitmap=await createImageBitmap(result.file);const check=document.createElement('canvas');check.width=check.height=1;const c=check.getContext('2d');c.drawImage(bitmap,0,0);const alpha=c.getImageData(0,0,1,1).data[3];bitmap.close();
  const logo=await VHCMSImageUpload.prepare(source,{preserve:true});
  const gif=new File([new Uint8Array(140000)],'animation.gif',{type:'image/gif'}),animation=await VHCMSImageUpload.prepare(gif);
  return {original:source.size,size:result.file.size,type:result.file.type,width:result.width,height:result.height,optimized:result.optimized,alpha,unchanged:before===await digest(source),logo:logo.file===source&&!logo.optimized,animation:animation.file===gif&&!animation.optimized};
 });
 assert.ok(prepared.original>131072);assert.equal(prepared.optimized,true);assert.ok(prepared.size<prepared.original*.9);assert.equal(prepared.type,'image/webp');assert.equal(prepared.width,2400);assert.equal(prepared.height,1350);assert.equal(prepared.alpha,0);assert.equal(prepared.unchanged,true);assert.equal(prepared.logo,true);assert.equal(prepared.animation,true);
 await p.locator('[data-cms-id="existing-0"] .existing-select').click();await p.locator('[data-inspector-tab=media]').click();
 const uploader=p.locator('#existingEditor .cms-photo-editor input[type=file]');
 await uploader.evaluate((input)=>{const dt=new DataTransfer();dt.items.add(window.__uploadSource);input.files=dt.files;input.dispatchEvent(new Event('change',{bubbles:true}))});
 await p.waitForFunction(()=>document.querySelector('#existingEditor .cms-photo-original')?.hasAttribute('href'));
 const uploads=f.calls.filter(c=>c.op==='upload');assert.equal(uploads.length,2);assert.equal(uploads[0].type,'image/png');assert.match(uploads[0].path,/-original\.png$/);assert.equal(uploads[1].type,'image/webp');assert.match(uploads[1].path,/\.webp$/);assert.ok(uploads[1].size<uploads[0].size);
 const sourceLink=await p.locator('.cms-photo-original').getAttribute('href');assert.match(sourceLink,/original\.png/);
 await p.locator('#save').click();await p.locator('#status').filter({hasText:'перевірено на сервері'}).waitFor();const revision=f.records.get('about:draft'),edit=revision.shared.cmsPageDraft.existing['existing-0'],url=edit.layoutImages[0];assert.match(url,/\.webp/);assert.equal(edit.photoOriginals[url],sourceLink);f.failUpload(4);
 await uploader.evaluate(input=>{const dt=new DataTransfer();dt.items.add(window.__uploadSource);input.files=dt.files;input.dispatchEvent(new Event('change',{bubbles:true}))});await p.locator('#status').filter({hasText:'Simulated variant failure'}).waitFor();await p.waitForFunction(()=>!document.querySelector('#save').disabled);assert.equal(await p.locator('.cms-photo-url input').inputValue(),url,'failed variant replaced the previous photo');assert.equal(await p.locator('.cms-photo-original').getAttribute('href'),sourceLink);
 await p.reload();await p.waitForFunction(()=>document.querySelectorAll('.existing-row').length&&!document.querySelector('#save').disabled);await p.locator('[data-cms-id="existing-0"] .existing-select').click();await p.locator('[data-inspector-tab=media]').click();assert.equal(await p.locator('.cms-photo-original').getAttribute('href'),sourceLink);
 assert.deepEqual(f.errors,[]);assert.equal(f.calls.filter(c=>c.table==='vh_page_revisions'&&c.values?.revision_status==='published').length,0);
 console.log('PASS: smaller aspect-preserving transparent WebP, immutable original, unchanged logos/animation, two-file Storage upload and original link retained through draft save/reload.');
}finally{await f.browser.close()}})().catch(e=>{console.error(e);process.exit(1)});
