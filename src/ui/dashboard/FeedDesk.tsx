import clsx from 'clsx';
import {
  Check,
  Copy,
  Download,
  ExternalLink,
  Inbox,
  Layers,
  Link2,
  Paperclip,
  Search,
  StickyNote,
  Trash2,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { call } from '@/core/messaging/rpc';
import type { Push } from '@/core/pushbullet/types';
import { dayLabel, extractCode, host, pushText, timeAgo } from '@/core/utils/format';
import { Avatar, Button, CodeChip, Empty, Spinner, TypeTile } from '@/ui/components';
import { type Filter, fileKind, matches } from '@/ui/features/feed/classify';
import { extension, type FeedContext, FILE_ICONS, summarize } from '@/ui/features/feed/FeedItem';
import { imageSrc } from '@/ui/features/feed/Gallery';
import { useNow } from '@/ui/hooks/use-now';
import { useStore } from '@/ui/hooks/use-store';
import { useRun, useToast } from '@/ui/hooks/use-toast';
import { i18n } from '#i18n';

const TYPES = [
  { type: 'all', icon: Layers },
  { type: 'link', icon: Link2 },
  { type: 'note', icon: StickyNote },
  { type: 'file', icon: Paperclip },
] as const;
const PAGE = 80;

/** The feed on a big screen: a compact list on the left, the selected push in full on the right. */
export function FeedDesk() {
  const { pushes, devices, chats, subscriptions, me, settings, selfDeviceIden, previews, historyCursor } = useStore([
    'pushes',
    'devices',
    'chats',
    'subscriptions',
    'me',
    'settings',
    'selfDeviceIden',
    'previews',
    'historyCursor',
  ]);
  const ctx: FeedContext = { devices, chats, subscriptions, me, selfDeviceIden, previews };
  const [type, setType] = useState<(typeof TYPES)[number]['type']>('all');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [limit, setLimit] = useState(PAGE);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const list = useRef<HTMLDivElement>(null);

  const visible = useMemo(() => {
    const filter: Filter = type === 'all' ? { kind: 'all' } : { kind: 'type', type };
    return pushes.filter((p) => matches(p, filter, me, query.trim().toLowerCase(), settings.showChannels));
  }, [pushes, type, query, me, settings.showChannels]);
  const shown = visible.slice(0, limit);
  const current = visible.find((p) => p.iden === selected) ?? visible[0];

  // Link previews for what's on screen, like the popup's feed.
  const missing = shown
    .filter((p) => p.type === 'link' && p.url && !previews[p.url])
    .map((p) => p.url!)
    .slice(0, 24)
    .join('|');
  useEffect(() => {
    if (missing && settings.linkPreviews) void call('preview.fetch', { urls: missing.split('|') }).catch(() => undefined);
  }, [missing, settings.linkPreviews]);

  // ↑/↓ (or k/j) move through the list.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest('input, textarea')) return;
      const step = e.key === 'ArrowDown' || e.key === 'j' ? 1 : e.key === 'ArrowUp' || e.key === 'k' ? -1 : 0;
      if (!step || !current) return;
      e.preventDefault();
      const i = visible.indexOf(current);
      const next = visible[Math.min(Math.max(i + step, 0), visible.length - 1)];
      if (next) {
        setSelected(next.iden);
        if (visible.indexOf(next) >= limit - 5) setLimit((l) => l + PAGE);
        list.current?.querySelector(`[data-iden="${next.iden}"]`)?.scrollIntoView({ block: 'nearest' });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [visible, current, limit]);

  const onScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    if (el.scrollTop + el.clientHeight < el.scrollHeight - 300) return;
    if (visible.length > limit) return setLimit((l) => l + PAGE);
    if (historyCursor === null || loadingOlder) return;
    setLoadingOlder(true);
    void call('pushes.older')
      .catch(() => undefined)
      .finally(() => {
        setLoadingOlder(false);
        setLimit((l) => l + PAGE);
      });
  };

  let lastDay = '';
  return (
    <div className="flex h-full overflow-hidden rounded-t-[22px] border border-b-0 border-line bg-surface shadow-sm">
      <div className="flex w-[400px] shrink-0 flex-col border-e border-line">
        <div className="shrink-0 space-y-2.5 border-b border-line p-3">
          <div className="flex h-9 items-center gap-2 rounded-xl bg-sunken px-3 focus-within:ring-2 focus-within:ring-accent/40">
            <Search size={15} className="text-faint" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={i18n.t('feed.searchPlaceholder')}
              aria-label={i18n.t('feed.searchLabel')}
              className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-faint"
            />
            {query && (
              <button aria-label={i18n.t('feed.closeSearch')} onClick={() => setQuery('')} className="text-faint hover:text-ink">
                <X size={14} />
              </button>
            )}
          </div>
          <div className="flex rounded-xl bg-sunken p-[3px]" role="radiogroup" aria-label={i18n.t('feed.show')}>
            {TYPES.map(({ type: t, icon: Icon }) => (
              <button
                key={t}
                role="radio"
                aria-checked={type === t}
                onClick={() => setType(t)}
                className={clsx(
                  'flex h-7 flex-1 items-center justify-center gap-1.5 rounded-[9px] text-xs font-bold transition-colors',
                  type === t ? 'bg-surface text-accent-strong shadow-sm' : 'text-muted hover:text-ink',
                )}
              >
                <Icon size={13} strokeWidth={2.2} />
                {t === 'all' ? i18n.t('feed.all') : i18n.t(`feed.only.${t}`)}
              </button>
            ))}
          </div>
        </div>

        <div ref={list} className="scroll-area min-h-0 flex-1 pb-3" onScroll={onScroll}>
          {!visible.length && (
            <Empty
              icon={query ? <Search size={22} /> : <Inbox size={22} />}
              title={i18n.t(query ? 'feed.noMatchTitle' : 'feed.emptyTitle')}
            >
              {i18n.t(query ? 'feed.noMatchBody' : 'feed.emptyBody')}
            </Empty>
          )}
          {shown.map((p) => {
            const day = dayLabel(p.created);
            const heading = day !== lastDay;
            lastDay = day;
            return (
              <div key={p.iden}>
                {heading && (
                  <p className="sticky top-0 z-10 bg-surface/95 px-4 pb-1.5 pt-3 text-2xs font-extrabold uppercase tracking-wide text-faint backdrop-blur">
                    {day}
                  </p>
                )}
                <Row p={p} ctx={ctx} on={p.iden === current?.iden} onSelect={() => setSelected(p.iden)} />
              </div>
            );
          })}
          {loadingOlder && (
            <div className="grid h-12 place-items-center">
              <Spinner />
            </div>
          )}
        </div>
      </div>

      <div className="min-w-0 flex-1 bg-bg/40">
        {current ? (
          <Detail
            key={current.iden}
            p={current}
            ctx={ctx}
            onGone={() => setSelected(visible[visible.indexOf(current) + 1]?.iden ?? null)}
          />
        ) : (
          <Empty icon={<Inbox size={24} />} title={i18n.t('feed.emptyTitle')}>
            {i18n.t('feed.emptyBody')}
          </Empty>
        )}
      </div>
    </div>
  );
}

