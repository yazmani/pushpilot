import clsx from 'clsx';
import { ClipboardCopy, Coffee, Heart, LockKeyhole, LogOut, Pencil, RefreshCw, Star, Trash2 } from 'lucide-react';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { browser, type Browser } from 'wxt/browser';
import { LINKS, REVIEWS } from '@/core/links';
import { call } from '@/core/messaging/rpc';
import type { Device } from '@/core/pushbullet/types';
import * as store from '@/core/storage/store';
import type { Settings, SoundChoice, Tab, Theme } from '@/core/storage/store';
import { deviceCategory, deviceKind, deviceName, isReachable } from '@/core/utils/format';
import { Avatar, Button, DeviceGlyph, fieldClass, LinkButton, LogoMark, Segmented, Toggle, ToastBar } from '@/ui/components';
import { SignIn } from '@/ui/features/auth/SignIn';
import { useTargets } from '@/ui/features/send/targets';
import { IssueList } from '@/ui/features/setup/SetupIssues';
import { lastActivity } from '@/core/setup';
import { useStore } from '@/ui/hooks/use-store';
import { useTheme } from '@/ui/hooks/use-theme';
import { ToastProvider, useRun, useToast } from '@/ui/hooks/use-toast';
import { i18n } from '#i18n';

const SECTIONS = [
  ['account', () => i18n.t('settings.section.account')],
  ['devices', () => i18n.t('settings.section.devices')],
  ['sending', () => i18n.t('settings.section.sending')],
  ['receiving', () => i18n.t('settings.section.receiving')],
  ['auto-open', () => i18n.t('settings.section.autoOpen')],
  ['notifications', () => i18n.t('settings.section.notifications')],
  ['badge', () => i18n.t('settings.section.toolbarBadge')],
  ['phone', () => i18n.t('settings.section.phone')],
  ['feed', () => i18n.t('settings.section.feed')],
  ['encryption', () => i18n.t('settings.section.encryption')],
  ['appearance', () => i18n.t('settings.section.appearance')],
  ['shortcuts', () => i18n.t('settings.section.shortcuts')],
  ['data', () => i18n.t('settings.section.yourData')],
  ['support', () => i18n.t('settings.navSupport')],
] as const;

export function SettingsPage() {
  useTheme();
  return (
    <ToastProvider render={(t) => <ToastBar toast={t} />}>
      <SettingsContent />
    </ToastProvider>
  );
}

