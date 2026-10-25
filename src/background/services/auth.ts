import { browser } from 'wxt/browser';
import { Pushbullet } from '@/core/pushbullet/client';
import * as store from '@/core/storage/store';
import { ensureSelfDevice, syncPeople } from '@/background/services/account';
import { syncPushes } from '@/background/services/pushes';
import { connect, disconnect } from '@/background/services/stream';

export async function signInWithToken(token: string) {
  token = token.trim();
  if (!token) throw new Error('Paste an access token first.');
  const me = await new Pushbullet(token).me();
  await store.set({ token, me, connection: 'connecting', lastError: null });
  await bootstrap();
  return me;
}

/** First load after sign-in: device registration, lists, history, stream. */
export async function bootstrap() {
  await ensureSelfDevice();
  await Promise.all([syncPeople().catch(() => undefined), syncPushes({ notify: false })]);
  await connect();
}

export async function signOut() {
  disconnect();
  await browser.storage.local.remove(store.accountKeys);
  await store.set({ connection: 'signed-out' });
  await browser.action.setBadgeText({ text: '' });
  const all = await browser.notifications.getAll();
  for (const id of Object.keys(all)) void browser.notifications.clear(id);
}
