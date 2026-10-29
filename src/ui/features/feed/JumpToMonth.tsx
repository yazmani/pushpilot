import clsx from 'clsx';
import { ArrowUp, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { Push } from '@/core/pushbullet/types';
import { IconButton, Spinner } from '@/ui/components';
import { i18n } from '#i18n';

export interface Month {
  year: number;
  month: number;
}

const key = (y: number, m: number) => y * 12 + m;

function monthOf(seconds: number): Month {
  const d = new Date(seconds * 1000);
  return { year: d.getFullYear(), month: d.getMonth() };
}

/**
 * A small year-and-month grid over the feed. Months with pushes show how many;
 * the rest are greyed out. Older months fill in while history is still loading.
 */
export function JumpToMonth({
  pushes,
  current,
  loading,
  onJump,
  onNewest,
  onClose,
}: {
  pushes: Push[];
  /** The day in view when the picker opened (seconds). */
  current: number;
  loading: boolean;
  onJump: (m: Month) => void;
  onNewest: () => void;
  onClose: () => void;
}) {
  const here = monthOf(current);
  const [year, setYear] = useState(here.year);

  const counts = useMemo(() => {
    const out = new Map<number, number>();
    for (const p of pushes) {
      const { year: y, month: m } = monthOf(p.created);
      out.set(key(y, m), (out.get(key(y, m)) ?? 0) + 1);
    }
    return out;
  }, [pushes]);
  const years = useMemo(() => [...new Set([...counts.keys()].map((k) => Math.floor(k / 12)))].sort(), [counts]);
  const older = years.some((y) => y < year);
  const newer = years.some((y) => y > year);

  const names = useMemo(() => {
    const f = new Intl.DateTimeFormat(undefined, { month: 'short' });
    return Array.from({ length: 12 }, (_, m) => f.format(new Date(2000, m, 15)));
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="absolute inset-0 z-30" role="presentation" onClick={onClose}>
      <div className="absolute inset-0 bg-bg/60 backdrop-blur-[2px]" />
      <section
        role="dialog"
        aria-label={i18n.t('feed.jumpTitle')}
        onClick={(e) => e.stopPropagation()}
        className="relative mx-3.5 mt-2 rounded-2xl border border-line bg-surface p-2.5 shadow-card"
      >
        <div className="flex items-center gap-1 pb-2">
          <IconButton label={i18n.t('feed.olderYear')} className="size-8" disabled={!older} onClick={() => setYear((y) => y - 1)}>
            <ChevronLeft size={16} className="rtl:-scale-x-100" />
          </IconButton>
          <p className="min-w-[3.5rem] text-center text-sm font-extrabold tabular-nums" aria-live="polite">
            {year}
          </p>
          <IconButton label={i18n.t('feed.newerYear')} className="size-8" disabled={!newer} onClick={() => setYear((y) => y + 1)}>
            <ChevronRight size={16} className="rtl:-scale-x-100" />
          </IconButton>
          <button
            type="button"
            onClick={onNewest}
            className="ms-auto flex h-8 items-center gap-1 rounded-lg px-2.5 text-xs font-bold text-accent-strong hover:bg-accent-soft"
          >
            <ArrowUp size={13} strokeWidth={2.4} /> {i18n.t('feed.newest')}
          </button>
        </div>

        <div className="grid grid-cols-4 gap-1">
          {names.map((name, m) => {
            const n = counts.get(key(year, m)) ?? 0;
            const on = year === here.year && m === here.month;
            return (
              <button
                key={m}
                type="button"
                disabled={!n}
                aria-current={on ? 'date' : undefined}
                aria-label={n ? `${name} ${year}, ${i18n.t('feed.monthCount', n)}` : `${name} ${year}`}
                onClick={() => onJump({ year, month: m })}
                className={clsx(
                  'flex h-12 flex-col items-center justify-center rounded-xl text-xs font-bold transition-colors',
                  on
                    ? 'bg-accent text-on-accent shadow-sm'
                    : n
                      ? 'bg-raised/60 text-ink hover:bg-accent-soft hover:text-accent-strong'
                      : 'text-faint/60',
                )}
              >
                {name}
                {n > 0 && (
                  <span className={clsx('text-2xs font-semibold tabular-nums', on ? 'text-on-accent/80' : 'text-muted')}>
                    {n}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {loading && (
          <p className="flex items-center justify-center gap-2 pt-2.5 text-2xs font-semibold text-muted">
            <Spinner className="size-3.5" /> {i18n.t('feed.loadingOlder')}
          </p>
        )}
      </section>
    </div>
  );
}

/** Months since year 0, for comparing which month two pushes are in. */
export function monthKey(seconds: number) {
  const { year, month } = monthOf(seconds);
  return key(year, month);
}

export { monthOf };

/** A sticky day or month heading in the feed; with onPick, it opens the month picker. */
export function SectionHeading({ label, onPick }: { label: string; onPick?: () => void }) {
  return (
    <h3 className="sticky top-0 z-10 bg-bg/95 pb-1.5 pt-2.5 text-xs font-bold text-muted backdrop-blur">
      {onPick ? (
        <button
          type="button"
          onClick={onPick}
          aria-haspopup="dialog"
          title={i18n.t('feed.jumpTitle')}
          className="-ms-1 flex items-center gap-1 rounded-lg px-2 py-0.5 transition-colors hover:bg-raised hover:text-ink"
        >
          {label}
          <ChevronDown size={13} strokeWidth={2.4} />
        </button>
      ) : (
        <span className="px-1">{label}</span>
      )}
    </h3>
  );
}
