import { browser } from 'wxt/browser';
import type {
  Chat,
  ConnectionState,
  Device,
  Mirror,
  Push,
  SmsNotice,
  SmsThread,
  Subscription,
  User,
} from '@/core/pushbullet/types';
import type { LinkPreview } from '@/core/utils/links';
import type { OutboxItem } from '@/background/services/outbox';

/** '' is an install from before this was recorded. */
export type AuthKind = 'site' | 'oauth' | 'token' | '';
export type Theme = 'system' | 'light' | 'dark';
export type Tab = 'send' | 'feed' | 'phone' | 'sms';
export type SoundChoice = 'takeoff' | 'chime' | 'pop' | 'ding' | 'custom';

export interface Settings {
  theme: Theme;
  defaultTab: Tab;
  /** Remembered target, serialized with targetKey(). */
  defaultTarget: string;
  /** Send the current tab's link when the popup opens, prefilled. */
  prefillCurrentPage: boolean;
  closeAfterSend: boolean;
  contextMenu: boolean;

  // Which incoming pushes count (notify, badge, auto-open)
  /** Pushes addressed to "All devices". */
  receiveAll: boolean;
  /** Pushes addressed to one of your other devices. */
  receiveOthers: boolean;
  /** Pushes you sent from this browser. */
  receiveOwn: boolean;
  /** Other browser devices whose pushes count as this browser's, like the old Pushbullet extension's "Chrome". */
  receiveFor: string[];
  showChannels: boolean;

  // Notifications
  notifyPushes: boolean;
  notifyMirrors: boolean;
  notifySms: boolean;
  sound: boolean;
  soundChoice: SoundChoice;
  /** Keep push toasts on screen until clicked. */
  sticky: boolean;
  /** Keep phone-notification toasts on screen until clicked. */
  stickyMirrors: boolean;
  /** Closing a toast with its × marks the push done / dismisses on the phone. */
  closeDismisses: boolean;

  // Auto-open
  autoOpenLinks: boolean;
  autoOpenFiles: boolean;
  autoOpenFromPeople: boolean;
  /** Switch to the tab instead of opening it in the background. */
  autoOpenActive: boolean;
  /** Also open links that arrived while Pushpilot was offline. */
  autoOpenOnReconnect: boolean;
  /** Skip the toast when the link was opened for you. */
  hideAutoOpened: boolean;

  // Phone
  mirrorEnabled: boolean;
  autoCopyCodes: boolean;
  clipboardReceive: boolean;

  // Badge
  badge: boolean;
  badgeFeed: boolean;
  badgePhone: boolean;
  badgeSms: boolean;
  /** Phone count is what's still on the phone, not what's new since you last looked. */
  badgePhoneLive: boolean;

  /** Rich previews for links in the feed (needs optional site access). */
  linkPreviews: boolean;
  snoozeUntil: number;
}

export const defaultSettings: Settings = {
  theme: 'light',
  defaultTab: 'send',
  defaultTarget: 'all',
  prefillCurrentPage: true,
  closeAfterSend: false,
  contextMenu: true,
  receiveAll: true,
  receiveOthers: false,
  receiveOwn: false,
  receiveFor: [],
  showChannels: false,
  notifyPushes: true,
  notifyMirrors: true,
  notifySms: true,
  sound: true,
  soundChoice: 'takeoff',
  sticky: false,
  stickyMirrors: false,
  closeDismisses: true,
  autoOpenLinks: true,
  autoOpenFiles: true,
  autoOpenFromPeople: false,
  autoOpenActive: false,
  autoOpenOnReconnect: false,
  hideAutoOpened: false,
  mirrorEnabled: true,
  autoCopyCodes: false,
  clipboardReceive: false,
  badge: true,
  badgeFeed: true,
  badgePhone: true,
  badgeSms: true,
  badgePhoneLive: false,
  linkPreviews: true,
  snoozeUntil: 0,
};

export interface Unread {
  feed: number;
  phone: number;
  sms: number;
}

