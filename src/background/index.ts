// Wires the service worker together. Called once per worker start from
// pages/background.ts; every listener is registered synchronously so Chrome can
// wake the worker for its events.
import { browser } from 'wxt/browser';
import * as store from '@/core/storage/store';
import { ensureSelfDevice, syncPeople } from '@/background/services/account';
import { signOut } from '@/background/services/auth';
import { registerBadge, updateBadge } from '@/background/platform/badge';
import { rebuildMenus, registerMenuClicks } from '@/background/platform/menus';
import { registerMirrorNotifications } from '@/background/services/mirror';
import { registerNotificationListeners } from '@/background/platform/notifications';
import { registerPushNotifications } from '@/background/services/pushes';
import { registerRpc } from '@/background/router';
import { setExpiredHandler } from '@/background/session';
import { registerSmsNotifications } from '@/background/services/sms';
import { connect, registerStreamWatchdog } from '@/background/services/stream';
import { registerCommands } from '@/background/platform/commands';

export function startBackground() {
  setExpiredHandler(signOut);
  registerRpc();
  registerNotificationListeners();
  registerPushNotifications();
  registerMirrorNotifications();
  registerSmsNotifications();
  registerMenuClicks();
  registerStreamWatchdog();
  registerBadge();

  store.onChange((changes) => {
    if ('devices' in changes || 'chats' in changes || 'token' in changes || 'settings' in changes) {
      void rebuildMenus();
    }
  });

  browser.runtime.onInstalled.addListener(async ({ reason }) => {
    void rebuildMenus();
    if (reason === 'install' && !(await store.get('token'))) {
      await browser.runtime.openOptionsPage();
    }
  });

  registerCommands();

  // Cold start (browser launch or the worker waking up for any event).
  void (async () => {
    await updateBadge();
    // Defaults that changed before the first store release: light theme, and
    // images and files open like links. Saved settings keep the old values, so
    // apply the new ones once.
    if ((await store.get('settingsVersion')) < 1) {
      const { theme } = await store.get('settings');
      await store.updateSettings({ autoOpenFiles: true, ...(theme === 'system' && { theme: 'light' }) });
      await store.set({ settingsVersion: 1 });
    }
    if (await store.get('token')) {
      // Installs from before per-browser devices shared one; give this one its own.
      if (!(await store.get('selfDeviceOwned'))) await ensureSelfDevice().catch(() => undefined);
      await connect();
      // People and channels have no tickle; refresh them at most every 10 minutes of wake-ups.
      const { peopleSyncedAt = 0 } = (await browser.storage.session.get('peopleSyncedAt')) as { peopleSyncedAt?: number };
      if (Date.now() - peopleSyncedAt > 10 * 60_000) {
        await browser.storage.session.set({ peopleSyncedAt: Date.now() });
        void syncPeople().catch(() => undefined);
      }
    }
  })();
}
