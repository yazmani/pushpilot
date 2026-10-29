import clsx from 'clsx';
import { LayoutGrid } from 'lucide-react';
import { useMemo, useState } from 'react';
import { call } from '@/core/messaging/rpc';
import type { Mirror } from '@/core/pushbullet/types';
import { MirrorCard } from '@/ui/features/phone/MirrorCard';
import { PhoneView } from '@/ui/features/phone/PhoneView';
import { useStore } from '@/ui/hooks/use-store';
import { useRun } from '@/ui/hooks/use-toast';
import { i18n } from '#i18n';

const CARD = 'rounded-[20px] border border-line bg-surface shadow-sm';
const appName = (m: Mirror) => m.application_name || m.package_name;

/** Phone notifications on a big screen: apps to filter by on the left, the notifications as cards. */
export function PhoneDesk({ focus }: { focus?: string }) {
  const { mirrors, devices, settings } = useStore(['mirrors', 'devices', 'settings']);
  const run = useRun();
  const [app, setApp] = useState<string | null>(null);
  const manyPhones = useMemo(() => new Set(mirrors.map((m) => m.source_device_iden)).size > 1, [mirrors]);
  const apps = useMemo(() => {
    const out = new Map<string, { name: string; icon?: string; count: number; live: number }>();
    for (const m of mirrors) {
      const a = out.get(m.package_name) ?? { name: appName(m), icon: m.icon, count: 0, live: 0 };
      a.count++;
      if (!m.dismissed) a.live++;
      out.set(m.package_name, a);
    }
    return [...out].sort((x, y) => y[1].live - x[1].live || y[1].count - x[1].count);
  }, [mirrors]);

  // Off, or nothing yet: the popup's explanations say it best.
  if (!settings.mirrorEnabled || !mirrors.length) return <PhoneView focus={focus} />;

  const mine = app ? mirrors.filter((m) => m.package_name === app) : mirrors;
  const live = mine.filter((m) => !m.dismissed);
  const earlier = mine.filter((m) => m.dismissed).slice(0, 60);
  const grid = 'grid grid-cols-[repeat(auto-fill,minmax(320px,1fr))] items-start gap-3';

  return (
    <div className="flex h-full gap-6">
      <nav className="scroll-area w-56 shrink-0 pb-6" aria-label={i18n.t('dash.apps')}>
        <p className="px-3 pb-2 text-2xs font-extrabold uppercase tracking-wide text-faint">{i18n.t('dash.apps')}</p>
        {[[null, { name: i18n.t('dash.allApps'), icon: undefined, count: mirrors.length, live: 0 }] as const, ...apps].map(
          ([id, a]) => (
            <button
              key={id ?? 'all'}
              onClick={() => setApp(id)}
              aria-pressed={app === id}
              className={clsx(
                'flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-start text-sm font-semibold transition-colors',
                app === id ? 'bg-surface text-ink shadow-sm ring-1 ring-line' : 'text-muted hover:bg-surface/60 hover:text-ink',
              )}
            >
              {a.icon ? (
                <img src={`data:image/jpeg;base64,${a.icon}`} alt="" className="size-6 shrink-0 rounded-md" />
              ) : (
                <span className="grid size-6 shrink-0 place-items-center rounded-md bg-raised text-muted">
                  <LayoutGrid size={13} />
                </span>
              )}
              <span className="min-w-0 flex-1 truncate">{a.name}</span>
              {a.live > 0 && <span className="size-1.5 rounded-full bg-accent" />}
              <span className="text-2xs tabular-nums text-faint">{a.count}</span>
            </button>
          ),
        )}
      </nav>

      <div className="scroll-area min-w-0 flex-1 pb-10">
        {live.length > 0 && (
          <section className="mb-8">
            <h2 className="mb-3 text-sm font-extrabold">
              {i18n.t('phone.now')} <span className="ms-1 font-semibold text-faint">{live.length}</span>
            </h2>
            <ul className={grid}>
              {live.map((m) => (
                <MirrorCard
                  key={m.id}
                  m={m}
                  devices={devices}
                  autoFocus={m.id === focus}
                  showDevice={manyPhones}
                  className={CARD}
                />
              ))}
            </ul>
          </section>
        )}
        {earlier.length > 0 && (
          <section>
            <div className="mb-3 flex items-center">
              <h2 className="flex-1 text-sm font-extrabold">{i18n.t('phone.earlier')}</h2>
              <button
                className="rounded-lg px-2 py-1 text-xs font-bold text-muted hover:bg-surface hover:text-ink"
                onClick={() => run(() => call('mirror.clear'), i18n.t('phone.cleared'))}
              >
                {i18n.t('phone.clearAll')}
              </button>
            </div>
            <ul className={grid}>
              {earlier.map((m) => (
                <MirrorCard key={m.id} m={m} devices={devices} showDevice={manyPhones} className={clsx(CARD, 'shadow-none')} />
              ))}
            </ul>
          </section>
        )}
        {!live.length && !earlier.length && <p className="text-sm text-muted">{i18n.t('dash.phoneQuiet')}</p>}
      </div>
    </div>
  );
}