function SettingsContent() {
  const { token, me, settings, devices, selfDeviceIden, e2eKey, connection, ready } = useStore([
    'token',
    'me',
    'settings',
    'devices',
    'selfDeviceIden',
    'e2eKey',
    'connection',
  ]);
  const run = useRun();
  const set = (patch: Partial<Settings>) => void store.updateSettings(patch);

  // Deep links like options.html#devices land on their section once rendered.
  useEffect(() => {
    if (ready && location.hash) document.querySelector(location.hash)?.scrollIntoView();
  }, [ready]);

  if (!ready) return null;
  if (!token) {
    return (
      <div className="mx-auto max-w-3xl px-8 py-20">
        <SignIn wide autoStart={location.hash === '#signin'} />
      </div>
    );
  }

  const self = devices.find((d) => d.iden === selfDeviceIden);

  return (
    <div className="min-h-screen">
      <header className="bg-band text-on-band">
        <div className="mx-auto flex h-16 max-w-5xl items-center gap-3 px-8">
          <LogoMark size={28} className="drop-shadow-[0_2px_4px_rgba(0,40,20,0.3)]" />
          <p className="text-lg font-extrabold tracking-[-0.02em]">Pushpilot</p>
          <span className="ms-2 rounded-full bg-white/15 px-2.5 py-1 text-2xs font-bold">
            {connection === 'live'
              ? i18n.t('header.connected')
              : connection === 'connecting'
                ? i18n.t('header.connecting')
                : i18n.t('header.offline')}
          </span>
          <span className="ms-auto truncate text-sm font-semibold text-on-band/85">{me?.email}</span>
          <Avatar src={me?.image_url} name={me?.name || me?.email} size={32} className="ring-2 ring-white/70" />
        </div>
      </header>
      <div className="mx-auto grid max-w-5xl grid-cols-1 gap-12 px-8 py-10 md:grid-cols-[200px_1fr]">
        <aside className="md:sticky md:top-10 md:self-start">
          <nav className="hidden flex-col gap-0.5 md:flex">
            {SECTIONS.map(([id, label]) => (
              <a
                key={id}
                href={`#${id}`}
                className="rounded-xl px-3 py-2 text-sm font-semibold text-muted transition-colors hover:bg-surface hover:text-ink"
              >
                {label()}
              </a>
            ))}
          </nav>
        </aside>

        <main className="min-w-0 max-w-2xl pb-24">
          <Section id="account" title={i18n.t('settings.section.account')}>
            <div className="flex items-center gap-4 py-4">
              <Avatar src={me?.image_url} name={me?.name || me?.email} size={52} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-base font-bold">{me?.name || me?.email}</p>
                <p className="flex items-center gap-2 truncate text-sm text-muted">
                  {me?.email}
                  {me?.pro && (
                    <span className="rounded-full bg-accent-soft px-2 py-0.5 text-2xs font-bold text-accent-strong">Pro</span>
                  )}
                </p>
              </div>
              <Button onClick={() => run(() => call('auth.signout'))}>
                <LogOut size={15} /> {i18n.t('settings.signOut')}
              </Button>
            </div>
            <RenameDevice
              current={self ? deviceName(self) : 'Chrome'}
              onSave={(name) => run(() => call('device.rename', { name }), i18n.t('settings.renamed'))}
            />
          </Section>

          <Section id="devices" title={i18n.t('settings.section.devices')} description={i18n.t('settings.section.devicesDesc')}>
            <IssueList />
            <DeviceList devices={devices} selfIden={selfDeviceIden} />
          </Section>

          <Section id="sending" title={i18n.t('settings.section.sending')}>
            <DefaultTarget value={settings.defaultTarget} onChange={(defaultTarget) => set({ defaultTarget })} />
            <Toggle
              label={i18n.t('settings.startWithThePage')}
              hint={i18n.t('settings.startWithThePageHint')}
              checked={settings.prefillCurrentPage}
              onChange={(prefillCurrentPage) => set({ prefillCurrentPage })}
            />
            <Toggle
              label={i18n.t('settings.closeThePopupAfter')}
              checked={settings.closeAfterSend}
              onChange={(closeAfterSend) => set({ closeAfterSend })}
            />
            <Toggle
              label={i18n.t('settings.rightClickMenu')}
              hint={i18n.t('settings.rightClickMenuHint')}
              checked={settings.contextMenu}
              onChange={(contextMenu) => set({ contextMenu })}
            />
          </Section>

          <Section
            id="receiving"
            title={i18n.t('settings.section.receiving')}
            description={i18n.t('settings.section.receivingDesc')}
          >
            <Toggle
              label={i18n.t('settings.pushesSentToAll')}
              hint={i18n.t('settings.pushesSentToAllHint')}
              checked={settings.receiveAll}
              onChange={(receiveAll) => set({ receiveAll })}
            />
            <Toggle
              label={i18n.t('settings.pushesSentToYour')}
              hint={i18n.t('settings.pushesSentToYourHint')}
              checked={settings.receiveOthers}
              onChange={(receiveOthers) => set({ receiveOthers })}
            />
            {!settings.receiveOthers && (
              <OtherBrowsers
                devices={devices}
                selfIden={selfDeviceIden}
                value={settings.receiveFor}
                onChange={(receiveFor) => set({ receiveFor })}
              />
            )}
            <Toggle
              label={i18n.t('settings.pushesYouSendFrom')}
              hint={i18n.t('settings.pushesYouSendFromHint')}
              checked={settings.receiveOwn}
              onChange={(receiveOwn) => set({ receiveOwn })}
            />
            <Toggle
              label={i18n.t('settings.channelSubscriptions')}
              hint={i18n.t('settings.channelSubscriptionsHint')}
              checked={settings.showChannels}
              onChange={(showChannels) => set({ showChannels })}
            />
          </Section>

          <Section id="auto-open" title={i18n.t('settings.section.autoOpen')}>
            <Toggle
              label={i18n.t('settings.openLinksAsSoon')}
              hint={i18n.t('settings.openLinksAsSoonHint')}
              checked={settings.autoOpenLinks}
              onChange={(autoOpenLinks) => set({ autoOpenLinks })}
            />
            <Toggle
              label={i18n.t('settings.switchToTheNew')}
              hint={i18n.t('settings.switchToTheNewHint')}
              checked={settings.autoOpenActive}
              onChange={(autoOpenActive) => set({ autoOpenActive })}
              disabled={!settings.autoOpenLinks}
            />
            <Toggle
              label={i18n.t('settings.alsoOpenImagesPdfs')}
              checked={settings.autoOpenFiles}
              onChange={(autoOpenFiles) => set({ autoOpenFiles })}
              disabled={!settings.autoOpenLinks}
            />
            <Toggle
              label={i18n.t('settings.alsoOpenLinksFrom')}
              hint={i18n.t('settings.alsoOpenLinksFromHint')}
              checked={settings.autoOpenFromPeople}
              onChange={(autoOpenFromPeople) => set({ autoOpenFromPeople })}
              disabled={!settings.autoOpenLinks}
            />
            <Toggle
              label={i18n.t('settings.openLinksThatArrived')}
              hint={i18n.t('settings.openLinksThatArrivedHint')}
              checked={settings.autoOpenOnReconnect}
              onChange={(autoOpenOnReconnect) => set({ autoOpenOnReconnect })}
              disabled={!settings.autoOpenLinks}
            />
            <Toggle
              label={i18n.t('settings.skipTheNotificationFor')}
              checked={settings.hideAutoOpened}
              onChange={(hideAutoOpened) => set({ hideAutoOpened })}
              disabled={!settings.autoOpenLinks}
            />
          </Section>

          <Section id="notifications" title={i18n.t('settings.section.notifications')}>
            <Toggle
              label={i18n.t('settings.pushes')}
              hint={i18n.t('settings.pushesHint')}
              checked={settings.notifyPushes}
              onChange={(notifyPushes) => set({ notifyPushes })}
            />
            <Toggle
              label={i18n.t('settings.phoneNotifications')}
              checked={settings.notifyMirrors}
              onChange={(notifyMirrors) => set({ notifyMirrors })}
            />
            <Toggle
              label={i18n.t('settings.textMessages')}
              checked={settings.notifySms}
              onChange={(notifySms) => set({ notifySms })}
            />
            <Toggle label={i18n.t('settings.playASound')} checked={settings.sound} onChange={(sound) => set({ sound })} />
            <SoundPicker
              value={settings.soundChoice}
              disabled={!settings.sound}
              onChange={(soundChoice) => set({ soundChoice })}
            />
            <Toggle
              label={i18n.t('settings.keepPushNotificationsOn')}
              hint={i18n.t('settings.keepPushNotificationsOnHint')}
              checked={settings.sticky}
              onChange={(sticky) => set({ sticky })}
            />
            <Toggle
              label={i18n.t('settings.keepPhoneNotificationsOn')}
              checked={settings.stickyMirrors}
              onChange={(stickyMirrors) => set({ stickyMirrors })}
            />
            <Toggle
              label={i18n.t('settings.closingANotificationDismisses')}
              hint={i18n.t('settings.closingANotificationDismissesHint')}
              checked={settings.closeDismisses}
              onChange={(closeDismisses) => set({ closeDismisses })}
            />
            <div className="flex items-center gap-3 py-3.5">
              <Button onClick={() => run(() => call('notify.test'))}>{i18n.t('settings.testNotification')}</Button>
              {settings.snoozeUntil > Date.now() && (
                <Button variant="ghost" onClick={() => set({ snoozeUntil: 0 })}>
                  {i18n.t('settings.endSnooze')}
                </Button>
              )}
            </div>
          </Section>

          <Section id="badge" title={i18n.t('settings.section.toolbarBadge')}>
            <Toggle label={i18n.t('settings.showUnreadCountsOn')} checked={settings.badge} onChange={(badge) => set({ badge })} />
            <Toggle
              label={i18n.t('settings.countPushes')}
              checked={settings.badgeFeed}
              onChange={(badgeFeed) => set({ badgeFeed })}
              disabled={!settings.badge}
            />
            <Toggle
              label={i18n.t('settings.countPhoneNotifications')}
              checked={settings.badgePhone}
              onChange={(badgePhone) => set({ badgePhone })}
              disabled={!settings.badge}
            />
            <Toggle
              label={i18n.t('settings.keepCountingPhoneNotifications')}
              hint={i18n.t('settings.keepCountingPhoneNotificationsHint')}
              checked={settings.badgePhoneLive}
              onChange={(badgePhoneLive) => set({ badgePhoneLive })}
              disabled={!settings.badge || !settings.badgePhone}
            />
            <Toggle
              label={i18n.t('settings.countTextMessages')}
              checked={settings.badgeSms}
              onChange={(badgeSms) => set({ badgeSms })}
              disabled={!settings.badge}
            />
          </Section>

          <Section id="phone" title={i18n.t('settings.section.phone')}>
            <Toggle
              label={i18n.t('settings.showMyPhonesNotifications')}
              hint={i18n.t('settings.showMyPhonesNotificationsHint')}
              checked={settings.mirrorEnabled}
              onChange={(mirrorEnabled) => set({ mirrorEnabled })}
            />
            <Toggle
              label={i18n.t('settings.copyOneTimeCodes')}
              hint={i18n.t('settings.copyOneTimeCodesHint')}
              checked={settings.autoCopyCodes}
              onChange={(autoCopyCodes) => set({ autoCopyCodes })}
            />
            <Toggle
              label={i18n.t('settings.receiveCopiedTextFrom')}
              hint={i18n.t('settings.receiveCopiedTextFromHint')}
              checked={settings.clipboardReceive}
              onChange={(clipboardReceive) => set({ clipboardReceive })}
            />
          </Section>

          <Section id="feed" title={i18n.t('settings.section.feed')}>
            <LinkPreviewsToggle enabled={settings.linkPreviews} onChange={(linkPreviews) => set({ linkPreviews })} />
          </Section>

          <Section id="encryption" title={i18n.t('settings.section.encryption')}>
            <Encryption
              enabled={!!e2eKey}
              onSave={(password) =>
                run(
                  () => call('e2e.set', { password }),
                  password ? i18n.t('settings.passwordSaved') : i18n.t('settings.encryptionOff'),
                )
              }
            />
          </Section>

          <Section id="appearance" title={i18n.t('settings.section.appearance')}>
            <Row label={i18n.t('settings.theme')}>
              <Segmented<Theme>
                value={settings.theme}
                className="w-64"
                options={[
                  { value: 'system', label: i18n.t('settings.themeSystem') },
                  { value: 'light', label: i18n.t('settings.themeLight') },
                  { value: 'dark', label: i18n.t('settings.themeDark') },
                ]}
                onChange={(theme) => set({ theme })}
              />
            </Row>
            <Row label={i18n.t('settings.openOn')}>
              <Segmented<Tab>
                value={settings.defaultTab}
                className="w-72"
                options={[
                  { value: 'send', label: i18n.t('tabs.send') },
                  { value: 'feed', label: i18n.t('tabs.feed') },
                  { value: 'phone', label: i18n.t('tabs.phone') },
                  { value: 'sms', label: i18n.t('tabs.sms') },
                ]}
                onChange={(defaultTab) => set({ defaultTab })}
              />
            </Row>
          </Section>

          <Section id="shortcuts" title={i18n.t('settings.section.shortcuts')}>
            <Shortcuts />
          </Section>

          <Section id="data" title={i18n.t('settings.section.yourData')}>
            <p className="py-3.5 text-sm leading-relaxed text-muted">{i18n.t('settings.dataBody')}</p>
            <div className="flex flex-wrap gap-2 pb-3.5">
              <Button onClick={() => run(() => call('sync'), i18n.t('settings.synced'))}>
                <RefreshCw size={15} /> {i18n.t('settings.syncNow')}
              </Button>
              <Button variant="danger" onClick={() => run(() => call('history.clear'), i18n.t('settings.historyCleared'))}>
                {i18n.t('settings.clearHistory')}
              </Button>
            </div>
          </Section>

          <Section id="support" title={i18n.t('settings.section.supportPushpilot')}>
            <p className="py-3.5 text-sm leading-relaxed text-muted">{i18n.t('settings.supportBody')}</p>
            <div className="flex flex-wrap gap-2 pb-3.5">
              <LinkButton href={LINKS.kofi} variant="primary">
                <Coffee size={15} /> {i18n.t('support.coffee')}
              </LinkButton>
              <LinkButton href={LINKS.sponsor}>
                <Heart size={15} /> {i18n.t('support.sponsor')}
              </LinkButton>
              {REVIEWS[browser.runtime.id] && (
                <LinkButton href={REVIEWS[browser.runtime.id]} variant="ghost">
                  <Star size={15} /> {i18n.t('rate.action')}
                </LinkButton>
              )}
              <LinkButton href={LINKS.repo} variant="ghost">
                {i18n.t('settings.star')}
              </LinkButton>
              <LinkButton href={LINKS.issues} variant="ghost">
                {i18n.t('settings.report')}
              </LinkButton>
            </div>
            <div className="flex flex-wrap items-center gap-3 py-3.5">
              <p className="min-w-0 flex-1 text-xs leading-relaxed text-muted">{i18n.t('settings.diagnosticsHint')}</p>
              <Button
                size="sm"
                onClick={() =>
                  run(async () => navigator.clipboard.writeText(await diagnostics()), i18n.t('settings.diagnosticsCopied'))
                }
              >
                <ClipboardCopy size={14} /> {i18n.t('settings.diagnostics')}
              </Button>
            </div>
          </Section>
        </main>
      </div>
    </div>
  );
}

