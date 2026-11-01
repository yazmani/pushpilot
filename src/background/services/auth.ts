import { browser } from 'wxt/browser';
import { Pushbullet } from '@/core/pushbullet/client';
import * as store from '@/core/storage/store';
import type { AuthKind } from '@/core/storage/store';
import { ensureSelfDevice, syncPeople } from '@/background/services/account';
import { syncPushes } from '@/background/services/pushes';
import { connect, disconnect } from '@/background/services/stream';
import { i18n } from '#i18n';

export async function signInWithToken(
  token: string,
  { kind = 'token', sameAccount = false }: { kind?: AuthKind; sameAccount?: boolean } = {},
) {
  token = token.trim();
  if (!token) throw new Error(i18n.t('bg.pasteToken'));
  const me = await new Pushbullet(token).me();
  // Switching how you're signed in keeps your history, so it has to be the same account.
  if (sameAccount && (await store.get('me'))?.iden !== me.iden) throw new Error(i18n.t('signIn.otherAccount'));
  // A switch of sign-in arrives with the stream still open on the old key; close
  // it, or connect() sees it open, does nothing, and "Connecting" never clears.
  disconnect();
  await store.set({ token, authKind: kind, me, connection: 'connecting', lastError: null });
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
  // Cached conversations and refresh times belong to the account too.
  await browser.storage.session.clear();
  await store.set({ connection: 'signed-out' });
  await browser.action.setBadgeText({ text: '' });
  const all = await browser.notifications.getAll();
  for (const id of Object.keys(all)) void browser.notifications.clear(id);
}
