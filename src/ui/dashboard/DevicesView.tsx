import clsx from 'clsx';
import { MessageSquareText, Send, TriangleAlert } from 'lucide-react';
import { browser } from 'wxt/browser';
import { deviceKind, deviceName, isReachable } from '@/core/utils/format';
import { Button, DeviceGlyph } from '@/ui/components';
import { IssueList, useSetupIssues } from '@/ui/features/setup/SetupIssues';
import { useStore } from '@/ui/hooks/use-store';
import { Card, Page } from './parts';
import { i18n } from '#i18n';

/** Every device on the account as a card: what it is, whether pushes reach it, and a way to send to it. */
export function DevicesView({ onSend }: { onSend: (target: string) => void }) {
  const { devices, selfDeviceIden } = useStore(['devices', 'selfDeviceIden']);
  const issues = useSetupIssues();
  const sorted = [...devices].sort((a, b) => Number(isReachable(b)) - Number(isReachable(a)) || b.modified - a.modified);
  const live = sorted.filter(isReachable).length;

  return (
    <Page
      title={i18n.t('dash.devices')}
      subtitle={i18n.t('dash.devicesCount', [String(live), String(devices.length)])}
      actions={
        <Button onClick={() => void browser.tabs.create({ url: browser.runtime.getURL('/options.html#devices') })}>
          {i18n.t('dash.manageDevices')}
        </Button>
      }
    >
      {issues.length > 0 && (
        <Card
          className="mb-6 border-note-fg/25"
          title={i18n.t('dash.attention')}
          icon={<TriangleAlert size={16} className="text-note-fg" />}
          bodyClassName="divide-y divide-line px-5"
        >
          <IssueList />
        </Card>
      )}

      <div className="grid grid-cols-[repeat(auto-fill,minmax(250px,1fr))] gap-4">
        {sorted.map((d) => {
          const on = isReachable(d);
          const self = d.iden === selfDeviceIden;
          return (
            <article
              key={d.iden}
              className={clsx(
                'flex flex-col rounded-[22px] border border-line bg-surface p-5 shadow-sm',
                !on && 'bg-surface/60 shadow-none',
              )}
            >
              <div className="flex items-start justify-between">
                <span
                  className={clsx(
                    'grid size-12 place-items-center rounded-2xl',
                    on ? 'bg-accent-soft text-accent-strong' : 'bg-raised text-faint',
                  )}
                >
                  <DeviceGlyph device={d} size={22} />
                </span>
                <span
                  className={clsx(
                    'flex items-center gap-1.5 rounded-full px-2.5 py-1 text-2xs font-bold',
                    on ? 'bg-accent-soft text-accent-strong' : 'bg-raised text-faint',
                  )}
                >
                  <span className={clsx('size-1.5 rounded-full', on ? 'bg-accent' : 'bg-faint')} />
                  {on ? i18n.t('settings.receiving') : i18n.t('settings.notConnected')}
                </span>
              </div>
              <p className={clsx('mt-4 truncate text-base font-extrabold tracking-[-0.01em]', !on && 'text-muted')}>
                {deviceName(d)}
              </p>
              <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted">
                {deviceKind(d)}
                {self && <span className="font-bold text-accent-strong">· {i18n.t('settings.thisBrowser')}</span>}
                {d.has_sms && (
                  <span className="flex items-center gap-1">
                    · <MessageSquareText size={12} /> {i18n.t('dash.canText')}
                  </span>
                )}
              </p>
              <p className="mt-3 text-2xs text-faint">
                {i18n.t('dash.lastActive', [
                  new Date(d.modified * 1000).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }),
                ])}
              </p>
              {on && !self && (
                <Button size="sm" className="mt-4 h-9 self-start" onClick={() => onSend(`device:${d.iden}`)}>
                  <Send size={14} /> {i18n.t('dash.sendTo')}
                </Button>
              )}
            </article>
          );
        })}
      </div>
    </Page>
  );
}
