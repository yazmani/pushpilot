import clsx from 'clsx';
import {
  Archive,
  Check,
  FileText,
  Film,
  Image,
  Inbox,
  Layers,
  Link2,
  ListChecks,
  Music,
  Paperclip,
  Radio,
  Search,
  StickyNote,
  Trash2,
  X,
} from 'lucide-react';
import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { call } from '@/core/messaging/rpc';
import type { Push } from '@/core/pushbullet/types';
import { dayLabel, personName } from '@/core/utils/format';
import { Avatar, Button, Empty, Group, IconButton, Spinner } from '@/ui/components';
import { useStore } from '@/ui/hooks/use-store';
import { useRun } from '@/ui/hooks/use-toast';
import { counterpart, FILE_KINDS, fileKind, type FileKind, type Filter, matches } from './classify';
import { Conversation } from './Conversation';
import { type FeedContext, FeedItem } from './FeedItem';
import { Gallery, monthLabel } from './Gallery';
import { JumpToMonth, type Month, monthKey, monthOf, SectionHeading } from './JumpToMonth';
import { Outbox } from './Outbox';
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
  // Selection mode for acting on many pushes at once.
  const [selected, setSelected] = useState<Set<string> | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  const run = useRun();
  // Month picker: the day in view when it opened, and a day to scroll to once rendered.
  const [picking, setPicking] = useState<number | null>(null);
  const [loadingAll, setLoadingAll] = useState(false);
  const [scrollTo, setScrollTo] = useState<string | null>(null);
  const scroller = useRef<HTMLDivElement>(null);

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

  // After a jump has rendered far enough down, bring that day to the top.
  useEffect(() => {
    if (!scrollTo) return;
    const el = scroller.current?.querySelector(`[data-day="${CSS.escape(scrollTo)}"]`);
    if (!el) return;
    el.scrollIntoView({ block: 'start' });
    setScrollTo(null);
  }, [scrollTo, limit]);

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

  const openPicker = (day: number) => {
    setPicking(day);
    if (!moreOnServer || loadingAll) return;
    setLoadingAll(true);
    void call('pushes.all')
      .catch(() => undefined)
      .finally(() => setLoadingAll(false));
  };
  const jump = ({ year, month }: Month) => {
    setPicking(null);
    // The newest push of that month; render down to it, then scroll there.
    const i = visible.findIndex((p) => {
      const m = monthOf(p.created);
      return m.year === year && m.month === month;
    });
    if (i < 0) return;
    setLimit((l) => Math.max(l, i + PAGE));
    setScrollTo((gallery ? monthLabel : dayLabel)(visible[i]!.created));
  };
  const toNewest = () => {
    setPicking(null);
    scroller.current?.scrollTo({ top: 0 });
  };
  // History that spans more than a month (or still has more to load) gets the picker.
  const canJump = moreOnServer || (visible.length > 1 && monthKey(visible[0]!.created) !== monthKey(visible.at(-1)!.created));

  const shown = visible.slice(0, limit);
  const toggle = (iden: string) =>
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(iden)) next.delete(iden);
      else next.add(iden);
      return next;
    });
  const allSelected = !!selected && shown.length > 0 && shown.every((p) => selected.has(p.iden));
  const bulk = async (method: 'push.dismissMany' | 'push.deleteMany', done: string) => {
    if (!selected?.size) return;
    let idens = [...selected];
    // Only active pushes can be marked as done.
    if (method === 'push.dismissMany') idens = idens.filter((i) => pushes.find((p) => p.iden === i && !p.dismissed));
    setBulkBusy(true);
    const ok = await run(() => (idens.length ? call(method, { idens }) : Promise.resolve()), done);
    setBulkBusy(false);
    if (ok) setSelected(null);
  };

  return (
    <div className="relative flex h-full flex-col">
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
            {!gallery && visible.length > 0 && (
              <IconButton
                label={i18n.t('feed.select')}
                active={!!selected}
                onClick={() => setSelected(selected ? null : new Set())}
              >
                <ListChecks size={16} />
              </IconButton>
            )}
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
      <div ref={scroller} className="scroll-area min-h-0 flex-1 px-3.5 pb-4">
        {!gallery && <Outbox />}
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
          <Gallery pushes={shown} onPick={canJump ? openPicker : undefined} />
        ) : (
          <DayGroups pushes={shown} onPick={canJump && !selected ? openPicker : undefined}>
            {(p) => (
              <FeedItem
                key={p.iden}
                push={p}
                ctx={ctx}
                isNew={p.created > seenAt && p.source_device_iden !== selfDeviceIden && p.direction !== 'outgoing'}
                onPerson={(email) => setFilter({ kind: 'person', email })}
                select={selected ? { on: selected.has(p.iden), toggle: () => toggle(p.iden) } : undefined}
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
      {picking !== null && (
        <JumpToMonth
          pushes={visible}
          current={picking}
          loading={loadingAll}
          onJump={jump}
          onNewest={toNewest}
          onClose={() => setPicking(null)}
        />
      )}
      {selected && !gallery && (
        <div className="flex shrink-0 items-center gap-1.5 border-t border-line bg-surface px-3.5 py-2">
          <button
            type="button"
            onClick={() => setSelected(allSelected ? new Set() : new Set(shown.map((p) => p.iden)))}
            className="me-auto truncate text-xs font-bold text-accent-strong hover:underline"
          >
            {allSelected
              ? i18n.t('feed.selectNone')
              : selected.size
                ? i18n.t('feed.selected', selected.size)
                : i18n.t('feed.selectAll')}
          </button>
          <Button
            size="sm"
            className="h-8"
            busy={bulkBusy}
            disabled={!selected.size}
            onClick={() => bulk('push.dismissMany', i18n.t('actions.doneToast'))}
          >
            <Check size={13} /> {i18n.t('feed.markDone')}
          </Button>
          <Button
            size="sm"
            variant="danger"
            className="h-8"
            disabled={!selected.size || bulkBusy}
            onClick={() => bulk('push.deleteMany', i18n.t('actions.deleted'))}
          >
            <Trash2 size={13} /> {i18n.t('feed.delete')}
          </Button>
          <Button size="sm" variant="primary" className="h-8" onClick={() => setSelected(null)}>
            {i18n.t('feed.selectDone')}
          </Button>
        </div>
      )}
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
        'flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-xs font-bold transition-colors',
        on ? 'border-accent bg-accent text-on-accent shadow-sm' : 'border-line bg-surface text-muted hover:text-ink',
      )}
    >
      {children}
    </button>
  );
}

function DayGroups({
  pushes,
  onPick,
  children,
}: {
  pushes: Push[];
  /** Opens the month picker from a day's heading. */
  onPick?: (day: number) => void;
  children: (p: Push) => ReactNode;
}) {
  const groups: { label: string; day: number; items: Push[] }[] = [];
  for (const p of pushes) {
    const label = dayLabel(p.created);
    const last = groups[groups.length - 1];
    if (last?.label === label) last.items.push(p);
    else groups.push({ label, day: p.created, items: [p] });
  }
  return (
    <>
      {groups.map((g) => (
        <section key={g.label} data-day={g.label} className="mb-3">
          <SectionHeading label={g.label} onPick={onPick && (() => onPick(g.day))} />
          <Group>{g.items.map(children)}</Group>
        </section>
      ))}
    </>
  );
}
