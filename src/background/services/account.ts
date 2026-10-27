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
  const name =
    ['Brave', 'Microsoft Edge', 'Opera', 'Vivaldi', 'Arc'].find((b) => brands.includes(b))?.replace('Microsoft ', '') ??
    ('brave' in navigator ? 'Brave' : 'Chrome');
  const platform =
    ua?.platform || (/Mac/.test(navigator.userAgent) ? 'macOS' : /Win/.test(navigator.userAgent) ? 'Windows' : 'Linux');
  return `${name} on ${platform}`;
}

let ensuring: Promise<string> | null = null;

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
    if (saved && selfDeviceOwned && devices.some((d) => d.iden === saved && d.active)) return saved;

    const created = await guard(() =>
      pb.createDevice({
        nickname: browserNickname(),
        type: 'chrome',
        model: 'Pushpilot',
        manufacturer: 'Pushpilot',
        icon: 'browser',
      }),
    );
    await store.set({ selfDeviceIden: created.iden, selfDeviceOwned: true });
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
