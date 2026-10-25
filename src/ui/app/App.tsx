import { RefreshCw } from 'lucide-react';
import { useEffect, useState } from 'react';
import { call } from '@/core/messaging/rpc';
import * as store from '@/core/storage/store';
import type { Tab } from '@/core/storage/store';
import { Centered, Spinner, ToastBar } from '@/ui/components';
import { SignIn } from '@/ui/features/auth/SignIn';
import { FeedView } from '@/ui/features/feed/FeedView';
import { PhoneView } from '@/ui/features/phone/PhoneView';
import { SendView } from '@/ui/features/send/SendView';
import { SmsView } from '@/ui/features/sms/SmsView';
import { useStore } from '@/ui/hooks/use-store';
import { useTheme } from '@/ui/hooks/use-theme';
import { ToastProvider } from '@/ui/hooks/use-toast';
import { Header } from './Header';

/** Where the app is rendered: toolbar popup, side panel, or the pop-out window. */
export type Mode = 'popup' | 'panel' | 'window';

/** Deep link from a notification click into a specific item. */
export interface Intent {
  thread?: string;
  device?: string;
  mirror?: string;
}

export function App({ mode }: { mode: Mode }) {
  useTheme();
  return (
    <ToastProvider render={(t) => <ToastBar toast={t} />}>
      <Shell mode={mode} />
    </ToastProvider>
  );
}

function Shell({ mode }: { mode: Mode }) {
  const { token, me, settings, unread, connection, lastError, devices, ready } = useStore([
    'token',
    'me',
    'settings',
    'unread',
    'connection',
    'lastError',
    'devices',
  ]);
  const [tab, setTab] = useState<Tab | null>(null);
  const [intent, setIntent] = useState<Intent>({});

  // Starting tab: a hand-off from a notification wins over the default.
  useEffect(() => {
    if (!ready || tab) return;
    void store.get('intent').then((it) => {
      if (it) {
        setIntent({ thread: it.thread, device: it.device, mirror: it.mirror });
        setTab(it.view);
        void store.set({ intent: null });
      } else {
        setTab(settings.defaultTab);
      }
    });
  }, [ready, tab, settings.defaultTab]);

  // Looking at a tab marks it read.
  useEffect(() => {
    if (!token || !tab || tab === 'send') return;
    if (unread[tab]) void call('unread.clear', { view: tab });
  }, [tab, token, unread]);

  if (!ready || (token && !tab)) {
    return (
      <Centered>
        <Spinner />
      </Centered>
    );
  }
  if (!token) return <SignIn inPopup={mode === 'popup'} />;

  return (
    <div className="flex h-full flex-col bg-bg">
      <Header
        mode={mode}
        me={me}
        connection={connection}
        snoozeUntil={settings.snoozeUntil}
        tab={tab!}
        onTab={setTab}
        unread={unread}
        showSms={devices.some((d) => d.has_sms)}
      />

      {(connection === 'offline' || lastError) && (
        <div className="flex shrink-0 items-center gap-2 border-b border-line bg-note-bg px-3.5 py-2 text-xs text-ink">
          <span className="flex-1 leading-relaxed">
            {connection === 'offline' ? 'Can’t reach Pushbullet. Retrying in the background.' : lastError}
          </span>
          {connection === 'offline' ? (
            <button className="flex items-center gap-1 font-bold text-note-fg" onClick={() => void call('reconnect')}>
              <RefreshCw size={12} /> Retry
            </button>
          ) : (
            <button className="font-bold text-note-fg" onClick={() => void store.set({ lastError: null })}>
              Dismiss
            </button>
          )}
        </div>
      )}

      <main className="relative min-h-0 flex-1 bg-bg">
        {tab === 'send' && <SendView mode={mode} onOpenFeed={() => setTab('feed')} />}
        {tab === 'feed' && <FeedView />}
        {tab === 'phone' && <PhoneView focus={intent.mirror} />}
        {tab === 'sms' && <SmsView device={intent.device} thread={intent.thread} />}
      </main>
    </div>
  );
}
