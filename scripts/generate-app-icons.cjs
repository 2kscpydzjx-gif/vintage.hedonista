/* Export standard browser/home-screen sizes from the owner's original PNG. */
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),input=process.argv[2];
if(!input)throw new Error('Usage: node scripts/generate-app-icons.cjs /path/to/original.png');
const original=fs.readFileSync(input);
(async()=>{
 const browser=await chromium.launch({headless:true,...(fs.existsSync('/usr/bin/chromium')?{executablePath:'/usr/bin/chromium',args:['--no-sandbox']}: {})});
 try{
  const page=await browser.newPage();
  const exports=await page.evaluate(async source=>{
   const image=new Image();image.src=source;await image.decode();
   if(image.width!==image.height)throw new Error('App icon source must be square');
   return [16,32,48,180,192,512].map(size=>{
    const canvas=document.createElement('canvas');canvas.width=canvas.height=size;
    const ctx=canvas.getContext('2d');
    // Home-screen icons need an opaque background; browser favicons retain alpha.
    if(size>=180){ctx.fillStyle='#241006';ctx.fillRect(0,0,size,size)}
    ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';
    ctx.drawImage(image,0,0,size,size);
    return {size,base64:canvas.toDataURL('image/png').split(',')[1]};
   });
  },'data:image/png;base64,'+original.toString('base64'));
  fs.mkdirSync(path.join(root,'assets/icons'),{recursive:true});
  const frames=[];
  for(const item of exports){
   const bytes=Buffer.from(item.base64,'base64');
   if(item.size<=48)frames.push({size:item.size,bytes});
   if(item.size===48)continue;
   const name=item.size<180?'favicon-'+item.size+'.png':item.size===180?'apple-touch-icon-180.png':'icon-'+item.size+'.png';
   fs.writeFileSync(path.join(root,'assets/icons',name),bytes);
   if(item.size===180)fs.writeFileSync(path.join(root,'apple-touch-icon.png'),bytes);
  }
  const header=Buffer.alloc(6+16*frames.length);header.writeUInt16LE(1,2);header.writeUInt16LE(frames.length,4);let offset=header.length;
  frames.forEach(({size,bytes},i)=>{const at=6+i*16;header[at]=header[at+1]=size;header.writeUInt16LE(1,at+4);header.writeUInt16LE(32,at+6);header.writeUInt32LE(bytes.length,at+8);header.writeUInt32LE(offset,at+12);offset+=bytes.length});
  fs.writeFileSync(path.join(root,'favicon.ico'),Buffer.concat([header,...frames.map(f=>f.bytes)]));
  console.log(JSON.stringify({sourceSha256:crypto.createHash('sha256').update(original).digest('hex'),sizes:exports.map(x=>x.size)}));
 }finally{await browser.close()}
})().catch(error=>{console.error(error);process.exitCode=1});
