import { browser } from 'wxt/browser';
import type { Device } from '@/core/pushbullet/types';
import * as store from '@/core/storage/store';
import { guard, requireClient } from '@/background/session';

export async function syncDevices() {
  const pb = await requireClient();
  const devices = await guard(() => pb.devices());
  await store.set({ devices: devices.filter((d) => d.active) });
  return devices;
}

export async function syncPeople() {
  const pb = await requireClient();
  const [chats, subscriptions] = await Promise.all([guard(() => pb.chats()), guard(() => pb.subscriptions()).catch(() => null)]);
  await store.set(subscriptions ? { chats, subscriptions } : { chats });
}

export async function syncMe() {
  const pb = await requireClient();
  const me = await guard(() => pb.me());
  await store.set({ me });
  return me;
}

/** "Brave on macOS", "Edge on Windows"… so each install is recognisable in device lists. */
function browserNickname(): string {
  const ua = (navigator as Navigator & { userAgentData?: { brands: { brand: string }[]; platform: string } }).userAgentData;
  const brands = ua?.brands.map((b) => b.brand) ?? [];
  const name = import.meta.env.FIREFOX
    ? 'Firefox'
    : (['Brave', 'Microsoft Edge', 'Opera', 'Vivaldi', 'Arc'].find((b) => brands.includes(b))?.replace('Microsoft ', '') ??
      ('brave' in navigator ? 'Brave' : 'Chrome'));
  const platform =
    ua?.platform || (/Mac/.test(navigator.userAgent) ? 'macOS' : /Win/.test(navigator.userAgent) ? 'Windows' : 'Linux');
  return `${name} on ${platform}`;
}

let ensuring: Promise<string> | null = null;

/**
 * A device this long without a check-in isn't running anywhere: every
 * Pushpilot refreshes its own once a day (touchSelfDevice). Matches the
 * "unused" clean-up in Settings › Devices.
 */
const ABANDONED_AFTER = 30 * 24 * 3600;

/** The Pushpilot device a fresh install may take over: same name, abandoned, newest of those. */
export function abandonedTwin(devices: Device[], nickname: string, exclude: string | null, now = Date.now() / 1000) {
  return devices
    .filter(
      (d) =>
        d.active &&
        d.manufacturer === 'Pushpilot' &&
        d.nickname === nickname &&
        d.iden !== exclude &&
        now - d.modified > ABANDONED_AFTER,
    )
    .sort((a, b) => b.modified - a.modified)[0];
}

/**
 * The existing device a fresh install should take over, if any: the one this
 * browser remembers registering (see rememberDevice), or else an abandoned twin.
 */
export function deviceToReuse(
  devices: Device[],
  { remembered, nickname, exclude }: { remembered: string | null; nickname: string; exclude: string | null },
  now = Date.now() / 1000,
) {
  const mine = devices.find((d) => d.iden === remembered && d.active && d.manufacturer === 'Pushpilot');
  return mine ?? abandonedTwin(devices, nickname, exclude, now);
}

/**
 * Where this browser notes its device, outside extension storage (which an
 * uninstall wipes): a cookie in the browser profile's own cookie jar. It sits
 * on a Pushbullet API path no request uses and is secure, HTTP-only and
 * same-site, so it's never sent anywhere; another computer or profile never
 * sees it. A reinstall, or signing out and back in, finds its device again.
 */
const MARK = { url: 'https://api.pushbullet.com/pushpilot', name: 'device' };
// Browsers cap cookie lifetimes at 400 days; the daily heartbeat renews it.
const MARK_DAYS = 395;

async function rememberedDevice(): Promise<string | null> {
  return (await browser.cookies.get(MARK).catch(() => null))?.value ?? null;
}

async function rememberDevice(iden: string) {
  await browser.cookies
    .set({
      ...MARK,
      value: iden,
      path: '/pushpilot',
      secure: true,
      httpOnly: true,
      sameSite: 'strict',
      expirationDate: Math.floor(Date.now() / 1000) + MARK_DAYS * 86_400,
    })
    .catch(() => undefined);
}

