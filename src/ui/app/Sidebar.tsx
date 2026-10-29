import clsx from 'clsx';
import { BellOff, ChevronsUpDown, Inbox, MessageSquareText, SendHorizontal, Smartphone } from 'lucide-react';
import { useState } from 'react';
import type { ConnectionState, User } from '@/core/pushbullet/types';
import * as store from '@/core/storage/store';
import type { Tab, Unread } from '@/core/storage/store';
import { Avatar, LogoMark } from '@/ui/components';
import { AccountMenu, StatusDot, TABS } from './Header';
import { i18n } from '#i18n';

const ICONS: Record<Tab, typeof Inbox> = {
  send: SendHorizontal,
  feed: Inbox,
  phone: Smartphone,
  sms: MessageSquareText,
};

/** The full-page app's navigation: the green band turned on its side. */
export function Sidebar({
  me,
  connection,
  snoozeUntil,
  tab,
  onTab,
  unread,
  showSms,
  className,
}: {
  me: User | null;
  connection: ConnectionState;
  snoozeUntil: number;
  tab: Tab;
  onTab: (t: Tab) => void;
  unread: Unread;
  showSms: boolean;
  className?: string;
}) {
  const [menu, setMenu] = useState(false);
  const snoozed = snoozeUntil > Date.now();
  const status =
    connection === 'live'
      ? i18n.t('header.connected')
      : connection === 'connecting'
        ? i18n.t('header.connecting')
        : i18n.t('header.offline');

  return (
    <aside className={clsx('bg-band w-60 shrink-0 flex-col text-on-band', className)}>
      <div className="flex items-center gap-2.5 px-5 pb-7 pt-6">
        <LogoMark size={34} className="drop-shadow-[0_2px_4px_rgba(0,40,20,0.3)]" />
        <span className="text-lg font-extrabold tracking-[-0.02em]">Pushpilot</span>
      </div>

      <nav className="flex flex-col gap-1 px-3" aria-label={i18n.t('header.sections')}>
        {TABS.filter((t) => t.id !== 'sms' || showSms).map((t) => {
          const on = tab === t.id;
          const count = t.id === 'send' ? 0 : unread[t.id];
          const Icon = ICONS[t.id];
          return (
            <button
              key={t.id}
              aria-current={on ? 'page' : undefined}
              onClick={() => onTab(t.id)}
              className={clsx(
                'flex h-10 items-center gap-3 rounded-xl px-3 text-sm font-bold transition-colors',
                on
                  ? 'bg-white text-[#0b7f43] shadow-sm dark:bg-white/95'
                  : 'text-on-band/80 hover:bg-white/12 hover:text-on-band',
              )}
            >
              <Icon size={17} strokeWidth={2.2} />
              <span className="flex-1 text-start">{t.label()}</span>
              {count > 0 && (
                <span
                  className={clsx(
                    'min-w-[19px] rounded-full px-1.5 text-center text-[11px] font-extrabold leading-[19px]',
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

      <div className="mt-auto space-y-2 p-3">
        {snoozed && (
          <button
            onClick={() => void store.updateSettings({ snoozeUntil: 0 })}
            title={i18n.t('header.pausedHint')}
            className="flex w-full items-center gap-2 rounded-xl bg-white/12 px-3 py-2 text-xs font-bold hover:bg-white/20"
          >
            <BellOff size={14} /> {i18n.t('header.unpause')}
          </button>
        )}
        <div className="relative">
          <button
            onClick={() => setMenu((v) => !v)}
            aria-label={i18n.t('header.accountMenu')}
            aria-expanded={menu}
            className="flex w-full items-center gap-2.5 rounded-xl p-2 text-start transition-colors hover:bg-white/12"
          >
            <span className="relative shrink-0">
              <Avatar src={me?.image_url} name={me?.name || me?.email} size={34} className="ring-2 ring-white/70" />
              <StatusDot state={connection} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-bold">{me?.name || me?.email}</span>
              <span className="block truncate text-2xs font-semibold text-on-band/75">{status}</span>
            </span>
            <ChevronsUpDown size={15} className="shrink-0 text-on-band/70" />
          </button>
          {menu && (
            <AccountMenu up mode="tab" me={me} connection={connection} snoozeUntil={snoozeUntil} onClose={() => setMenu(false)} />
          )}
        </div>
      </div>
    </aside>
  );
}
