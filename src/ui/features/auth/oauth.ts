import { browser } from 'wxt/browser';
import { OAUTH } from '@/core/links';
import { call } from '@/core/messaging/rpc';

/**
 * Signs in through Pushbullet's OAuth page (implicit flow) and hands the token
 * to the worker. Runs in an extension page that stays open: the auth window
 * would close the toolbar popup mid-flow, and the worker can be stopped while
 * the user is logging in.
 */
export async function signInWithPushbullet() {
  const url = new URL(OAUTH.authorizeUrl);
  url.searchParams.set('client_id', OAUTH.clientId);
  url.searchParams.set('redirect_uri', browser.identity.getRedirectURL());
  url.searchParams.set('response_type', 'token');
  url.searchParams.set('scope', 'everything');

  let result: string | undefined;
  try {
    result = await browser.identity.launchWebAuthFlow({ url: url.toString(), interactive: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (/did not approve|cancel|closed/i.test(message)) throw new Error('Sign-in was cancelled.');
    throw new Error(`Couldn’t open Pushbullet’s sign-in: ${message}`);
  }
  if (!result) throw new Error('Sign-in was cancelled.');

  const returned = new URL(result);
  const params = new URLSearchParams(returned.hash.slice(1));
  const token = params.get('access_token');
  const error = params.get('error') ?? returned.searchParams.get('error');
  if (!token) {
    throw new Error(
      error === 'access_denied'
        ? 'Sign-in was cancelled.'
        : `Pushbullet didn’t return an access token${error ? ` (${error})` : ''}.`,
    );
  }
  await call('auth.token', { token });
}

/** From the toolbar popup: continue in Settings, which stays open during sign-in. */
export function continueSignInInSettings() {
  void browser.tabs.create({ url: browser.runtime.getURL('/options.html#signin') });
  window.close();
}
