/* Page-owned presentation; published copy and capsule collections stay in the CMS.
   Applied to the final CMS structure before the startup mask is released. */
(()=>{'use strict';
 const photo='https://yffwjgwwkapdrpwyjwfp.supabase.co/storage/v1/object/public/vintage-media/cms/capsules/existing-existing-0-static--capsule-hero-photo-0/1793784727483-bc6a7ff8-fc7d-4bf5-8c4d-75f4d140d5a1.webp';
 window.VHCapsulePage={present(edits){
  const hero=document.querySelector('.capsule-page>.capsule-hero');if(!hero)return;
  const saved=edits['existing-0']||{};
  const edit={...saved,design:{...saved.design,layoutVersion:1,photoPreset:'gradient-hero',heightMode:'auto',minHeight:480,textLayout:'stacked',align:'left',textPosition:'center',textWidth:52,backgroundMode:'dark',textTone:'light',cropDevices:{desktop:{fit:'cover',x:65,y:25,zoom:100},tablet:{fit:'cover',x:66,y:35,zoom:100},mobile:{fit:'cover',x:72,y:35,zoom:100}}},mapped:{...saved.mapped,'static:.capsule-hero-copy .capsule-kicker:0':'VINTAZHKA','static:.capsule-hero-photo:0':photo},layoutImages:{0:photo},mediaSettings:{},mediaCrop:{}};
  window.VHCMSModel.applyDesign(hero,edit.design,'capsules',edit);
  // Old title positions and animation classes are not part of this presentation.
  const copy=hero.querySelector(':scope>.vh-cms-composition>.vh-cms-copy');
  copy?.querySelectorAll('.capsule-kicker').forEach(node=>node.textContent='VINTAZHKA');
  const image=hero.querySelector(':scope>.vh-cms-composition>.vh-cms-photo>img');
  if(image)image.alt='Вінтажні речі та натхнення для стильових капсул Vintazhka';
  const intro=document.querySelector('.capsule-page>.capsule-intro');
  intro?.querySelectorAll('.vh43-reveal').forEach(node=>node.classList.remove('vh43-reveal','vh43-visible'));
  window.VHCMSBoot?.whenVisible(()=>{vhVisibleFeature(hero);vhVisibleFeature(intro)});
 }};
})();