/**
 * A plain-text report to paste into a bug report. Counts and states only:
 * no names, emails, device names or push contents.
 */
async function diagnostics() {
  const s = await store.getMany([
    'connection',
    'lastError',
    'rateLimitedUntil',
    'devices',
    'selfDeviceIden',
    'outbox',
    'pushes',
    'historyCursor',
    'mirrors',
    'me',
    'settings',
  ]);
  const ua = navigator.userAgent;
  const brands = (navigator as Navigator & { userAgentData?: { brands: { brand: string; version: string }[]; platform: string } })
    .userAgentData;
  const browserName =
    brands?.brands
      .filter((b) => !/not.?a.?brand|chromium/i.test(b.brand))
      .map((b) => `${b.brand} ${b.version}`)
      .join(', ') ||
    ua.match(/(Edg|OPR|Chrome|Firefox)\/[\d.]+/)?.[0] ||
    ua;
  const isBrave = await (navigator as Navigator & { brave?: { isBrave: () => Promise<boolean> } }).brave
    ?.isBrave()
    .catch(() => false);
  const kinds = new Map<string, [number, number]>();
  for (const d of s.devices) {
    const k = deviceCategory(d);
    const [all, live] = kinds.get(k) ?? [0, 0];
    kinds.set(k, [all + 1, live + Number(isReachable(d))]);
  }
  const on = (v: boolean) => (v ? 'on' : 'off');
  return [
    `Pushpilot ${browser.runtime.getManifest().version}`,
    `Browser: ${browserName}${isBrave ? ' (Brave)' : ''}`,
    `OS: ${brands?.platform || navigator.platform}`,
    `UI language: ${browser.i18n.getUILanguage()}`,
    `Pro: ${s.me?.pro ? 'yes' : 'no'}`,
    `Connection: ${s.connection}`,
    `Last error: ${s.lastError ?? 'none'}`,
    `Rate-limited: ${s.rateLimitedUntil > Date.now() ? `until ${new Date(s.rateLimitedUntil).toISOString()}` : 'no'}`,
    `Devices: ${[...kinds].map(([k, [all, live]]) => `${k} ${live}/${all}`).join(', ') || 'none'} (connected/total)`,
    `This browser registered: ${s.devices.some((d) => d.iden === s.selfDeviceIden) ? 'yes' : 'no'}`,
    `Waiting to send: ${s.outbox.length}`,
    `Pushes stored: ${s.pushes.length}, history ${s.historyCursor === null ? 'fully loaded' : 'partly loaded'}`,
    `Phone notifications stored: ${s.mirrors.length}`,
    `Mirroring ${on(s.settings.mirrorEnabled)}, notifications ${on(s.settings.notifyPushes)}, auto-open links ${on(s.settings.autoOpenLinks)}, files ${on(s.settings.autoOpenFiles)}`,
  ].join('\n');
}

