import clsx from 'clsx';
import { BellRing, FolderOpen, Inbox, MessageSquareText, MonitorSmartphone, Plus, Send } from 'lucide-react';
import { useEffect, useMemo } from 'react';
import { call } from '@/core/messaging/rpc';
import { deviceKind, deviceName, isReachable, threadName, timeAgo } from '@/core/utils/format';
import { Avatar, Button, DeviceGlyph, TypeTile } from '@/ui/components';
import { fileKind } from '@/ui/features/feed/classify';
import { extension, type FeedContext, FeedItem, FILE_ICONS } from '@/ui/features/feed/FeedItem';
import { imageSrc } from '@/ui/features/feed/Gallery';
import { MirrorCard } from '@/ui/features/phone/MirrorCard';
import { recipientImage } from '@/ui/features/sms/ThreadView';
import { useNow } from '@/ui/hooks/use-now';
import { useStore } from '@/ui/hooks/use-store';
import type { Page as PageId } from '@/ui/app/Sidebar';
import { Card, Page, Stat } from './parts';
import { i18n } from '#i18n';

const WEEK = 7 * 24 * 3600;

function greeting(name: string) {
  const h = new Date().getHours();
  const key = h < 5 ? 'dash.greetEvening' : h < 12 ? 'dash.greetMorning' : h < 18 ? 'dash.greetAfternoon' : 'dash.greetEvening';
  return i18n.t(key, [name]);
}

