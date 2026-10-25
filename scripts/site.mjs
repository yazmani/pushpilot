// Builds the GitHub Pages site into _site/: the landing page from site/, the
// privacy policy rendered from PRIVACY.md (one source of truth), plus icons
// and README screenshots. Deployed by .github/workflows/pages.yml.
//
//   node scripts/site.mjs

import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { marked } from 'marked';

const root = fileURLToPath(new URL('..', import.meta.url));
const out = join(root, '_site');
const BASE = 'https://yazmani.github.io/pushpilot/';

await rm(out, { recursive: true, force: true });
await mkdir(join(out, 'screenshots'), { recursive: true });

await cp(join(root, 'site'), out, { recursive: true });
await cp(join(root, 'src/public/icon'), join(out, 'icons'), { recursive: true });
await cp(join(root, 'src/assets/logo.svg'), join(out, 'logo.svg'));
for (const name of ['hero-clear', 'send-light', 'feed-light', 'phone-dark', 'sms-thread-light']) {
  await cp(join(root, `docs/screenshots/${name}.png`), join(out, `screenshots/${name}.png`));
}
await cp(join(root, 'docs/screenshots/og.png'), join(out, 'og.png'));

function page({ title, description, path, body }) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title}</title>
    <meta name="description" content="${description}" />
    <link rel="canonical" href="${BASE}${path}" />
    <meta name="theme-color" content="#16a35a" />
    <link rel="icon" type="image/png" sizes="32x32" href="icons/32.png" />
    <meta property="og:title" content="${title}" />
    <meta property="og:description" content="${description}" />
    <meta property="og:image" content="${BASE}og.png" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
    <link rel="stylesheet" href="styles.css" />
  </head>
  <body>
    <header class="band slim">
      <nav class="nav wrap" aria-label="Main">
        <a class="brand" href="./"><img src="logo.svg" alt="" width="32" height="32" />Pushpilot</a>
        <div class="nav-links">
          <a href="./#features">Features</a>
          <a href="https://github.com/yazmani/pushpilot">GitHub</a>
          <a class="btn btn-light btn-sm" href="./#install">Install</a>
        </div>
      </nav>
    </header>
    <main class="doc wrap">
${body}
    </main>
    <footer class="footer">
      <div class="wrap footer-inner">
        <p><img src="logo.svg" alt="" width="20" height="20" /> Pushpilot. Not affiliated with, endorsed by, or sponsored by Pushbullet.</p>
        <nav aria-label="Footer"><a href="./">Home</a><a href="https://github.com/yazmani/pushpilot">GitHub</a></nav>
      </div>
    </footer>
  </body>
</html>
`;
}

const privacy = marked.parse(await readFile(join(root, 'PRIVACY.md'), 'utf8'));
await writeFile(
  join(out, 'privacy.html'),
  page({
    title: 'Privacy policy · Pushpilot',
    description: 'What Pushpilot stores, what it sends and to whom. No servers, no analytics, no tracking.',
    path: 'privacy.html',
    body: privacy,
  }),
);

await writeFile(
  join(out, '404.html'),
  page({
    title: 'Page not found · Pushpilot',
    description: 'This page does not exist.',
    path: '404.html',
    body: '<h1>That page flew off.</h1><p>It doesn’t exist, or it moved. <a href="./">Go to the homepage</a>.</p>',
  }),
);

await writeFile(join(out, 'robots.txt'), `User-agent: *\nAllow: /\nSitemap: ${BASE}sitemap.xml\n`);
const today = new Date().toISOString().slice(0, 10);
await writeFile(
  join(out, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>${BASE}</loc><lastmod>${today}</lastmod></url>
  <url><loc>${BASE}privacy.html</loc><lastmod>${today}</lastmod></url>
</urlset>
`,
);
// GitHub Pages: serve files as-is (no Jekyll).
await writeFile(join(out, '.nojekyll'), '');
console.log('Site built in _site/');
