import type { Chat, Device, Push, SmsThread } from '@/core/pushbullet/types';

export function deviceName(d: Device | undefined): string {
  if (!d) return 'Unknown device';
  return d.nickname || [d.manufacturer, d.model].filter(Boolean).join(' ') || 'Unnamed device';
}

/** Pushbullet keeps stale registrations around with `pushable: false`; pushes to them go nowhere. */
export function isReachable(d: Device): boolean {
  return d.active && d.pushable !== false;
}

export function deviceKind(d: Device | undefined): string {
  switch (d?.icon) {
    case 'phone':
      return 'Phone';
    case 'tablet':
      return 'Tablet';
    case 'laptop':
      return 'Laptop';
    case 'watch':
      return 'Watch';
    case 'browser':
      return 'Browser';
    case 'website':
      return 'Website';
    case 'system':
      return 'Computer';
    default:
      if (d?.type === 'android' || d?.type === 'ios') return 'Phone';
      return d?.type === 'chrome' || d?.type === 'firefox' ? 'Browser' : 'Computer';
  }
}

export function personName(c: Chat | undefined, fallback = 'Someone'): string {
  return c?.with.name || c?.with.email || fallback;
}

export function threadName(t: SmsThread): string {
  return t.recipients.map((r) => r.name || r.number || r.address).join(', ');
}

export function host(url: string | undefined): string {
  if (!url) return '';
  try {
    return new URL(url).host.replace(/^www\./, '');
  } catch {
    return url;
  }
}

export function normalizeUrl(url: string): string {
  return /^[a-z][a-z0-9+.-]*:/i.test(url) ? url : `https://${url.replace(/^\/+/, '')}`;
}

export function isHttpUrl(url: string | undefined): url is string {
  return !!url && /^https?:\/\//i.test(url);
}

/** Whole URL typed into a note? Treat it as a link. */
export function looksLikeUrl(text: string): boolean {
  return /^(https?:\/\/|www\.)\S+$/i.test(text.trim());
}

const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto', style: 'narrow' });

export function timeAgo(seconds: number): string {
  const diff = seconds - Date.now() / 1000;
  const abs = Math.abs(diff);
  if (abs < 45) return 'now';
  if (abs < 3600) return rtf.format(Math.round(diff / 60), 'minute');
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), 'hour');
  if (abs < 86400 * 6) return rtf.format(Math.round(diff / 86400), 'day');
  const old = abs > 86400 * 300;
  return new Date(seconds * 1000).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    ...(old && { year: 'numeric' }),
  });
}

export function clockTime(seconds: number): string {
  return new Date(seconds * 1000).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

export function dayLabel(seconds: number): string {
  const d = new Date(seconds * 1000);
  const today = new Date();
  const yesterday = new Date(Date.now() - 86400000);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
}

// One-time codes: prefer digits next to a "code"-ish word, then any lone 4–8 digit run.
export function extractCode(text: string | undefined): string | undefined {
  if (!text) return;
  const near = text.match(/(?:code|otp|pin|passcode|verification|verify|token|código|code de|kod|码)\D{0,24}?(\d{4,8})\b/i);
  if (near) return near[1];
  const near2 = text.match(/\b(\d{4,8})\b[^\n]{0,30}?(?:is your|est votre|es tu|code|otp)/i);
  if (near2) return near2[1];
  const lone = text.match(/(?<![\d.,:/-])\b(\d{5,8})\b(?![\d.,:/-])/);
  return lone?.[1];
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 ** 2).toFixed(1)} MB`;
}

export function uid(): string {
  return crypto.randomUUID();
}

/** Push → the thing a click should open. */
export function pushOpenUrl(p: Push): string | undefined {
  if (p.type === 'link' && p.url) return normalizeUrl(p.url);
  if (p.type === 'file' && p.file_url) return p.file_url;
  return undefined;
}

export function pushText(p: Push): string {
  if (p.type === 'link') return [p.title, p.body, p.url].filter(Boolean).join('\n');
  if (p.type === 'file') return [p.body, p.file_url].filter(Boolean).join('\n');
  return [p.title, p.body].filter(Boolean).join('\n');
}

export function isImage(p: Push): boolean {
  return p.type === 'file' && !!p.file_type?.startsWith('image/');
}
