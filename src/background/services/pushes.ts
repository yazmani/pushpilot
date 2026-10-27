import { browser } from 'wxt/browser';
import * as store from '@/core/storage/store';
import type { Pushbullet } from '@/core/pushbullet/client';
import type { Push } from '@/core/pushbullet/types';
import { deviceName, host, isAddressNote, isImage, pushOpenUrl, pushText } from '@/core/utils/format';
import { urlPreview } from '@/core/utils/links';
import { clear, isSnoozed, onNotification, show, toDataUrl } from '@/background/platform/notifications';
import { copyText } from '@/background/platform/offscreen';
import { openApp, openUrl } from '@/background/platform/windows';
import { guard, isRateLimited, requireClient } from '@/background/session';
import { i18n } from '#i18n';

const KEEP = 3000;

// Runs strictly one at a time: an onopen refresh racing a tickle would read the
// same cursor and notify the same push twice.
let queue: Promise<void> = Promise.resolve();

// Pushes this browser just sent. They're stored right away (rememberPush), so
// the next sync wouldn't see them as new; this lets "notify my own pushes" work.
const sentHere = new Set<string>();

export function syncPushes(opts: { notify?: boolean; reconnect?: boolean } = {}): Promise<void> {
  const run = queue.then(() => doSync(opts.notify ?? true, opts.reconnect ?? false));
  queue = run.catch((err) => console.warn('[pushpilot] push sync failed', err));
  return run;
}

async function doSync(notify: boolean, reconnect: boolean) {
  const pb = await requireClient();
  const cursor = await store.get('pushCursor');
  const firstRun = cursor === 0;
  // First run: the recent history page by page (see loadOlderPushes); after that,
  // only what changed since the cursor.
  const incoming = firstRun
    ? (await collectHistory(pb, '', 100)).pushes
    : await guard(() => pb.pushes({ after: cursor, pages: 5 }));
  if (!incoming.length) {
    // An account with no pushes yet: start the cursor now, or the first push to
    // arrive would be taken for history and never notified.
    if (firstRun) await store.set({ pushes: [], pushCursor: Date.now() / 1000 - 60 });
    return;
  }

  const fresh: Push[] = [];
  const dismissedNow: string[] = [];
  await store.update('pushes', (pushes) => {
    const byIden = new Map(pushes.map((p) => [p.iden, p]));
    for (const p of incoming) {
      const prev = byIden.get(p.iden);
      if (!p.active) {
        byIden.delete(p.iden);
        dismissedNow.push(p.iden);
        continue;
      }
      if (!prev || sentHere.delete(p.iden)) fresh.push(p);
      else if (p.dismissed && !prev.dismissed) dismissedNow.push(p.iden);
      byIden.set(p.iden, p);
    }
    return [...byIden.values()].sort((a, b) => b.created - a.created).slice(0, KEEP);
  });
  const newest = Math.max(cursor, ...incoming.map((p) => p.modified));
  await store.set({ pushCursor: newest });

  for (const iden of dismissedNow) void clear(`push:${iden}`);
  if (firstRun || !notify) return;

  // Oldest first so the newest toast ends up on top.
  for (const p of fresh.sort((a, b) => a.created - b.created)) {
    if (p.created < cursor - 60) continue;
    if (await isForMe(p)) await deliver(p, reconnect);
  }
}

/**
 * Should this push reach this browser (toast, unread count, auto-open)? Pushes
 * to this browser always count; pushes to "All devices", to your other devices,
 * and from this browser itself are options.
 */
async function isForMe(p: Push): Promise<boolean> {
  if (!p.active || p.dismissed) return false;
  const { selfDeviceIden, settings, subscriptions, chats } = await store.getMany([
    'selfDeviceIden',
    'settings',
    'subscriptions',
    'chats',
  ]);
  if (p.direction === 'outgoing') return false;

  if (p.channel_iden) {
    if (!settings.showChannels) return false;
    return !subscriptions.find((s) => s.channel.iden === p.channel_iden)?.muted;
  }
  if (p.direction === 'incoming' && p.sender_email_normalized) {
    return !chats.find((c) => c.with.email_normalized === p.sender_email_normalized)?.muted;
  }

  const fromHere = !!selfDeviceIden && p.source_device_iden === selfDeviceIden;
  if (fromHere && !settings.receiveOwn) return false;
  if (!p.target_device_iden) return settings.receiveAll;
  if (p.target_device_iden === selfDeviceIden || settings.receiveFor.includes(p.target_device_iden)) return true;
  return settings.receiveOthers;
}

