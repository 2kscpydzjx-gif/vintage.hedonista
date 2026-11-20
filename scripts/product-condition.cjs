// Business default: vintage items without an explicit new condition are used.
// Keep the browser equivalent in vh-seo-runtime.js aligned (merchant tests cover both).
module.exports=value=>/^(?:new|нов(?:ий|а|е|і))(?:\s|[.,!]|$)/iu.test(String(value??'').trim())?'new':'used';
