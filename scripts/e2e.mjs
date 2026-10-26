// End-to-end run of the built extension in Chrome for Testing, signed in with
// ACCESS_TOKEN from .env. Exercises sign-in, sync, the stream, and sending
// (to this browser's own Pushbullet device, then deleted), and saves
// screenshots of each view to e2e-shots/.
//
//   npm run build && node --env-file=.env scripts/e2e.mjs [--headful]
//   BROWSER_PATH="/Applications/Brave Browser.app/Contents/MacOS/Brave Browser" … to test in Brave

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer';

const token = process.env.ACCESS_TOKEN;
if (!token) throw new Error('Set ACCESS_TOKEN in .env first.');
const extPath = fileURLToPath(new URL('../dist/chrome-mv3', import.meta.url));
const shots = fileURLToPath(new URL('../e2e-shots/', import.meta.url));
await mkdir(shots, { recursive: true });

const browser = await puppeteer.launch({
  headless: !process.argv.includes('--headful'),
  pipe: true,
  enableExtensions: [extPath],
  defaultViewport: null,
  executablePath: process.env.BROWSER_PATH || undefined,
});

let failures = 0;
const step = async (name, fn) => {
  try {
    const out = await fn();
    console.log(`ok   ${name}${out ? `  ${out}` : ''}`);
    return out;
  } catch (err) {
    failures++;
    console.log(`FAIL ${name}  ${err?.message ?? err}`);
  }
};

