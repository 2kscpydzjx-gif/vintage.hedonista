#!/usr/bin/env node
// Generate static Product JSON-LD from existing SEO HTML pages.
// Run: node scripts/build-product-jsonld.cjs
// Uses only existing public HTML. Does not connect to Supabase or modify products.
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..','seo-product');
const decode=s=>s.replace(/&quot;/g,'"').replace(/&#39;|&#x27;/g,"'").replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>');
const strip=s=>decode(s.replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim());
function tag(html,id){const safe=id.replace(/[.*+?^$\{\}()|[\]\\]/g,'\\$&');const m=html.match(new RegExp('<[^>]+id=["\\']'+safe+'["\\'][^>]*>([\\s\\S]*?)<\\/[^>]+>','i'));return m?strip(m[1]):'';}
function attr(html,id,name){const match=html.match(new RegExp('<[^>]+id=["\\']'+id+'["\\'][^>]*>','i'));return match?.[0].match(new RegExp('\\b'+name+'=["\\']([^"\\']+)["\\']','i'))?.[1]||'';}
function walk(dir){if(!fs.existsSync(dir))return [];return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(dir,e.name)):e.name==='index.html'?[path.join(dir,e.name)]:[]);}
let changed=0,skipped=0;
for(const file of walk(root)){
 let html=fs.readFileSync(file,'utf8');
 const name=tag(html,'productName'),image=attr(html,'galleryMainImg','src');
 const canonical=html.match(/<link\s+rel=["']canonical["']\s+href=["']([^"']+)/i)?.[1]||'';
 if(!name||!canonical){skipped++;continue;}
 const brand=tag(html,'productBrandFact'),description=tag(html,'productShortDescription');
 const priceText=tag(html,'productPrice').replace(/\s/g,'').replace(',','.');
 const price=priceText.match(/\d+(?:\.\d+)?/)?.[0];
 const data={'@context':'https://schema.org','@type':'Product',name,url:canonical};
 if(description)data.description=description;
 if(/^https?:\/\//.test(image))data.image=[decode(image)];
 if(brand&&brand!=='—')data.brand={'@type':'Brand',name:brand};
 if(price)data.offers={'@type':'Offer',url:canonical,priceCurrency:'UAH',price,itemCondition:'https://schema.org/UsedCondition'};
 // Availability is intentionally omitted: published does not imply in stock.
 const json=JSON.stringify(data).replace(/</g,'\\u003c');
 const block='<script type="application/ld+json" id="vh-static-product-jsonld">'+json+'</script>';
 const prior=/<script\s+type=["']application\/ld\+json["'](?:\s+id=["']vh-static-product-jsonld["'])?[^>]*>[\s\S]*?<\/script>/i;
 if(prior.test(html))html=html.replace(prior,block);
 else html=html.replace('</head>',block+'</head>');
 if(html!==fs.readFileSync(file,'utf8')){fs.writeFileSync(file,html);changed++;}
}
console.log('Updated '+changed+' SEO pages; skipped '+skipped+'.');
