import { BellRing, Smartphone } from 'lucide-react';
import { useMemo } from 'react';
import { browser } from 'wxt/browser';
import { call } from '@/core/messaging/rpc';
import { Button, Empty, Group, SectionLabel } from '@/ui/components';
import { useStore } from '@/ui/hooks/use-store';
import { useRun } from '@/ui/hooks/use-toast';
import { MirrorCard } from './MirrorCard';

export function PhoneView({ focus }: { focus?: string }) {
  const { mirrors, devices, settings } = useStore(['mirrors', 'devices', 'settings']);
  const run = useRun();
  const live = useMemo(() => mirrors.filter((m) => !m.dismissed), [mirrors]);
  const earlier = useMemo(() => mirrors.filter((m) => m.dismissed).slice(0, 40), [mirrors]);

  if (!settings.mirrorEnabled) {
    return (
      <Empty
        icon={<BellRing size={24} />}
        title="Phone notifications are off"
        action={
          <Button onClick={() => void browser.tabs.create({ url: browser.runtime.getURL('/options.html#phone') })}>
            Open settings
          </Button>
        }
      >
        Turn on notification mirroring to see your Android notifications here.
      </Empty>
    );
  }

  if (!mirrors.length) {
    return (
      <Empty icon={<Smartphone size={24} />} title="No phone notifications yet">
        In the Pushbullet app on your Android phone, open Notification mirroring and switch it on. New notifications appear here
        and as desktop alerts.
      </Empty>
    );
  }

  return (
    <div className="scroll-area h-full px-3.5 pb-4 pt-3">
      {live.length > 0 && (
        <section>
          <SectionLabel>On your phone now</SectionLabel>
          <Group>
            {live.map((m) => (
              <MirrorCard key={m.id} m={m} devices={devices} autoFocus={m.id === focus} />
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
                onClick={() => run(() => call('mirror.clear'), 'Cleared')}
              >
                Clear all
              </button>
            }
          >
            Earlier
          </SectionLabel>
          <Group>
            {earlier.map((m) => (
              <MirrorCard key={m.id} m={m} devices={devices} />
            ))}
          </Group>
        </section>
      )}
    </div>
  );
}
