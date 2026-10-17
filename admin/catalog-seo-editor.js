/* SEO editorial editor. Uses existing admin Supabase client and is_admin() RLS. */
(function(){
const $=id=>document.getElementById(id);
const base=new URL('../',document.currentScript.src);
let defaults=null,selected='all',current=null,editing=false;
const els=()=>({heading:$('seoBlockHeading'),description:$('seoBlockDescription'),image:$('seoBlockImage'),features:[0,1,2].map(i=>[$('seoFeatureTitle'+i),$('seoFeatureBody'+i)])});
const keyFor=(type,cat,sub)=>type==='all'?'all':type==='category'?'category:'+cat.slug:'subcategory:'+cat.slug+':'+sub.slug;
function options(){
 const select=$('seoBlockTarget');if(!select)return;
 const old=select.value||selected;
 const entries=[['all','Усі товари']];
 for(const c of categories){entries.push([keyFor('category',c),'Категорія: '+c.name]);for(const sub of subcategories.filter(x=>String(x.category_id)===String(c.id)))entries.push([keyFor('subcategory',c,sub),'  ↳ '+c.name+' / '+sub.name])}
 select.replaceChildren();for(const [value,label] of entries){const opt=document.createElement('option');opt.value=value;opt.textContent=label;select.append(opt)}
 select.value=entries.some(x=>x[0]===old)?old:'all';selected=select.value;
}
function fallback(){
 if(selected==='all')return defaults?.all||{};
 const parts=selected.split(':');
 const cat=categories.find(x=>x.slug===parts[1]);
 if(parts[0]==='category'){
  const existing=defaults?.categories?.[parts[1]];if(existing)return existing;
  const name=cat?.name||parts[1]||'';
  return {heading:'Вінтажні '+name.toLowerCase()+' у Vintage Hedonista',description:'Відкрийте добірку '+name.toLowerCase()+' у Vintage Hedonista. Знайдіть вінтажні речі з характером та доповніть свій гардероб особливими деталями.',features:[]};
 }
 if(parts[0]==='subcategory'){
  const existing=defaults?.subcategories?.[parts[1]+'/'+parts[2]];if(existing)return existing;
  const sub=subcategories.find(x=>x.slug===parts[2]&&String(x.category_id)===String(cat?.id));
  const name=sub?.name||parts[2]||'';
  return {heading:'Вінтажні '+name.toLowerCase()+' у Vintage Hedonista',description:'Відкрийте добірку '+name.toLowerCase()+' у Vintage Hedonista. Знайдіть вінтажні речі з характером та доповніть свій гардероб особливими деталями.',features:[]};
 }
 return {};
}
function fill(data){
 const e=els();e.heading.value=data.heading||'';e.description.value=data.description||'';e.image.value=data.image||'';
 e.features.forEach(([h,b],i)=>{h.value=data.features?.[i]?.[0]||'';b.value=data.features?.[i]?.[1]||''});
 $('seoBlockStatus').textContent=current?'Завантажено з Supabase':'Показано стандартний вміст. Заповніть поля, щоб зберегти власний текст.';
 editing=false;
}
async function load(){
 selected=$('seoBlockTarget').value;
 $('seoBlockStatus').textContent='Завантаження…';
 try{
  if(!defaults){const response=await fetch(new URL('catalog-seo-content.json',base));if(response.ok)defaults=await response.json()}
  const {data,error}=await sb.from('vh_catalog_seo_blocks').select('heading,description,features,image').eq('page_key',selected).maybeSingle();
  if(error)throw error;current=data;fill(data||fallback())
 }catch(error){console.error(error);$('seoBlockStatus').textContent='Помилка завантаження: '+error.message}
}
async function save(){
 const e=els();const heading=e.heading.value.trim(),description=e.description.value.trim();
 if(!heading||!description){toast('Заповни заголовок H2 та опис');return}
 const features=e.features.map(([h,b])=>[h.value.trim(),b.value.trim()]).filter(([h,b])=>h&&b);
 if(e.features.some(([h,b])=>Boolean(h.value.trim())!==Boolean(b.value.trim()))){toast('Для колонки заповни назву та опис або залиш обидва поля порожніми');return}
 const button=$('seoBlockSave');button.disabled=true;
 try{
  const {error}=await sb.from('vh_catalog_seo_blocks').upsert({page_key:selected,heading,description,image:e.image.value.trim(),features,updated_at:new Date().toISOString()},{onConflict:'page_key'});
  if(error)throw error;current={heading,description,image:e.image.value.trim(),features};editing=false;
  $('seoBlockStatus').textContent='Збережено в Supabase. На сайті оновиться після перезавантаження; SEO HTML — після генерації.';
  toast('SEO-блок збережено');
 }catch(error){console.error(error);toast('Не вдалося зберегти: '+error.message)}
 finally{button.disabled=false}
}
document.addEventListener('DOMContentLoaded',()=>{
 const target=$('seoBlockTarget');if(!target)return;
 target.addEventListener('change',load);
 $('seoBlockSave').addEventListener('click',save);
 $('seoBlockReload').addEventListener('click',load);
 for(const el of $('seoBlockEditor').querySelectorAll('input,textarea'))el.addEventListener('input',()=>{editing=true;$('seoBlockStatus').textContent='Є незбережені зміни'});
 $('seoBlockTarget').addEventListener('focus',options);
 $('seoBlockEditor').addEventListener('focusin',()=>{if(!target.options.length){options();void load()}},{once:true});
 const observer=new MutationObserver(()=>{if(!editing)options()});
 const table=$('categoriesTable');if(table)observer.observe(table,{childList:true});
 options();void load();
});
})();