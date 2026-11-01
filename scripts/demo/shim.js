// Stands in for the extension APIs so the built UI can run in a normal tab with
// the demo account. Used only by scripts/screenshots.mjs.
(() => {
  const data = window.__DEMO_DATA__;
  const params = new URLSearchParams(location.search);
  const store = {
    ...data,
    // Keep the one-time What's new card out of the pictures.
    whatsNewSeen: window.__MANIFEST__.version.split('.').slice(0, 2).join('.'),
    settings: {
      theme: params.get('theme') || 'light',
      defaultTab: params.get('tab') || 'send',
      defaultTarget: 'device:d-pixel',
      linkPreviews: true,
    },
  };
  const listeners = [];
  const noop = { addListener() {}, removeListener() {} };
  const area = {
    async get(keys) {
      const ks = typeof keys === 'string' ? [keys] : keys;
      return Object.fromEntries(ks.filter((k) => k in store).map((k) => [k, store[k]]));
    },
    async set(values) {
      Object.assign(store, values);
      const changes = Object.fromEntries(Object.entries(values).map(([k, v]) => [k, { newValue: v }]));
      listeners.forEach((l) => l(changes, 'local'));
    },
    async remove() {},
  };

  globalThis.browser = {
    runtime: {
      id: 'demo',
      getURL: (p) => p,
      getManifest: () => window.__MANIFEST__,
      async sendMessage(msg) {
        if (msg.rpc === 'sms.thread') return { ok: true, data: data.smsMessages };
        if (msg.rpc === 'sms.threads') return { ok: true, data: data.smsThreads[msg.device] ?? [] };
        if (msg.rpc === 'unread.clear') return { ok: true };
        if (msg.rpc === 'push.send') return { ok: true, data: { queued: false } };
        return { ok: true, data: undefined };
      },
      onMessage: noop,
      openOptionsPage() {},
    },
    storage: { local: area, session: area, onChanged: { addListener: (l) => listeners.push(l), removeListener() {} } },
    tabs: {
      async query() {
        return [data.tab];
      },
      onActivated: noop,
      onUpdated: noop,
      create() {},
    },
    windows: {
      async getCurrent() {
        return { id: 1 };
      },
      async getLastFocused() {
        return { id: 1 };
      },
      create() {},
    },
    scripting: {
      async executeScript() {
        return [{ result: data.scrape }];
      },
    },
    permissions: {
      async contains() {
        return true;
      },
      async request() {
        return true;
      },
    },
    sidePanel: { open() {} },
    i18n: {
      getMessage(key, subs = []) {
        const text = window.__MESSAGES__?.[key]?.message ?? '';
        return [].concat(subs).reduce((t, s, i) => t.replaceAll(`$${i + 1}`, s), text);
      },
      getUILanguage: () => 'en',
    },
    action: {
      async getUserSettings() {
        return { isOnToolbar: true };
      },
    },
    commands: {
      async getAll() {
        return [
          { name: '_execute_action', shortcut: '⌥⇧R' },
          { name: 'push-current-page', description: 'Push the current page to your default device', shortcut: '⌥⇧P' },
          { name: 'push-clipboard', description: 'Push what you copied to your default device', shortcut: '⇧⌘9' },
          { name: 'open-window', description: 'Open Pushpilot in a window', shortcut: '⇧⌘8' },
        ];
      },
    },
  };
})();