try {
  const sw = await browser.waitForTarget((t) => t.type() === 'service_worker' && t.url().endsWith('/background.js'));
  const extId = new URL(sw.url()).host;
  const worker = await sw.worker();
  worker.on('console', (m) => console.log(`  [sw ${m.type()}] ${m.text()}`));

  // A real page so "send the current page" has something to pick up.
  const site = await browser.newPage();
  await site.goto('https://example.com/', { waitUntil: 'domcontentloaded' });

  const app = await browser.newPage();
  await app.setViewport({ width: 400, height: 584, deviceScaleFactor: 2 });
  const rpc = (msg) => app.evaluate((m) => chrome.runtime.sendMessage(m), msg);
  const storage = (keys) => app.evaluate((k) => chrome.storage.local.get(k), keys);

  await app.goto(`chrome-extension://${extId}/popup.html`);
  await app.screenshot({ path: `${shots}signin.png` });

  await step('OAuth redirect uses the store extension ID', async () => {
    const redirect = await app.evaluate(() => chrome.identity.getRedirectURL());
    if (redirect !== 'https://pdiijobemepbckkbdeacfngodbeddmcf.chromiumapp.org/') throw new Error(redirect);
    return redirect;
  });

  await step('sign in with token', async () => {
    const r = await rpc({ rpc: 'auth.token', token });
    if (!r?.ok) throw new Error(r?.error ?? 'no reply');
    const { me, selfDeviceIden, devices } = await storage(['me', 'selfDeviceIden', 'devices']);
    return `${me.email}, self=${selfDeviceIden}, ${devices.length} devices`;
  });

  await step('stream goes live', async () => {
    for (let i = 0; i < 40; i++) {
      const { connection } = await storage(['connection']);
      if (connection === 'live') return 'live';
      await new Promise((r) => setTimeout(r, 250));
    }
    throw new Error('still not live after 10s');
  });

  await step('history synced', async () => {
    const { pushes, chats } = await storage(['pushes', 'chats']);
    return `${pushes.length} pushes, ${chats.length} people`;
  });

  const { selfDeviceIden } = await storage(['selfDeviceIden']);
  let sentIden;
  await step('send a note via RPC (to this browser)', async () => {
    const r = await rpc({
      rpc: 'push.send',
      push: { type: 'note', title: 'Pushpilot e2e', body: 'Automated check; deleted right away.' },
      targets: [`device:${selfDeviceIden}`],
    });
    if (!r?.ok) throw new Error(r?.error ?? 'no reply');
    const { pushes } = await storage(['pushes']);
    sentIden = pushes.find((p) => p.title === 'Pushpilot e2e')?.iden;
    if (!sentIden) throw new Error('sent push not recorded locally');
    return sentIden;
  });

  // What the global ⌘⇧9 shortcut runs: read the clipboard in the offscreen
  // page and push it to the default target (this browser here, not the phone).
  await step('push the clipboard (global shortcut)', async () => {
    const marker = `https://example.org/?pushpilot-clip=${Date.now()}`;
    await app.bringToFront();
    await app.evaluate(async (iden) => {
      const { settings } = await chrome.storage.local.get('settings');
      await chrome.storage.local.set({ settings: { ...settings, defaultTarget: `device:${iden}` } });
    }, selfDeviceIden);
    await app.evaluate((text) => navigator.clipboard.writeText(text), marker);
    const r = await rpc({ rpc: 'clip.push' });
    if (!r?.ok) throw new Error(r?.error ?? 'no reply');
    const { pushes } = await storage(['pushes']);
    const push = pushes.find((p) => p.url === marker);
    if (!push) throw new Error('clipboard was not pushed');
    if (push.type !== 'link' || push.target_device_iden !== selfDeviceIden)
      throw new Error(`${push.type} → ${push.target_device_iden}`);
    await rpc({ rpc: 'push.delete', iden: push.iden });
    await app.evaluate(async () => {
      const { settings } = await chrome.storage.local.get('settings');
      await chrome.storage.local.set({ settings: { ...settings, defaultTarget: 'all' } });
    });
    return 'pushed as a link to this browser';
  });

  // Open the UI as Pushpilot's pop-out window over the example.com tab, so the
  // composer picks up "the page you're on" exactly as the toolbar popup does.
  await site.bringToFront();
  await app.evaluate(() =>
    chrome.windows.create({ url: chrome.runtime.getURL('/popup.html?window=1'), type: 'popup', width: 400, height: 640 }),
  );
  const ui = await (await browser.waitForTarget((t) => t.url().includes('popup.html?window=1'))).page();
  await ui.setViewport({ width: 400, height: 640, deviceScaleFactor: 2 });
  const setTheme = (theme) =>
    ui.evaluate(
      (t) =>
        chrome.storage.local
          .get('settings')
          .then(({ settings }) => chrome.storage.local.set({ settings: { ...settings, theme: t } })),
      theme,
    );
  const tabTo = async (view) => {
    for (const t of await ui.$$('[role=tab]')) if ((await t.evaluate((e) => e.textContent)).startsWith(view)) await t.click();
    await new Promise((r) => setTimeout(r, 900));
  };

  await step('popup prefills the current page', async () => {
    await ui.waitForSelector('button[title="Edit link"]', { timeout: 8000 });
    return ui.evaluate(() => document.querySelector('button[title="Edit link"]').textContent);
  });

  await step('send through the popup UI (to this browser)', async () => {
    await ui.evaluate(
      (iden) =>
        chrome.storage.local
          .get('settings')
          .then(({ settings }) => chrome.storage.local.set({ settings: { ...settings, defaultTarget: `device:${iden}` } })),
      selfDeviceIden,
    );
    await ui.reload();
    await ui.waitForFunction(
      () => [...document.querySelectorAll('button')].some((b) => b.textContent?.includes('Send to This browser')),
      { timeout: 8000 },
    );
    for (const theme of ['light', 'dark']) {
      await setTheme(theme);
      await new Promise((r) => setTimeout(r, 300));
      await ui.screenshot({ path: `${shots}send-${theme}.png` });
    }
    await ui.evaluate(() => {
      const ta = document.querySelector('textarea[aria-label="Message"]');
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(ta, 'Pushpilot e2e UI');
      ta.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await ui.evaluate(() =>
      [...document.querySelectorAll('button')].find((b) => b.textContent?.includes('Send to This browser')).click(),
    );
    const toast = await ui.waitForSelector('[role=status]', { timeout: 8000 }).then((h) => h.evaluate((e) => e.textContent));
    if (!toast?.includes('Sent')) throw new Error(`toast: ${toast}`);
    return toast;
  });

  await step('send a file through the popup UI (upload + push)', async () => {
    const file = join(tmpdir(), 'pushpilot-e2e.txt');
    await writeFile(file, `Pushpilot end-to-end upload check ${new Date().toISOString()}\n`);
    await ui.reload();
    await ui.waitForFunction(
      () => [...document.querySelectorAll('button')].some((b) => b.textContent?.includes('Send to This browser')),
      {
        timeout: 8000,
      },
    );
    const input = await ui.$('input[type=file]');
    await input.uploadFile(file);
    await ui.waitForFunction(() => document.body.innerText.includes('pushpilot-e2e.txt'), { timeout: 5000 });
    await ui.evaluate(() =>
      [...document.querySelectorAll('button')].find((b) => b.textContent?.includes('Send to This browser')).click(),
    );
    await ui.waitForFunction(() => document.querySelector('[role=status]')?.textContent?.includes('Sent'), { timeout: 20000 });
    const { pushes } = await storage(['pushes']);
    const sent = pushes.find((p) => p.file_name === 'pushpilot-e2e.txt');
    if (!sent?.file_url) throw new Error('file push not recorded');
    const body = await fetch(sent.file_url).then((r) => r.text());
    if (!body.startsWith('Pushpilot end-to-end upload check')) throw new Error('uploaded file content mismatch');
    return sent.file_url.replace(/^(https:\/\/[^/]+\/).*/, '$1…');
  });

  await step('desktop notification and sound (offscreen document)', async () => {
    const r = await rpc({ rpc: 'notify.test' });
    if (!r?.ok) throw new Error(r?.error);
    const ids = await app.evaluate(() => chrome.notifications.getAll().then((all) => Object.keys(all)));
    if (!ids.some((id) => id.startsWith('info:test'))) throw new Error('no test notification');
    const s = await rpc({ rpc: 'sound.preview', choice: 'chime' });
    if (!s?.ok) throw new Error(s?.error);
    const offscreen = await app.evaluate(() =>
      chrome.runtime.getContexts({ contextTypes: ['OFFSCREEN_DOCUMENT'] }).then((c) => c.length),
    );
    if (!offscreen) throw new Error('offscreen document not created');
    return 'notification shown, offscreen audio running';
  });

  await step('end-to-end encryption password', async () => {
    const on = await rpc({ rpc: 'e2e.set', password: 'pushpilot-e2e-password' });
    if (!on?.ok) throw new Error(on?.error);
    const { e2eKey } = await storage(['e2eKey']);
    if (!e2eKey || atob(e2eKey).length !== 32) throw new Error('no 256-bit key stored');
    await rpc({ rpc: 'e2e.set', password: null });
    const after = await storage(['e2eKey']);
    if (after.e2eKey) throw new Error('key not cleared');
    return 'key derived and cleared';
  });

  // Your phone may not be mirroring right now; give the Phone view something to
  // draw. This only touches the throwaway test profile's local storage.
  await ui.evaluate(() =>
    chrome.storage.local.get('mirrors').then(({ mirrors }) => {
      if (mirrors?.length) return;
      const now = Date.now() / 1000;
      return chrome.storage.local.set({
        mirrors: [
          {
            id: 'demo-1',
            receivedAt: now - 60,
            created: now - 60,
            title: 'Northwind Bank',
            body: 'Your sign-in code is 482913. It expires in 10 minutes.',
            application_name: 'Messages',
            package_name: 'demo.messages',
            notification_id: '1',
            source_user_iden: 'demo',
            code: '482913',
            dismissible: true,
          },
          {
            id: 'demo-2',
            receivedAt: now - 400,
            created: now - 400,
            title: 'Omar',
            body: 'Running 10 min late, grab me a coffee',
            application_name: 'WhatsApp',
            package_name: 'demo.whatsapp',
            notification_id: '2',
            source_user_iden: 'demo',
            conversation_iden: 'omar',
            dismissible: true,
            actions: [{ label: 'Mark as read', trigger_key: 'read' }],
          },
          {
            id: 'demo-3',
            receivedAt: now - 5000,
            created: now - 5000,
            title: 'Package delivered',
            body: 'Your parcel was left at the front door.',
            application_name: 'Amazon',
            package_name: 'demo.amazon',
            notification_id: '3',
            source_user_iden: 'demo',
            dismissed: true,
          },
        ],
      });
    }),
  );

  for (const view of ['Feed', 'Phone', 'SMS']) {
    await step(`render ${view}`, async () => {
      await tabTo(view);
      for (const theme of ['dark', 'light']) {
        await setTheme(theme);
        await new Promise((r) => setTimeout(r, view === 'Phone' ? 300 : 2500));
        await ui.screenshot({ path: `${shots}${view.toLowerCase()}-${theme}.png` });
      }
      return ui.evaluate(() => document.querySelector('main')?.innerText.slice(0, 90).replace(/\n/g, ' | '));
    });
  }

  // A push from another of your devices, addressed to this browser: it should
  // raise a notification and, with auto-open on (the default), open the link.
  await step('receive a push from another device (notify + auto-open)', async () => {
    const api = (path, init = {}) =>
      fetch(`https://api.pushbullet.com${path}`, {
        method: init.method ?? (init.body ? 'POST' : 'GET'),
        headers: { 'Access-Token': token, 'Content-Type': 'application/json' },
        body: init.body ? JSON.stringify(init.body) : undefined,
      }).then((r) => r.json());
    const { devices } = await storage(['devices']);
    const other = devices.find((d) => d.iden !== selfDeviceIden && d.active);
    const marker = `https://example.org/?pushpilot-e2e=${Date.now()}`;
    const push = await api('/v2/pushes', {
      body: {
        type: 'link',
        title: 'Pushpilot e2e incoming',
        url: marker,
        device_iden: selfDeviceIden,
        source_device_iden: other.iden,
      },
    });
    if (!push.iden) throw new Error(JSON.stringify(push));
    try {
      let opened = false;
      let notified = false;
      for (let i = 0; i < 40 && !(opened && notified); i++) {
        await new Promise((r) => setTimeout(r, 250));
        opened = (await browser.pages()).some((pg) => pg.url().startsWith(marker));
        notified = await app.evaluate((iden) => chrome.notifications.getAll().then((all) => `push:${iden}` in all), push.iden);
      }
      if (!notified) throw new Error('no notification');
      if (!opened) throw new Error('link was not auto-opened');
      return `from ${other.nickname}: notified and opened`;
    } finally {
      await api(`/v2/pushes/${push.iden}`, { method: 'DELETE' });
      for (const pg of await browser.pages()) if (pg.url().startsWith(marker)) await pg.close();
    }
  });

  // Images and other files open too (on by default).
  await step('receive an image (auto-open)', async () => {
    const headers = { 'Access-Token': token, 'Content-Type': 'application/json' };
    const ticket = await fetch('https://api.pushbullet.com/v2/upload-request', {
      method: 'POST',
      headers,
      body: JSON.stringify({ file_name: 'pushpilot-e2e.png' }),
    }).then((r) => r.json());
    const form = new FormData();
    form.append('file', new Blob([await readFile(new URL('../src/public/icon/32.png', import.meta.url))]), 'pushpilot-e2e.png');
    const up = await fetch(ticket.upload_url, { method: 'POST', body: form });
    if (!up.ok) throw new Error(`upload ${up.status}`);
    const push = await fetch('https://api.pushbullet.com/v2/pushes', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        type: 'file',
        file_name: ticket.file_name,
        file_type: ticket.file_type,
        file_url: ticket.file_url,
        device_iden: selfDeviceIden,
      }),
    }).then((r) => r.json());
    if (!push.iden) throw new Error(JSON.stringify(push));
    try {
      let opened = false;
      for (let i = 0; i < 40 && !opened; i++) {
        await new Promise((r) => setTimeout(r, 250));
        opened = (await browser.pages()).some((pg) => pg.url() === ticket.file_url);
      }
      if (!opened) throw new Error('image was not auto-opened');
      return `opened ${ticket.file_type}`;
    } finally {
      await fetch(`https://api.pushbullet.com/v2/pushes/${push.iden}`, { method: 'DELETE', headers: { 'Access-Token': token } });
      for (const pg of await browser.pages()) if (pg.url() === ticket.file_url) await pg.close();
    }
  });

  // What the Apple shortcut and some apps send: a note holding only an address,
  // with no source device. It should open like a link.
  await step('receive an address sent as a note (auto-open)', async () => {
    const address = `example.org/?pushpilot-e2e-note=${Date.now()}`;
    const res = await fetch('https://api.pushbullet.com/v2/pushes', {
      method: 'POST',
      headers: { 'Access-Token': token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'note', body: address, device_iden: selfDeviceIden }),
    });
    const push = await res.json();
    if (!push.iden) throw new Error(JSON.stringify(push));
    try {
      let opened = false;
      for (let i = 0; i < 40 && !opened; i++) {
        await new Promise((r) => setTimeout(r, 250));
        opened = (await browser.pages()).some((pg) => pg.url().startsWith(`https://${address}`));
      }
      if (!opened) throw new Error('address note was not auto-opened');
      return `opened https://${address.split('?')[0]}`;
    } finally {
      await fetch(`https://api.pushbullet.com/v2/pushes/${push.iden}`, { method: 'DELETE', headers: { 'Access-Token': token } });
      for (const pg of await browser.pages()) if (pg.url().startsWith(`https://${address}`)) await pg.close();
    }
  });

  await step('clean up test pushes', async () => {
    const { pushes } = await storage(['pushes']);
    const mine = pushes.filter(
      (p) => p.title === 'Pushpilot e2e' || p.body === 'Pushpilot e2e UI' || p.file_name === 'pushpilot-e2e.txt',
    );
    for (const p of mine) {
      const r = await rpc({ rpc: 'push.delete', iden: p.iden });
      if (!r?.ok) throw new Error(r?.error);
    }
    return `deleted ${mine.length}`;
  });

  const options = await browser.newPage();
  await options.setViewport({ width: 1100, height: 900, deviceScaleFactor: 1 });
  await options.goto(`chrome-extension://${extId}/options.html`);
  await new Promise((r) => setTimeout(r, 800));
  await options.screenshot({ path: `${shots}options.png` });
  for (const section of ['receiving', 'notifications']) {
    await options.evaluate((id) => document.getElementById(id)?.scrollIntoView(), section);
    await new Promise((r) => setTimeout(r, 300));
    await options.screenshot({ path: `${shots}options-${section}.png` });
  }
} finally {
  // Each run's fresh profile registers its own device; remove it again.
  try {
    const pages = await browser.pages();
    const ext = pages.find((p) => p.url().startsWith('chrome-extension://'));
    const iden = ext && (await ext.evaluate(() => chrome.storage.local.get('selfDeviceIden').then((r) => r.selfDeviceIden)));
    if (iden) {
      await fetch(`https://api.pushbullet.com/v2/devices/${iden}`, { method: 'DELETE', headers: { 'Access-Token': token } });
      console.log(`     removed test device ${iden}`);
    }
  } catch (err) {
    console.log(`     could not remove test device: ${err?.message}`);
  }
  await browser.close();
}

console.log(failures ? `\n${failures} step(s) failed` : '\nAll steps passed');
process.exit(failures ? 1 : 0);
