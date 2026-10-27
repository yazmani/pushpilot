import { browser } from 'wxt/browser';
import { deriveKey } from '@/core/pushbullet/crypto';
import type { Rpc, RpcMessage, RpcName } from '@/core/messaging/rpc';
import * as store from '@/core/storage/store';
import { renameDevice, renameSelfDevice, setChatMuted, syncMe, syncPeople } from '@/background/services/account';
import { bootstrap, signInWithToken, signOut } from '@/background/services/auth';
import { show } from '@/background/platform/notifications';
import { playSound } from '@/background/platform/offscreen';
import { fetchPreviews, savePreview } from '@/background/services/previews';
import { clearMirrors, dismissMirror, replyToMirror, triggerMirrorAction } from '@/background/services/mirror';
import { clearAllPushNotifications, deletePush, dismissPush, loadOlderPushes } from '@/background/services/pushes';
import { pushClipboard, sendPush } from '@/background/services/send';
import { fetchThread, fetchThreads, sendSms } from '@/background/services/sms';
import { reconnect } from '@/background/services/stream';
import { i18n } from '#i18n';

type Handlers = { [K in RpcName]: (req: Rpc[K]['req']) => Promise<Rpc[K]['res']> };

const handlers: Handlers = {
  'auth.token': async ({ token }) => {
    await signInWithToken(token);
  },
  'auth.signout': () => signOut(),
  sync: async () => {
    await syncMe();
    await bootstrap();
  },
  reconnect: () => reconnect(),
  'push.send': ({ push, targets }) => sendPush(push, targets),
  'push.dismiss': ({ iden }) => dismissPush(iden),
  'push.delete': ({ iden }) => deletePush(iden),
  'pushes.older': () => loadOlderPushes(),
  'unread.clear': async ({ view }) => {
    await store.update('unread', (u) => ({ ...u, [view]: 0 }));
    if (view === 'feed') await clearAllPushNotifications();
  },
  'mirror.dismiss': ({ id }) => dismissMirror(id),
  'mirror.action': ({ id, key }) => triggerMirrorAction(id, key),
  'mirror.reply': ({ id, message }) => replyToMirror(id, message),
  'mirror.clear': () => clearMirrors(),
  'sms.threads': ({ device, force }) => fetchThreads(device, force),
  'sms.thread': ({ device, thread }) => fetchThread(device, thread),
  'sms.send': ({ device, addresses, message }) => sendSms(device, addresses, message),
  'clip.push': () => pushClipboard(),
  'e2e.set': async ({ password }) => {
    if (!password) {
      await store.set({ e2eKey: null });
      return;
    }
    const me = (await store.get('me')) ?? (await syncMe());
    await store.set({ e2eKey: await deriveKey(password, me.iden), lastError: null });
  },
  'chat.mute': ({ iden, muted }) => setChatMuted(iden, muted),
  'history.clear': async () => {
    // Keep the cursor so cleared pushes don't come back on the next sync.
    await store.set({
      pushes: [],
      mirrors: [],
      smsNotices: [],
      unread: { feed: 0, phone: 0, sms: 0 },
      // …and don't fetch the cleared history back when the feed scrolls.
      historyCursor: null,
    });
    void syncPeople().catch(() => undefined);
  },
  'device.rename': ({ name, iden }) => (iden ? renameDevice(iden, name) : renameSelfDevice(name)),
  'sound.preview': async ({ choice }) => {
    await playSound(choice);
  },
  'preview.fetch': ({ urls }) => fetchPreviews(urls),
  'preview.save': ({ url, preview }) => savePreview(url, preview),
  'notify.test': () =>
    show(`info:test-${Date.now()}`, {
      title: i18n.t('bg.testTitle'),
      message: i18n.t('bg.testMessage'),
      context: i18n.t('bg.testContext'),
      buttons: [i18n.t('actions.open'), i18n.t('common.dismiss')],
    }),
};

export function registerRpc() {
  browser.runtime.onMessage.addListener((msg: unknown, _sender, sendResponse) => {
    const m = msg as RpcMessage & { offscreen?: boolean };
    if (!m || typeof m !== 'object' || !('rpc' in m) || m.offscreen) return;
    const { rpc, ...req } = m;
    const handler = handlers[rpc] as ((r: unknown) => Promise<unknown>) | undefined;
    if (!handler) return;
    handler(req).then(
      (data) => sendResponse({ ok: true, data }),
      (err: unknown) => {
        console.warn(`[pushpilot] ${rpc} failed`, err);
        sendResponse({ ok: false, error: err instanceof Error ? err.message : String(err) });
      },
    );
    return true;
  });
}
