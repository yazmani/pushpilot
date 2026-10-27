import { browser } from 'wxt/browser';
import * as store from '@/core/storage/store';
import type { SmsMessage, SmsNotice } from '@/core/pushbullet/types';
import { extractCode, uid } from '@/core/utils/format';
import { copyText } from '@/background/platform/offscreen';
import { isSnoozed, onNotification, show, toDataUrl } from '@/background/platform/notifications';
import { openApp } from '@/background/platform/windows';
import { due, guard, invalidate, requireClient } from '@/background/session';
import { i18n } from '#i18n';

export interface SmsChangedPush {
  type: 'sms_changed';
  source_device_iden: string;
  notifications?: SmsNotice[];
}

// Each fetch asks the phone over Pushbullet, so recent answers are reused.
// A new or changed text (sms_changed) invalidates them; Refresh forces a fetch.
const THREADS_MAX_AGE = 2 * 60_000;
const THREAD_MAX_AGE = 60_000;

export async function fetchThreads(device: string, force = false) {
  const cached = (await store.get('smsThreads'))[device];
  if (!force && cached && !(await due(`sms:${device}`, THREADS_MAX_AGE))) return cached;
  const pb = await requireClient();
  const threads = await guard(() => pb.smsThreads(device));
  await store.update('smsThreads', (all) => ({ ...all, [device]: threads }));
  return threads;
}

export async function fetchThread(device: string, thread: string) {
  const key = `smsThread:${device}:${thread}`;
  const cached = (await browser.storage.session.get(key))[key] as SmsMessage[] | undefined;
  if (cached && !(await due(key, THREAD_MAX_AGE))) return cached;
  const pb = await requireClient();
  const list = await guard(() => pb.smsThread(device, thread));
  await browser.storage.session.set({ [key]: list });
  return list;
}

export async function sendSms(device: string, addresses: string[], message: string) {
  const pb = await requireClient();
  await guard(() => pb.sendText(device, addresses, message, uid()));
  await invalidate(`sms:${device}`);
}

export async function handleSmsChanged(push: SmsChangedPush) {
  const device = push.source_device_iden;
  for (const n of push.notifications ?? []) await invalidate(`smsThread:${device}:${n.thread_id}`);
  void fetchThreads(device, true).catch(() => undefined);
  const notices = push.notifications ?? [];
  if (!notices.length) return;

  const settings = await store.get('settings');
  // Codes in texts are copied like codes in phone notifications.
  const code = notices.map((n) => extractCode(n.body, { strict: true })).find(Boolean);
  if (code && settings.autoCopyCodes) await copyText(code);
  await store.update('smsNotices', (all) => [...notices, ...all].slice(0, 50));
  if (settings.badge && settings.badgeSms) await store.update('unread', (u) => ({ ...u, sms: u.sms + notices.length }));
  if (!settings.notifySms || (await isSnoozed())) return;

  for (const n of notices) {
    const c = extractCode(n.body, { strict: true });
    await show(`sms:${device}|${n.thread_id}`, {
      title: n.title,
      message: n.body,
      context: i18n.t('sms.placeholder'),
      icon: await toDataUrl(n.image_url),
      buttons: c
        ? [settings.autoCopyCodes ? i18n.t('phone.copiedCode', [c]) : i18n.t('bg.copyCode', [c]), i18n.t('phone.reply')]
        : [i18n.t('phone.reply')],
    });
  }
}

export function registerSmsNotifications() {
  const open = (rest: string) => {
    const [device, thread] = rest.split('|');
    return openApp({ view: 'sms', device, thread });
  };
  onNotification('sms', {
    click: open,
    async button(rest, index) {
      const [, thread] = rest.split('|');
      const latest = (await store.get('smsNotices')).find((n) => n.thread_id === thread);
      const code = extractCode(latest?.body, { strict: true });
      if (code && index === 0) await copyText(code);
      else await open(rest);
    },
  });
}
