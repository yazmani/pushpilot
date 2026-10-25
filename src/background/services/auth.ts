import { browser } from 'wxt/browser';
import { Pushbullet } from '@/core/pushbullet/client';
import * as store from '@/core/storage/store';
import { ensureSelfDevice, syncPeople } from '@/background/services/account';
import { show } from '@/background/platform/notifications';
import { syncPushes } from '@/background/services/pushes';
import { connect, disconnect } from '@/background/services/stream';

// pushbullet.com keeps the signed-in account's access token in an `api_key`
// cookie (it set it for the old official extension). Reading it gives a
// one-click sign-in with no OAuth client to register.
const SITE = 'https://www.pushbullet.com';
const COOKIE = 'api_key';
const SIGNIN_TAB_KEY = 'signinTabId';

async function readCookie(): Promise<string | null> {
  const c = await browser.cookies.get({ url: SITE, name: COOKIE });
  return c?.value ? decodeURIComponent(c.value) : null;
}

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

export async function startWebSignIn() {
  const existing = await readCookie();
  if (existing) {
    await signInWithToken(existing);
    return;
  }
  const tab = await browser.tabs.create({ url: `${SITE}/signin`, active: true });
  await browser.storage.session.set({ [SIGNIN_TAB_KEY]: tab.id ?? -1 });
}

async function pendingTab(): Promise<number | undefined> {
  return (await browser.storage.session.get(SIGNIN_TAB_KEY))[SIGNIN_TAB_KEY] as number | undefined;
}

let finishing = false;

async function finishWebSignIn(token: string) {
  // Only while a sign-in is pending: visiting pushbullet.com after signing
  // out of Pushpilot must not quietly sign you back in.
  if (finishing || (await pendingTab()) === undefined || (await store.get('token'))) return;
  finishing = true;
  try {
    const me = await signInWithToken(token);
    const saved = await pendingTab();
    await browser.storage.session.remove(SIGNIN_TAB_KEY);
    if (saved !== undefined && saved >= 0) await browser.tabs.remove(saved).catch(() => undefined);
    await show('info:signed-in', {
      title: `Signed in as ${me.name || me.email}`,
      message: 'Click the Pushpilot icon to send this page to your phone.',
      silent: true,
    });
  } catch (err) {
    console.warn('[pushpilot] web sign-in failed', err);
  } finally {
    finishing = false;
  }
}

export function registerSignInWatchers() {
  browser.cookies.onChanged.addListener(({ cookie, removed }) => {
    if (removed || cookie.name !== COOKIE || !cookie.domain.endsWith('pushbullet.com')) return;
    void finishWebSignIn(decodeURIComponent(cookie.value));
  });

  // Already signed in on the site but the cookie expired: the web app also
  // keeps the account (with its api_key) in localStorage.
  browser.tabs.onUpdated.addListener(async (tabId, info, tab) => {
    if (info.status !== 'complete' || !tab.url?.startsWith(SITE)) return;
    if ((await pendingTab()) !== tabId) return;
    try {
      const [res] = await browser.scripting.executeScript({
        target: { tabId },
        func: () => {
          try {
            const raw = localStorage.getItem('account');
            const parsed = raw ? (JSON.parse(raw) as { api_key?: string; data?: { api_key?: string } }) : null;
            return parsed?.api_key ?? parsed?.data?.api_key ?? null;
          } catch {
            return null;
          }
        },
      });
      const token = (res?.result as string | null) ?? (await readCookie());
      if (token) await finishWebSignIn(token);
    } catch (err) {
      console.warn('[pushpilot] could not read pushbullet.com session', err);
    }
  });
}

export async function signOut() {
  disconnect();
  await browser.storage.local.remove(store.accountKeys);
  await store.set({ connection: 'signed-out' });
  await browser.action.setBadgeText({ text: '' });
  const all = await browser.notifications.getAll();
  for (const id of Object.keys(all)) void browser.notifications.clear(id);
}
