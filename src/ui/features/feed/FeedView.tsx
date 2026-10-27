import clsx from 'clsx';
import {
  Archive,
  FileText,
  Film,
  Image,
  Inbox,
  Layers,
  Link2,
  Music,
  Paperclip,
  Radio,
  Search,
  StickyNote,
  X,
} from 'lucide-react';
import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { call } from '@/core/messaging/rpc';
import type { Push } from '@/core/pushbullet/types';
import { dayLabel, personName } from '@/core/utils/format';
import { Avatar, Empty, Group, IconButton, Spinner } from '@/ui/components';
import { useStore } from '@/ui/hooks/use-store';
import { counterpart, FILE_KINDS, fileKind, type FileKind, type Filter, matches } from './classify';
import { Conversation } from './Conversation';
import { type FeedContext, FeedItem } from './FeedItem';
import { Gallery } from './Gallery';
import { i18n } from '#i18n';

const SEEN_KEY = 'pushpilot.feedSeenAt';

const TYPES = [
  { type: 'all', icon: Layers },
  { type: 'link', icon: Link2 },
  { type: 'note', icon: StickyNote },
  { type: 'file', icon: Paperclip },
] as const;

const FILE_KIND_ICONS: Record<FileKind, typeof Layers> = {
  image: Image,
  video: Film,
  pdf: FileText,
  doc: FileText,
  audio: Music,
  other: Archive,
};
const PAGE = 50;

