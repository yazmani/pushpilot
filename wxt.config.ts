import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'wxt';

// The Chrome Web Store item's public key. Builds you load unpacked (and `npm run
// dev`) get the store's extension ID, which the OAuth redirect depends on. The
// store zip leaves it out (`npm run zip` sets STORE_BUILD); the store keeps its own.
const STORE_PUBLIC_KEY =
  'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAtbMg6nbwu3RxuFOGSUf4bpioPzI59jClykWP0CYRNJ2Ovjx/2k86PKfVjXW7k91k36sNQ8ipjy7jVFaFgA0LuFONqJ+TDKLnY7WM4h8JJT3zD8J6dXC86pIzmgfwi6m/sSPyeGoPcysd5QaRtWjfIIHYhdMjNLZZEnjSb/uW2OrTqX4sX0fMQ9xIPenHrHQ1CPneKOSOx5b/J8CdW3tsp8NNertKWEHU/YiZ3vvdspk/HDmABVUY1UIGMsdB5rNyU14Ch3MKKrrWUuVMNmUji7m0YChaW3X7fYfK1zRjH9gvXM52JUMp2XWfCWILvkVSadvJd2CwzteP+gRC9yeiEwIDAQAB';

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ['@wxt-dev/module-react', '@wxt-dev/i18n/module'],
  srcDir: 'src',
  // Every extension context lives here: the popup, side panel, options and
  // offscreen pages, plus background.ts (WXT discovers all entrypoints in one folder).
  entrypointsDir: 'pages',
  publicDir: 'src/public',
  // Visible (non-dot) folder so browser "Load unpacked" dialogs can see it.
  outDir: 'dist',
  vite: () => ({
    plugins: [tailwindcss()],
  }),
  manifest: {
    // Strings come from src/locales/<language>.yml.
    default_locale: 'en',
    name: '__MSG_extName__',
    short_name: 'Pushpilot',
    description: '__MSG_extDescription__',
    ...(process.env.STORE_BUILD ? {} : { key: STORE_PUBLIC_KEY }),
    minimum_chrome_version: '127',
    homepage_url: 'https://yazmani.github.io/pushpilot/',
    permissions: [
      'storage',
      'unlimitedStorage',
      'notifications',
      'contextMenus',
      'tabs',
      'activeTab',
      'alarms',
      'offscreen',
      'identity',
      'scripting',
      'sidePanel',
      'favicon',
      'clipboardRead',
      'clipboardWrite',
    ],
    host_permissions: [
      'https://api.pushbullet.com/*',
      'https://*.pushbulletusercontent.com/*',
      'https://*.pushbulletusercontent2.com/*',
      'https://*.googleusercontent.com/*',
      'https://i.ytimg.com/*',
      'https://www.youtube.com/oembed*',
      'https://opengraph.githubassets.com/*',
    ],
    // Asked for only when you turn on link previews in Settings.
    optional_host_permissions: ['<all_urls>'],
    action: {
      default_title: 'Pushpilot',
    },
    commands: {
      _execute_action: {
        suggested_key: { default: 'Alt+Shift+R' },
        description: '__MSG_cmdOpen__',
      },
      'push-current-page': {
        suggested_key: { default: 'Alt+Shift+P' },
        description: '__MSG_cmdPushPage__',
      },
      // Global: they work from any app while the browser runs. Chrome allows
      // at most four suggested keys, and only Ctrl+Shift+[0-9] for global ones
      // (⌘⇧ on a Mac).
      'push-clipboard': {
        suggested_key: { default: 'Ctrl+Shift+9' },
        description: '__MSG_cmdPushClipboard__',
        global: true,
      },
      'open-window': {
        suggested_key: { default: 'Ctrl+Shift+8' },
        description: '__MSG_cmdOpenWindow__',
        global: true,
      },
      'send-clipboard': {
        description: '__MSG_cmdSendClipboard__',
      },
    },
  },
});
