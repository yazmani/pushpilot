import clsx from 'clsx';
import { Inbox, Search, X } from 'lucide-react';
import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { call } from '@/core/messaging/rpc';
import type { Push } from '@/core/pushbullet/types';
import { dayLabel, personName } from '@/core/utils/format';
import { Avatar, Empty, Group, IconButton } from '@/ui/components';
import { useStore } from '@/ui/hooks/use-store';
import { counterpart, type Filter, matches } from './classify';
import { Conversation } from './Conversation';
import { type FeedContext, FeedItem } from './FeedItem';

const SEEN_KEY = 'pushpilot.feedSeenAt';
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

  const sentinel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => e?.isIntersecting && setLimit((l) => l + PAGE));
    io.observe(el);
    return () => io.disconnect();
  }, [visible.length]);

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
              placeholder="Search your pushes"
              aria-label="Search pushes"
              className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-faint"
            />
            <button aria-label="Close search" onClick={closeSearch} className="text-faint hover:text-ink">
              <X size={14} />
            </button>
          </div>
        ) : (
          <>
            <div className="no-scrollbar flex min-w-0 flex-1 gap-1.5 overflow-x-auto">
              <Chip on={filter.kind === 'all'} onClick={() => setFilter({ kind: 'all' })}>
                Everything
              </Chip>
              <Chip on={filter.kind === 'me'} onClick={() => setFilter({ kind: 'me' })}>
                My devices
              </Chip>
              {hasChannels && (
                <Chip on={filter.kind === 'channels'} onClick={() => setFilter({ kind: 'channels' })}>
                  Channels
                </Chip>
              )}
              {people.map((c) => (
                <Chip key={c.iden} on={false} onClick={() => setFilter({ kind: 'person', email: c.with.email_normalized })}>
                  <Avatar src={c.with.image_url} name={personName(c)} size={18} />
                  {personName(c).split(' ')[0]}
                </Chip>
              ))}
            </div>
            <IconButton label="Search" onClick={() => setSearching(true)}>
              <Search size={16} />
            </IconButton>
          </>
        )}
      </div>

      <div className="scroll-area min-h-0 flex-1 px-3.5 pb-4">
        {visible.length === 0 ? (
          query ? (
            <Empty icon={<Search size={24} />} title="Nothing matches">
              Try fewer words, or part of a link.
            </Empty>
          ) : (
            <Empty icon={<Inbox size={24} />} title="Your pushes land here">
              Links, notes and files you send or receive show up in this feed.
            </Empty>
          )
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
        {visible.length > limit && <div ref={sentinel} className="h-8" />}
      </div>
    </div>
  );
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={clsx(
        'flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3 text-xs font-bold transition-colors',
        on ? 'bg-accent text-on-accent' : 'bg-surface text-muted ring-1 ring-line hover:text-ink',
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
