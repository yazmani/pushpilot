import clsx from 'clsx';
import {
  BellOff,
  ChevronsUpDown,
  FolderOpen,
  Inbox,
  LayoutGrid,
  MessageSquareText,
  MonitorSmartphone,
  Plus,
  Smartphone,
} from 'lucide-react';
import { useState } from 'react';
import type { ConnectionState, User } from '@/core/pushbullet/types';
import * as store from '@/core/storage/store';
import type { Unread } from '@/core/storage/store';
import { Avatar, LogoMark } from '@/ui/components';
import { AccountMenu, StatusDot } from './Header';
import { i18n } from '#i18n';

/** Sections of the full-page app. */
export type Page = 'home' | 'feed' | 'files' | 'phone' | 'sms' | 'devices';

const NAV: { id: Page; icon: typeof Inbox; label: () => string }[][] = [
  [
    { id: 'home', icon: LayoutGrid, label: () => i18n.t('dash.home') },
    { id: 'feed', icon: Inbox, label: () => i18n.t('tabs.feed') },
    { id: 'files', icon: FolderOpen, label: () => i18n.t('dash.files') },
  ],
  [
    { id: 'phone', icon: Smartphone, label: () => i18n.t('tabs.phone') },
    { id: 'sms', icon: MessageSquareText, label: () => i18n.t('tabs.sms') },
    { id: 'devices', icon: MonitorSmartphone, label: () => i18n.t('dash.devices') },
  ],
];

/** The full-page app's navigation, on the brand's deep green. */
export function Sidebar({
  me,
  connection,
  snoozeUntil,
  page,
  onPage,
  onNewPush,
  unread,
  showSms,
}: {
  me: User | null;
  connection: ConnectionState;
  snoozeUntil: number;
  page: Page;
  onPage: (p: Page) => void;
  onNewPush: () => void;
  unread: Unread;
  showSms: boolean;
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
    <aside className="bg-rail flex w-[264px] shrink-0 flex-col text-on-band">
      <div className="flex items-center gap-3 px-6 pb-6 pt-7">
        <LogoMark size={34} className="drop-shadow-[0_3px_6px_rgba(0,30,15,0.35)]" />
        <span className="text-[19px] font-extrabold tracking-[-0.03em]">Pushpilot</span>
      </div>

      <div className="px-4 pb-5">
        <button
          onClick={onNewPush}
          className="flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-white text-sm font-extrabold text-[#0b7f43] shadow-[0_6px_20px_-6px_rgba(0,0,0,0.35)] transition-transform hover:-translate-y-px dark:bg-white/95"
        >
          <Plus size={17} strokeWidth={2.6} /> {i18n.t('dash.newPush')}
        </button>
      </div>

      <nav className="flex flex-col gap-4 px-3" aria-label={i18n.t('header.sections')}>
        {NAV.map((group, g) => (
          <div key={g} className="flex flex-col gap-0.5">
            {group
              .filter((n) => n.id !== 'sms' || showSms)
              .map((n) => {
                const on = page === n.id;
                const count = n.id === 'feed' || n.id === 'phone' || n.id === 'sms' ? unread[n.id] : 0;
                const Icon = n.icon;
                return (
                  <button
                    key={n.id}
                    aria-current={on ? 'page' : undefined}
                    onClick={() => onPage(n.id)}
                    className={clsx(
                      'group flex h-10 items-center gap-3 rounded-xl px-3 text-sm font-bold transition-colors',
                      on
                        ? 'bg-white/[0.16] text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.12)]'
                        : 'text-on-band/70 hover:bg-white/[0.08] hover:text-white',
                    )}
                  >
                    <Icon
                      size={18}
                      strokeWidth={on ? 2.4 : 2}
                      className={clsx(on ? 'text-[#8ff5bb]' : 'text-on-band/60 group-hover:text-on-band/90')}
                    />
                    <span className="flex-1 text-start">{n.label()}</span>
                    {count > 0 && (
                      <span className="min-w-[20px] rounded-full bg-[#8ff5bb] px-1.5 text-center text-[11px] font-extrabold leading-5 text-[#063d20]">
                        {count > 99 ? '99+' : count}
                      </span>
                    )}
                  </button>
                );
              })}
            {g === 0 && <div className="mx-3 mt-3.5 border-t border-white/10" />}
          </div>
        ))}
      </nav>

      <div className="mt-auto space-y-2 p-3">
        {snoozed && (
          <button
            onClick={() => void store.updateSettings({ snoozeUntil: 0 })}
            title={i18n.t('header.pausedHint')}
            className="flex w-full items-center gap-2 rounded-xl bg-white/10 px-3 py-2 text-xs font-bold hover:bg-white/15"
          >
            <BellOff size={14} /> {i18n.t('header.unpause')}
          </button>
        )}
        <div className="relative">
          <button
            onClick={() => setMenu((v) => !v)}
            aria-label={i18n.t('header.accountMenu')}
            aria-expanded={menu}
            className="flex w-full items-center gap-3 rounded-2xl bg-black/10 p-2.5 text-start transition-colors hover:bg-black/20"
          >
            <span className="relative shrink-0">
              <Avatar src={me?.image_url} name={me?.name || me?.email} size={36} className="ring-2 ring-white/50" />
              <StatusDot state={connection} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-bold">{me?.name || me?.email}</span>
              <span className="block truncate text-2xs font-semibold text-on-band/65">{status}</span>
            </span>
            <ChevronsUpDown size={15} className="shrink-0 text-on-band/60" />
          </button>
          {menu && (
            <AccountMenu up mode="tab" me={me} connection={connection} snoozeUntil={snoozeUntil} onClose={() => setMenu(false)} />
          )}
        </div>
      </div>
    </aside>
  );
}
