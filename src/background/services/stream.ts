import { browser } from 'wxt/browser';
import { STREAM } from '@/core/pushbullet/client';
import { decryptJson } from '@/core/pushbullet/crypto';
import * as store from '@/core/storage/store';
import { ensureSelfDevice, syncPeople } from '@/background/services/account';
import { type DismissalPush, handleDismissal, handleMirror, type MirrorPush } from '@/background/services/mirror';
import { show } from '@/background/platform/notifications';
import { copyText } from '@/background/platform/offscreen';
import { syncPushes } from '@/background/services/pushes';
import { handleSmsChanged, type SmsChangedPush } from '@/background/services/sms';

// Pushbullet's realtime stream. Chrome 116+ keeps a service worker alive while
// its WebSocket is active, so we ping every 20s; the server sends a nop every
// 30s and silence beyond that means the socket is dead.
const KEEPALIVE_MS = 20_000;
const SILENCE_MS = 45_000;
export const WATCHDOG_ALARM = 'pushpilot-watchdog';

let ws: WebSocket | null = null;
let keepalive: ReturnType<typeof setInterval> | undefined;
let silence: ReturnType<typeof setTimeout> | undefined;
let retry: ReturnType<typeof setTimeout> | undefined;
let attempts = 0;
let connecting = false;

export function isOpen() {
  return ws?.readyState === WebSocket.OPEN;
}

function stopTimers() {
  clearInterval(keepalive);
  clearTimeout(silence);
  clearTimeout(retry);
}

function armSilence() {
  clearTimeout(silence);
  silence = setTimeout(() => {
    console.info('[pushpilot] stream went quiet, reconnecting');
    void reconnect();
  }, SILENCE_MS);
}

export async function connect() {
  if (connecting || isOpen()) return;
  const token = await store.get('token');
  if (!token) {
    await store.set({ connection: 'signed-out' });
    return;
  }
  connecting = true;
  stopTimers();
  ws?.close();
  await store.set({ connection: 'connecting' });

  const socket = new WebSocket(STREAM + token);
  ws = socket;

  socket.onopen = () => {
    connecting = false;
    attempts = 0;
    void store.set({ connection: 'live', lastError: null });
    armSilence();
    keepalive = setInterval(() => socket.readyState === WebSocket.OPEN && socket.send('keepalive'), KEEPALIVE_MS);
    // Catch up on anything pushed while we were away, and on device changes.
    void syncPushes({ reconnect: true }).catch(() => undefined);
    void ensureSelfDevice().catch(() => undefined);
  };

  socket.onmessage = (e) => {
    armSilence();
    void onMessage(String(e.data));
  };

  const down = () => {
    if (ws !== socket) return;
    connecting = false;
    ws = null;
    stopTimers();
    void scheduleRetry();
  };
  socket.onclose = down;
  socket.onerror = down;
}

async function scheduleRetry() {
  if (!(await store.get('token'))) return;
  await store.set({ connection: navigator.onLine ? 'connecting' : 'offline' });
  attempts++;
  // 2s, 4s, 8s … capped at a minute; the watchdog alarm covers us beyond that.
  const delay = Math.min(60_000, 1000 * 2 ** Math.min(attempts, 6));
  if (attempts > 6) await store.set({ connection: 'offline' });
  retry = setTimeout(() => void connect(), delay);
}

export async function reconnect() {
  attempts = 0;
  const old = ws;
  ws = null;
  connecting = false;
  stopTimers();
  old?.close();
  await connect();
}

export function disconnect() {
  const old = ws;
  ws = null;
  connecting = false;
  stopTimers();
  old?.close();
}

export function registerStreamWatchdog() {
  void browser.alarms.create(WATCHDOG_ALARM, { periodInMinutes: 1 });
  browser.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === WATCHDOG_ALARM && !isOpen() && !connecting) void connect();
  });
  self.addEventListener('online', () => void reconnect());
  self.addEventListener('offline', () => void store.set({ connection: 'offline' }));
}

interface StreamMessage {
  type: 'nop' | 'tickle' | 'push';
  subtype?: 'push' | 'device';
  push?: { type?: string; encrypted?: boolean; ciphertext?: string; [k: string]: unknown };
}

async function onMessage(raw: string) {
  let msg: StreamMessage;
  try {
    msg = JSON.parse(raw) as StreamMessage;
  } catch {
    return;
  }
  if (msg.type === 'nop') return;
  if (msg.type === 'tickle') {
    if (msg.subtype === 'push') void syncPushes();
    if (msg.subtype === 'device') {
      // Also re-registers this browser if its device was removed (say on pushbullet.com).
      void ensureSelfDevice().catch(() => undefined);
      void syncPeople().catch(() => undefined);
    }
    return;
  }
  if (msg.type !== 'push' || !msg.push) return;

  let push = msg.push;
  if (push.encrypted && push.ciphertext) {
    const key = await store.get('e2eKey');
    if (!key) {
      await store.set({ lastError: 'Your phone sends end-to-end encrypted data. Add your encryption password in Settings.' });
      return;
    }
    try {
      push = await decryptJson(key, push.ciphertext);
    } catch {
      await store.set({ lastError: 'Couldn’t decrypt data from your phone. Check your encryption password in Settings.' });
      return;
    }
  }

  switch (push.type) {
    case 'mirror':
      return handleMirror(push as unknown as MirrorPush);
    case 'dismissal':
      return handleDismissal(push as unknown as DismissalPush);
    case 'sms_changed':
      return handleSmsChanged(push as unknown as SmsChangedPush);
    case 'clip':
      return onClip(push as { body?: string; source_device_iden?: string });
  }
}

async function onClip(push: { body?: string; source_device_iden?: string }) {
  const { settings, selfDeviceIden, devices } = await store.getMany(['settings', 'selfDeviceIden', 'devices']);
  if (!settings.clipboardReceive || !push.body || push.source_device_iden === selfDeviceIden) return;
  await copyText(push.body);
  const from = devices.find((d) => d.iden === push.source_device_iden);
  await show(`info:clip-${Date.now()}`, {
    title: 'Clipboard updated',
    message: push.body.slice(0, 200),
    context: from ? `Copied from ${from.nickname ?? from.model}` : undefined,
    silent: true,
  });
}
