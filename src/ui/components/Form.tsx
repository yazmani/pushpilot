import clsx from 'clsx';
import { SendHorizontal } from 'lucide-react';
import { type ReactNode, useRef } from 'react';
import { IconButton } from './Button';
import { i18n } from '#i18n';

export function Toggle({
  checked,
  onChange,
  label,
  hint,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  hint?: ReactNode;
  disabled?: boolean;
}) {
  return (
    <label className={clsx('flex cursor-pointer items-start gap-4 py-3.5', disabled && 'pointer-events-none opacity-50')}>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-ink">{label}</span>
        {hint && <span className="mt-0.5 block text-xs leading-relaxed text-muted">{hint}</span>}
      </span>
      <input
        type="checkbox"
        className="peer sr-only"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
      />
      <span
        aria-hidden="true"
        className={clsx(
          'relative mt-0.5 h-[22px] w-[38px] shrink-0 rounded-full transition-colors peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent',
          checked ? 'bg-accent' : 'bg-line',
        )}
      >
        <span
          className={clsx(
            'absolute top-[3px] size-4 rounded-full bg-white shadow-sm transition-transform',
            checked ? 'translate-x-[19px]' : 'translate-x-[3px]',
          )}
        />
      </span>
    </label>
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  className,
}: {
  value: T;
  options: { value: T; label: ReactNode; title?: string }[];
  onChange: (v: T) => void;
  className?: string;
}) {
  return (
    <div className={clsx('flex rounded-xl bg-sunken p-[3px]', className)} role="radiogroup">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          title={o.title}
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={clsx(
            'flex h-7 flex-1 items-center justify-center gap-1.5 rounded-[9px] px-2.5 text-xs font-semibold transition-colors',
            value === o.value ? 'bg-surface text-ink shadow-sm' : 'text-muted hover:text-ink',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export const fieldClass =
  'rounded-xl border border-line bg-surface px-3 text-sm outline-none transition-colors placeholder:text-faint focus:border-accent';

/** Bottom-docked message box used by chats and SMS threads. Enter sends, Shift+Enter breaks. */
export function MessageComposer({
  value,
  onChange,
  onSend,
  placeholder,
  busy,
}: {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  placeholder: string;
  busy?: boolean;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  return (
    <form
      className="flex shrink-0 items-end gap-2 border-t border-line bg-surface/60 p-2.5"
      onSubmit={(e) => {
        e.preventDefault();
        onSend();
        ref.current?.focus();
      }}
    >
      <textarea
        ref={ref}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            onSend();
          }
        }}
        rows={1}
        placeholder={placeholder}
        aria-label={placeholder}
        className={clsx(fieldClass, 'max-h-28 min-h-10 flex-1 resize-none py-2.5 [field-sizing:content]')}
      />
      <IconButton
        label={i18n.t('tabs.send')}
        type="submit"
        tone="accent"
        disabled={busy || !value.trim()}
        className="size-10 rounded-xl"
      >
        <SendHorizontal size={17} />
      </IconButton>
    </form>
  );
}
