import { browser } from 'wxt/browser';
import { copy, paste, play } from '@/background/platform/media';

browser.runtime.onMessage.addListener((msg: unknown, _sender, sendResponse) => {
  const m = msg as { offscreen?: boolean; action?: string; text?: string; choice?: string; src?: string | null };
  if (!m?.offscreen) return;
  if (m.action === 'sound') play(m.choice ?? 'takeoff', m.src);
  if (m.action === 'copy' && m.text) copy(m.text);
  if (m.action === 'paste') {
    sendResponse(paste());
    return;
  }
  sendResponse(true);
});
