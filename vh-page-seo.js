(function(){
 const page=location.pathname.split('/').pop().replace(/\.html$/,'')||'index';
 const keys={index:'home',catalog:'catalog',about:'about',journal:'journal',delivery:'delivery',contacts:'contacts',capsule:'capsules'};
 const key=keys[page];if(!key||!window.VH_CONFIG||!window.supabase||!window.VHSEORuntime)return;
 const sb=window.supabase.createClient(VH_CONFIG.supabaseUrl,VH_CONFIG.supabaseKey);
 sb.from('vh_seo_metadata').select('seo_title,meta_description').eq('entity_type','page').eq('entity_id',key).maybeSingle().then(({data,error})=>{
  if(error){console.warn('Page SEO',error);return}
  if(!data)return;
  // Category-specific SEO has priority over generic catalog page SEO.
  if(key==='catalog'&&new URLSearchParams(location.search).has('category'))return;
  window.VHSEORuntime.set({title:data.seo_title||document.title,description:data.meta_description||''});
 });
})();