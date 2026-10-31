// Project links shown in the UI.
export const LINKS = {
  repo: 'https://github.com/yazmani/pushpilot',
  issues: 'https://github.com/yazmani/pushpilot/issues',
  sponsor: 'https://github.com/sponsors/yazmani',
  kofi: 'https://ko-fi.com/pushpilot',
  store: 'https://chromewebstore.google.com/detail/pushpilot-for-pushbullet/pdiijobemepbckkbdeacfngodbeddmcf',
} as const;

/** Where to leave a rating, by extension ID: the store this install came from. */
export const REVIEWS: Record<string, string> = {
  pdiijobemepbckkbdeacfngodbeddmcf:
    'https://chromewebstore.google.com/detail/pushpilot-for-pushbullet/pdiijobemepbckkbdeacfngodbeddmcf/reviews',
  // Microsoft Edge Add-ons: reviews are on the listing page itself.
  coeohelkfpdbkdjilgkdnpbeflgdlmjh:
    'https://microsoftedge.microsoft.com/addons/detail/pushpilot-for-pushbullet/coeohelkfpdbkdjilgkdnpbeflgdlmjh',
};

/**
 * Pushpilot's registered Pushbullet OAuth clients (implicit flow), by extension
 * ID. A client allows a single redirect URI, https://<extension id>.chromiumapp.org/,
 * and each store gives the extension its own ID, so each store needs its own
 * client. Client IDs are public by design; there is no secret in the extension.
 * Builds with an ID that isn't listed sign in with an access token instead.
 */
export const OAUTH = {
  clients: {
    // Chrome Web Store, and unpacked builds (they carry the store's key).
    pdiijobemepbckkbdeacfngodbeddmcf: 'yh0yaqlwPTLkFK9pzVk6RfGsgIxWEEZV',
    // Microsoft Edge Add-ons.
    coeohelkfpdbkdjilgkdnpbeflgdlmjh: '8Sz0Jtis3YV98cPKxpr2EYnMZKUTpgjX',
  } as Record<string, string>,
  authorizeUrl: 'https://www.pushbullet.com/authorize',
} as const;

/** Successful sends before Pushpilot asks, once, for a rating. */
export const RATE_PROMPT_AFTER = 5;

/** Successful sends before Pushpilot asks, once, for support. */
export const SUPPORT_PROMPT_AFTER = 20;
