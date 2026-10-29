import { X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { call } from '@/core/messaging/rpc';
import type { Tab } from '@/core/storage/store';
import { IconButton } from '@/ui/components';
import { Banners, type Intent } from '@/ui/app/App';
import { type Page as PageId, Sidebar } from '@/ui/app/Sidebar';
import { FeedView } from '@/ui/features/feed/FeedView';
import { PhoneView } from '@/ui/features/phone/PhoneView';
import { SendView } from '@/ui/features/send/SendView';
import { SmsView } from '@/ui/features/sms/SmsView';
import { useStore } from '@/ui/hooks/use-store';
import { DevicesView } from './DevicesView';
import { FilesView } from './FilesView';
import { Overview } from './Overview';
import { Page } from './parts';
import { i18n } from '#i18n';

/** Pushpilot as a full page on a big screen: a sidebar, roomy pages, and the composer as a slide-over. */
export function Dashboard({ initialTab, intent }: { initialTab: Tab; intent: Intent }) {
  const { me, settings, unread, connection, devices, pushes } = useStore([
    'me',
    'settings',
    'unread',
    'connection',
    'devices',
    'pushes',
  ]);
  // Notifications and texts hand off straight to their page; otherwise start on the overview.
  const [page, setPage] = useState<PageId>(initialTab === 'send' ? 'home' : initialTab);
  const [sms, setSms] = useState<{ device?: string; thread?: string }>({ device: intent.device, thread: intent.thread });
  const [composer, setComposer] = useState<{ target?: string } | null>(null);

  // Looking at a section marks it read, like the popup's tabs.
  useEffect(() => {
    if ((page === 'feed' || page === 'phone' || page === 'sms') && unread[page]) void call('unread.clear', { view: page });
  }, [page, unread]);

  return (
    <div className="flex h-full bg-bg">
      <Sidebar
        me={me}
        connection={connection}
        snoozeUntil={settings.snoozeUntil}
        page={page}
        onPage={setPage}
        onNewPush={() => setComposer({})}
        unread={unread}
        showSms={devices.some((d) => d.has_sms)}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <Banners />
        <main className="relative min-h-0 flex-1">
          {page === 'home' && (
            <Overview
              onPage={setPage}
              onNewPush={() => setComposer({})}
              onThread={(device, thread) => {
                setSms({ device, thread });
                setPage('sms');
              }}
            />
          )}
          {page === 'feed' && (
            <Page fill width="max-w-4xl" title={i18n.t('tabs.feed')} subtitle={i18n.t('dash.feedCount', pushes.length)}>
              {/* The feed pads itself for the popup; line it up with the page title instead. */}
              <div className="-mx-3.5 h-full">
                <FeedView />
              </div>
            </Page>
          )}
          {page === 'files' && <FilesView />}
          {page === 'phone' && (
            <Page fill width="max-w-3xl" title={i18n.t('tabs.phone')} subtitle={i18n.t('dash.phoneSubtitle')}>
              <div className="-mx-3.5 h-full">
                <PhoneView focus={intent.mirror} />
              </div>
            </Page>
          )}
          {page === 'sms' && (
            <Page fill width="max-w-7xl" title={i18n.t('tabs.sms')} subtitle={i18n.t('dash.smsSubtitle')}>
              <SmsView key={`${sms.device}:${sms.thread}`} device={sms.device} thread={sms.thread} split />
            </Page>
          )}
          {page === 'devices' && <DevicesView onSend={(target) => setComposer({ target })} />}
        </main>
      </div>

      {composer && <Composer target={composer.target} onClose={() => setComposer(null)} onOpenFeed={() => setPage('feed')} />}
    </div>
  );
}

/** The popup's Send view as a panel sliding in from the side. */
function Composer({ target, onClose, onOpenFeed }: { target?: string; onClose: () => void; onOpenFeed: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-40 flex justify-end" role="presentation">
      <div className="animate-fade absolute inset-0 bg-black/25 backdrop-blur-[2px]" onClick={onClose} />
      <section
        role="dialog"
        aria-label={i18n.t('dash.newPush')}
        className="animate-slide relative flex h-full w-[460px] max-w-full flex-col border-s border-line bg-bg shadow-[0_0_60px_-10px_rgba(0,0,0,0.35)]"
      >
        <div className="flex shrink-0 items-center gap-2 px-5 pb-1 pt-5">
          <h2 className="flex-1 text-lg font-extrabold tracking-[-0.02em]">{i18n.t('dash.newPush')}</h2>
          <IconButton label={i18n.t('gallery.close')} onClick={onClose}>
            <X size={18} />
          </IconButton>
        </div>
        <div className="min-h-0 flex-1">
          <SendView
            mode="tab"
            target={target}
            onOpenFeed={() => {
              onClose();
              onOpenFeed();
            }}
          />
        </div>
      </section>
    </div>
  );
}
