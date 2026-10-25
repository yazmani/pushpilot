// Renders README screenshots (docs/screenshots) and Chrome Web Store images
// (.local/store, git-ignored) from the built
// extension using the fictional demo account in scripts/demo/data.js.
// No Pushbullet account or network access to Pushbullet is involved.
//
//   npm run build && node scripts/screenshots.mjs

import { createReadStream } from 'node:fs';
import { mkdir, readFile, stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer';

const root = fileURLToPath(new URL('..', import.meta.url));
const dist = join(root, 'dist/chrome-mv3');
const out = join(root, 'docs/screenshots');
// Store listing images stay local (git-ignored) with the listing copy.
const storeOut = join(root, '.local/store');
await mkdir(out, { recursive: true });
await mkdir(storeOut, { recursive: true });

const TYPES = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
  '.svg': 'image/svg+xml',
};
const demoScripts = '<script src="/__demo/data.js"></script><script src="/__demo/shim.js"></script>';
const logo = await readFile(join(root, 'src/assets/logo.svg'), 'utf8');

const FONT =
  '<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@500;700;800&display=swap" rel="stylesheet">';
const BAND = 'linear-gradient(135deg, #0c8446 0%, #17a85b 60%, #22bd6a 100%)';

function popupFrame(view, theme, scale = 1, extra = '') {
  return `<iframe src="/popup.html?tab=${view}&theme=${theme}${extra}" width="400" height="588" style="border:0;border-radius:22px;background:#fff;box-shadow:0 30px 80px -20px rgba(0,30,15,.55),0 0 0 1px rgba(255,255,255,.18);transform:scale(${scale});transform-origin:top left"></iframe>`;
}

function storePage({ view, theme, headline, sub, extra = '' }) {
  return `<!doctype html><html><head><meta charset="utf-8">${FONT}<style>
    body{margin:0;width:1280px;height:800px;overflow:hidden;font-family:'Plus Jakarta Sans',sans-serif;background:${BAND};color:#fff;display:flex;align-items:center}
    .copy{width:560px;padding-left:96px}
    .mark{display:flex;align-items:center;gap:14px;font-weight:800;font-size:22px;letter-spacing:-.01em;opacity:.95}
    .mark svg{width:44px;height:44px;border-radius:12px;box-shadow:0 0 0 2px rgba(255,255,255,.35)}
    h1{font-size:54px;line-height:1.05;letter-spacing:-.035em;margin:36px 0 18px;font-weight:800}
    p{font-size:21px;line-height:1.5;margin:0;opacity:.88;max-width:440px}
    .shot{margin-left:auto;margin-right:110px;width:${400 * 1.2}px;height:${588 * 1.2}px}
  </style></head><body>
    <div class="copy"><div class="mark">${logo}Pushpilot</div><h1>${headline}</h1><p>${sub}</p></div>
    <div class="shot">${popupFrame(view, theme, 1.2, extra)}</div>
  </body></html>`;
}

function heroPage(transparent = false) {
  return `<!doctype html><html><head><meta charset="utf-8">${FONT}<style>
    body{margin:0;width:1600px;height:860px;overflow:hidden;background:${transparent ? 'transparent' : BAND};display:flex;align-items:center;justify-content:center;gap:48px}
    .f{width:400px;height:588px}.f.mid{transform:translateY(-24px)}
  </style></head><body>
    <div class="f">${popupFrame('feed', 'light')}</div>
    <div class="f mid">${popupFrame('send', 'light')}</div>
    <div class="f">${popupFrame('phone', 'dark')}</div>
  </body></html>`;
}