function Thumb({ p, ctx, size }: { p: Push; ctx: FeedContext; size: number }) {
  const s = summarize(p, ctx);
  const style = { width: size, height: size };
  if (s.sub) return <Avatar src={s.sub.channel.image_url} name={s.sub.channel.name} size={size} />;
  if (s.who) return <Avatar src={s.chat?.with.image_url} name={s.chat?.with.name || s.who} size={size} />;
  if (s.imageFile)
    return <img src={s.imageFile} alt="" loading="lazy" style={style} className="shrink-0 rounded-xl object-cover" />;
  if (s.preview?.image)
    return (
      <img src={s.preview.image} alt="" loading="lazy" style={style} className="shrink-0 rounded-xl bg-raised object-cover" />
    );
  if (p.type === 'file')
    return (
      <TypeTile type="file" size={size} icon={FILE_ICONS[fileKind(p)]} label={size >= 40 ? extension(p.file_name) : undefined} />
    );
  return <TypeTile type={p.type} size={size} />;
}

function Row({ p, ctx, on, onSelect }: { p: Push; ctx: FeedContext; on: boolean; onSelect: () => void }) {
  useNow();
  const s = summarize(p, ctx);
  return (
    <button
      data-iden={p.iden}
      onClick={onSelect}
      aria-current={on || undefined}
      className={clsx(
        'mx-2 flex w-[calc(100%-1rem)] items-center gap-3 rounded-xl px-2.5 py-2 text-start transition-colors',
        on ? 'bg-accent-soft' : 'hover:bg-raised/60',
      )}
    >
      <Thumb p={p} ctx={ctx} size={42} />
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline gap-2">
          <span dir="auto" className={clsx('truncate text-[13px] font-bold', on && 'text-accent-strong')}>
            {s.title || p.body}
          </span>
          <span className="ms-auto shrink-0 text-2xs text-faint">{timeAgo(p.created)}</span>
        </span>
        <span dir="auto" className="block truncate text-xs text-muted">
          {(s.title && s.subtitle) || s.line}
        </span>
      </span>
    </button>
  );
}

