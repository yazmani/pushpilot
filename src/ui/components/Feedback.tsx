import clsx from 'clsx';
import { LoaderCircle } from 'lucide-react';
import type { ReactNode } from 'react';
import type { ToastState } from '@/ui/hooks/use-toast';
import { i18n } from '#i18n';

export function Empty({
  icon,
  title,
  children,
  action,
}: {
  icon?: ReactNode;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center px-8 py-12 text-center">
      {icon && <div className="mb-4 grid size-14 place-items-center rounded-2xl bg-accent-soft text-accent-strong">{icon}</div>}
      <p className="text-base font-bold text-ink">{title}</p>
      {children && <div className="mt-1.5 max-w-[290px] text-sm leading-relaxed text-muted">{children}</div>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Spinner({ className }: { className?: string }) {
  return <LoaderCircle size={18} className={clsx('animate-spin text-accent', className)} aria-label={i18n.t('common.loading')} />;
}

export function Centered({ children }: { children: ReactNode }) {
  return <div className="grid h-full place-items-center py-10">{children}</div>;
}

export function ToastBar({ toast }: { toast: ToastState | null }) {
  if (!toast) return null;
  return (
    <div
      key={toast.id}
      role="status"
      className={clsx(
        'animate-rise pointer-events-none fixed inset-x-3 bottom-3 z-50 mx-auto flex max-w-sm items-center gap-2 rounded-xl px-3.5 py-2.5 text-sm font-semibold shadow-card',
        toast.tone === 'error' ? 'bg-danger text-white' : 'bg-ink text-bg',
      )}
    >
      {toast.tone === 'ok' && <span className="size-1.5 shrink-0 rounded-full bg-accent" />}
      {toast.text}
    </div>
  );
}

export function Notice({
  tone = 'info',
  children,
  action,
}: {
  tone?: 'info' | 'warn' | 'error';
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div
      className={clsx(
        'flex items-start gap-2 rounded-xl px-3 py-2 text-xs leading-relaxed',
        tone === 'info' && 'bg-accent-soft text-ink',
        tone === 'warn' && 'bg-note-bg text-ink',
        tone === 'error' && 'bg-danger-soft text-danger',
      )}
    >
      <span className="flex-1">{children}</span>
      {action}
    </div>
  );
}

export function SectionLabel({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-2 flex items-center">
      <h3 className="text-xs font-bold text-muted">{children}</h3>
      {action && <div className="ms-auto">{action}</div>}
    </div>
  );
}

/** Inset grouped list: one rounded container, hairlines between rows. */
export function Group({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <ul className={clsx('divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface shadow-sm', className)}>
      {children}
    </ul>
  );
}
