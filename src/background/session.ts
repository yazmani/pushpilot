import { ApiError, Pushbullet } from '@/core/pushbullet/client';
import * as store from '@/core/storage/store';
import { i18n } from '#i18n';

let cached: Pushbullet | null = null;

/** The API client for the signed-in account, or null when signed out. */
export async function client(): Promise<Pushbullet | null> {
  const { token, e2eKey } = await store.getMany(['token', 'e2eKey']);
  if (!token) return (cached = null);
  if (!cached || cached.token !== token || cached.e2eKey !== e2eKey) cached = new Pushbullet(token, e2eKey);
  return cached;
}

export async function requireClient(): Promise<Pushbullet> {
  const pb = await client();
  if (!pb) throw new Error(i18n.t('bg.signInFirst'));
  return pb;
}

type ExpiredHandler = () => Promise<void>;
let onExpired: ExpiredHandler = async () => {};

export function setExpiredHandler(fn: ExpiredHandler) {
  onExpired = fn;
}

/** Runs an API task; a rejected token signs the user out instead of failing silently forever. */
export async function guard<T>(task: () => Promise<T>): Promise<T> {
  try {
    return await task();
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) {
      await store.set({ lastError: i18n.t('bg.tokenRejected') });
      await onExpired();
    }
    throw err;
  }
}
