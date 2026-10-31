import {readFile} from 'node:fs/promises';
const escape=value=>String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const validHref=value=>typeof value==='string'&&/^(https?:|\/|\.\/|\.\.\/|[\w-]+\.html|#)/i.test(value);
export async function publishedNavigation(config,{cloudflare=false,fixture=process.env.VH_NAVIGATION_SNAPSHOT_FILE}={}){
 const fallback=JSON.parse(await readFile(new URL('./published-navigation.json',import.meta.url),'utf8'));
 if(fixture)return JSON.parse(await readFile(fixture,'utf8'));
 if(!cloudflare)return fallback;
 // Publishable-key read only; build never writes or reads drafts.
 const base=config.match(/supabaseUrl\s*:\s*['"]([^'"]+)/)?.[1],key=config.match(/supabaseKey\s*:\s*['"]([^'"]+)/)?.[1];
 try{
  const response=await fetch(base+'/rest/v1/vh_page_revisions?select=shared,updated_at&page_key=eq.home&revision_status=eq.published&limit=1',{headers:{apikey:key,'Accept-Profile':'public'},signal:AbortSignal.timeout(12000)});
  if(!response.ok)throw Error('HTTP '+response.status);
  const rows=await response.json();if(!Array.isArray(rows))throw Error('Invalid published navigation response');
  return {updated_at:rows[0]?.updated_at||null,nav:rows[0]?.shared?.nav||{}};
 }catch(error){console.warn('Published navigation read failed; using the saved public snapshot ('+error.message+').');return fallback}
}
export function renderPublishedNavigation(html,snapshot){
 if(!/<header\b/i.test(html))return html;
 html=html.replace(/(<header\b[^>]*>)([\s\S]*?)(<\/header>)/i,(_,start,header,end)=>{
  header=header.replace(/(<nav\b[^>]*>)([\s\S]*?)(<\/nav>)/i,(_,open,nav,close)=>{
   let index=0;nav=nav.replace(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi,(original,attrs,label)=>{
    const value=snapshot?.nav?.[String(index++)];if(typeof value?.label!=='string'||!value.label)return original;
    const href=attrs.match(/\bhref="([^"]*)"/i)?.[1]||'';
    const originalLabel=label.replace(/<[^>]*>/g,'').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
    attrs+=' data-vh-nav-default-label="'+originalLabel+'" data-vh-nav-default-href="'+href+'"';
    if(validHref(value.href))attrs=attrs.replace(/\bhref="[^"]*"/i,'href="'+escape(value.href)+'"');
    return '<a'+attrs+'>'+escape(value.label)+'</a>';
   });return open+nav+close;
  });return start+header+end;
 });
 if(snapshot?.updated_at)html=html.replace(/<\/head>/i,'<meta name="vh-published-nav-revision" content="'+escape(snapshot.updated_at)+'"></head>');
 return html;
}