function Section({ id, title, description, children }: { id: string; title: string; description?: string; children: ReactNode }) {
  return (
    <section id={id} className="mb-12 scroll-mt-12">
      <h2 className="text-xl font-extrabold tracking-[-0.02em]">{title}</h2>
      {description && <p className="mt-1 text-sm text-muted">{description}</p>}
      <div className="mt-3 divide-y divide-line rounded-2xl border border-line bg-surface px-5 shadow-sm">{children}</div>
    </section>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-4 py-3.5">
      <span className="flex-1 text-sm font-semibold">{label}</span>
      {children}
    </div>
  );
}

/** Devices that haven't been seen for this long count as unused in the clean-up. */
const UNUSED_AFTER = 30 * 24 * 3600;

function DeviceList({ devices, selfIden }: { devices: Device[]; selfIden: string | null }) {
  const run = useRun();
  const { pushes, mirrors } = useStore(['pushes', 'mirrors']);
  const [editing, setEditing] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  const [cleaning, setCleaning] = useState(false);
  // Not connected, or no sign of life for a month: old installs, retired phones.
  const now = Date.now() / 1000;
  const unused = devices.filter(
    (d) => d.iden !== selfIden && (!isReachable(d) || now - lastActivity(d, pushes, mirrors) > UNUSED_AFTER),
  );
  const remove = (idens: string[]) =>
    run(() => call('device.delete', { idens }), i18n.t('settings.removedDevices', idens.length));
  const [draft, setDraft] = useState('');
  const save = (d: Device) => {
    setEditing(null);
    if (draft.trim() && draft.trim() !== deviceName(d))
      void run(() => call('device.rename', { iden: d.iden, name: draft }), i18n.t('settings.renamed'));
  };
  const sorted = [...devices].sort((a, b) => Number(isReachable(b)) - Number(isReachable(a)) || b.modified - a.modified);
  return (
    <>
      {sorted.map((d) => {
        const live = isReachable(d);
        return (
          <div key={d.iden} className="flex items-center gap-3 py-3">
            <span
              className={clsx(
                'grid size-9 place-items-center rounded-xl',
                live ? 'bg-accent-soft text-accent-strong' : 'bg-raised text-faint',
              )}
            >
              <DeviceGlyph device={d} size={17} />
            </span>
            <div className="min-w-0 flex-1">
              {editing === d.iden ? (
                <form
                  className="flex items-center gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    save(d);
                  }}
                >
                  <input
                    autoFocus
                    onFocus={(e) => e.currentTarget.select()}
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => e.key === 'Escape' && setEditing(null)}
                    aria-label={i18n.t('settings.renameDevice', [deviceName(d)])}
                    className={clsx(fieldClass, 'h-8 min-w-0 flex-1')}
                  />
                  <Button type="submit" size="sm" disabled={!draft.trim()}>
                    {i18n.t('settings.save')}
                  </Button>
                  <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(null)}>
                    {i18n.t('settings.cancel')}
                  </Button>
                </form>
              ) : (
                <p className={clsx('group flex items-center gap-1 text-sm font-semibold', !live && 'text-muted')}>
                  <span className="truncate">{deviceName(d)}</span>
                  {d.iden === selfIden && (
                    <span className="ms-1 shrink-0 text-xs font-medium text-faint">{i18n.t('settings.thisBrowser')}</span>
                  )}
                  <button
                    type="button"
                    title={i18n.t('settings.renameDevice', [deviceName(d)])}
                    aria-label={i18n.t('settings.renameDevice', [deviceName(d)])}
                    onClick={() => {
                      setDraft(deviceName(d));
                      setEditing(d.iden);
                    }}
                    className="grid size-6 shrink-0 place-items-center rounded-md text-faint opacity-0 transition-opacity hover:bg-raised hover:text-ink focus-visible:opacity-100 group-hover:opacity-100"
                  >
                    <Pencil size={12} />
                  </button>
                  {d.iden !== selfIden && (
                    <button
                      type="button"
                      title={i18n.t('settings.removeDevice', [deviceName(d)])}
                      aria-label={i18n.t('settings.removeDevice', [deviceName(d)])}
                      onClick={() => setRemoving(d.iden)}
                      className="grid size-6 shrink-0 place-items-center rounded-md text-faint opacity-0 transition-opacity hover:bg-danger-soft hover:text-danger focus-visible:opacity-100 group-hover:opacity-100"
                    >
                      <Trash2 size={12} />
                    </button>
                  )}
                </p>
              )}
              <p className="text-xs text-faint">
                {i18n.t(d.has_sms ? 'settings.deviceLineSms' : 'settings.deviceLine', [
                  deviceKind(d),
                  new Date(d.modified * 1000).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }),
                ])}
              </p>
            </div>
            {removing === d.iden ? (
              <span className="flex items-center gap-1.5">
                <Button
                  size="sm"
                  variant="danger"
                  onClick={async () => {
                    setRemoving(null);
                    await remove([d.iden]);
                  }}
                >
                  {i18n.t('settings.remove')}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setRemoving(null)}>
                  {i18n.t('settings.cancel')}
                </Button>
              </span>
            ) : (
              <span
                className={clsx(
                  'rounded-full px-2.5 py-1 text-2xs font-bold',
                  live ? 'bg-accent-soft text-accent-strong' : 'bg-raised text-faint',
                )}
              >
                {live ? i18n.t('settings.receiving') : i18n.t('settings.notConnected')}
              </span>
            )}
          </div>
        );
      })}
      {unused.length > 0 && (
        <div className="py-3.5">
          {!cleaning ? (
            <Button size="sm" onClick={() => setCleaning(true)}>
              <Trash2 size={14} /> {i18n.t('settings.cleanup', unused.length)}
            </Button>
          ) : (
            <div className="rounded-xl bg-raised/60 p-3.5">
              <p className="text-xs font-semibold">{i18n.t('settings.cleanupHint')}</p>
              <ul className="mt-1.5 list-disc ps-5 text-xs leading-relaxed text-muted">
                {unused.map((d) => (
                  <li key={d.iden}>
                    {deviceName(d)}{' '}
                    <span className="text-faint">
                      ·{' '}
                      {new Date(lastActivity(d, pushes, mirrors) * 1000).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </span>
                  </li>
                ))}
              </ul>
              <div className="mt-3 flex gap-2">
                <Button
                  size="sm"
                  variant="danger"
                  onClick={async () => {
                    setCleaning(false);
                    await remove(unused.map((d) => d.iden));
                  }}
                >
                  {i18n.t('settings.cleanupConfirm', unused.length)}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setCleaning(false)}>
                  {i18n.t('settings.cancel')}
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}

/**
 * Other browsers on the account whose pushes should land here too. Phones still
 * list the old Pushbullet extension's "Chrome" device, and pushes picked for it
 * would otherwise reach no one.
 */
function OtherBrowsers({
  devices,
  selfIden,
  value,
  onChange,
}: {
  devices: Device[];
  selfIden: string | null;
  value: string[];
  onChange: (v: string[]) => void;
}) {
  const others = devices.filter(
    (d) => d.iden !== selfIden && isReachable(d) && ['browser', 'computer', 'laptop'].includes(deviceCategory(d)),
  );
  if (!others.length) return null;
  return (
    <div className="py-3.5">
      <p className="text-sm font-semibold text-ink">{i18n.t('settings.otherBrowsers')}</p>
      <p className="mt-0.5 text-xs leading-relaxed text-muted">{i18n.t('settings.otherBrowsersHint')}</p>
      <div className="mt-2.5 flex flex-wrap gap-2">
        {others.map((d) => {
          const on = value.includes(d.iden);
          return (
            <label
              key={d.iden}
              className={clsx(
                'flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold transition-colors',
                on ? 'border-accent bg-accent-soft text-accent-strong' : 'border-line text-ink hover:bg-raised',
              )}
            >
              <input
                type="checkbox"
                className="size-4 accent-accent"
                checked={on}
                onChange={(e) => onChange(e.target.checked ? [...value, d.iden] : value.filter((iden) => iden !== d.iden))}
              />
              {deviceName(d)}
              <span className="text-xs font-medium text-faint">
                {new Date(d.modified * 1000).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}
              </span>
            </label>
          );
        })}
      </div>
    </div>
  );
}

function DefaultTarget({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { targets } = useTargets();
  return (
    <Row label={i18n.t('settings.sendToByDefault')}>
      <select
        value={targets.some((t) => t.key === value) ? value : 'all'}
        onChange={(e) => onChange(e.target.value)}
        className={clsx(fieldClass, 'h-9 font-semibold')}
      >
        {targets.map((t) => (
          <option key={t.key} value={t.key}>
            {t.label}
          </option>
        ))}
      </select>
    </Row>
  );
}

function RenameDevice({ current, onSave }: { current: string; onSave: (name: string) => void }) {
  const [name, setName] = useState(current);
  useEffect(() => {
    setName(current);
  }, [current]);
  return (
    <form
      className="flex flex-wrap items-center gap-3 py-3.5"
      onSubmit={(e) => {
        e.preventDefault();
        onSave(name);
      }}
    >
      <label htmlFor="device-name" className="flex-1 text-sm font-semibold">
        {i18n.t('settings.renameLabel')}
      </label>
      <input id="device-name" value={name} onChange={(e) => setName(e.target.value)} className={clsx(fieldClass, 'h-9 w-48')} />
      <Button type="submit" disabled={!name.trim() || name === current}>
        {i18n.t('settings.rename')}
      </Button>
    </form>
  );
}

function Encryption({ enabled, onSave }: { enabled: boolean; onSave: (password: string | null) => void }) {
  const [password, setPassword] = useState('');
  return (
    <div className="py-4">
      <p className="flex items-center gap-2 text-sm font-bold">
        <LockKeyhole size={15} className={enabled ? 'text-accent' : 'text-faint'} />
        {enabled ? i18n.t('settings.e2eOn') : i18n.t('settings.e2eOff')}
      </p>
      <p className="mt-1 text-xs leading-relaxed text-muted">{i18n.t('settings.e2eBody')}</p>
      <form
        className="mt-3 flex flex-wrap gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (password) onSave(password);
          setPassword('');
        }}
      >
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={enabled ? i18n.t('settings.changePassword') : i18n.t('settings.encryptionPassword')}
          aria-label={i18n.t('settings.encryptionPassword')}
          autoComplete="off"
          className={clsx(fieldClass, 'h-9 min-w-0 flex-1')}
        />
        <Button type="submit" disabled={!password}>
          {i18n.t('settings.savePassword')}
        </Button>
        {enabled && (
          <Button variant="danger" onClick={() => onSave(null)}>
            {i18n.t('settings.turnOff')}
          </Button>
        )}
      </form>
    </div>
  );
}

/** Each browser keeps extension shortcuts on its own settings page. */
function openShortcutSettings() {
  if (import.meta.env.FIREFOX) {
    void (browser.commands as typeof browser.commands & { openShortcutSettings(): Promise<void> }).openShortcutSettings();
  } else void browser.tabs.create({ url: 'chrome://extensions/shortcuts' });
}

function Shortcuts() {
  const [commands, setCommands] = useState<Browser.commands.Command[]>([]);
  useEffect(() => {
    void browser.commands.getAll().then(setCommands);
  }, []);
  return (
    <>
      {commands.map((c) => (
        <Row key={c.name} label={c.name === '_execute_action' ? i18n.t('cmdOpen') : c.description || c.name || ''}>
          {c.shortcut ? (
            <kbd className="rounded-lg border border-line bg-bg px-2 py-1 font-sans text-xs font-bold">{c.shortcut}</kbd>
          ) : (
            <span className="text-xs text-faint">{i18n.t('settings.notSet')}</span>
          )}
        </Row>
      ))}
      <div className="py-3.5">
        <p className="mb-3 text-xs leading-relaxed text-muted">{i18n.t('settings.shortcutsHint')}</p>
        <Button onClick={openShortcutSettings}>{i18n.t('settings.changeShortcuts')}</Button>
      </div>
    </>
  );
}

const SOUNDS: { value: SoundChoice; label: () => string }[] = [
  { value: 'takeoff', label: () => i18n.t('settings.soundTakeoff') },
  { value: 'chime', label: () => i18n.t('settings.soundChime') },
  { value: 'pop', label: () => i18n.t('settings.soundPop') },
  { value: 'ding', label: () => i18n.t('settings.soundDing') },
  { value: 'custom', label: () => i18n.t('settings.soundCustom') },
];

function SoundPicker({
  value,
  disabled,
  onChange,
}: {
  value: SoundChoice;
  disabled: boolean;
  onChange: (v: SoundChoice) => void;
}) {
  const { customSound } = useStore(['customSound']);
  const run = useRun();
  const notify = useToast();
  const input = useRef<HTMLInputElement>(null);

  const choose = (file: File) => {
    if (file.size > 1_000_000) return notify(i18n.t('settings.soundTooBig'), 'error');
    const reader = new FileReader();
    reader.onload = async () => {
      const src = reader.result as string;
      const ok = await new Audio(src).play().then(
        () => true,
        () => false,
      );
      if (!ok) return notify(i18n.t('settings.soundUnplayable'), 'error');
      await store.set({ customSound: src });
      onChange('custom');
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className={clsx('flex flex-col gap-3 py-3.5', disabled && 'pointer-events-none opacity-50')}>
      <div className="flex flex-wrap items-center gap-3">
        <span className="flex-1 text-sm font-semibold">{i18n.t('settings.sound')}</span>
        <Segmented<SoundChoice>
          value={value}
          options={SOUNDS.map((s) => ({ value: s.value, label: s.label() }))}
          className="w-[360px] max-w-full"
          onChange={(v) => {
            if (v === 'custom' && !customSound) return input.current?.click();
            onChange(v);
            void call('sound.preview', { choice: v });
          }}
        />
        <Button size="sm" onClick={() => run(() => call('sound.preview', { choice: value }))}>
          {i18n.t('settings.play')}
        </Button>
      </div>
      {value === 'custom' && (
        <p className="text-xs text-muted">
          {customSound ? i18n.t('settings.soundUsing') : i18n.t('settings.soundNone')}{' '}
          <button className="font-bold text-accent-strong hover:underline" onClick={() => input.current?.click()}>
            {customSound ? i18n.t('settings.soundChooseAnother') : i18n.t('settings.soundChoose')}
          </button>
          {i18n.t('settings.soundFormats')}
        </p>
      )}
      <input
        ref={input}
        type="file"
        accept="audio/mpeg,audio/ogg,audio/wav,audio/x-wav,.mp3,.ogg,.wav"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) choose(f);
          e.target.value = '';
        }}
      />
    </div>
  );
}

function LinkPreviewsToggle({ enabled, onChange }: { enabled: boolean; onChange: (v: boolean) => void }) {
  const [granted, setGranted] = useState<boolean | null>(null);
  useEffect(() => {
    void browser.permissions.contains({ origins: ['<all_urls>'] }).then(setGranted);
  }, []);
  const on = enabled && !!granted;
  return (
    <Toggle
      label={i18n.t('settings.showPreviewsForLinks')}
      hint={granted === false && enabled ? i18n.t('settings.previewsNeedPermission') : i18n.t('settings.previewsHint')}
      checked={on}
      onChange={async (v) => {
        if (v && !granted) {
          // Must be called straight from the click for Chrome to show the prompt.
          const ok = await browser.permissions.request({ origins: ['<all_urls>'] });
          setGranted(ok);
          if (!ok) return;
        }
        onChange(v);
      }}
    />
  );
}