function Detail({ p, ctx, onGone }: { p: Push; ctx: FeedContext; onGone: () => void }) {
  const notify = useToast();
  const run = useRun();
  const s = summarize(p, ctx);
  const kind = p.type === 'file' ? fileKind(p) : undefined;
  const code = p.type === 'note' ? extractCode(p.body) : undefined;
  const when = new Date(p.created * 1000).toLocaleString(undefined, { dateStyle: 'full', timeStyle: 'short' });

  return (
    <article className="scroll-area h-full">
      <div className="mx-auto max-w-3xl px-10 py-8">
        <div className="flex items-center gap-3 text-xs text-muted">
          <Thumb p={p} ctx={ctx} size={36} />
          <div className="min-w-0">
            <p className="truncate font-bold text-ink">{s.line}</p>
            <p className="truncate">{when}</p>
          </div>
        </div>

        {p.type === 'link' && s.preview?.image && (
          <a
            href={s.url}
            target="_blank"
            rel="noreferrer"
            className="mt-6 block overflow-hidden rounded-2xl border border-line bg-raised"
          >
            <img src={s.preview.image} alt="" className="aspect-video w-full object-cover" />
          </a>
        )}
        {kind === 'image' && (
          <a
            href={p.file_url}
            target="_blank"
            rel="noreferrer"
            className="mt-6 block overflow-hidden rounded-2xl border border-line bg-raised"
          >
            <img src={imageSrc(p, 's1600')} alt={p.file_name ?? ''} className="max-h-[60vh] w-full object-contain" />
          </a>
        )}
        {kind === 'video' && <video src={p.file_url} controls className="mt-6 max-h-[60vh] w-full rounded-2xl bg-black" />}
        {kind === 'audio' && <audio src={p.file_url} controls className="mt-6 w-full" />}
        {p.type === 'file' && kind !== 'image' && kind !== 'video' && (
          // No preview for documents and archives: a large tile says what it is at a glance.
          <a
            href={p.file_url}
            target="_blank"
            rel="noreferrer"
            className="group mt-6 grid aspect-[16/7] place-items-center rounded-2xl border border-file-fg/10 bg-file-bg/60 transition-colors hover:bg-file-bg"
          >
            <span className="flex flex-col items-center gap-3">
              <span className="transition-transform group-hover:-translate-y-0.5">
                <TypeTile type="file" size={96} icon={FILE_ICONS[kind ?? 'other']} label={extension(p.file_name)} />
              </span>
              {p.file_type && <span className="text-xs font-semibold text-file-fg/80">{p.file_type}</span>}
            </span>
          </a>
        )}

        {s.title && (
          <h2 dir="auto" className="mt-6 break-words text-2xl font-extrabold leading-tight tracking-[-0.02em]">
            {s.title}
          </h2>
        )}
        {p.type === 'link' && p.url && (
          <a
            href={s.url}
            target="_blank"
            rel="noreferrer"
            className="mt-1.5 block truncate text-sm font-semibold text-accent-strong hover:underline"
          >
            {host(p.url)} · {p.url}
          </a>
        )}
        {p.type === 'link' && s.preview?.description && !p.body && (
          <p dir="auto" className="mt-3 text-sm leading-relaxed text-muted">
            {s.preview.description}
          </p>
        )}
        {p.body && (
          <p
            dir="auto"
            className={clsx(
              'mt-4 whitespace-pre-wrap break-words leading-relaxed',
              p.type === 'note' ? 'rounded-2xl border border-line bg-surface p-5 text-[15px]' : 'text-sm text-ink/85',
            )}
          >
            {p.body}
          </p>
        )}
        {code && <CodeChip code={code} className="mt-3" />}

        <div className="mt-7 flex flex-wrap gap-2">
          {s.url && (
            <Button variant="primary" onClick={() => window.open(s.url, '_blank')}>
              {p.type === 'file' ? <Download size={15} /> : <ExternalLink size={15} />}
              {p.type === 'file' ? i18n.t('actions.download') : i18n.t('actions.open')}
            </Button>
          )}
          <Button
            onClick={async () => {
              await navigator.clipboard.writeText(pushText(p));
              notify(i18n.t('actions.copied'));
            }}
          >
            <Copy size={15} /> {i18n.t('actions.copy')}
          </Button>
          {!p.dismissed && p.direction !== 'outgoing' && (
            <Button onClick={() => run(() => call('push.dismiss', { iden: p.iden }), i18n.t('actions.doneToast'))}>
              <Check size={15} /> {i18n.t('actions.done')}
            </Button>
          )}
          <Button
            variant="danger"
            onClick={async () => {
              if (await run(() => call('push.delete', { iden: p.iden }), i18n.t('actions.deleted'))) onGone();
            }}
          >
            <Trash2 size={15} /> {i18n.t('actions.deleteEverywhere')}
          </Button>
        </div>
      </div>
    </article>
  );
}
