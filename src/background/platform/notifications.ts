import { browser, type Browser } from 'wxt/browser';
import * as store from '@/core/storage/store';
import { playSound } from '@/background/platform/offscreen';

export const ICON = '/icon/128.png';

export interface NotifyHandler {
  click?: (rest: string) => void | Promise<void>;
  button?: (rest: string, index: number) => void | Promise<void>;
  closedByUser?: (rest: string) => void | Promise<void>;
}

const handlers = new Map<string, NotifyHandler>();

/** Notification ids look like `<kind>:<rest>`; each kind registers its handler. */
export function onNotification(kind: string, handler: NotifyHandler) {
  handlers.set(kind, handler);
}

function route(id: string): [NotifyHandler | undefined, string] {
  const at = id.indexOf(':');
  return [handlers.get(id.slice(0, at)), id.slice(at + 1)];
}

export function registerNotificationListeners() {
  browser.notifications.onClicked.addListener((id) => {
    const [h, rest] = route(id);
    void h?.click?.(rest);
    void browser.notifications.clear(id);
  });
  browser.notifications.onButtonClicked.addListener((id, index) => {
    const [h, rest] = route(id);
    void h?.button?.(rest, index);
    void browser.notifications.clear(id);
  });
  browser.notifications.onClosed.addListener((id, byUser) => {
    if (!byUser) return;
    const [h, rest] = route(id);
    void h?.closedByUser?.(rest);
  });
}

export async function isSnoozed(): Promise<boolean> {
  const s = await store.get('settings');
  return s.snoozeUntil > Date.now();
}

export interface Toast {
  title: string;
  message: string;
  context?: string;
  icon?: string;
  image?: string;
  buttons?: string[];
  silent?: boolean;
}

export async function show(id: string, t: Toast, opts: { sticky?: boolean } = {}) {
  const settings = await store.get('settings');
  const options: Browser.notifications.NotificationCreateOptions = {
    type: t.image ? 'image' : 'basic',
    iconUrl: t.icon || ICON,
    title: t.title || 'Pushpilot',
    message: t.message || '',
    contextMessage: t.context,
    // Firefox rejects the whole notification over buttons; there a click opens the item instead.
    ...(import.meta.env.FIREFOX
      ? {}
      : {
          buttons: t.buttons?.slice(0, 2).map((title) => ({ title })),
          requireInteraction: opts.sticky ?? false,
          silent: true,
          priority: 2,
        }),
  };
  if (t.image) options.imageUrl = t.image;
  try {
    await browser.notifications.create(id, options);
  } catch (err) {
    // A bad icon/image URL rejects the whole toast; retry plain.
    console.warn('[pushpilot] notification failed, retrying without images', err);
    await browser.notifications.create(id, { ...options, type: 'basic', iconUrl: ICON, imageUrl: undefined });
  }
  if (settings.sound && !t.silent) void playSound(settings.soundChoice);
}

export function clear(id: string) {
  return browser.notifications.clear(id);
}

function toBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

const dataUrlCache = new Map<string, string>();

/** Notifications only accept data:/blob:/packaged URLs, so remote images are inlined. */
export async function toDataUrl(url: string | undefined, maxBytes = 1_500_000): Promise<string | undefined> {
  if (!url) return;
  if (url.startsWith('data:')) return url;
  const hit = dataUrlCache.get(url);
  if (hit) return hit;
  try {
    const res = await fetch(url);
    if (!res.ok) return;
    const buf = await res.arrayBuffer();
    if (buf.byteLength > maxBytes) return;
    const type = res.headers.get('content-type') || 'image/png';
    const data = `data:${type};base64,${toBase64(buf)}`;
    if (dataUrlCache.size > 50) dataUrlCache.clear();
    dataUrlCache.set(url, data);
    return data;
  } catch {
    return;
  }
}
