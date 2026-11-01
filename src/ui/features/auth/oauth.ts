import { browser } from 'wxt/browser';
import { OAUTH } from '@/core/links';
import { call } from '@/core/messaging/rpc';
import { ApiError, Pushbullet } from '@/core/pushbullet/client';
import { i18n } from '#i18n';

/** The OAuth client registered for this install's extension ID, if any (see OAUTH). */
export function oauthClientId(): string | undefined {
  return OAUTH.clients[browser.runtime.id];
}

/**
 * Signs in through Pushbullet's OAuth page (implicit flow) and hands the token
 * to the worker. Runs in an extension page that stays open: the auth window
 * would close the toolbar popup mid-flow, and the worker can be stopped while
 * the user is logging in.
 */
export async function signInWithPushbullet() {
  const clientId = oauthClientId();
  if (!clientId) throw new Error(i18n.t('signIn.openFailed', ['no OAuth client for this extension ID']));
  const url = new URL(OAUTH.authorizeUrl);
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('redirect_uri', browser.identity.getRedirectURL());
  url.searchParams.set('response_type', 'token');
  url.searchParams.set('scope', 'everything');

  let result: string | undefined;
  try {
    result = await browser.identity.launchWebAuthFlow({ url: url.toString(), interactive: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (/did not approve|cancel|closed/i.test(message)) throw new Error(i18n.t('signIn.cancelled'));
    throw new Error(i18n.t('signIn.openFailed', [message]));
  }
  if (!result) throw new Error(i18n.t('signIn.cancelled'));

  const returned = new URL(result);
  const params = new URLSearchParams(returned.hash.slice(1));
  const token = params.get('access_token');
  const error = params.get('error') ?? returned.searchParams.get('error');
  if (!token) {
    throw new Error(
      error === 'access_denied' ? i18n.t('signIn.cancelled') : i18n.t('signIn.noToken', [error ? ` (${error})` : '']),
    );
  }
  await call('auth.token', { token, kind: 'oauth' });
}

/** From the toolbar popup: continue in Settings, which stays open during sign-in. */
export function continueSignInInSettings() {
  void browser.tabs.create({ url: browser.runtime.getURL('/options.html#signin') });
  window.close();
}

const SITE = 'https://www.pushbullet.com/*';
const SITE_TIMEOUT = 5 * 60_000;

/** Whether pushbullet.com access was already granted (asking needs a click). */
export function hasSiteAccess() {
  return browser.permissions.contains({ origins: [SITE] });
}

/**
 * Signs in with the key pushbullet.com keeps for its own signed-in session,
 * the way the original Pushbullet extension did. Pushes made with it are
 * yours, so the Pushbullet apps show them under Me; an OAuth app's pushes
 * land under Following › <app> instead. Needs pushbullet.com access, asked
 * for here (it's within the optional host permission the manifest declares).
 *
 * `sameAccount` switches an existing sign-in over without touching history.
 */
export async function signInWithPushbulletSite({ sameAccount = false } = {}) {
  // request() first: it has to run while the click still counts.
  if (!(await browser.permissions.request({ origins: [SITE] }))) throw new Error(i18n.t('signIn.siteDenied'));
  const token = await readSiteKey();
  await call('auth.token', { token, kind: 'site', sameAccount });
}

/**
 * The api_key from a pushbullet.com tab: one that's open, or one opened for
 * this. Waits while you sign in there. Signing out of pushbullet.com can leave
 * the old, revoked key behind, so a key only counts once Pushbullet accepts it.
 */
async function readSiteKey(): Promise<string> {
  const existing = (await browser.tabs.query({ url: SITE }))[0];
  const tab = existing ?? (await browser.tabs.create({ url: 'https://www.pushbullet.com/', active: true }));
  // An open tab may sit in the background; bring it forward so you can sign in there.
  if (existing) {
    void browser.tabs.update(tab.id!, { active: true });
    if (tab.windowId !== undefined) void browser.windows.update(tab.windowId, { focused: true });
  }
  const deadline = Date.now() + SITE_TIMEOUT;
  let revoked = '';
  try {
    while (Date.now() < deadline) {
      if (!(await browser.tabs.get(tab.id!).catch(() => null))) throw new Error(i18n.t('signIn.cancelled'));
      const [result] = await browser.scripting
        .executeScript({
          target: { tabId: tab.id! },
          func: () => {
            try {
              return (JSON.parse(localStorage.getItem('account') || '{}') as { api_key?: string }).api_key ?? null;
            } catch {
              return null;
            }
          },
        })
        // The page is still loading, or showing Google's sign-in.
        .catch(() => []);
      const key = typeof result?.result === 'string' ? result.result : '';
      if (key && key !== revoked) {
        try {
          await new Pushbullet(key).me();
          return key;
        } catch (err) {
          if (!(err instanceof ApiError && err.unauthorized)) throw err;
          revoked = key;
        }
      }
      await new Promise((r) => setTimeout(r, 1000));
    }
    throw new Error(i18n.t('signIn.siteTimeout'));
  } finally {
    if (!existing && tab.id !== undefined) void browser.tabs.remove(tab.id).catch(() => undefined);
  }
}