function promoPage(width, height) {
  if (width < 600) {
    return `<!doctype html><html><head><meta charset="utf-8">${FONT}<style>
      body{margin:0;width:${width}px;height:${height}px;overflow:hidden;font-family:'Plus Jakarta Sans',sans-serif;background:${BAND};color:#fff;display:flex;align-items:center;justify-content:center;text-align:center}
      .logo svg{width:84px;height:84px;border-radius:22px;box-shadow:0 0 0 3px rgba(255,255,255,.3),0 18px 40px -12px rgba(0,30,15,.5)}
      h1{font-size:40px;letter-spacing:-.035em;margin:16px 0 4px;font-weight:800}
      p{font-size:17px;margin:0;opacity:.9;font-weight:500}
    </style></head><body><div><div class="logo">${logo}</div><h1>Pushpilot</h1><p>for Pushbullet</p></div></body></html>`;
  }
  // Marquee: fixed columns so the copy and the screenshots never overlap.
  return `<!doctype html><html><head><meta charset="utf-8">${FONT}<style>
    body{margin:0;width:${width}px;height:${height}px;overflow:hidden;position:relative;font-family:'Plus Jakarta Sans',sans-serif;background:${BAND};color:#fff}
    .copy{position:absolute;left:96px;top:0;bottom:0;width:520px;display:flex;flex-direction:column;justify-content:center}
    .logo svg{width:96px;height:96px;border-radius:26px;box-shadow:0 0 0 3px rgba(255,255,255,.3),0 20px 50px -12px rgba(0,30,15,.5)}
    h1{font-size:64px;letter-spacing:-.035em;margin:26px 0 10px;font-weight:800;line-height:1}
    p{font-size:24px;line-height:1.4;margin:0;opacity:.9;font-weight:500}
    .shots{position:absolute;left:690px;top:64px;display:flex;gap:22px}
    .shots .f{width:${400 * 0.82}px;height:${588 * 0.82}px}
  </style></head><body>
    <div class="copy"><div class="logo">${logo}</div><h1>Pushpilot</h1><p>Your pushes, cleared for takeoff.<br>A modern client for Pushbullet.</p></div>
    <div class="shots"><div class="f">${popupFrame('send', 'light', 0.82)}</div><div class="f">${popupFrame('phone', 'dark', 0.82)}</div></div>
  </body></html>`;
}

// Social preview (Open Graph) for the website: 1200×630, public, lives with the README images.
function ogPage() {
  return `<!doctype html><html><head><meta charset="utf-8">${FONT}<style>
    body{margin:0;width:1200px;height:630px;overflow:hidden;position:relative;font-family:'Plus Jakarta Sans',sans-serif;background:${BAND};color:#fff}
    .copy{position:absolute;left:80px;top:0;bottom:0;width:560px;display:flex;flex-direction:column;justify-content:center}
    .mark{display:flex;align-items:center;gap:14px;font-weight:800;font-size:26px;letter-spacing:-.01em}
    .mark svg{width:56px;height:56px;border-radius:15px;box-shadow:0 0 0 3px rgba(255,255,255,.3)}
    h1{font-size:62px;line-height:1.02;letter-spacing:-.04em;margin:30px 0 16px;font-weight:800}
    p{font-size:23px;line-height:1.45;margin:0;opacity:.9;font-weight:500}
    .shot{position:absolute;left:740px;top:56px;width:${400 * 0.95}px;height:${588 * 0.95}px}
  </style></head><body>
    <div class="copy"><div class="mark">${logo}Pushpilot</div><h1>Send this page to your phone.</h1><p>A free, open-source Pushbullet client for Chrome, Brave and Edge.</p></div>
    <div class="shot">${popupFrame('send', 'light', 0.95)}</div>
  </body></html>`;
}

const STORE = [
  {
    view: 'send',
    theme: 'light',
    headline: 'Send this page to your phone.',
    sub: 'Open Pushpilot on any page and it’s ready to go, even at the minute of the video you’re watching.',
  },
  {
    view: 'feed',
    theme: 'light',
    headline: 'Everything you pushed, in one place.',
    sub: 'Links, notes, files and photos from all your devices and friends, with rich previews.',
  },
  {
    view: 'phone',
    theme: 'dark',
    headline: 'Your phone’s notifications, on your desktop.',
    sub: 'Copy sign-in codes in one click. Reply to messages without picking up your phone.',
  },
  {
    view: 'sms',
    theme: 'light',
    headline: 'Text from your browser.',
    sub: 'Read and answer SMS from your Android phone, right next to your work.',
    extra: '&thread=1',
  },
  {
    view: 'send',
    theme: 'dark',
    headline: 'Built for Manifest V3.',
    sub: 'Auto-open links, notification sounds, end-to-end encryption and a side panel. Works in Chrome, Brave and Edge.',
  },
];

const pages = {
  '/__hero.html': () => heroPage(),
  // Same composition without the backdrop, for the website's hero band (light and dark).
  '/__hero-clear.html': () => heroPage(true),
  '/__og.html': ogPage,
  '/__promo-small.html': () => promoPage(440, 280),
  '/__promo-marquee.html': () => promoPage(1400, 560),
  ...Object.fromEntries(STORE.map((s, i) => [`/__store-${i + 1}.html`, () => storePage(s)])),
};

