import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'wxt';

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ['@wxt-dev/module-react'],
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
    name: 'Pushpilot for Pushbullet',
    short_name: 'Pushpilot',
    description:
      'Send tabs, notes and files to your phone, see Android notifications and text from your browser. Unofficial Pushbullet client.',
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
      'cookies',
      'scripting',
      'sidePanel',
      'favicon',
      'clipboardRead',
      'clipboardWrite',
    ],
    host_permissions: [
      'https://api.pushbullet.com/*',
      'https://www.pushbullet.com/*',
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
        description: 'Open Pushpilot',
      },
      'push-current-page': {
        suggested_key: { default: 'Alt+Shift+P' },
        description: 'Push the current page to your default device',
      },
      'send-clipboard': {
        suggested_key: { default: 'Alt+Shift+C' },
        description: 'Send your clipboard to your other devices',
      },
    },
  },
});
