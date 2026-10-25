import clsx from 'clsx';
import { LoaderCircle } from 'lucide-react';
import type { AnchorHTMLAttributes, ButtonHTMLAttributes } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

function buttonClass(variant: Variant, size: Size, className?: string) {
  return clsx(
    'inline-flex shrink-0 items-center justify-center gap-2 font-semibold transition-[background-color,box-shadow,transform,filter] duration-150',
    'active:translate-y-px disabled:pointer-events-none disabled:opacity-45',
    size === 'sm' && 'h-7 rounded-lg px-2.5 text-xs',
    size === 'md' && 'h-9 rounded-xl px-3.5 text-sm',
    size === 'lg' && 'h-12 rounded-2xl px-4 text-base',
    variant === 'primary' && 'bg-accent text-on-accent shadow-glow hover:brightness-[1.06]',
    variant === 'secondary' && 'border border-line bg-surface text-ink shadow-sm hover:bg-raised',
    variant === 'ghost' && 'text-ink hover:bg-raised',
    variant === 'danger' && 'text-danger hover:bg-danger-soft',
    className,
  );
}

export function Button({
  variant = 'secondary',
  size = 'md',
  busy,
  className,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size; busy?: boolean }) {
  return (
    <button type="button" className={buttonClass(variant, size, className)} disabled={busy || rest.disabled} {...rest}>
      {busy && <LoaderCircle size={15} className="animate-spin" aria-hidden="true" />}
      {children}
    </button>
  );
}

/** A link styled as a button; opens in a new tab. */
export function LinkButton({
  variant = 'secondary',
  size = 'md',
  className,
  children,
  ...rest
}: AnchorHTMLAttributes<HTMLAnchorElement> & { variant?: Variant; size?: Size }) {
  return (
    <a target="_blank" rel="noreferrer" className={buttonClass(variant, size, className)} {...rest}>
      {children}
    </a>
  );
}

export function IconButton({
  label,
  className,
  children,
  active,
  tone = 'plain',
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string; active?: boolean; tone?: 'plain' | 'accent' }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={clsx(
        'grid size-8 shrink-0 place-items-center rounded-[10px] transition-colors disabled:pointer-events-none disabled:opacity-40',
        tone === 'plain' && 'text-muted hover:bg-raised hover:text-ink',
        tone === 'plain' && active && 'bg-raised text-ink',
        tone === 'accent' && 'bg-accent text-on-accent shadow-glow hover:brightness-[1.06]',
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}
