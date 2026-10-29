import clsx from 'clsx';
import { AppWindow, BellOff, Check, ExternalLink, Globe, Maximize2, Moon, PanelRight, RefreshCw, Settings } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { browser } from 'wxt/browser';
import { call } from '@/core/messaging/rpc';
import type { ConnectionState, User } from '@/core/pushbullet/types';
import * as store from '@/core/storage/store';
import type { Tab, Unread } from '@/core/storage/store';
import { Avatar, LogoMark } from '@/ui/components';
import type { Mode } from './App';
import { i18n } from '#i18n';

export const TABS: { id: Tab; label: () => string }[] = [
  { id: 'send', label: () => i18n.t('tabs.send') },
  { id: 'feed', label: () => i18n.t('tabs.feed') },
  { id: 'phone', label: () => i18n.t('tabs.phone') },
  { id: 'sms', label: () => i18n.t('tabs.sms') },
];

/**
 * The green band: mark, sections and your account in one row, so the popup
 * spends its height on content. Everything secondary lives in the account menu.
 */
export function Header({
  mode,
  me,
  connection,
  snoozeUntil,
  tab,
  onTab,
  unread,
  showSms,
  className,
}: {
  className?: string;
  mode: Mode;
  me: User | null;
  connection: ConnectionState;
  snoozeUntil: number;
  tab: Tab;
  onTab: (t: Tab) => void;
  unread: Unread;
  showSms: boolean;
}) {
  const [menu, setMenu] = useState(false);
  const snoozed = snoozeUntil > Date.now();

  return (
    <header className={clsx('bg-band relative shrink-0 text-on-band', className)}>
      <div className="flex h-[52px] items-center gap-1 ps-3.5 pe-2.5">
        <LogoMark size={28} className="me-1.5 shrink-0 drop-shadow-[0_2px_4px_rgba(0,40,20,0.3)]" />
        <nav className="flex min-w-0 flex-1 items-center gap-0.5" role="tablist" aria-label={i18n.t('header.sections')}>
          {TABS.filter((t) => t.id !== 'sms' || showSms).map((t) => {
            const on = tab === t.id;
            const count = t.id === 'send' ? 0 : unread[t.id];
            return (
              <button
                key={t.id}
                role="tab"
                aria-selected={on}
                onClick={() => onTab(t.id)}
                className={clsx(
                  'flex h-8 items-center gap-1.5 rounded-full px-3 text-[13px] font-bold transition-colors',
                  on
                    ? 'bg-white text-[#0b7f43] shadow-sm dark:bg-white/95'
                    : 'text-on-band/80 hover:bg-white/12 hover:text-on-band',
                )}
              >
                {t.label()}
                {count > 0 && (
                  <span
                    className={clsx(
                      'min-w-[17px] rounded-full px-1 text-center text-[10px] font-extrabold leading-[17px]',
                      on ? 'bg-[#16a35a] text-white' : 'bg-white text-[#0b7f43]',
                    )}
                  >
                    {count > 99 ? '99+' : count}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {mode !== 'tab' && (
          <button
            title={i18n.t('header.openTab')}
            aria-label={i18n.t('header.openTab')}
            onClick={() => void openFullPage(mode)}
            className="me-2 grid size-8 place-items-center rounded-full text-on-band/85 transition-colors hover:bg-white/12 hover:text-on-band"
          >
            <Maximize2 size={15} strokeWidth={2.2} />
          </button>
        )}
        {snoozed && (
          <button
            title={i18n.t('header.pausedHint')}
            onClick={() => void store.updateSettings({ snoozeUntil: 0 })}
            className="grid size-8 place-items-center rounded-full text-on-band/85 hover:bg-white/12"
          >
            <BellOff size={15} />
          </button>
        )}
        <div className="relative">
          <button
            onClick={() => setMenu((v) => !v)}
            aria-label={i18n.t('header.accountMenu')}
            aria-expanded={menu}
            className="relative rounded-full p-0.5 transition-colors hover:bg-white/15"
          >
            <Avatar src={me?.image_url} name={me?.name || me?.email} size={30} className="ring-2 ring-white/70" />
            <StatusDot state={connection} />
          </button>
          {menu && (
            <AccountMenu mode={mode} me={me} connection={connection} snoozeUntil={snoozeUntil} onClose={() => setMenu(false)} />
          )}
        </div>
      </div>
    </header>
  );
}

/** One full-page Pushpilot: focus it if it's already open, and get the popup out of the way. */
export async function openFullPage(mode: Mode) {
  const url = browser.runtime.getURL('/app.html');
  const [open] = await browser.tabs.query({ url });
  if (open?.id !== undefined) {
    await browser.tabs.update(open.id, { active: true });
    await browser.windows.update(open.windowId, { focused: true });
  } else await browser.tabs.create({ url });
  if (mode === 'popup') window.close();
}

export function StatusDot({ state }: { state: ConnectionState }) {
  return (
    <span
      className={clsx(
        'absolute bottom-0 end-0 size-2.5 rounded-full ring-2 ring-[#13a257] dark:ring-[#0f4a2b]',
        state === 'live' && 'bg-[#7dffb4]',
        state === 'connecting' && 'animate-pulse bg-amber-300',
        (state === 'offline' || state === 'signed-out') && 'bg-zinc-300',
      )}
    />
  );
}

export function AccountMenu({
  mode,
  me,
  connection,
  snoozeUntil,
  onClose,
  up = false,
}: {
  mode: Mode;
  me: User | null;
  connection: ConnectionState;
  snoozeUntil: number;
  onClose: () => void;
  /** Open upwards, from the bottom of the full-page sidebar. */
  up?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onDown = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && onClose();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  const snoozed = snoozeUntil > Date.now();
  const tomorrowMorning = () => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(8, 0, 0, 0);
    return d.getTime() - Date.now();
  };
  const snooze = (ms: number) => {
    void store.updateSettings({ snoozeUntil: ms ? Date.now() + ms : 0 });
    onClose();
  };
  const openPanel = async () => {
    const win = await browser.windows.getCurrent();
    if (win.id !== undefined) await browser.sidePanel.open({ windowId: win.id });
    window.close();
  };
  // One full-page Pushpilot: focus it if it's already open.
  const openTab = async () => {
    await openFullPage(mode);
    onClose();
  };
  const popOut = async () => {
    await browser.windows.create({ url: browser.runtime.getURL('/popup.html?window=1'), type: 'popup', width: 420, height: 660 });
    window.close();
  };

  const item =
    'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-start text-sm font-semibold text-ink hover:bg-raised dark:hover:bg-white/[0.07]';
  const status =
    connection === 'live'
      ? i18n.t('header.connected')
      : connection === 'connecting'
        ? i18n.t('header.connecting')
        : i18n.t('header.offline');

  return (
    <div
      ref={ref}
      role="menu"
      className={clsx(
        // A notch lighter than the surface in dark mode, so it stands out against the dark sidebar too.
        'animate-rise absolute z-50 w-64 rounded-2xl border border-line bg-surface p-1.5 text-ink shadow-card dark:border-white/10 dark:bg-raised dark:shadow-[0_18px_50px_-12px_rgba(0,0,0,0.7)]',
        up ? 'bottom-full start-0 mb-2' : 'end-0 top-11',
      )}
    >
      <div className="flex items-center gap-2.5 px-2.5 pb-2.5 pt-2">
        <Avatar src={me?.image_url} name={me?.name || me?.email} size={34} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold">{me?.name || me?.email}</p>
          <p className="flex items-center gap-1.5 text-2xs font-semibold text-muted">
            <span
              className={clsx(
                'size-1.5 rounded-full',
                connection === 'live' ? 'bg-accent' : connection === 'connecting' ? 'bg-note-fg' : 'bg-faint',
              )}
            />
            {status}
            {connection === 'offline' && (
              <button className="ms-1 flex items-center gap-1 text-accent-strong" onClick={() => void call('reconnect')}>
                <RefreshCw size={10} /> {i18n.t('common.retry')}
              </button>
            )}
          </p>
        </div>
      </div>

      <div className="border-t border-line px-2.5 pb-1 pt-2.5 text-2xs font-bold text-muted">
        {snoozed
          ? i18n.t('header.quietUntil', [
              new Date(snoozeUntil).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }),
            ])
          : i18n.t('header.pause')}
      </div>
      {/* "Tonight" is the longest label in most languages; give it the room. */}
      <div className="grid grid-cols-[1fr_1fr_1fr_1.7fr] gap-1 px-1.5 pb-2">
        {(
          [
            ['30m', i18n.t('header.snooze30m'), 30 * 60_000],
            ['1h', i18n.t('header.snooze1h'), 3_600_000],
            ['8h', i18n.t('header.snooze8h'), 8 * 3_600_000],
            ['night', i18n.t('header.snoozeNight'), tomorrowMorning()],
          ] as const
        ).map(([id, label, ms]) => (
          <button
            key={id}
            onClick={() => snooze(ms)}
            className="flex h-8 min-w-0 items-center justify-center gap-1 whitespace-nowrap rounded-lg bg-raised px-1 text-xs font-bold hover:bg-accent-soft hover:text-accent-strong dark:bg-white/[0.07]"
          >
            {id === 'night' && <Moon size={12} className="shrink-0" />}
            {label}
          </button>
        ))}
      </div>
      {snoozed && (
        <button className={clsx(item, 'text-accent-strong')} onClick={() => snooze(0)}>
          <Check size={15} /> {i18n.t('header.unpause')}
        </button>
      )}

      <div className="mt-1 border-t border-line pt-1.5">
        {mode !== 'tab' && (
          <button className={item} onClick={openTab}>
            <AppWindow size={15} className="text-muted" /> {i18n.t('header.openTab')}
          </button>
        )}
        {mode === 'popup' && (
          <>
            <button className={item} onClick={openPanel}>
              <PanelRight size={15} className="text-muted" /> {i18n.t('header.openPanel')}
            </button>
            <button className={item} onClick={popOut}>
              <ExternalLink size={15} className="text-muted" /> {i18n.t('header.openWindow')}
            </button>
          </>
        )}
        <a className={item} href="https://www.pushbullet.com/" target="_blank" rel="noreferrer" onClick={onClose}>
          <Globe size={15} className="text-muted" /> Pushbullet.com
        </a>
        <button className={item} onClick={() => void browser.runtime.openOptionsPage()}>
          <Settings size={15} className="text-muted" /> {i18n.t('header.settings')}
        </button>
      </div>
    </div>
  );
}