async function deliver(p: Push, reconnect: boolean) {
  const { settings, devices, chats, subscriptions, previews } = await store.getMany([
    'settings',
    'devices',
    'chats',
    'subscriptions',
    'previews',
  ]);
  if (settings.badge && settings.badgeFeed) await store.update('unread', (u) => ({ ...u, feed: u.feed + 1 }));

  const url = pushOpenUrl(p);
  const fromPerson = p.direction === 'incoming' && !!p.sender_email_normalized;
  const opens =
    settings.autoOpenLinks &&
    !!url &&
    (p.type === 'link' || isAddressNote(p) || (p.type === 'file' && settings.autoOpenFiles)) &&
    (!fromPerson || settings.autoOpenFromPeople) &&
    (!reconnect || settings.autoOpenOnReconnect);
  if (opens) await openUrl(url, settings.autoOpenActive);

  if (!settings.notifyPushes || (opens && settings.hideAutoOpened) || (await isSnoozed())) return;

  let from = '';
  let icon: string | undefined;
  if (p.channel_iden) {
    const sub = subscriptions.find((s) => s.channel.iden === p.channel_iden);
    from = sub?.channel.name ?? p.sender_name ?? i18n.t('bg.channel');
    icon = await toDataUrl(sub?.channel.image_url);
  } else if (fromPerson) {
    const chat = chats.find((c) => c.with.email_normalized === p.sender_email_normalized);
    from = p.sender_name || chat?.with.name || p.sender_email_normalized!;
    icon = await toDataUrl(chat?.with.image_url);
  } else if (p.source_device_iden) {
    from = deviceName(devices.find((d) => d.iden === p.source_device_iden));
  }

  const preview = p.type === 'link' && p.url ? (previews[p.url] ?? urlPreview(p.url)) : undefined;
  const title =
    p.type === 'link'
      ? p.title || preview?.title || host(p.url) || i18n.t('kind.link')
      : p.type === 'file'
        ? p.file_name || i18n.t('kind.file')
        : p.title || (p.body ? (p.body.split('\n')[0] ?? '').slice(0, 80) : i18n.t('kind.note'));
  const message =
    p.type === 'link' ? [p.body, host(p.url)].filter(Boolean).join('\n') : p.type === 'note' && !p.title ? '' : p.body || '';
  const image = isImage(p) ? p.image_url || p.file_url : preview?.image;

  await show(
    `push:${p.iden}`,
    {
      title,
      message: message || (p.type === 'file' ? p.file_type || '' : ''),
      context: [from && i18n.t('route.from', [from]), opens && i18n.t('bg.opened')].filter(Boolean).join(', ') || undefined,
      icon,
      image: await toDataUrl(image),
      buttons: [
        url ? (p.type === 'file' ? i18n.t('actions.download') : i18n.t('actions.open')) : i18n.t('actions.copy'),
        i18n.t('bg.done'),
      ],
    },
    { sticky: settings.sticky },
  );
}

/**
 * Walks the history from `start` until it has `want` active pushes or runs out,
 * and remembers where it stopped for the next "load older".
 */
async function collectHistory(pb: Pushbullet, start: string, want: number) {
  const pushes: Push[] = [];
  let cursor: string | undefined = start || undefined;
  for (let page = 0; page < 40 && pushes.length < want; page++) {
    const res = await guard(() => pb.pushesPage(cursor));
    pushes.push(...res.pushes.filter((p) => p.active));
    cursor = res.cursor;
    if (!cursor) break;
  }
  await store.set({ historyCursor: cursor ?? null });
  return { pushes, done: !cursor };
}

/** The feed scrolled to the end: fetch the next stretch of older pushes. */
export async function loadOlderPushes(depth = 0): Promise<{ added: number; done: boolean }> {
  const start = await store.get('historyCursor');
  if (start === null) return { added: 0, done: true };
  if (await isRateLimited()) return { added: 0, done: false };
  const pb = await requireClient();
  const { pushes, done } = await collectHistory(pb, start, 60);
  let added = 0;
  await store.update('pushes', (all) => {
    const have = new Set(all.map((p) => p.iden));
    const older = pushes.filter((p) => !have.has(p.iden));
    added = older.length;
    return [...all, ...older].sort((a, b) => b.created - a.created).slice(0, KEEP);
  });
  // Starting over from the newest page (installs from before this) can find
  // nothing new at first; keep going a little, and let the next scroll go on,
  // so a long history doesn't use up the account's API allowance in one go.
  if (!added && !done && depth < 2) return loadOlderPushes(depth + 1);
  return { added, done };
}

async function findPush(iden: string) {
  return (await store.get('pushes')).find((p) => p.iden === iden);
}

export async function dismissPush(iden: string) {
  const pb = await requireClient();
  const updated = await guard(() => pb.dismissPush(iden));
  await store.update('pushes', (all) => all.map((p) => (p.iden === iden ? { ...p, ...updated } : p)));
  void clear(`push:${iden}`);
}

export async function deletePush(iden: string) {
  const pb = await requireClient();
  await guard(() => pb.deletePush(iden));
  await store.update('pushes', (all) => all.filter((p) => p.iden !== iden));
  void clear(`push:${iden}`);
}

/**
 * Bulk versions, one request at a time so a long selection doesn't burn
 * through the rate limit in a burst. Stops at the first failure and keeps
 * what already went through.
 */
export async function dismissPushes(idens: string[]) {
  for (const iden of idens) await dismissPush(iden);
}

export async function deletePushes(idens: string[]) {
  for (const iden of idens) await deletePush(iden);
}

/** Records a push we just created so the UI shows it before the tickle lands. */
export async function rememberPush(p: Push) {
  sentHere.add(p.iden);
  await store.update('pushes', (all) => [p, ...all.filter((x) => x.iden !== p.iden)].slice(0, KEEP));
}

export function registerPushNotifications() {
  onNotification('push', {
    async click(iden) {
      const p = await findPush(iden);
      const url = p && pushOpenUrl(p);
      if (url) await openUrl(url);
      else await openApp({ view: 'feed' });
    },
    async button(iden, index) {
      const p = await findPush(iden);
      if (!p) return;
      if (index === 0) {
        const url = pushOpenUrl(p);
        if (url) await openUrl(url);
        else await copyText(pushText(p));
      } else {
        await dismissPush(iden).catch(() => undefined);
      }
    },
    async closedByUser(iden) {
      if ((await store.get('settings')).closeDismisses) await dismissPush(iden).catch(() => undefined);
    },
  });
}

export async function clearAllPushNotifications() {
  const all = await browser.notifications.getAll();
  for (const id of Object.keys(all)) if (id.startsWith('push:')) void clear(id);
}
