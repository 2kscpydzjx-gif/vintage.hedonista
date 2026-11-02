// Source snapshots keep their established layout; only Cloudflare's public build
// uses these routes. This also keeps the scheduled snapshot generator compatible.
const kinds={'seo-product':'product','seo-category':'catalog','seo-subcategory':'catalog','seo-article':'journal'};
export function cleanReferences(text,base){
 const escape=value=>value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
 const roots=base?escape(base)+'|':'';
 const expression=new RegExp('('+roots+'(?<=[\\s"\'(])(?:\\.\\.?/)*|(?<=[\\s"\'(])/)(seo-(?:product|category|subcategory|article)/)','g');
 return text.replace(expression,(_,root,prefix)=>root+kinds[prefix.slice(0,-1)]+'/');
}
export function cleanFile(file){return file.replace(/^seo-(?:product|category|subcategory|article)\//,prefix=>kinds[prefix.slice(0,-1)]+'/')}
// Pages normalizes index.html before serving proxy targets. Keep the public
// trailing-slash URL separate from its flat, extensionless asset target.
export function cleanAssetFile(file){
 const clean=cleanFile(file);
 return /^(?:product|catalog|journal)\/.+\/index\.html$/.test(clean)?clean.replace(/\/index\.html$/,'.html'):file;
}
export function snapshotIdentity(file){
 if(file.startsWith('product/'))return file.replace(/^product\//,'seo-product/');
 if(file.startsWith('journal/'))return file.replace(/^journal\//,'seo-article/');
 if(/^catalog\/[^/]+\/index\.html$/.test(file))return file.replace(/^catalog\//,'seo-category/');
 if(/^catalog\/[^/]+\/[^/]+\/index\.html$/.test(file))return file.replace(/^catalog\//,'seo-subcategory/');
 return file;
}
export function cleanRedirects(files){
 const lines=[];
 for(const [old,next,params] of [['seo-product','product',':slug'],['seo-category','catalog',':category'],['seo-subcategory','catalog',':category/:slug'],['seo-article','journal',':slug']]){
  for(const suffix of ['/index.html','/',''])lines.push('/'+old+'/'+params+suffix+' /'+next+'/'+params+'/ 301');
 }
 const routes=['product/:slug','catalog/:category/:slug','catalog/:category','journal/:slug'];
 for(const route of routes)lines.push('/'+route+'/index.html /'+route+'/ 301');
 for(const route of routes)lines.push('/'+route+' /'+route+'/ 301');
 const snapshots=files.filter(file=>/^seo-(?:product|category|subcategory|article)\/.*\/index\.html$/.test(file));
 if(snapshots.length+2>2000)throw Error('Clean URL snapshot rules exceed the Cloudflare static redirect budget');
 // Exact rewrites precede fallbacks so crawlers receive the existing static
 // product/article/editorial HTML. New items work before the next SEO snapshot.
 const exact=['/catalog/ /catalog 301','/journal/ /journal 301'];
 for(const file of snapshots){const source='/'+cleanFile(file).split('/').map(encodeURIComponent).join('/'),target='/'+cleanAssetFile(file).split('/').map(encodeURIComponent).join('/');exact.push(source.slice(0,-10)+' '+target.slice(0,-5)+' 200')}
 lines.push('/product/:slug/ /product?slug=:slug 200','/journal/:slug/ /article?slug=:slug 200','/catalog/:category/:slug/ /catalog?category=:category&subcategory=:slug 200','/catalog/:category/ /catalog?category=:category 200');
 const rules=[...exact,...lines];
 if(rules.some(rule=>rule.length>1000))throw Error('A clean URL rule exceeds the Cloudflare 1000-character limit');
 return rules.join('\n')+'\n';
}
