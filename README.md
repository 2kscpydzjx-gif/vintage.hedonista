# Legacy GitHub Pages redirects

This branch contains only redirects from https://2kscpydzjx-gif.github.io/vintage.hedonista/ to https://vintazhka.com.ua/.

GitHub Pages must publish this branch from `/ (root)`. Cloudflare production continues to publish `main`. Do not merge this branch into `main`, and leave the GitHub Pages custom-domain field empty.

Pages use immediate HTML meta refresh plus a preceding JavaScript `location.replace` that preserves query parameters and fragments. They are client redirects, not HTTP 301 responses. Each known page has a canonical link to its matching new URL. Old `.html` and `/index.html` paths map to the clean Cloudflare addresses. A custom 404 page applies the same mapping to unknown paths; GitHub still returns HTTP 404 for those unknown paths.

The branch has no storefront, CMS, Supabase configuration, credentials, database operations or email operations. `routes.json` records the public HTML filenames from the source commit. Roll back the Pages source to `main / (root)` if needed.

Regenerate root redirect pages with `node scripts/build.mjs --root`, verify with `npm test`, and use `npm run build` to create a `dist` artifact for any automatic preview builds.
