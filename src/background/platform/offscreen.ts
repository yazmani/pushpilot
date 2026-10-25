import { browser, type Browser } from 'wxt/browser';
import * as store from '@/core/storage/store';
import type { SoundChoice } from '@/core/storage/store';

// The service worker has no DOM: sound and clipboard go through an offscreen page.
const URL_PATH = '/offscreen.html';
let creating: Promise<void> | null = null;

async function ensure(): Promise<void> {
  const url = browser.runtime.getURL(URL_PATH);
  const contexts = await browser.runtime.getContexts({
    contextTypes: ['OFFSCREEN_DOCUMENT' as Browser.runtime.ContextType],
    documentUrls: [url],
  });
  if (contexts.length) return;
  creating ??= browser.offscreen
    .createDocument({
      url: URL_PATH,
      reasons: ['AUDIO_PLAYBACK', 'CLIPBOARD'] as Browser.offscreen.Reason[],
      justification: 'Play the notification sound and copy received text to the clipboard.',
    })
    .finally(() => {
      creating = null;
    });
  await creating;
}

async function send<T>(message: Record<string, unknown>): Promise<T | undefined> {
  try {
    await ensure();
    // The page registers its listener on load; retry briefly on a cold start.
    for (let i = 0; i < 10; i++) {
      try {
        return (await browser.runtime.sendMessage({ offscreen: true, ...message })) as T;
      } catch {
        await new Promise((r) => setTimeout(r, 50));
      }
    }
  } catch (err) {
    console.warn('[pushpilot] offscreen failed', err);
  }
  return undefined;
}

export async function playSound(choice: SoundChoice) {
  const custom = choice === 'custom' ? await store.get('customSound') : null;
  return send({ action: 'sound', choice: custom ? 'custom' : choice === 'custom' ? 'takeoff' : choice, src: custom });
}

export function copyText(text: string) {
  return send({ action: 'copy', text });
}

export async function readClipboard(): Promise<string> {
  return (await send<string>({ action: 'paste' })) ?? '';
}
