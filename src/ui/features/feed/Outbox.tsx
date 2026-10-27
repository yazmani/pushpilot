import { CloudOff, RotateCw, X } from 'lucide-react';
import { call } from '@/core/messaging/rpc';
import { host } from '@/core/utils/format';
import { Group, IconButton, SectionLabel } from '@/ui/components';
import { targetLabel, useTargets } from '@/ui/features/send/targets';
import { useStore } from '@/ui/hooks/use-store';
import { useRun } from '@/ui/hooks/use-toast';
import { i18n } from '#i18n';

/** Pushes waiting for the connection, at the top of the feed, with Retry and Cancel. */
export function Outbox() {
  const { outbox } = useStore(['outbox']);
  const { targets } = useTargets();
  const run = useRun();
  if (!outbox.length) return null;
  return (
    <section className="mb-3 mt-1">
      <SectionLabel>{i18n.t('outbox.title')}</SectionLabel>
      <p className="-mt-1 mb-1.5 px-1 text-2xs text-muted">{i18n.t('outbox.hint')}</p>
      <Group>
        {outbox.map((o) => (
          <li key={o.id} className="flex items-center gap-3 px-3.5 py-2.5">
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-note-bg text-note-fg">
              <CloudOff size={16} />
            </span>
            <div className="min-w-0 flex-1">
              <p dir="auto" className="truncate text-sm font-bold">
                {o.push.title || o.push.file_name || (o.push.url ? host(o.push.url) : o.push.body)}
              </p>
              <p className="truncate text-2xs text-faint">
                {o.error ? i18n.t('outbox.failed', [o.error]) : i18n.t('send.sendTo', [targetLabel(o.targets, targets)])}
              </p>
            </div>
            <IconButton
              label={i18n.t('outbox.retry')}
              className="size-7"
              onClick={() => run(() => call('outbox.retry', { id: o.id }))}
            >
              <RotateCw size={14} />
            </IconButton>
            <IconButton
              label={i18n.t('outbox.cancel')}
              className="size-7"
              onClick={() => run(() => call('outbox.cancel', { id: o.id }))}
            >
              <X size={14} />
            </IconButton>
          </li>
        ))}
      </Group>
    </section>
  );
}