const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname.startsWith('/_favicon/')) {
    const host = new URL(url.searchParams.get('pageUrl') || 'https://example.com').hostname;
    res.writeHead(302, { Location: `https://www.google.com/s2/favicons?domain=${host}&sz=64` });
    return res.end();
  }
  if (pages[url.pathname]) {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end(pages[url.pathname]());
  }
  if (url.pathname.startsWith('/__demo/')) {
    res.writeHead(200, { 'Content-Type': 'text/javascript' });
    return createReadStream(join(root, 'scripts/demo', url.pathname.slice(8))).pipe(res);
  }
  const file = join(dist, url.pathname === '/' ? 'popup.html' : url.pathname);
  try {
    await stat(file);
  } catch {
    res.writeHead(404);
    return res.end();
  }
  if (extname(file) === '.html') {
    const html = (await readFile(file, 'utf8')).replace('<head>', `<head>${demoScripts}`);
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end(html);
  }
  res.writeHead(200, { 'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream' });
  createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}`;

const browser = await puppeteer.launch({ headless: true });
const settle = (ms = 1800) => new Promise((r) => setTimeout(r, ms));

async function openThread(frameOrPage) {
  await frameOrPage.waitForFunction(() => [...document.querySelectorAll('button')].some((b) => b.textContent?.includes('Mom')), {
    timeout: 8000,
  });
  await frameOrPage.evaluate(() => [...document.querySelectorAll('button')].find((b) => b.textContent?.includes('Mom')).click());
}

try {
  // Popup views for the README, light and dark.
  const page = await browser.newPage();
  await page.setViewport({ width: 400, height: 588, deviceScaleFactor: 2 });
  for (const theme of ['light', 'dark']) {
    for (const view of ['send', 'feed', 'phone', 'sms']) {
      await page.goto(`${base}/popup.html?tab=${view}&theme=${theme}`, { waitUntil: 'networkidle2' });
      await settle();
      await page.screenshot({ path: join(out, `${view}-${theme}.png`) });
    }
    await page.goto(`${base}/popup.html?tab=sms&theme=${theme}`, { waitUntil: 'networkidle2' });
    await openThread(page);
    await settle(1200);
    await page.screenshot({ path: join(out, `sms-thread-${theme}.png`) });
  }

  const settings = await browser.newPage();
  await settings.setViewport({ width: 1100, height: 820, deviceScaleFactor: 2 });
  await settings.goto(`${base}/options.html?theme=light`, { waitUntil: 'networkidle2' });
  await settle();
  await settings.evaluate(() => document.getElementById('receiving')?.scrollIntoView());
  await settle(400);
  await settings.screenshot({ path: join(out, 'settings-light.png') });

  // Composite hero for the top of the README.
  const hero = await browser.newPage();
  await hero.setViewport({ width: 1600, height: 860, deviceScaleFactor: 1.5 });
  await hero.goto(`${base}/__hero.html`, { waitUntil: 'networkidle2' });
  await settle(2500);
  await hero.screenshot({ path: join(out, 'hero.png') });
  await hero.goto(`${base}/__hero-clear.html`, { waitUntil: 'networkidle2' });
  await settle(2500);
  await hero.screenshot({ path: join(out, 'hero-clear.png'), omitBackground: true });

  const og = await browser.newPage();
  await og.setViewport({ width: 1200, height: 630, deviceScaleFactor: 1 });
  await og.goto(`${base}/__og.html`, { waitUntil: 'networkidle2' });
  await settle(2500);
  await og.screenshot({ path: join(out, 'og.png') });

  // Chrome Web Store: 1280×800 screenshots and promo tiles at exact sizes.
  const store = await browser.newPage();
  for (let i = 0; i < STORE.length; i++) {
    await store.setViewport({ width: 1280, height: 800, deviceScaleFactor: 1 });
    await store.goto(`${base}/__store-${i + 1}.html`, { waitUntil: 'networkidle2' });
    await settle(2200);
    if (STORE[i].extra?.includes('thread')) {
      const frame = store.frames().find((f) => f.url().includes('popup.html'));
      await openThread(frame);
      await settle(1200);
    }
    await store.screenshot({ path: join(storeOut, `screenshot-${i + 1}.png`) });
  }
  for (const [name, w, h] of [
    ['promo-small', 440, 280],
    ['promo-marquee', 1400, 560],
  ]) {
    await store.setViewport({ width: w, height: h, deviceScaleFactor: 1 });
    await store.goto(`${base}/__${name}.html`, { waitUntil: 'networkidle2' });
    await settle(2200);
    await store.screenshot({ path: join(storeOut, `${name}.png`) });
  }
  console.log(`Screenshots in docs/screenshots, store images in .local/store`);
} finally {
  await browser.close();
  server.close();
}