export function FeedView() {
  const { pushes, devices, chats, subscriptions, me, settings, selfDeviceIden, previews } = useStore([
    'pushes',
    'devices',
    'chats',
    'subscriptions',
    'me',
    'settings',
    'selfDeviceIden',
    'previews',
  ]);
  const [filter, setFilter] = useState<Filter>({ kind: 'all' });
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [limit, setLimit] = useState(PAGE);
  const { historyCursor } = useStore(['historyCursor']);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const moreOnServer = historyCursor !== null;

  // Snapshot "last visit" once per open so new items stay marked while you look.
  const seenAt = useMemo(() => {
    try {
      const v = Number(localStorage.getItem(SEEN_KEY) || 0);
      localStorage.setItem(SEEN_KEY, String(Date.now() / 1000));
      return v;
    } catch {
      return 0;
    }
  }, []);

  const visible = useMemo(
    () => pushes.filter((p) => matches(p, filter, me, query.trim().toLowerCase(), settings.showChannels)),
    [pushes, filter, query, me, settings.showChannels],
  );
  const people = useMemo(() => {
    const emails = new Set(pushes.map((p) => counterpart(p, me)).filter(Boolean));
    return chats.filter((c) => emails.has(c.with.email_normalized));
  }, [pushes, chats, me]);
  // Kinds of files there are, for the second row of chips under Files.
  const fileKinds = useMemo(() => {
    const present = new Set(pushes.filter((p) => p.type === 'file').map(fileKind));
    return FILE_KINDS.filter((k) => present.has(k));
  }, [pushes]);
  const filesOn = filter.kind === 'type' && filter.type === 'file';
  const gallery = filesOn && filter.file === 'image';
  const hasChannels = settings.showChannels && pushes.some((p) => p.channel_iden);
  const ctx: FeedContext = { devices, chats, subscriptions, me, selfDeviceIden, previews };

  // Ask the worker for previews of links on screen it hasn't looked up yet.
  const missing = useMemo(
    () =>
      visible
        .slice(0, limit)
        .filter((p) => p.type === 'link' && p.url && !previews[p.url])
        .map((p) => p.url!)
        .slice(0, 24),
    [visible, limit, previews],
  );
  const missingKey = missing.join('|');
  useEffect(() => {
    if (missingKey && settings.linkPreviews) void call('preview.fetch', { urls: missingKey.split('|') }).catch(() => undefined);
  }, [missingKey, settings.linkPreviews]);

  // Scrolling to the end shows more of what's stored, then fetches older
  // pushes from Pushbullet, like the phone app.
  const sentinel = useRef<HTMLDivElement>(null);
  const atEnd = visible.length <= limit;
  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => {
      if (!e?.isIntersecting) return;
      if (!atEnd) return setLimit((l) => l + PAGE);
      if (!moreOnServer || loadingOlder) return;
      setLoadingOlder(true);
      void call('pushes.older')
        .catch(() => undefined)
        .finally(() => {
          setLoadingOlder(false);
          setLimit((l) => l + PAGE);
        });
    });
    io.observe(el);
    return () => io.disconnect();
  }, [visible.length, limit, atEnd, moreOnServer, loadingOlder]);

  if (filter.kind === 'person') {
    return (
      <Conversation
        chat={chats.find((c) => c.with.email_normalized === filter.email)}
        email={filter.email}
        pushes={visible}
        me={me}
        onBack={() => setFilter({ kind: 'all' })}
      />
    );
  }

  const closeSearch = () => {
    setQuery('');
    setSearching(false);
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 items-center gap-1.5 px-3.5 pb-2 pt-3">
        {searching ? (
          <div className="flex h-9 flex-1 items-center gap-2 rounded-xl border border-accent bg-surface px-3">
            <Search size={14} className="text-accent" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Escape' && closeSearch()}
              placeholder={i18n.t('feed.searchPlaceholder')}
              aria-label={i18n.t('feed.searchLabel')}
              className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-faint"
            />
            <button aria-label={i18n.t('feed.closeSearch')} onClick={closeSearch} className="text-faint hover:text-ink">
              <X size={14} />
            </button>
          </div>
        ) : (
          <>
            <div className="flex min-w-0 flex-1 rounded-xl bg-sunken p-[3px]" role="radiogroup" aria-label={i18n.t('feed.show')}>
              {TYPES.map(({ type, icon: Icon }) => {
                const on = type === 'all' ? filter.kind === 'all' : filter.kind === 'type' && filter.type === type;
                return (
                  <button
                    key={type}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => setFilter(type === 'all' ? { kind: 'all' } : { kind: 'type', type })}
                    className={clsx(
                      'flex h-8 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-[9px] px-1.5 text-xs font-bold transition-colors',
                      on ? 'bg-surface text-accent-strong shadow-sm' : 'text-muted hover:text-ink',
                    )}
                  >
                    <Icon size={14} strokeWidth={2.2} className="shrink-0" />
                    <span className="truncate">{type === 'all' ? i18n.t('feed.all') : i18n.t(`feed.only.${type}`)}</span>
                  </button>
                );
              })}
            </div>
            <IconButton label={i18n.t('feed.search')} onClick={() => setSearching(true)}>
              <Search size={16} />
            </IconButton>
          </>
        )}
      </div>
      {filesOn && fileKinds.length > 1 && (
        <div className="no-scrollbar flex shrink-0 gap-1.5 overflow-x-auto px-3.5 pb-2">
          <SubChip on={!filter.file} onClick={() => setFilter({ kind: 'type', type: 'file' })}>
            {i18n.t('feed.fileKind.all')}
          </SubChip>
          {fileKinds.map((k) => {
            const Icon = FILE_KIND_ICONS[k];
            return (
              <SubChip key={k} on={filter.file === k} onClick={() => setFilter({ kind: 'type', type: 'file', file: k })}>
                <Icon size={13} strokeWidth={2.2} />
                {i18n.t(`feed.fileKind.${k}`)}
              </SubChip>
            );
          })}
        </div>
      )}
      {!searching && (filter.kind === 'all' || filter.kind === 'channels') && (hasChannels || people.length > 0) && (
        <div className="no-scrollbar flex shrink-0 gap-1.5 overflow-x-auto px-3.5 pb-2">
          {hasChannels && (
            <SubChip
              on={filter.kind === 'channels'}
              onClick={() => setFilter(filter.kind === 'channels' ? { kind: 'all' } : { kind: 'channels' })}
            >
              <Radio size={13} strokeWidth={2.2} />
              {i18n.t('feed.channels')}
            </SubChip>
          )}
          {people.map((c) => (
            <SubChip key={c.iden} on={false} onClick={() => setFilter({ kind: 'person', email: c.with.email_normalized })}>
              <Avatar src={c.with.image_url} name={personName(c)} size={18} />
              {personName(c).split(' ')[0]}
            </SubChip>
          ))}
        </div>
      )}
      <div className="scroll-area min-h-0 flex-1 px-3.5 pb-4">
        {visible.length === 0 ? (
          query ? (
            <Empty icon={<Search size={24} />} title={i18n.t('feed.noMatchTitle')}>
              {i18n.t('feed.noMatchBody')}
            </Empty>
          ) : (
            <Empty icon={<Inbox size={24} />} title={i18n.t('feed.emptyTitle')}>
              {i18n.t('feed.emptyBody')}
            </Empty>
          )
        ) : gallery ? (
          <Gallery pushes={visible.slice(0, limit)} />
        ) : (
          <DayGroups pushes={visible.slice(0, limit)}>
            {(p) => (
              <FeedItem
                key={p.iden}
                push={p}
                ctx={ctx}
                isNew={p.created > seenAt && p.source_device_iden !== selfDeviceIden && p.direction !== 'outgoing'}
                onPerson={(email) => setFilter({ kind: 'person', email })}
              />
            )}
          </DayGroups>
        )}
        {(visible.length > limit || moreOnServer) && (
          <div ref={sentinel} className="grid h-12 place-items-center">
            {loadingOlder && <Spinner />}
          </div>
        )}
      </div>
    </div>
  );
}

function SubChip({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={clsx(
        'flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3 text-xs font-bold transition-colors',
        on ? 'bg-accent text-on-accent shadow-sm' : 'bg-surface text-muted ring-1 ring-line hover:text-ink',
      )}
    >
      {children}
    </button>
  );
}

function DayGroups({ pushes, children }: { pushes: Push[]; children: (p: Push) => ReactNode }) {
  const groups: { label: string; items: Push[] }[] = [];
  for (const p of pushes) {
    const label = dayLabel(p.created);
    const last = groups[groups.length - 1];
    if (last?.label === label) last.items.push(p);
    else groups.push({ label, items: [p] });
  }
  return (
    <>
      {groups.map((g) => (
        <section key={g.label} className="mb-3">
          <h3 className="sticky top-0 z-10 bg-bg/95 px-1 pb-1.5 pt-2.5 text-xs font-bold text-muted backdrop-blur">{g.label}</h3>
          <Group>{g.items.map(children)}</Group>
        </section>
      ))}
    </>
  );
}
