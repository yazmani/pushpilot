import { BellRing, Smartphone } from 'lucide-react';
import { useMemo } from 'react';
import { browser } from 'wxt/browser';
import { call } from '@/core/messaging/rpc';
import { Button, Empty, Group, SectionLabel } from '@/ui/components';
import { useStore } from '@/ui/hooks/use-store';
import { useRun } from '@/ui/hooks/use-toast';
import { MirrorCard } from './MirrorCard';
import { i18n } from '#i18n';

export function PhoneView({ focus }: { focus?: string }) {
  const { mirrors, devices, settings } = useStore(['mirrors', 'devices', 'settings']);
  const run = useRun();
  const live = useMemo(() => mirrors.filter((m) => !m.dismissed), [mirrors]);
  const manyPhones = useMemo(() => new Set(mirrors.map((m) => m.source_device_iden)).size > 1, [mirrors]);
  const earlier = useMemo(() => mirrors.filter((m) => m.dismissed).slice(0, 40), [mirrors]);

  if (!settings.mirrorEnabled) {
    return (
      <Empty
        icon={<BellRing size={24} />}
        title={i18n.t('phone.offTitle')}
        action={
          <Button onClick={() => void browser.tabs.create({ url: browser.runtime.getURL('/options.html#phone') })}>
            {i18n.t('phone.openSettings')}
          </Button>
        }
      >
        {i18n.t('phone.offBody')}
      </Empty>
    );
  }

  if (!mirrors.length) {
    return (
      <Empty icon={<Smartphone size={24} />} title={i18n.t('phone.emptyTitle')}>
        {i18n.t('phone.emptyBody')}
      </Empty>
    );
  }

  return (
    <div className="scroll-area h-full px-3.5 pb-4 pt-3">
      {live.length > 0 && (
        <section>
          <SectionLabel>{i18n.t('phone.now')}</SectionLabel>
          <Group>
            {live.map((m) => (
              <MirrorCard key={m.id} m={m} devices={devices} autoFocus={m.id === focus} showDevice={manyPhones} />
            ))}
          </Group>
        </section>
      )}
      {earlier.length > 0 && (
        <section className={live.length ? 'mt-5' : undefined}>
          <SectionLabel
            action={
              <button
                className="text-xs font-bold text-muted hover:text-ink"
                onClick={() => run(() => call('mirror.clear'), i18n.t('phone.cleared'))}
              >
                {i18n.t('phone.clearAll')}
              </button>
            }
          >
            {i18n.t('phone.earlier')}
          </SectionLabel>
          <Group>
            {earlier.map((m) => (
              <MirrorCard key={m.id} m={m} devices={devices} showDevice={manyPhones} />
            ))}
          </Group>
        </section>
      )}
    </div>
  );
}
