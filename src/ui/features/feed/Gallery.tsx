import clsx from 'clsx';
import { ChevronLeft, ChevronRight, Download, ExternalLink, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { Push } from '@/core/pushbullet/types';
import { IconButton } from '@/ui/components';
import { SectionHeading } from './JumpToMonth';
import { i18n } from '#i18n';

/** A sized copy from Google's image server when Pushbullet has one, else the file itself. */
function imageSrc(p: Push, size: string) {
  return p.image_url ? `${p.image_url}=${size}` : p.file_url;
}

export function monthLabel(seconds: number) {
  return new Date(seconds * 1000).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

/** Pushed images as a grid by month; one opens full size. */
export function Gallery({ pushes, onPick }: { pushes: Push[]; onPick?: (day: number) => void }) {
  const [open, setOpen] = useState<number | null>(null);
  const months = useMemo(() => {
    const out: { label: string; items: { p: Push; i: number }[] }[] = [];
    pushes.forEach((p, i) => {
      const label = monthLabel(p.created);
      const last = out[out.length - 1];
      if (last?.label === label) last.items.push({ p, i });
      else out.push({ label, items: [{ p, i }] });
    });
    return out;
  }, [pushes]);

  return (
    <>
      {months.map((m) => (
        <section key={m.label} data-day={m.label} className="mb-3">
          <SectionHeading label={m.label} onPick={onPick && (() => onPick(m.items[0]!.p.created))} />
          <div className="grid grid-cols-3 gap-1 @xl:grid-cols-4 @xl:gap-1.5 @3xl:grid-cols-5 @4xl:grid-cols-6">
            {m.items.map(({ p, i }) => (
              <button
                key={p.iden}
                onClick={() => setOpen(i)}
                className="group relative aspect-square overflow-hidden rounded-lg bg-raised ring-1 ring-black/5"
                title={p.file_name}
              >
                <img
                  src={imageSrc(p, 's400-c')}
                  alt={p.file_name ?? ''}
                  loading="lazy"
                  className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
                />
              </button>
            ))}
          </div>
        </section>
      ))}
      {open !== null && pushes[open] && <Lightbox pushes={pushes} index={open} onIndex={setOpen} onClose={() => setOpen(null)} />}
    </>
  );
}

function Lightbox({
  pushes,
  index,
  onIndex,
  onClose,
}: {
  pushes: Push[];
  index: number;
  onIndex: (i: number) => void;
  onClose: () => void;
}) {
  const p = pushes[index]!;
  const prev = index > 0 ? () => onIndex(index - 1) : undefined;
  const next = index < pushes.length - 1 ? () => onIndex(index + 1) : undefined;
  // Arrows follow reading direction, so they swap in right-to-left languages.
  const rtl = document.documentElement.dir === 'rtl';

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === (rtl ? 'ArrowRight' : 'ArrowLeft')) prev?.();
      if (e.key === (rtl ? 'ArrowLeft' : 'ArrowRight')) next?.();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, prev, next, rtl]);

  const nav =
    'absolute top-1/2 grid size-10 -translate-y-1/2 place-items-center rounded-full bg-black/40 text-white backdrop-blur hover:bg-black/60';
  return (
    <div
      role="dialog"
      aria-label={p.file_name}
      className="animate-rise fixed inset-0 z-50 flex flex-col bg-black/95 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="flex shrink-0 items-center gap-1 px-3 py-2 text-white">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold">{p.file_name}</p>
          <p className="text-2xs text-white/60">
            {new Date(p.created * 1000).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })} ·{' '}
            {i18n.t('gallery.count', [String(index + 1), String(pushes.length)])}
          </p>
        </div>
        <a
          href={p.file_url}
          target="_blank"
          rel="noreferrer"
          title={i18n.t('gallery.open')}
          className="grid size-9 place-items-center rounded-full hover:bg-white/10"
        >
          <ExternalLink size={16} />
        </a>
        <a
          href={p.file_url}
          download={p.file_name}
          title={i18n.t('actions.download')}
          className="grid size-9 place-items-center rounded-full hover:bg-white/10"
        >
          <Download size={16} />
        </a>
        <IconButton label={i18n.t('gallery.close')} onClick={onClose} className="size-9 text-white hover:bg-white/10">
          <X size={18} />
        </IconButton>
      </div>
      <div className="relative min-h-0 flex-1" onClick={(e) => e.target === e.currentTarget && onClose()}>
        <img
          key={p.iden}
          src={imageSrc(p, 's1600')}
          alt={p.file_name ?? ''}
          className="absolute inset-0 m-auto max-h-full max-w-full object-contain p-2"
        />
        {prev && (
          <button aria-label={i18n.t('gallery.previous')} onClick={prev} className={clsx(nav, 'start-2')}>
            <ChevronLeft size={20} className="rtl:-scale-x-100" />
          </button>
        )}
        {next && (
          <button aria-label={i18n.t('gallery.next')} onClick={next} className={clsx(nav, 'end-2')}>
            <ChevronRight size={20} className="rtl:-scale-x-100" />
          </button>
        )}
      </div>
    </div>
  );
}
