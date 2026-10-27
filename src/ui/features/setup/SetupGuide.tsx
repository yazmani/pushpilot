import clsx from 'clsx';
import { Check, Rocket, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { browser } from 'wxt/browser';
import { isPhone } from '@/core/setup';
import * as store from '@/core/storage/store';
import { isReachable } from '@/core/utils/format';
import { IconButton } from '@/ui/components';
import { useStore } from '@/ui/hooks/use-store';
import { i18n } from '#i18n';

const APPS = 'https://www.pushbullet.com/apps';

/** Whether the toolbar button is pinned; undefined where the browser can't tell. */
function useOnToolbar() {
  const [on, setOn] = useState<boolean | undefined>();
  useEffect(() => {
    const action = browser.action as
      (typeof browser.action & { getUserSettings?: () => Promise<{ isOnToolbar?: boolean }> }) | undefined;
    void action
      ?.getUserSettings?.()
      .then((s) => setOn(s.isOnToolbar))
      .catch(() => undefined);
  }, []);
  return on;
}

function useShortcut(name: string) {
  const [shortcut, setShortcut] = useState('');
  useEffect(() => {
    void browser.commands
      .getAll()
      .then((all) => setShortcut(all.find((c) => c.name === name)?.shortcut ?? ''))
      .catch(() => undefined);
  }, [name]);
  return shortcut;
}

interface Step {
  id: string;
  done: boolean;
  label: string;
  hint: string;
  link?: { href: string; label: string };
}

/** First-run checklist in the Send view. New installs only; hides once everything is ticked or it's dismissed. */
export function SetupGuide() {
  const { setupGuide, triedShortcut, devices, mirrors, smsThreads, ready } = useStore([
    'setupGuide',
    'triedShortcut',
    'devices',
    'mirrors',
    'smsThreads',
  ]);
  const onToolbar = useOnToolbar();
  const shortcut = useShortcut('push-clipboard');
  if (!ready || !setupGuide) return null;

  const phones = devices.filter((d) => isPhone(d) && isReachable(d));
  // Mirroring and texts are Android-only in Pushbullet.
  const android = phones.some((d) => d.type === 'android' || d.has_sms);
  const steps: Step[] = [
    {
      id: 'phone',
      done: phones.length > 0,
      label: i18n.t('guide.phone'),
      hint: i18n.t('guide.phoneHint'),
      link: { href: APPS, label: i18n.t('setup.getApp') },
    },
  ];
  if (onToolbar !== undefined)
    steps.push({ id: 'pin', done: onToolbar, label: i18n.t('guide.pin'), hint: i18n.t('guide.pinHint') });
  if (android) {
    steps.push({ id: 'mirror', done: mirrors.length > 0, label: i18n.t('guide.mirror'), hint: i18n.t('guide.mirrorHint') });
    steps.push({
      id: 'sms',
      done: Object.values(smsThreads).some((t) => t.length > 0),
      label: i18n.t('guide.sms'),
      hint: i18n.t('guide.smsHint'),
    });
  }
  if (shortcut)
    steps.push({
      id: 'shortcut',
      done: triedShortcut,
      label: i18n.t('guide.shortcut', [shortcut]),
      hint: i18n.t('guide.shortcutHint'),
    });

  const left = steps.filter((s) => !s.done).length;
  if (!left) return null;
  const next = steps.find((s) => !s.done);

  return (
    <section className="mb-3 rounded-2xl border border-line bg-surface p-3.5 shadow-card" aria-label={i18n.t('guide.title')}>
      <div className="flex items-start gap-2">
        <p className="flex flex-1 items-center gap-1.5 text-sm font-bold">
          <Rocket size={15} className="text-accent-strong" /> {i18n.t('guide.title')}
          <span className="ms-1 text-xs font-semibold text-faint">
            {i18n.t('guide.progress', [String(steps.length - left), String(steps.length)])}
          </span>
        </p>
        <IconButton
          label={i18n.t('common.dismiss')}
          className="-me-1.5 -mt-1.5 size-7"
          onClick={() => void store.set({ setupGuide: false })}
        >
          <X size={14} />
        </IconButton>
      </div>
      <ol className="mt-2 flex flex-col gap-1.5">
        {steps.map((s) => (
          <li key={s.id} className="flex items-start gap-2.5">
            <span
              className={clsx(
                'mt-0.5 grid size-4 shrink-0 place-items-center rounded-full',
                s.done ? 'bg-accent text-on-accent' : 'ring-[1.5px] ring-line',
              )}
              aria-hidden="true"
            >
              {s.done && <Check size={10} strokeWidth={3.5} />}
            </span>
            <div className="min-w-0 flex-1">
              <p className={clsx('text-xs font-semibold', s.done && 'text-faint line-through')}>
                <span className="sr-only">{s.done ? i18n.t('guide.done') : i18n.t('guide.todo')} </span>
                {s.label}
              </p>
              {s === next && (
                <p className="mt-0.5 text-xs leading-relaxed text-muted">
                  {s.hint}
                  {s.link && (
                    <>
                      {' '}
                      <a
                        className="font-bold text-accent-strong hover:underline"
                        href={s.link.href}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {s.link.label}
                      </a>
                    </>
                  )}
                </p>
              )}
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
