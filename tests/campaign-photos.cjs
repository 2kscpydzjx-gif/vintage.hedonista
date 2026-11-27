const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,process.env.VH_TEST_BUILT==='1'?'../dist':'..');
const sandbox={window:{}};vm.runInNewContext(fs.readFileSync(path.join(root,'home-campaign-config.js'),'utf8'),sandbox);
const campaign=sandbox.window.VH_HOME_CAMPAIGN;
async function mockCampaignPhotos(context,png){
 for(const url of new Set([campaign.image,campaign.mobileImage,campaign.popup?.image,campaign.popup?.mobileImage].filter(Boolean))){
  const local=!/^https?:/.test(url)&&path.resolve(root,url);
  const file=local||(process.env.VH_CAMPAIGN_IMAGE_DIR&&path.join(process.env.VH_CAMPAIGN_IMAGE_DIR,url===campaign.image?'banner-desktop.webp':'banner-mobile.webp'));
  const type=file?.endsWith('.webp')?'image/webp':/\.jpe?g$/i.test(file||'')?'image/jpeg':'image/png';
  await context.route(new URL(url,'http://127.0.0.1:8765/').href,r=>r.fulfill({contentType:type,body:file?fs.readFileSync(file):png}));
 }
}
async function verifyFrame(image,inset){
 if(!inset)return;
 const box=await image.evaluate((img,frame)=>{const picture=img.parentElement.getBoundingClientRect(),r=img.getBoundingClientRect();return {top:r.y+r.height*frame.top/100,bottom:r.y+r.height*(1-frame.bottom/100),targetTop:picture.y,targetBottom:picture.bottom}},inset);
 require('node:assert/strict').ok(box.top<=box.targetTop+1&&box.bottom>=box.targetBottom-1,'uploaded padding remains visible');
}
module.exports={campaign,mockCampaignPhotos,verifyFrame};
