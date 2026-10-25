import * as store from '@/core/storage/store';
import type { SmsNotice } from '@/core/pushbullet/types';
import { uid } from '@/core/utils/format';
import { isSnoozed, onNotification, show, toDataUrl } from '@/background/platform/notifications';
import { openApp } from '@/background/platform/windows';
import { guard, requireClient } from '@/background/session';

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
  await store.update('smsNotices', (all) => [...notices, ...all].slice(0, 50));
  if (settings.badge && settings.badgeSms) await store.update('unread', (u) => ({ ...u, sms: u.sms + notices.length }));
  if (!settings.notifySms || (await isSnoozed())) return;

  for (const n of notices) {
    await show(`sms:${device}|${n.thread_id}`, {
      title: n.title,
      message: n.body,
      context: 'Text message',
      icon: await toDataUrl(n.image_url),
      buttons: ['Reply'],
    });
  }
}

export function registerSmsNotifications() {
  const open = (rest: string) => {
    const [device, thread] = rest.split('|');
    return openApp({ view: 'sms', device, thread });
  };
  onNotification('sms', { click: open, button: open });
}
