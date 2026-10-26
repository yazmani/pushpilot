import { browser } from 'wxt/browser';
import type { SmsMessage, SmsThread, Target } from '@/core/pushbullet/types';
import type { SoundChoice } from '@/core/storage/store';
import type { LinkPreview } from '@/core/utils/links';

export interface OutgoingPush {
  type: 'note' | 'link' | 'file';
  title?: string;
  body?: string;
  url?: string;
  file_name?: string;
  file_type?: string;
  file_url?: string;
}

// UI → background requests. Each entry maps a request to its response data.
export interface Rpc {
  'auth.token': { req: { token: string }; res: void };
  'auth.signout': { req: object; res: void };
  sync: { req: object; res: void };
  reconnect: { req: object; res: void };
  'push.send': { req: { push: OutgoingPush; targets: string[] }; res: void };
  'push.dismiss': { req: { iden: string }; res: void };
  'push.delete': { req: { iden: string }; res: void };
  'unread.clear': { req: { view: 'feed' | 'phone' | 'sms' }; res: void };
  'mirror.dismiss': { req: { id: string }; res: void };
  'mirror.action': { req: { id: string; key: string }; res: void };
  'mirror.reply': { req: { id: string; message: string }; res: void };
  'mirror.clear': { req: object; res: void };
  'sms.threads': { req: { device: string }; res: SmsThread[] };
  'sms.thread': { req: { device: string; thread: string }; res: SmsMessage[] };
  'sms.send': { req: { device: string; addresses: string[]; message: string }; res: void };
  'clip.send': { req: { text: string }; res: void };
  'clip.push': { req: object; res: void };
  'e2e.set': { req: { password: string | null }; res: void };
  'chat.mute': { req: { iden: string; muted: boolean }; res: void };
  'history.clear': { req: object; res: void };
  'device.rename': { req: { name: string }; res: void };
  'notify.test': { req: object; res: void };
  'sound.preview': { req: { choice: SoundChoice }; res: void };
  'preview.fetch': { req: { urls: string[] }; res: void };
  'preview.save': { req: { url: string; preview: LinkPreview }; res: void };
}

export type RpcName = keyof Rpc;
export type RpcMessage = { [K in RpcName]: { rpc: K } & Rpc[K]['req'] }[RpcName];
type Reply<T> = { ok: true; data: T } | { ok: false; error: string };

export async function call<K extends RpcName>(rpc: K, req: Rpc[K]['req'] = {} as Rpc[K]['req']): Promise<Rpc[K]['res']> {
  const reply = (await browser.runtime.sendMessage({ rpc, ...req })) as Reply<Rpc[K]['res']> | undefined;
  if (!reply) throw new Error('Pushpilot’s background worker did not answer. Try again.');
  if (!reply.ok) throw new Error(reply.error);
  return reply.data;
}

export function targetKey(t: Target): string {
  if (t.kind === 'all') return 'all';
  if (t.kind === 'device') return `device:${t.iden}`;
  return `person:${t.email}`;
}

export function parseTarget(key: string): Target {
  if (key.startsWith('device:')) return { kind: 'device', iden: key.slice(7) };
  if (key.startsWith('person:')) return { kind: 'person', email: key.slice(7) };
  return { kind: 'all' };
}
