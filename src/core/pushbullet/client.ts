import { decryptJson, encrypt } from './crypto';
import type { Chat, Device, Push, SmsMessage, SmsThread, Subscription, User } from './types';
import { i18n } from '#i18n';

export const API = 'https://api.pushbullet.com';
export const STREAM = 'wss://stream.pushbullet.com/websocket/';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
  get unauthorized() {
    return this.status === 401 || this.status === 403;
  }
}

type Json = Record<string, unknown>;

export interface UploadTicket {
  file_name: string;
  file_type: string;
  file_url: string;
  upload_url: string;
  data?: Record<string, string>;
}

export class Pushbullet {
  constructor(
    readonly token: string,
    readonly e2eKey: string | null = null,
  ) {}

  private async call<T>(path: string, init: { method?: string; body?: Json } = {}): Promise<T> {
    const res = await fetch(API + path, {
      method: init.method ?? (init.body ? 'POST' : 'GET'),
      headers: {
        'Access-Token': this.token,
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: init.body ? JSON.stringify(init.body) : undefined,
    });
    if (!res.ok) {
      let message = res.statusText;
      try {
        const err = (await res.json()) as { error?: { message?: string } };
        message = err.error?.message ?? message;
      } catch {
        // non-JSON error body
      }
      throw new ApiError(res.status, message || i18n.t('bg.requestFailed', [String(res.status)]));
    }
    const text = await res.text();
    return (text ? JSON.parse(text) : {}) as T;
  }

  me() {
    return this.call<User>('/v2/users/me');
  }

  async devices() {
    return (await this.call<{ devices: Device[] }>('/v2/devices?active=true')).devices;
  }

  createDevice(device: Partial<Device>) {
    return this.call<Device>('/v2/devices', { body: device as Json });
  }

  updateDevice(iden: string, patch: Partial<Device>) {
    return this.call<Device>(`/v2/devices/${iden}`, { body: patch as Json });
  }

  async chats() {
    return (await this.call<{ chats: Chat[] }>('/v2/chats?active=true')).chats.filter((c) => c.active);
  }

  setChatMuted(iden: string, muted: boolean) {
    return this.call<Chat>(`/v2/chats/${iden}`, { body: { muted } });
  }

  async subscriptions() {
    return (await this.call<{ subscriptions: Subscription[] }>('/v2/subscriptions?active=true')).subscriptions.filter(
      (s) => s.active,
    );
  }

  /** Pushes modified after `after` (includes deletions), newest first. */
  async pushes(opts: { after?: number; limit?: number; pages?: number; activeOnly?: boolean } = {}) {
    const all: Push[] = [];
    let cursor: string | undefined;
    const pages = opts.pages ?? 1;
    for (let i = 0; i < pages; i++) {
      const q = new URLSearchParams();
      if (opts.after) q.set('modified_after', String(opts.after));
      if (opts.activeOnly) q.set('active', 'true');
      q.set('limit', String(opts.limit ?? 100));
      if (cursor) q.set('cursor', cursor);
      const page = await this.call<{ pushes: Push[]; cursor?: string }>(`/v2/pushes?${q}`);
      all.push(...page.pushes);
      cursor = page.cursor;
      if (!cursor) break;
    }
    return all;
  }

  createPush(push: Json) {
    return this.call<Push>('/v2/pushes', { body: push });
  }

  dismissPush(iden: string) {
    return this.call<Push>(`/v2/pushes/${iden}`, { body: { dismissed: true } });
  }

  deletePush(iden: string) {
    return this.call<Json>(`/v2/pushes/${iden}`, { method: 'DELETE' });
  }

  /** Sends a stream-only message, end-to-end encrypted when a key is set. */
  async ephemeral(push: Json) {
    const payload = this.e2eKey ? { encrypted: true, ciphertext: await encrypt(this.e2eKey, JSON.stringify(push)) } : push;
    return this.call<Json>('/v2/ephemerals', { body: { type: 'push', push: payload } });
  }

  uploadRequest(file_name: string, file_type: string) {
    return this.call<UploadTicket>('/v2/upload-request', { body: { file_name, file_type } });
  }

  /** Uploads a file and resolves with the fields a file push needs. */
  async upload(file: Blob, name: string, onProgress?: (fraction: number) => void) {
    const ticket = await this.uploadRequest(name, file.type || 'application/octet-stream');
    const form = new FormData();
    for (const [k, v] of Object.entries(ticket.data ?? {})) form.append(k, v);
    form.append('file', file, name);
    await new Promise<void>((resolve, reject) => {
      // XHR (when present) for progress events; the service worker falls back to fetch.
      if (typeof XMLHttpRequest === 'undefined') {
        fetch(ticket.upload_url, { method: 'POST', body: form }).then(
          (r) => (r.ok ? resolve() : reject(new ApiError(r.status, i18n.t('bg.uploadFailed')))),
          reject,
        );
        return;
      }
      const xhr = new XMLHttpRequest();
      xhr.open('POST', ticket.upload_url);
      xhr.upload.onprogress = (e) => e.lengthComputable && onProgress?.(e.loaded / e.total);
      xhr.onload = () => (xhr.status < 300 ? resolve() : reject(new ApiError(xhr.status, i18n.t('bg.uploadFailed'))));
      xhr.onerror = () => reject(new Error(i18n.t('bg.uploadOffline')));
      xhr.send(form);
    });
    return { file_name: ticket.file_name, file_type: ticket.file_type, file_url: ticket.file_url };
  }

  private async permanent<T>(key: string): Promise<T> {
    let res: Json;
    try {
      res = await this.call<Json>(`/v2/permanents/${key}`);
    } catch (err) {
      // Pushbullet answers 404 for phones that stopped syncing texts.
      if (err instanceof ApiError && err.status === 404) {
        throw new ApiError(404, i18n.t('bg.smsOff'));
      }
      throw err;
    }
    if (res.encrypted) {
      if (!this.e2eKey) throw new Error(i18n.t('bg.encrypted'));
      return decryptJson<T>(this.e2eKey, res.ciphertext as string);
    }
    return res as T;
  }

  async smsThreads(deviceIden: string) {
    return (await this.permanent<{ threads?: SmsThread[] }>(`${deviceIden}_threads`)).threads ?? [];
  }

  async smsThread(deviceIden: string, threadId: string) {
    return (await this.permanent<{ thread?: SmsMessage[] }>(`${deviceIden}_thread_${threadId}`)).thread ?? [];
  }

  async sendText(deviceIden: string, addresses: string[], message: string, guid: string) {
    let data: Json = { target_device_iden: deviceIden, addresses, message, guid };
    if (this.e2eKey) {
      data = {
        target_device_iden: deviceIden,
        encrypted: true,
        ciphertext: await encrypt(this.e2eKey, JSON.stringify(data)),
      };
    }
    return this.call<Json>('/v3/create-text', { body: { data } });
  }
}
