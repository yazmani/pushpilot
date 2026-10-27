// End-to-end checks against an Android phone or emulator running Pushbullet
// (SMS sync and notification mirroring on): SMS threads load, an incoming text
// raises a notification, a text sent from Pushpilot is delivered, a phone
// notification is mirrored with its code, and dismissing it clears it on the
// phone. See docs/TESTING.md for the emulator setup.
//
//   PHONE=<device iden> npm run build && node --env-file=.env scripts/phone-e2e.mjs
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer';
const ADB = process.env.ADB || 'adb';
const adb = (...a) => execFileSync(ADB, a, { encoding: 'utf8' }).trim();
const ext = fileURLToPath(new URL('../dist/chrome-mv3', import.meta.url));
const T = process.env.ACCESS_TOKEN;
const EMU = process.env.PHONE;
if (!T || !EMU) throw new Error('Set ACCESS_TOKEN in .env and PHONE to the phone’s Pushbullet device iden.');
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await puppeteer.launch({
  headless: true,
  pipe: true,
  enableExtensions: [ext],
  defaultViewport: null,
  protocolTimeout: 60000,
});
let self;
let failures = 0;
const step = async (name, fn) => {
  try {
    console.log('ok  ', name, (await fn()) ?? '');
  } catch (e) {
    failures++;
    console.log('FAIL', name, e.message);
  }
};
try {
  const sw = await browser.waitForTarget((t) => t.type() === 'service_worker' && t.url().endsWith('/background.js'));
  const extId = new URL(sw.url()).host;
  const app = await browser.newPage();
  await app.setViewport({ width: 400, height: 600, deviceScaleFactor: 2 });
  await app.goto(`chrome-extension://${extId}/popup.html`);
  const rpc = (m) => app.evaluate((x) => chrome.runtime.sendMessage(x), m);
  const storage = (k) => app.evaluate((x) => chrome.storage.local.get(x), k);
  const r = await rpc({ rpc: 'auth.token', token: T });
  if (!r?.ok) throw new Error(r?.error);
  for (let i = 0; i < 20; i++) {
    if ((await storage('connection')).connection === 'live') break;
    await wait(500);
  }
  ({ selfDeviceIden: self } = await storage('selfDeviceIden'));
  await step('phone is listed', async () => {
    const { devices } = await storage('devices');
    const d = devices.find((x) => x.iden === EMU);
    return d ? `${d.nickname} has_sms=${d.has_sms}` : 'MISSING';
  });
  await step('SMS threads load', async () => {
    const res = await rpc({ rpc: 'sms.threads', device: EMU });
    if (!res?.ok) throw new Error(res?.error);
    const { smsThreads } = await storage('smsThreads');
    return (smsThreads[EMU] ?? []).map((t) => `${t.recipients[0].address}: ${t.latest?.body}`).join(' | ');
  });
  await step('incoming text raises a notification', async () => {
    const before = Object.keys(await app.evaluate(() => chrome.notifications.getAll()));
    adb('emu', 'sms', 'send', '5551234', 'Incoming test ' + Date.now());
    for (let i = 0; i < 40; i++) {
      await wait(500);
      const now = Object.keys(await app.evaluate(() => chrome.notifications.getAll()));
      const fresh = now.filter((k) => !before.includes(k) && k.startsWith('sms:'));
      if (fresh.length) return fresh[0];
    }
    throw new Error('no sms notification');
  });
  await step('send a text from Pushpilot', async () => {
    const body = 'Reply from Pushpilot ' + Date.now();
    const res = await rpc({ rpc: 'sms.send', device: EMU, addresses: ['5551234'], message: body });
    if (!res?.ok) throw new Error(res?.error);
    for (let i = 0; i < 30; i++) {
      await wait(1000);
      const sent = adb('shell', 'content', 'query', '--uri', 'content://sms/sent', '--projection', 'body');
      if (sent.includes(body)) return 'delivered to the phone';
    }
    throw new Error('not in the phone’s sent box');
  });
  await step('phone notification is mirrored', async () => {
    adb('shell', `cmd notification post -S bigtext -t 'Northwind Bank' pp_test 'Your sign-in code is 482913'`);
    for (let i = 0; i < 40; i++) {
      await wait(500);
      const { mirrors } = await storage('mirrors');
      const m = (mirrors ?? []).find((x) => /482913/.test(x.body ?? ''));
      if (m) return `${m.application_name || m.package_name}: "${m.title}" code=${m.code ?? '-'}`;
    }
    throw new Error('not mirrored (is mirroring on, and the Shell app allowed, in Pushbullet?)');
  });
  await step('dismiss from Pushpilot clears it on the phone', async () => {
    const { mirrors } = await storage('mirrors');
    const m = mirrors.find((x) => /482913/.test(x.body ?? '') && !x.dismissed);
    const res = await rpc({ rpc: 'mirror.dismiss', id: m.id });
    if (!res?.ok) throw new Error(res?.error);
    for (let i = 0; i < 20; i++) {
      await wait(500);
      if (!adb('shell', 'dumpsys', 'notification', '--noredact').includes('pp_test')) return 'gone from the phone';
    }
    throw new Error('still on the phone');
  });
} finally {
  if (self) await fetch(`https://api.pushbullet.com/v2/devices/${self}`, { method: 'DELETE', headers: { 'Access-Token': T } });
  await browser.close();
}
console.log(failures ? `\n${failures} step(s) failed` : '\nAll steps passed');
process.exit(failures ? 1 : 0);
