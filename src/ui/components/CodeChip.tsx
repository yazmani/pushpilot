import clsx from 'clsx';
import { Copy } from 'lucide-react';
import { useToast } from '@/ui/hooks/use-toast';
import { i18n } from '#i18n';

/** A one-time code from a notification or text, copied with one click. */
export function CodeChip({ code, small, className }: { code: string; small?: boolean; className?: string }) {
  const notify = useToast();
  return (
    <button
      type="button"
      title={i18n.t('phone.copyCode')}
      onClick={async (e) => {
        e.stopPropagation();
        await navigator.clipboard.writeText(code);
        notify(i18n.t('phone.copiedCode', [code]));
      }}
      className={clsx(
        'flex shrink-0 items-center rounded-xl bg-accent-soft font-extrabold tracking-[0.12em] text-accent-strong transition hover:brightness-95',
        small ? 'h-7 gap-1.5 px-2.5 text-xs' : 'h-8 gap-2 px-3 text-base',
        className,
      )}
    >
      {code}
      <Copy size={small ? 12 : 14} />
    </button>
  );
}
