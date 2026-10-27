import { browser } from 'wxt/browser';
import * as store from '@/core/storage/store';
import { pushClipboard, sendClipboard, sendQuietly } from '@/background/services/send';
import { show } from '@/background/platform/notifications';
import { readClipboard } from '@/background/platform/offscreen';
import { openPopout } from '@/background/platform/windows';
import { i18n } from '#i18n';

/** Keyboard shortcuts declared in wxt.config.ts (`commands`). */
export function registerCommands() {
  browser.commands.onCommand.addListener(async (command, tab) => {
    if (!(await store.get('token'))) return;
    if (command === 'push-current-page') {
      const active = tab ?? (await browser.tabs.query({ active: true, lastFocusedWindow: true }))[0];
      if (!active?.url) return;
      const { defaultTarget } = await store.get('settings');
      await sendQuietly({ type: 'link', title: active.title, url: active.url }, [defaultTarget], active.title ?? active.url);
    }
    if (command === 'push-clipboard') await pushClipboard();
    if (command === 'open-window') await openPopout();
    if (command === 'send-clipboard') {
      const text = await readClipboard();
      if (!text) return;
      try {
        await sendClipboard(text);
        await show(`info:clip-sent-${Date.now()}`, {
          title: i18n.t('bg.clipboardSent'),
          message: text.slice(0, 200),
          silent: true,
        });
      } catch (err) {
        await show(`info:clip-fail-${Date.now()}`, {
          title: i18n.t('bg.clipboardFailed'),
          message: err instanceof Error ? err.message : String(err),
          silent: true,
        });
      }
    }
  });
}
