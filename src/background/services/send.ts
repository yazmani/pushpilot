import type { OutgoingPush } from '@/core/messaging/rpc';
import { parseTarget } from '@/core/messaging/rpc';
import * as store from '@/core/storage/store';
import { deviceName, looksLikeUrl, normalizeUrl, personName } from '@/core/utils/format';
import { show } from '@/background/platform/notifications';
import { readClipboard } from '@/background/platform/offscreen';
import { rememberPush } from '@/background/services/pushes';
import { guard, requireClient } from '@/background/session';
import { i18n } from '#i18n';

/** Creates one push per target (Pushbullet takes a single target per push). */
export async function sendPush(push: OutgoingPush, targets: string[]) {
  const pb = await requireClient();
  const self = await store.get('selfDeviceIden');
  const list = targets.length ? targets : ['all'];
  const base: Record<string, unknown> = { ...push };
  if (self) base.source_device_iden = self;
  for (const key of Object.keys(base)) if (base[key] === undefined || base[key] === '') delete base[key];

  const results = await Promise.allSettled(
    list.map((key) => {
      const t = parseTarget(key);
      const body = { ...base };
      if (t.kind === 'device') body.device_iden = t.iden;
      if (t.kind === 'person') body.email = t.email;
      return guard(() => pb.createPush(body));
    }),
  );
  const failed = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected');
  for (const r of results) if (r.status === 'fulfilled') await rememberPush(r.value);
  if (failed.length === results.length) throw failed[0]!.reason;
  if (failed.length)
    throw new Error(
      i18n.t('bg.partial', [String(results.length - failed.length), String(results.length), failed[0]!.reason?.message ?? '']),
    );
}

async function describeTargets(targets: string[]): Promise<string> {
  const { devices, chats, selfDeviceIden } = await store.getMany(['devices', 'chats', 'selfDeviceIden']);
  const names = targets.map((key) => {
    const t = parseTarget(key);
    if (t.kind === 'all') return i18n.t('bg.yourOtherDevices');
    if (t.kind === 'device')
      return t.iden === selfDeviceIden ? i18n.t('settings.thisBrowser') : deviceName(devices.find((d) => d.iden === t.iden));
    return personName(
      chats.find((c) => c.with.email === t.email),
      t.email,
    );
  });
  return names.join(', ');
}

/** Pushes from places without UI (context menu, shortcut) confirm with a quiet toast. */
export async function sendQuietly(push: OutgoingPush, targets: string[], label: string) {
  try {
    await sendPush(push, targets);
    await show(`info:sent-${Date.now()}`, {
      title: i18n.t('send.sentTo', [await describeTargets(targets)]),
      message: label,
      silent: true,
    });
  } catch (err) {
    await show(`info:fail-${Date.now()}`, {
      title: i18n.t('bg.sendFailed'),
      message: err instanceof Error ? err.message : String(err),
      silent: true,
    });
  }
}

export async function sendImage(srcUrl: string, targets: string[], pageUrl?: string) {
  const pb = await requireClient();
  try {
    const res = await fetch(srcUrl);
    if (!res.ok) throw new Error(String(res.status));
    const blob = await res.blob();
    const name = decodeURIComponent(new URL(srcUrl).pathname.split('/').pop() || 'image').slice(0, 120) || 'image';
    const file = await guard(() =>
      pb.upload(blob, /\.\w{2,5}$/.test(name) ? name : `${name}.${blob.type.split('/')[1] || 'png'}`),
    );
    await sendQuietly({ type: 'file', ...file, body: pageUrl }, targets, file.file_name);
  } catch {
    // Cross-origin or data the worker can’t read: send the address instead.
    await sendQuietly({ type: 'link', title: i18n.t('kind.image'), url: srcUrl }, targets, srcUrl);
  }
}

export async function sendClipboard(text: string) {
  const pb = await requireClient();
  const { me, selfDeviceIden } = await store.getMany(['me', 'selfDeviceIden']);
  await guard(() =>
    pb.ephemeral({
      type: 'clip',
      body: text,
      source_user_iden: me?.iden,
      source_device_iden: selfDeviceIden,
    }),
  );
}

/** Pushes the copied text (as a link if it's an address) to the default target. */
export async function pushClipboard() {
  const text = (await readClipboard()).trim();
  if (!text) {
    await show(`info:clip-empty-${Date.now()}`, {
      title: i18n.t('bg.nothingTitle'),
      message: i18n.t('bg.nothingBody'),
      silent: true,
    });
    return;
  }
  const { defaultTarget } = await store.get('settings');
  const push: OutgoingPush = looksLikeUrl(text) ? { type: 'link', url: normalizeUrl(text) } : { type: 'note', body: text };
  await sendQuietly(push, [defaultTarget], text.slice(0, 200));
}
