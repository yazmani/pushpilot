import { browser } from 'wxt/browser';
import * as store from '@/core/storage/store';

const POPOUT_KEY = 'popoutWindowId';

/**
 * Brings up Pushpilot on a given view: the toolbar popup when Chrome allows it,
 * otherwise a small standalone window that is reused on later calls.
 */
export async function openApp(intent: NonNullable<store.Schema['intent']>) {
  await store.set({ intent });
  try {
    await browser.action.openPopup();
    return;
  } catch {
    // No focused browser window (or unsupported) — fall through to a window.
  }
  await openPopout();
}

export async function openPopout() {
  const saved = (await browser.storage.session.get(POPOUT_KEY))[POPOUT_KEY] as number | undefined;
  if (saved !== undefined) {
    try {
      await browser.windows.update(saved, { focused: true });
      return;
    } catch {
      // window was closed
    }
  }
  const win = await browser.windows.create({
    url: browser.runtime.getURL('/popup.html?window=1'),
    type: 'popup',
    width: 440,
    height: 680,
    focused: true,
  });
  if (win?.id !== undefined) await browser.storage.session.set({ [POPOUT_KEY]: win.id });
}

export async function openUrl(url: string, active = true) {
  await browser.tabs.create({ url, active });
}