/** The full page's home: what came in, what's on the phone, and where things stand. */
export function Overview({
  onPage,
  onNewPush,
  onThread,
}: {
  onPage: (p: PageId) => void;
  onNewPush: () => void;
  onThread: (device: string, thread: string) => void;
}) {
  useNow();
  const { pushes, devices, chats, subscriptions, me, selfDeviceIden, previews, mirrors, smsThreads } = useStore([
    'pushes',
    'devices',
    'chats',
    'subscriptions',
    'me',
    'selfDeviceIden',
    'previews',
    'mirrors',
    'smsThreads',
  ]);
  const ctx: FeedContext = { devices, chats, subscriptions, me, selfDeviceIden, previews };
  const now = Date.now() / 1000;

  const week = useMemo(() => pushes.filter((p) => p.created > now - WEEK).length, [pushes, now]);
  const files = useMemo(() => pushes.filter((p) => p.type === 'file'), [pushes]);
  const live = useMemo(() => mirrors.filter((m) => !m.dismissed), [mirrors]);
  const reachable = devices.filter(isReachable);
  const phone = useMemo(
    () => devices.filter((d) => d.has_sms && isReachable(d)).sort((a, b) => b.modified - a.modified)[0],
    [devices],
  );
  const threads = (phone && smsThreads[phone.iden]) || [];

  // Texts are cached for a few seconds; this fills the card without a second fetch.
  useEffect(() => {
    if (phone) void call('sms.threads', { device: phone.iden }).catch(() => undefined);
  }, [phone]);

  const first = (me?.name || me?.email || '').split(/[\s@]/)[0] ?? '';
  const today = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });

  return (
    <Page
      width="max-w-7xl"
      title={greeting(first)}
      subtitle={today}
      actions={
        <Button variant="primary" onClick={onNewPush}>
          <Plus size={16} strokeWidth={2.6} /> {i18n.t('dash.newPush')}
        </Button>
      }
    >
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <Stat
          icon={<Send size={19} />}
          label={i18n.t('dash.statWeek')}
          value={week}
          hint={i18n.t('dash.statLoaded', [String(pushes.length)])}
          onClick={() => onPage('feed')}
        />
        <Stat
          tone="file"
          icon={<FolderOpen size={19} />}
          label={i18n.t('dash.statFiles')}
          value={files.length}
          hint={i18n.t('dash.statImages', [String(files.filter((p) => fileKind(p) === 'image').length)])}
          onClick={() => onPage('files')}
        />
        <Stat
          tone="link"
          icon={<MonitorSmartphone size={19} />}
          label={i18n.t('dash.statDevices')}
          value={
            <>
              {reachable.length}
              <span className="text-base font-bold text-faint"> / {devices.length}</span>
            </>
          }
          hint={i18n.t('dash.statDevicesHint')}
          onClick={() => onPage('devices')}
        />
        <Stat
          tone="note"
          icon={<BellRing size={19} />}
          label={i18n.t('dash.statPhone')}
          value={live.length}
          hint={phone ? deviceName(phone) : undefined}
          onClick={() => onPage('phone')}
        />
      </div>

      <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-12">
        <Card
          className="lg:col-span-7"
          title={i18n.t('dash.recentPushes')}
          icon={<Inbox size={16} />}
          onMore={() => onPage('feed')}
          bodyClassName="pb-2"
        >
          {pushes.length ? (
            <ul className="divide-y divide-line">
              {pushes.slice(0, 6).map((p) => (
                <FeedItem key={p.iden} push={p} ctx={ctx} isNew={false} onPerson={() => onPage('feed')} />
              ))}
            </ul>
          ) : (
            <p className="px-2 pb-3 text-sm text-muted">{i18n.t('feed.emptyBody')}</p>
          )}
        </Card>

        <div className="flex flex-col gap-5 lg:col-span-5">
          <Card title={i18n.t('phone.now')} icon={<BellRing size={16} />} onMore={() => onPage('phone')} bodyClassName="pb-2">
            {live.length ? (
              <ul className="divide-y divide-line">
                {live.slice(0, 3).map((m) => (
                  <MirrorCard key={m.id} m={m} devices={devices} />
                ))}
              </ul>
            ) : (
              <p className="px-2 pb-2 text-sm text-muted">{i18n.t('dash.phoneQuiet')}</p>
            )}
          </Card>

          {phone && (
            <Card
              title={i18n.t('dash.latestTexts')}
              icon={<MessageSquareText size={16} />}
              onMore={() => onPage('sms')}
              bodyClassName="px-2 pb-2"
            >
              {threads.slice(0, 4).map((t) => (
                <button
                  key={t.id}
                  onClick={() => onThread(phone.iden, t.id)}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-start hover:bg-raised/70"
                >
                  <Avatar
                    src={t.recipients.length === 1 ? recipientImage(t.recipients[0]) : undefined}
                    name={threadName(t)}
                    size={34}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline gap-2">
                      <span className="truncate text-sm font-bold">{threadName(t)}</span>
                      {t.latest && <span className="ms-auto shrink-0 text-2xs text-faint">{timeAgo(t.latest.timestamp)}</span>}
                    </span>
                    <span dir="auto" className="block truncate text-xs text-muted">
                      {t.latest?.direction === 'outgoing' && i18n.t('sms.you')}
                      {t.latest?.body || (t.latest?.image_urls?.length ? i18n.t('sms.photo') : '')}
                    </span>
                  </span>
                </button>
              ))}
              {!threads.length && <p className="px-3 pb-2 text-sm text-muted">{i18n.t('sms.noThreadsBody')}</p>}
            </Card>
          )}
        </div>

        <Card
          className="lg:col-span-7"
          title={i18n.t('dash.recentFiles')}
          icon={<FolderOpen size={16} />}
          onMore={() => onPage('files')}
          bodyClassName="px-5 pb-5"
        >
          {files.length ? (
            <div className="grid grid-cols-4 gap-2.5 2xl:grid-cols-6">
              {files.slice(0, 12).map((p, i) => {
                const image = fileKind(p) === 'image';
                return (
                  <button
                    key={p.iden}
                    onClick={() => onPage('files')}
                    title={p.file_name}
                    className={clsx(
                      'group relative aspect-square overflow-hidden rounded-2xl bg-raised ring-1 ring-black/5',
                      // Two full rows: 4 across, or 6 on very wide screens.
                      i >= 8 && 'max-2xl:hidden',
                    )}
                  >
                    {image ? (
                      <img
                        src={imageSrc(p, 's400-c')}
                        alt=""
                        loading="lazy"
                        className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                    ) : (
                      <span className="grid size-full place-items-center bg-file-bg">
                        <TypeTile type="file" size={56} icon={FILE_ICONS[fileKind(p)]} label={extension(p.file_name)} />
                      </span>
                    )}
                    <span className="absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-black/60 to-transparent px-2.5 pb-2 pt-6 text-start text-2xs font-semibold text-white opacity-0 transition-opacity group-hover:opacity-100">
                      {p.file_name}
                    </span>
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-muted">{i18n.t('dash.filesEmpty')}</p>
          )}
        </Card>

        <Card
          className="lg:col-span-5"
          title={i18n.t('dash.devices')}
          icon={<MonitorSmartphone size={16} />}
          onMore={() => onPage('devices')}
          bodyClassName="px-2 pb-2"
        >
          {[...devices]
            .sort((a, b) => Number(isReachable(b)) - Number(isReachable(a)) || b.modified - a.modified)
            .slice(0, 5)
            .map((d) => {
              const on = isReachable(d);
              return (
                <div key={d.iden} className="flex items-center gap-3 rounded-xl px-3 py-2">
                  <span
                    className={clsx(
                      'grid size-9 place-items-center rounded-xl',
                      on ? 'bg-accent-soft text-accent-strong' : 'bg-raised text-faint',
                    )}
                  >
                    <DeviceGlyph device={d} size={17} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={clsx('block truncate text-sm font-bold', !on && 'text-muted')}>
                      {deviceName(d)}
                      {d.iden === selfDeviceIden && (
                        <span className="ms-1.5 text-xs font-medium text-faint">{i18n.t('settings.thisBrowser')}</span>
                      )}
                    </span>
                    <span className="block truncate text-xs text-faint">{deviceKind(d)}</span>
                  </span>
                  <span className={clsx('size-2 rounded-full', on ? 'bg-accent' : 'bg-line')} />
                </div>
              );
            })}
        </Card>
      </div>
    </Page>
  );
}
