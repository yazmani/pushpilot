import * as store from '@/core/storage/store';
import type { Mirror, MirrorAction } from '@/core/pushbullet/types';
import { deviceName, extractCode, uid } from '@/core/utils/format';
import { clear, isSnoozed, onNotification, show } from '@/background/platform/notifications';
import { copyText } from '@/background/platform/offscreen';
import { openApp } from '@/background/platform/windows';
import { guard, requireClient } from '@/background/session';
import { i18n } from '#i18n';

const KEEP = 150;

export interface MirrorPush {
  type: 'mirror';
  title?: string;
  body?: string;
  icon?: string;
  application_name?: string;
  package_name: string;
  notification_id: string;
  notification_tag?: string | null;
  source_device_iden?: string;
  source_user_iden: string;
  dismissible?: boolean;
  conversation_iden?: string;
  actions?: MirrorAction[];
  created?: number;
}

export interface DismissalPush {
  type: 'dismissal';
  package_name: string;
  notification_id: string;
  notification_tag?: string | null;
  source_user_iden: string;
}

function same(a: Pick<Mirror, 'package_name' | 'notification_id' | 'notification_tag'>, b: typeof a) {
  return (
    a.package_name === b.package_name &&
    String(a.notification_id) === String(b.notification_id) &&
    (a.notification_tag ?? null) === (b.notification_tag ?? null)
  );
}

export async function handleMirror(push: MirrorPush) {
  const settings = await store.get('settings');
  if (!settings.mirrorEnabled) return;

  const code = extractCode(`${push.title ?? ''}\n${push.body ?? ''}`);
  const entry: Mirror = {
    id: uid(),
    receivedAt: Date.now() / 1000,
    created: push.created && push.created > 0 ? push.created : Date.now() / 1000,
    title: push.title,
    body: push.body,
    icon: push.icon,
    application_name: push.application_name,
    package_name: push.package_name,
    notification_id: String(push.notification_id),
    notification_tag: push.notification_tag ?? null,
    source_device_iden: push.source_device_iden,
    source_user_iden: push.source_user_iden,
    dismissible: push.dismissible,
    conversation_iden: push.conversation_iden,
    actions: push.actions,
    code,
  };

  // An app re-posting a live notification (progress, chat thread) updates in place.
  let isUpdate = false;
  await store.update('mirrors', (all) => {
    const i = all.findIndex((m) => !m.dismissed && same(m, entry));
    if (i !== -1) {
      entry.id = all[i]!.id;
      isUpdate = true;
      all = all.filter((_, j) => j !== i);
    }
    return [entry, ...all].slice(0, KEEP);
  });
  if (!isUpdate && settings.badge && settings.badgePhone) await store.update('unread', (u) => ({ ...u, phone: u.phone + 1 }));

  if (code && settings.autoCopyCodes) await copyText(code);
  if (!settings.notifyMirrors || (await isSnoozed())) return;

  const devices = await store.get('devices');
  const app = entry.application_name || entry.package_name;
  const device = devices.find((d) => d.iden === entry.source_device_iden);
  const primary = code
    ? settings.autoCopyCodes
      ? i18n.t('phone.copiedCode', [code])
      : i18n.t('bg.copyCode', [code])
    : entry.conversation_iden
      ? i18n.t('phone.reply')
      : entry.actions?.[0]?.label;
  await show(
    `mirror:${entry.id}`,
    {
      title: entry.title || app,
      message: entry.body || '',
      context: device ? i18n.t('bg.appOnDevice', [app ?? '', deviceName(device)]) : app,
      icon: entry.icon ? `data:image/jpeg;base64,${entry.icon}` : undefined,
      buttons: [primary, entry.dismissible !== false ? i18n.t('common.dismiss') : undefined].filter((b): b is string => !!b),
      silent: isUpdate,
    },
    { sticky: settings.stickyMirrors },
  );
}

export async function handleDismissal(push: DismissalPush) {
  let matched: Mirror | undefined;
  await store.update('mirrors', (all) =>
    all.map((m) => {
      if (!m.dismissed && same(m, push)) {
        matched = m;
        return { ...m, dismissed: true };
      }
      return m;
    }),
  );
  if (matched) void clear(`mirror:${matched.id}`);
}

async function find(id: string) {
  return (await store.get('mirrors')).find((m) => m.id === id);
}

async function sendDismissal(m: Mirror, triggerKey?: string) {
  const pb = await requireClient();
  await guard(() =>
    pb.ephemeral({
      type: 'dismissal',
      package_name: m.package_name,
      notification_id: m.notification_id,
      notification_tag: m.notification_tag ?? null,
      source_user_iden: m.source_user_iden,
      ...(triggerKey ? { trigger_action: triggerKey } : {}),
    }),
  );
}

export async function dismissMirror(id: string) {
  const m = await find(id);
  if (!m) return;
  if (!m.dismissed) await sendDismissal(m);
  await store.update('mirrors', (all) => all.map((x) => (x.id === id ? { ...x, dismissed: true } : x)));
  void clear(`mirror:${id}`);
}

export async function triggerMirrorAction(id: string, key: string) {
  const m = await find(id);
  if (!m) return;
  await sendDismissal(m, key);
  await store.update('mirrors', (all) => all.map((x) => (x.id === id ? { ...x, dismissed: true } : x)));
  void clear(`mirror:${id}`);
}

/** Quick reply to messaging apps (WhatsApp, Telegram, Messages…) via the phone. */
export async function replyToMirror(id: string, message: string) {
  const m = await find(id);
  if (!m?.conversation_iden) throw new Error(i18n.t('bg.noReplies'));
  const pb = await requireClient();
  const me = await store.get('me');
  await guard(() =>
    pb.ephemeral({
      type: 'messaging_extension_reply',
      package_name: m.package_name,
      source_user_iden: me?.iden ?? m.source_user_iden,
      target_device_iden: m.source_device_iden,
      conversation_iden: m.conversation_iden,
      message,
    }),
  );
}

export async function clearMirrors() {
  const all = await store.get('mirrors');
  for (const m of all) void clear(`mirror:${m.id}`);
  await store.set({ mirrors: [] });
}

export function registerMirrorNotifications() {
  onNotification('mirror', {
    click: (id) => openApp({ view: 'phone', mirror: id }),
    async button(id, index) {
      const m = await find(id);
      if (!m) return;
      if (index === 0) {
        if (m.code) await copyText(m.code);
        else if (m.conversation_iden) await openApp({ view: 'phone', mirror: id });
        else if (m.actions?.[0]) await triggerMirrorAction(id, m.actions[0].trigger_key);
        else await dismissMirror(id);
      } else {
        await dismissMirror(id);
      }
    },
    async closedByUser(id) {
      if ((await store.get('settings')).closeDismisses) await dismissMirror(id).catch(() => undefined);
    },
  });
}
