import type { OutgoingPush } from '@/core/messaging/rpc';
import { ApiError } from '@/core/pushbullet/client';
import * as store from '@/core/storage/store';
import { uid } from '@/core/utils/format';
import { sendPush } from '@/background/services/send';

/**
 * Pushes that couldn't go out because the connection dropped (or Pushbullet
 * was briefly down) wait here and are retried when the browser is back
 * online, instead of being lost.
 */
export interface OutboxItem {
  id: string;
  push: OutgoingPush;
  targets: string[];
  created: number;
  /** Set when a retry failed for a reason waiting won't fix. */
  error?: string;
}

/** Offline, network failure, Pushbullet down or rate-limiting: worth retrying later. */
export function isTransient(err: unknown): boolean {
  if (!navigator.onLine) return true;
  if (err instanceof ApiError) return err.status >= 500 || err.status === 429;
  return err instanceof TypeError; // fetch's "Failed to fetch"
}

/** Sends now, or queues the push when the failure is temporary. */
export async function sendOrQueue(push: OutgoingPush, targets: string[]): Promise<{ queued: boolean }> {
  try {
    await sendPush(push, targets);
    return { queued: false };
  } catch (err) {
    if (!isTransient(err)) throw err;
    await store.update('outbox', (all) => [...all, { id: uid(), push, targets, created: Date.now() / 1000 }]);
    return { queued: true };
  }
}

let flushing: Promise<void> | null = null;

/** Retries everything waiting, oldest first. Runs one at a time. */
export function flushOutbox(): Promise<void> {
  flushing ??= (async () => {
    for (const item of await store.get('outbox')) {
      if (item.error) continue;
      try {
        await sendPush(item.push, item.targets);
        await store.update('outbox', (all) => all.filter((x) => x.id !== item.id));
      } catch (err) {
        if (isTransient(err)) break; // still offline: try again on the next trigger
        const error = err instanceof Error ? err.message : String(err);
        await store.update('outbox', (all) => all.map((x) => (x.id === item.id ? { ...x, error } : x)));
      }
    }
  })().finally(() => {
    flushing = null;
  });
  return flushing;
}

export async function retryOutboxItem(id: string) {
  await store.update('outbox', (all) => all.map((x) => (x.id === id ? { ...x, error: undefined } : x)));
  await flushOutbox();
}

export function cancelOutboxItem(id: string) {
  return store.update('outbox', (all) => all.filter((x) => x.id !== id));
}
