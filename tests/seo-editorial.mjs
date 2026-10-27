import assert from 'node:assert/strict';
import {fillCatalogEditorial,stripStaticProductLinks,staticProductFallback} from '../scripts/seo-editorial.mjs';
for(const opening of [
 '<section class="vh-catalog-seo wrap" id="catalogSeoEditorial" aria-label="Про колекцію" hidden>',
 '<section data-cms-section="catalog-catalogSeoEditorial-2" hidden id="catalogSeoEditorial" data-cms-legacy="existing-1">',
 "<section hidden='hidden' id='catalogSeoEditorial' class='vh-catalog-seo wrap'>"
]){
 const source='<main>'+opening+'<p>Previous copy</p></section><section>Unrelated block</section></main>';
 const markup='<div><h2>Category &amp; collection</h2><p>Visible description</p></div>';
 const filled=fillCatalogEditorial(source,markup);
 assert.ok(filled.includes(markup));assert.ok(!filled.includes('Previous copy'));assert.ok(!filled.includes(' hidden'));assert.ok(filled.includes('<section>Unrelated block</section>'));
 if(source.includes('data-cms-section'))assert.ok(filled.includes('data-cms-section="catalog-catalogSeoEditorial-2"'));
 assert.equal(fillCatalogEditorial(filled,markup),filled);
 assert.match(fillCatalogEditorial(filled,''),/id=["']catalogSeoEditorial["'][^>]* hidden>/);
}
assert.throws(()=>fillCatalogEditorial('<main></main>','<p>Content</p>'),/slot is missing/);
console.log('PASS: static SEO copy survives CMS attributes, quote/attribute changes and repeated generation; missing slots fail explicitly.');

const fallback=staticProductFallback([{slug:'coat',name:'Пальто & жакет'},{slug:'shirt',name:'Сорочка'},{slug:'shirt',name:'Сорочка'}],'https://example.test/');
assert.ok(fallback.startsWith('<noscript>'));assert.ok(fallback.endsWith('</noscript>'));
assert.equal((fallback.match(/<a /g)||[]).length,2);assert.match(fallback,/Пальто &amp; жакет/);
assert.ok(!fallback.includes('<summary>'));assert.ok(!fallback.includes('Переглянути всі товари'));
for(const nav of ['<nav class="vh-static-product-links wrap"><details><summary>Old</summary></details></nav>',fallback]){
 const source='<main><p>Keep</p>'+nav+'</main>';
 assert.equal(stripStaticProductLinks(source),'<main><p>Keep</p></main>');
 const render=html=>stripStaticProductLinks(html).replace('</main>',fallback+'</main>');
 assert.equal(render(render(source)),render(source));assert.equal((render(source).match(/<noscript>/g)||[]).length,1);
}
assert.equal(staticProductFallback([],'https://example.test/'),'');
console.log('PASS: no duplicate catalog control, usable no-JS links and idempotent generation.');