export interface Schema {
  token: string | null;
  me: User | null;
  devices: Device[];
  chats: Chat[];
  subscriptions: Subscription[];
  pushes: Push[];
  pushCursor: number;
  /** Where older history continues: '' = from the newest, null = all loaded. */
  historyCursor: string | null;
  mirrors: Mirror[];
  smsThreads: Record<string, SmsThread[]>;
  smsNotices: SmsNotice[];
  selfDeviceIden: string | null;
  /** True once selfDeviceIden is a device this install registered (never shared with another browser). */
  selfDeviceOwned: boolean;
  e2eKey: string | null;
  /** Link metadata (title, image, kind) keyed by URL, from the composer or fetched for the feed. */
  previews: Record<string, LinkPreview>;
  /** Custom notification sound as a data: URL. */
  customSound: string | null;
  settings: Settings;
  unread: Unread;
  connection: ConnectionState;
  lastError: string | null;
  /** Pushbullet is rate-limiting the account until then (ms since epoch). */
  rateLimitedUntil: number;
  /** Pushes waiting for the connection to come back (see background/services/outbox.ts). */
  outbox: OutboxItem[];
  /** Hand-off from the context menu / notifications to the popup. */
  intent: { view: Tab; thread?: string; device?: string; mirror?: string } | null;
  /** Successful sends from this install, for the one-time support prompt. */
  sendCount: number;
  /** The support prompt was shown and acted on or dismissed. */
  supportPromptSeen: boolean;
  /** The rating prompt was shown and acted on or dismissed. */
  ratePromptSeen: boolean;
  /** Bumped when a changed default should reach existing installs (see background/index.ts). */
  settingsVersion: number;
  /** Minor version ("1.1") whose What's new card was dismissed, or set on a fresh install. */
  whatsNewSeen: string;
  /** The first-run checklist in the Send view; on for new installs until finished or dismissed. */
  setupGuide: boolean;
  /** The push-clipboard shortcut was used at least once (a step of the checklist). */
  triedShortcut: boolean;
  /**
   * How this install signed in. Pushes made with an OAuth app's token ('oauth')
   * show in the Pushbullet apps under Following › Pushpilot instead of Me.
   */
  authKind: AuthKind;
  /** Device warnings (see core/setup.ts) dismissed from the popup, by issueKey(). */
  dismissedIssues: string[];
}

export const defaults: Schema = {
  token: null,
  me: null,
  devices: [],
  chats: [],
  subscriptions: [],
  pushes: [],
  pushCursor: 0,
  historyCursor: '',
  mirrors: [],
  smsThreads: {},
  smsNotices: [],
  selfDeviceIden: null,
  selfDeviceOwned: false,
  e2eKey: null,
  previews: {},
  customSound: null,
  settings: defaultSettings,
  unread: { feed: 0, phone: 0, sms: 0 },
  connection: 'signed-out',
  lastError: null,
  rateLimitedUntil: 0,
  outbox: [],
  intent: null,
  sendCount: 0,
  supportPromptSeen: false,
  ratePromptSeen: false,
  settingsVersion: 0,
  whatsNewSeen: '',
  setupGuide: false,
  triedShortcut: false,
  authKind: '',
  dismissedIssues: [],
};

export type Key = keyof Schema;

export async function get<K extends Key>(key: K): Promise<Schema[K]> {
  const res = await browser.storage.local.get(key);
  const value = res[key] as Schema[K] | undefined;
  if (key === 'settings') return { ...defaultSettings, ...(value as Settings | undefined) } as Schema[K];
  return value === undefined ? defaults[key] : value;
}

export async function getMany<K extends Key>(keys: K[]): Promise<Pick<Schema, K>> {
  const res = await browser.storage.local.get(keys);
  const out = {} as Pick<Schema, K>;
  for (const key of keys) {
    const value = res[key];
    out[key] = (value === undefined ? defaults[key] : value) as Schema[K];
    if (key === 'settings') {
      out[key] = { ...defaultSettings, ...(value as Settings | undefined) } as Schema[K];
    }
  }
  return out;
}

export function set(values: Partial<Schema>): Promise<void> {
  return browser.storage.local.set(values);
}

// Serialised read-modify-write per key so overlapping background updates
// (a tickle racing a dismissal) never drop each other's changes.
const queues = new Map<Key, Promise<unknown>>();

export function update<K extends Key>(key: K, fn: (value: Schema[K]) => Schema[K]): Promise<Schema[K]> {
  const prev = queues.get(key) ?? Promise.resolve();
  const next = prev.then(async () => {
    const value = fn(await get(key));
    await set({ [key]: value } as Partial<Schema>);
    return value;
  });
  queues.set(
    key,
    next.catch(() => undefined),
  );
  return next;
}

export async function updateSettings(patch: Partial<Settings>): Promise<Settings> {
  return update('settings', (s) => ({ ...s, ...patch }));
}

export function onChange(fn: (changes: Partial<Schema>) => void): () => void {
  const listener = (changes: Record<string, { newValue?: unknown }>, area: string) => {
    if (area !== 'local') return;
    const out: Partial<Schema> = {};
    for (const [key, change] of Object.entries(changes)) {
      (out as Record<string, unknown>)[key] = change.newValue ?? defaults[key as Key];
    }
    fn(out);
  };
  browser.storage.onChanged.addListener(listener);
  return () => browser.storage.onChanged.removeListener(listener);
}

/**
 * Everything account-specific; wiped on sign-out. The self device is kept so
 * signing back in reuses it instead of registering another one.
 */
export const accountKeys: Key[] = [
  'token',
  'authKind',
  'me',
  'devices',
  'chats',
  'subscriptions',
  'pushes',
  'pushCursor',
  'historyCursor',
  'outbox',
  'mirrors',
  'smsThreads',
  'smsNotices',
  'e2eKey',
  'previews',
  'unread',
  'lastError',
  'intent',
];
