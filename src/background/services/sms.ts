import * as store from '@/core/storage/store';
import type { SmsNotice } from '@/core/pushbullet/types';
import { extractCode, uid } from '@/core/utils/format';
import { copyText } from '@/background/platform/offscreen';
import { isSnoozed, onNotification, show, toDataUrl } from '@/background/platform/notifications';
import { openApp } from '@/background/platform/windows';
import { guard, requireClient } from '@/background/session';
import { i18n } from '#i18n';

export interface SmsChangedPush {
  type: 'sms_changed';
  source_device_iden: string;
  notifications?: SmsNotice[];
}

export async function fetchThreads(device: string) {
  const pb = await requireClient();
  const threads = await guard(() => pb.smsThreads(device));
  await store.update('smsThreads', (all) => ({ ...all, [device]: threads }));
  return threads;
}

export async function fetchThread(device: string, thread: string) {
  const pb = await requireClient();
  return guard(() => pb.smsThread(device, thread));
}

export async function sendSms(device: string, addresses: string[], message: string) {
  const pb = await requireClient();
  await guard(() => pb.sendText(device, addresses, message, uid()));
}

export async function handleSmsChanged(push: SmsChangedPush) {
  const device = push.source_device_iden;
  void fetchThreads(device).catch(() => undefined);
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
