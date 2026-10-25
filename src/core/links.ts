// Project links shown in the UI.
export const LINKS = {
  repo: 'https://github.com/yazmani/pushpilot',
  issues: 'https://github.com/yazmani/pushpilot/issues',
  sponsor: 'https://github.com/sponsors/yazmani',
  kofi: 'https://ko-fi.com/pushpilot',
} as const;

/**
 * Pushpilot's registered Pushbullet OAuth client (implicit flow). The client ID
 * is public by design; there is no secret in the extension.
 */
export const OAUTH = {
  clientId: 'yh0yaqlwPTLkFK9pzVk6RfGsgIxWEEZV',
  authorizeUrl: 'https://www.pushbullet.com/authorize',
} as const;

/** Successful sends before Pushpilot asks, once, for support. */
export const SUPPORT_PROMPT_AFTER = 20;