/**
 * Every install registers a Pushbullet device of its own. Sharing one (say the
 * "Chrome" device left behind by the official extension, which other clients
 * may also use) makes pushes from the other browser look like they came from
 * here, so they'd be ignored as our own.
 */
export function ensureSelfDevice(): Promise<string> {
  ensuring ??= (async () => {
    const pb = await requireClient();
    const devices = await syncDevices();
    const { selfDeviceIden: saved, selfDeviceOwned } = await store.getMany(['selfDeviceIden', 'selfDeviceOwned']);
    if (saved && selfDeviceOwned && devices.some((d) => d.iden === saved && d.active)) {
      // Installs from before the cookie note one now, so their next reinstall finds it.
      if ((await rememberedDevice()) !== saved) await rememberDevice(saved);
      return saved;
    }

    // A reinstall or new profile starts with empty storage. Take back the device
    // this browser remembers, or else an abandoned Pushpilot device of the same
    // name, rather than adding yet another "Brave on macOS". Never a recent
    // twin: it may be another computer's, and two installs sharing a device mix
    // up pushes.
    const nickname = browserNickname();
    const orphan = deviceToReuse(devices, { remembered: await rememberedDevice(), nickname, exclude: saved });
    if (orphan) {
      // Touch it, so another install opening at the same time doesn't take it too.
      await guard(() => pb.updateDevice(orphan.iden, { nickname }));
      await store.set({ selfDeviceIden: orphan.iden, selfDeviceOwned: true });
      await rememberDevice(orphan.iden);
      await syncDevices();
      return orphan.iden;
    }

    const created = await guard(() =>
      pb.createDevice({
        nickname,
        type: import.meta.env.FIREFOX ? 'firefox' : 'chrome',
        model: 'Pushpilot',
        manufacturer: 'Pushpilot',
        icon: 'browser',
      }),
    );
    await store.set({ selfDeviceIden: created.iden, selfDeviceOwned: true });
    await rememberDevice(created.iden);
    await syncDevices();
    return created.iden;
  })().finally(() => {
    ensuring = null;
  });
  return ensuring;
}

/** Any device on the account; Pushbullet shows the new name everywhere. */
export async function renameDevice(iden: string, name: string) {
  const pb = await requireClient();
  if (!name.trim()) return;
  await guard(() => pb.updateDevice(iden, { nickname: name.trim() }));
  await syncDevices();
}

/**
 * Bumps this browser's device record at most once a day, so its "last active"
 * date means something: the device clean-up in Settings goes by it, and an
 * install that stops running stands out after a month. Also renews the
 * cookie that remembers this browser's device.
 */
export async function touchSelfDevice() {
  const { selfDeviceIden, devices } = await store.getMany(['selfDeviceIden', 'devices']);
  const self = devices.find((d) => d.iden === selfDeviceIden);
  if (self) await rememberDevice(self.iden);
  if (!self || Date.now() / 1000 - self.modified < 23 * 3600) return;
  const pb = await requireClient();
  await guard(() => pb.updateDevice(self.iden, { nickname: self.nickname }));
  await syncDevices();
}

/**
 * Removes devices from the account, one request at a time. Never this
 * browser's own device: Pushpilot would just register it again.
 */
export async function deleteDevices(idens: string[]) {
  const pb = await requireClient();
  const self = await store.get('selfDeviceIden');
  for (const iden of idens) if (iden !== self) await guard(() => pb.deleteDevice(iden));
  await store.update('devices', (all) => all.filter((d) => d.iden === self || !idens.includes(d.iden)));
}

export async function renameSelfDevice(name: string) {
  const pb = await requireClient();
  const iden = await ensureSelfDevice();
  await guard(() => pb.updateDevice(iden, { nickname: name.trim() || 'Chrome' }));
  await syncDevices();
}

export async function setChatMuted(iden: string, muted: boolean) {
  const pb = await requireClient();
  const chat = await guard(() => pb.setChatMuted(iden, muted));
  await store.update('chats', (all) => all.map((c) => (c.iden === iden ? { ...c, muted: chat.muted } : c)));
}
