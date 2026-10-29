import clsx from 'clsx';
import { ChevronRight } from 'lucide-react';
import type { ReactNode } from 'react';
import { i18n } from '#i18n';

/** A page of the full-page app: a title row, then the content. */
export function Page({
  title,
  subtitle,
  actions,
  fill,
  width = 'max-w-6xl',
  children,
}: {
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
  /** The content manages its own scrolling (feed, texts) and should fill the height. */
  fill?: boolean;
  width?: string;
  children: ReactNode;
}) {
  const head = (
    <header className="flex shrink-0 items-end gap-4 pb-6 pt-9">
      <div className="min-w-0 flex-1">
        <h1 className="text-[28px] font-extrabold leading-tight tracking-[-0.03em]">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </header>
  );
  if (fill) {
    return (
      <div className={clsx('mx-auto flex h-full w-full flex-col px-10', width)}>
        {head}
        <div className="relative min-h-0 flex-1">{children}</div>
      </div>
    );
  }
  return (
    <div className="scroll-area h-full">
      <div className={clsx('mx-auto w-full px-10 pb-12', width)}>
        {head}
        {children}
      </div>
    </div>
  );
}

/** A white panel with a small heading and an optional "See all". */
export function Card({
  title,
  icon,
  onMore,
  className,
  bodyClassName,
  children,
}: {
  title: string;
  icon?: ReactNode;
  onMore?: () => void;
  className?: string;
  bodyClassName?: string;
  children: ReactNode;
}) {
  return (
    <section className={clsx('flex flex-col rounded-[22px] border border-line bg-surface shadow-sm', className)}>
      <div className="flex items-center gap-2 px-5 pb-3 pt-4">
        {icon && <span className="text-accent-strong">{icon}</span>}
        <h2 className="flex-1 text-sm font-extrabold tracking-[-0.01em]">{title}</h2>
        {onMore && (
          <button
            onClick={onMore}
            className="-me-2 flex items-center gap-0.5 rounded-lg px-2 py-1 text-xs font-bold text-accent-strong hover:bg-accent-soft"
          >
            {i18n.t('recent.seeAll')} <ChevronRight size={13} className="rtl:-scale-x-100" />
          </button>
        )}
      </div>
      <div className={clsx('min-h-0 flex-1', bodyClassName)}>{children}</div>
    </section>
  );
}

/** One number with its label, for the overview's top row. */
export function Stat({
  label,
  value,
  hint,
  icon,
  tone = 'accent',
  onClick,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon: ReactNode;
  tone?: 'accent' | 'note' | 'file' | 'link';
  onClick?: () => void;
}) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      onClick={onClick}
      className={clsx(
        'flex items-start gap-4 rounded-[22px] border border-line bg-surface p-5 text-start shadow-sm transition-colors',
        onClick && 'hover:border-accent/40 hover:shadow-card',
      )}
    >
      <span
        className={clsx(
          'grid size-11 shrink-0 place-items-center rounded-2xl',
          tone === 'accent' && 'bg-accent-soft text-accent-strong',
          tone === 'note' && 'bg-note-bg text-note-fg',
          tone === 'file' && 'bg-file-bg text-file-fg',
          tone === 'link' && 'bg-link-bg text-link-fg',
        )}
      >
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block text-xs font-bold text-muted">{label}</span>
        <span className="mt-0.5 block text-[26px] font-extrabold leading-tight tracking-[-0.03em] tabular-nums">{value}</span>
        {hint && <span className="mt-0.5 block truncate text-xs text-faint">{hint}</span>}
      </span>
    </Tag>
  );
}
