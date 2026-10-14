const { chromium } = require('playwright');
const assert = require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true});
 const page=await browser.newPage({viewport:{width:1440,height:900}});
 const errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:8765/admin/v2-editor.html',{waitUntil:'domcontentloaded'});
 await page.locator('#page').waitFor();
 assert.equal(await page.locator('.top').count(),1);
 assert.equal(await page.locator('.left').count(),1);
 assert.equal(await page.locator('.right').count(),1);
 assert.equal(await page.locator('#canvas').count(),1);
 for(const device of ['desktop','tablet','mobile']){
  await page.locator('[data-device="'+device+'"]').click();
  assert.equal(await page.locator('[data-device="'+device+'"]').getAttribute('aria-pressed'),'true');
 }
 await page.locator('[data-rtab="design"]').click();
 assert.equal(await page.locator('#design').isVisible(),true);
 await page.locator('[data-rtab="content"]').click();
 assert.equal(await page.locator('#content').isVisible(),true);
 await page.locator('[data-tab="pages"]').click();
 assert.equal(await page.locator('#sidehead').innerText(),'СТОРІНКИ САЙТУ');
 await page.locator('[data-tab="blocks"]').click();
 assert.equal(await page.locator('#sidehead').innerText(),'СТРУКТУРА СТОРІНКИ');
 // Ensure the approved editor uses the real CMS bridge rather than its reference screenshot.
 const bridgeLoaded=await page.evaluate(()=>[...document.scripts].some(s=>s.src.includes('v2-cms-bridge.js')));
 assert.equal(bridgeLoaded,true,'V2 CMS bridge script must load');
 const engine=page.locator('iframe[title="CMS data engine"]');
 assert.equal(await engine.count(),1,'Hidden CMS engine must be mounted');
 const engineDocument=engine.contentFrame();
 await engineDocument.locator('#existingBlocks').waitFor({timeout:10000});
 assert.equal(await engineDocument.locator('#siteFrame').count(),1,'Native CMS preview must exist');
 // Anonymous CI must not accidentally claim that a draft was saved or published.
 assert.equal(await page.locator('#save').count(),1);
 assert.equal(await page.locator('#publish').count(),1);
 const critical=errors.filter(x=>/ReferenceError|SyntaxError|TypeError/.test(x));
 assert.deepEqual(critical,[],'Critical browser errors: '+critical.join('; '));
 await browser.close();
 console.log('V2 smoke test passed (unauthenticated UI only).');
})().catch(e=>{console.error(e);process.exit(1)});
