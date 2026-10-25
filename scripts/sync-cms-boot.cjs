const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),source=fs.readFileSync(path.join(root,'cms-boot.js'),'utf8').trim(),css=fs.readFileSync(path.join(root,'cms-boot.css'),'utf8').trim();
const snippet='<!-- vh-cms-boot:start --><style>'+css+'</style><script>'+source+'</script><!-- vh-cms-boot:end -->';
const walk=dir=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(entry=>entry.isDirectory()?walk(path.join(dir,entry.name)):entry.name==='index.html'?[path.join(dir,entry.name)]:[]);
const files=['index.html','about.html','catalog.html','capsule.html','journal.html','delivery.html','contacts.html'].map(file=>path.join(root,file)).concat(walk(path.join(root,'seo-category')),walk(path.join(root,'seo-subcategory')));
for(const file of files){let html=fs.readFileSync(file,'utf8');html=html.replace(/<!-- vh-cms-boot:start -->[\s\S]*?<!-- vh-cms-boot:end -->/,'');html=html.replace(/<meta charset="utf-8">/i,match=>match+snippet);if(process.argv.includes('--check')){if(fs.readFileSync(file,'utf8')!==html)throw Error('CMS boot markup is out of sync: '+file)}else fs.writeFileSync(file,html)}
