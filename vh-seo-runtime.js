(function(){
function setMeta(name,content,attr='name'){let e=document.head.querySelector(`meta[${attr}="${name}"]`);if(!e){e=document.createElement('meta');e.setAttribute(attr,name);document.head.append(e)}e.setAttribute('content',content||'')}
function canonical(url){let e=document.head.querySelector('link[rel="canonical"]');if(!e){e=document.createElement('link');e.rel='canonical';document.head.append(e)}e.href=url}
async function apply(sb,kind,id,fallback={}){const url=new URL(location.href);url.hash='';if(['localhost','127.0.0.1'].includes(url.hostname)){url.protocol='https:';url.hostname='2kscpydzjx-gif.github.io';url.port='';url.pathname='/vintage.hedonista/'+url.pathname.split('/').pop();}const {data,error}=await sb.from('vh_seo_metadata').select('seo_title,meta_description').eq('entity_type',kind).eq('entity_id',String(id)).maybeSingle();if(error)console.warn('SEO metadata',error);const title=data?.seo_title||fallback.title||'Vintage Hedonista';const desc=data?.meta_description||fallback.description||'';document.title=title;setMeta('description',desc);setMeta('og:title',title,'property');setMeta('og:description',desc,'property');setMeta('og:url',url.href,'property');canonical(document.querySelector('meta[name="vh-static-canonical"]')?.content||url.href)}
function set({title,description,canonicalUrl}={}){
 const t=title||document.title;const d=description||'';
 document.title=t;setMeta('description',d);setMeta('og:title',t,'property');setMeta('og:description',d,'property');
 const live=new URL(location.href);if(['localhost','127.0.0.1'].includes(live.hostname)){live.protocol='https:';live.hostname='2kscpydzjx-gif.github.io';live.port='';live.pathname='/vintage.hedonista/'+live.pathname.split('/').pop();}live.hash='';const u=canonicalUrl||live.href;setMeta('og:url',u,'property');canonical(u);
}
window.VHSEORuntime={apply,set};
})();
