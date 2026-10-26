import assert from 'node:assert/strict';
import {fillCatalogEditorial} from '../scripts/seo-editorial.mjs';
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
