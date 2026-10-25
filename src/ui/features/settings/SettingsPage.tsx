import clsx from 'clsx';
import { Coffee, Heart, LockKeyhole, LogOut, RefreshCw, Star } from 'lucide-react';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { browser, type Browser } from 'wxt/browser';
import { LINKS } from '@/core/links';
import { call } from '@/core/messaging/rpc';
import type { Device } from '@/core/pushbullet/types';
import * as store from '@/core/storage/store';
import type { Settings, SoundChoice, Tab, Theme } from '@/core/storage/store';
import { deviceKind, deviceName, isReachable } from '@/core/utils/format';
import { Avatar, Button, DeviceGlyph, fieldClass, LinkButton, LogoMark, Segmented, Toggle, ToastBar } from '@/ui/components';
import { SignIn } from '@/ui/features/auth/SignIn';
import { useTargets } from '@/ui/features/send/targets';
import { useStore } from '@/ui/hooks/use-store';
import { useTheme } from '@/ui/hooks/use-theme';
import { ToastProvider, useRun, useToast } from '@/ui/hooks/use-toast';

const SECTIONS = [
  ['account', 'Account'],
  ['devices', 'Devices'],
  ['sending', 'Sending'],
  ['receiving', 'Receiving'],
  ['auto-open', 'Auto-open'],
  ['notifications', 'Notifications'],
  ['badge', 'Toolbar badge'],
  ['phone', 'Phone'],
  ['feed', 'Feed'],
  ['encryption', 'Encryption'],
  ['appearance', 'Appearance'],
  ['shortcuts', 'Shortcuts'],
  ['data', 'Your data'],
  ['support', 'Support'],
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
        <SignIn wide />
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
          <span className="ml-2 rounded-full bg-white/15 px-2.5 py-1 text-2xs font-bold">
            {connection === 'live' ? 'Connected' : connection === 'connecting' ? 'Connecting…' : 'Offline'}
          </span>
          <span className="ml-auto truncate text-sm font-semibold text-on-band/85">{me?.email}</span>
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
                {label}
              </a>
            ))}
          </nav>
        </aside>

        <main className="min-w-0 max-w-2xl pb-24">
          <Section id="account" title="Account">
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
                <LogOut size={15} /> Sign out
              </Button>
            </div>
            <RenameDevice
              current={self ? deviceName(self) : 'Chrome'}
              onSave={(name) => run(() => call('device.rename', { name }), 'Renamed')}
            />
          </Section>

          <Section
            id="devices"
            title="Devices"
            description="Pushbullet keeps old registrations around. Only devices marked Receiving get your pushes."
          >
            <DeviceList devices={devices} selfIden={selfDeviceIden} />
          </Section>

          <Section id="sending" title="Sending">
            <DefaultTarget value={settings.defaultTarget} onChange={(defaultTarget) => set({ defaultTarget })} />
            <Toggle
              label="Start with the page you’re on"
              hint="Opening Pushpilot fills in the current tab’s title and link, ready to send."
              checked={settings.prefillCurrentPage}
              onChange={(prefillCurrentPage) => set({ prefillCurrentPage })}
            />
            <Toggle
              label="Close the popup after sending"
              checked={settings.closeAfterSend}
              onChange={(closeAfterSend) => set({ closeAfterSend })}
            />
            <Toggle
              label="Right-click menu"
              hint="Push pages, links, images and selected text from any page’s context menu."
              checked={settings.contextMenu}
              onChange={(contextMenu) => set({ contextMenu })}
            />
          </Section>

          <Section
            id="receiving"
            title="Receiving"
            description="Pushes sent straight to this browser always arrive. Choose what else counts."
          >
            <Toggle
              label="Pushes sent to all devices"
              hint="What your phone sends when you don’t pick a device."
              checked={settings.receiveAll}
              onChange={(receiveAll) => set({ receiveAll })}
            />
            <Toggle
              label="Pushes sent to your other devices"
              hint="See everything, even pushes meant for your tablet or another computer."
              checked={settings.receiveOthers}
              onChange={(receiveOthers) => set({ receiveOthers })}
            />
            <Toggle
              label="Pushes you send from this browser"
              hint="Notify and open your own pushes here too, for example when you push to all devices from the right-click menu."
              checked={settings.receiveOwn}
              onChange={(receiveOwn) => set({ receiveOwn })}
            />
            <Toggle
              label="Channel subscriptions"
              hint="Pushes from channels and feeds you follow."
              checked={settings.showChannels}
              onChange={(showChannels) => set({ showChannels })}
            />
          </Section>

          <Section id="auto-open" title="Auto-open">
            <Toggle
              label="Open links as soon as they arrive"
              hint="Links pushed to this browser open in a new tab, like the original Pushbullet extension."
              checked={settings.autoOpenLinks}
              onChange={(autoOpenLinks) => set({ autoOpenLinks })}
            />
            <Toggle
              label="Switch to the new tab"
              hint="Otherwise it opens in the background."
              checked={settings.autoOpenActive}
              onChange={(autoOpenActive) => set({ autoOpenActive })}
              disabled={!settings.autoOpenLinks}
            />
            <Toggle
              label="Also open files and images"
              checked={settings.autoOpenFiles}
              onChange={(autoOpenFiles) => set({ autoOpenFiles })}
              disabled={!settings.autoOpenLinks}
            />
            <Toggle
              label="Also open links from people"
              hint="Not just your own devices."
              checked={settings.autoOpenFromPeople}
              onChange={(autoOpenFromPeople) => set({ autoOpenFromPeople })}
              disabled={!settings.autoOpenLinks}
            />
            <Toggle
              label="Open links that arrived while offline"
              hint="When Pushpilot reconnects, for example after your computer wakes up."
              checked={settings.autoOpenOnReconnect}
              onChange={(autoOpenOnReconnect) => set({ autoOpenOnReconnect })}
              disabled={!settings.autoOpenLinks}
            />
            <Toggle
              label="Skip the notification for opened links"
              checked={settings.hideAutoOpened}
              onChange={(hideAutoOpened) => set({ hideAutoOpened })}
              disabled={!settings.autoOpenLinks}
            />
          </Section>

          <Section id="notifications" title="Notifications">
            <Toggle
              label="Pushes"
              hint="Links, notes and files."
              checked={settings.notifyPushes}
              onChange={(notifyPushes) => set({ notifyPushes })}
            />
            <Toggle
              label="Phone notifications"
              checked={settings.notifyMirrors}
              onChange={(notifyMirrors) => set({ notifyMirrors })}
            />
            <Toggle label="Text messages" checked={settings.notifySms} onChange={(notifySms) => set({ notifySms })} />
            <Toggle label="Play a sound" checked={settings.sound} onChange={(sound) => set({ sound })} />
            <SoundPicker
              value={settings.soundChoice}
              disabled={!settings.sound}
              onChange={(soundChoice) => set({ soundChoice })}
            />
            <Toggle
              label="Keep push notifications on screen"
              hint="They stay until you click or close them."
              checked={settings.sticky}
              onChange={(sticky) => set({ sticky })}
            />
            <Toggle
              label="Keep phone notifications on screen"
              checked={settings.stickyMirrors}
              onChange={(stickyMirrors) => set({ stickyMirrors })}
            />
            <Toggle
              label="Closing a notification dismisses it"
              hint="Close a push and it’s marked done everywhere; close a phone notification and it’s cleared on your phone."
              checked={settings.closeDismisses}
              onChange={(closeDismisses) => set({ closeDismisses })}
            />
            <div className="flex items-center gap-3 py-3.5">
              <Button onClick={() => run(() => call('notify.test'))}>Send a test notification</Button>
              {settings.snoozeUntil > Date.now() && (
                <Button variant="ghost" onClick={() => set({ snoozeUntil: 0 })}>
                  End snooze
                </Button>
              )}
            </div>
          </Section>

          <Section id="badge" title="Toolbar badge">
            <Toggle
              label="Show unread counts on the toolbar icon"
              checked={settings.badge}
              onChange={(badge) => set({ badge })}
            />
            <Toggle
              label="Count pushes"
              checked={settings.badgeFeed}
              onChange={(badgeFeed) => set({ badgeFeed })}
              disabled={!settings.badge}
            />
            <Toggle
              label="Count phone notifications"
              checked={settings.badgePhone}
              onChange={(badgePhone) => set({ badgePhone })}
              disabled={!settings.badge}
            />
            <Toggle
              label="Count text messages"
              checked={settings.badgeSms}
              onChange={(badgeSms) => set({ badgeSms })}
              disabled={!settings.badge}
            />
          </Section>

          <Section id="phone" title="Phone">
            <Toggle
              label="Show my phone’s notifications"
              hint="Needs Notification mirroring switched on in the Pushbullet app on Android."
              checked={settings.mirrorEnabled}
              onChange={(mirrorEnabled) => set({ mirrorEnabled })}
            />
            <Toggle
              label="Copy one-time codes automatically"
              hint="When a notification contains a verification code, it goes straight to your clipboard."
              checked={settings.autoCopyCodes}
              onChange={(autoCopyCodes) => set({ autoCopyCodes })}
            />
            <Toggle
              label="Receive copied text from other devices"
              hint="Universal copy and paste. Needs Pushbullet Pro and the setting turned on in your other apps."
              checked={settings.clipboardReceive}
              onChange={(clipboardReceive) => set({ clipboardReceive })}
            />
          </Section>

          <Section id="feed" title="Feed">
            <LinkPreviewsToggle enabled={settings.linkPreviews} onChange={(linkPreviews) => set({ linkPreviews })} />
          </Section>

          <Section id="encryption" title="Encryption">
            <Encryption
              enabled={!!e2eKey}
              onSave={(password) =>
                run(() => call('e2e.set', { password }), password ? 'Encryption password saved' : 'Encryption turned off')
              }
            />
          </Section>

          <Section id="appearance" title="Appearance">
            <Row label="Theme">
              <Segmented<Theme>
                value={settings.theme}
                className="w-64"
                options={[
                  { value: 'system', label: 'System' },
                  { value: 'light', label: 'Light' },
                  { value: 'dark', label: 'Dark' },
                ]}
                onChange={(theme) => set({ theme })}
              />
            </Row>
            <Row label="Open on">
              <Segmented<Tab>
                value={settings.defaultTab}
                className="w-72"
                options={[
                  { value: 'send', label: 'Send' },
                  { value: 'feed', label: 'Feed' },
                  { value: 'phone', label: 'Phone' },
                  { value: 'sms', label: 'SMS' },
                ]}
                onChange={(defaultTab) => set({ defaultTab })}
              />
            </Row>
          </Section>

          <Section id="shortcuts" title="Shortcuts">
            <Shortcuts />
          </Section>

          <Section id="data" title="Your data">
            <p className="py-3.5 text-sm leading-relaxed text-muted">
              Pushpilot keeps your history in this browser and talks only to Pushbullet. Clearing it here doesn’t delete anything
              from your account.
            </p>
            <div className="flex flex-wrap gap-2 pb-3.5">
              <Button onClick={() => run(() => call('sync'), 'Synced with Pushbullet')}>
                <RefreshCw size={15} /> Sync now
              </Button>
              <Button variant="danger" onClick={() => run(() => call('history.clear'), 'History cleared')}>
                Clear local history
              </Button>
            </div>
          </Section>

          <Section id="support" title="Support Pushpilot">
            <p className="py-3.5 text-sm leading-relaxed text-muted">
              Pushpilot is free, open source and made by one person, with no ads or tracking. If it’s useful to you, you can help
              keep it going.
            </p>
            <div className="flex flex-wrap gap-2 pb-3.5">
              <LinkButton href={LINKS.kofi} variant="primary">
                <Coffee size={15} /> Buy me a coffee
              </LinkButton>
              <LinkButton href={LINKS.sponsor}>
                <Heart size={15} /> Sponsor on GitHub
              </LinkButton>
              <LinkButton href={LINKS.repo} variant="ghost">
                <Star size={15} /> Star on GitHub
              </LinkButton>
              <LinkButton href={LINKS.issues} variant="ghost">
                Report a problem
              </LinkButton>
            </div>
          </Section>
        </main>
      </div>
    </div>
  );
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

function DeviceList({ devices, selfIden }: { devices: Device[]; selfIden: string | null }) {
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
              <p className={clsx('truncate text-sm font-semibold', !live && 'text-muted')}>
                {deviceName(d)}
                {d.iden === selfIden && <span className="ml-2 text-xs font-medium text-faint">this browser</span>}
              </p>
              <p className="text-xs text-faint">
                {deviceKind(d)}
                {d.has_sms ? ', can text' : ''}. Last active{' '}
                {new Date(d.modified * 1000).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
              </p>
            </div>
            <span
              className={clsx(
                'rounded-full px-2.5 py-1 text-2xs font-bold',
                live ? 'bg-accent-soft text-accent-strong' : 'bg-raised text-faint',
              )}
            >
              {live ? 'Receiving' : 'Not connected'}
            </span>
          </div>
        );
      })}
      <p className="py-3 text-xs leading-relaxed text-muted">
        Remove old devices on{' '}
        <a
          className="font-bold text-accent-strong hover:underline"
          href="https://www.pushbullet.com/#settings/devices"
          target="_blank"
          rel="noreferrer"
        >
          pushbullet.com › Devices
        </a>
        . A phone shows up as Receiving again after you open the Pushbullet app on it.
      </p>
    </>
  );
}

function DefaultTarget({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { targets } = useTargets();
  return (
    <Row label="Send to, by default">
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
        This browser’s name on your other devices
      </label>
      <input id="device-name" value={name} onChange={(e) => setName(e.target.value)} className={clsx(fieldClass, 'h-9 w-48')} />
      <Button type="submit" disabled={!name.trim() || name === current}>
        Rename
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
        {enabled ? 'End-to-end encryption is on' : 'End-to-end encryption is off'}
      </p>
      <p className="mt-1 text-xs leading-relaxed text-muted">
        Use the same password you set in the Pushbullet app on your phone. It encrypts notifications, texts and copied text in
        transit. Pushpilot stores only the derived key.
      </p>
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
          placeholder={enabled ? 'Change password' : 'Encryption password'}
          aria-label="Encryption password"
          autoComplete="off"
          className={clsx(fieldClass, 'h-9 min-w-0 flex-1')}
        />
        <Button type="submit" disabled={!password}>
          Save password
        </Button>
        {enabled && (
          <Button variant="danger" onClick={() => onSave(null)}>
            Turn off
          </Button>
        )}
      </form>
    </div>
  );
}

function Shortcuts() {
  const [commands, setCommands] = useState<Browser.commands.Command[]>([]);
  useEffect(() => {
    void browser.commands.getAll().then(setCommands);
  }, []);
  return (
    <>
      {commands.map((c) => (
        <Row key={c.name} label={c.name === '_execute_action' ? 'Open Pushpilot' : c.description || c.name || ''}>
          {c.shortcut ? (
            <kbd className="rounded-lg border border-line bg-bg px-2 py-1 font-sans text-xs font-bold">{c.shortcut}</kbd>
          ) : (
            <span className="text-xs text-faint">Not set</span>
          )}
        </Row>
      ))}
      <div className="py-3.5">
        <Button onClick={() => void browser.tabs.create({ url: 'chrome://extensions/shortcuts' })}>Change shortcuts</Button>
      </div>
    </>
  );
}

const SOUNDS: { value: SoundChoice; label: string }[] = [
  { value: 'takeoff', label: 'Takeoff' },
  { value: 'chime', label: 'Chime' },
  { value: 'pop', label: 'Pop' },
  { value: 'ding', label: 'Ding' },
  { value: 'custom', label: 'Your own' },
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
    if (file.size > 1_000_000) return notify('Pick a sound under 1 MB.', 'error');
    const reader = new FileReader();
    reader.onload = async () => {
      const src = reader.result as string;
      const ok = await new Audio(src).play().then(
        () => true,
        () => false,
      );
      if (!ok) return notify('That file couldn’t be played. Try an MP3, OGG or WAV.', 'error');
      await store.set({ customSound: src });
      onChange('custom');
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className={clsx('flex flex-col gap-3 py-3.5', disabled && 'pointer-events-none opacity-50')}>
      <div className="flex flex-wrap items-center gap-3">
        <span className="flex-1 text-sm font-semibold">Sound</span>
        <Segmented<SoundChoice>
          value={value}
          options={SOUNDS}
          className="w-[360px] max-w-full"
          onChange={(v) => {
            if (v === 'custom' && !customSound) return input.current?.click();
            onChange(v);
            void call('sound.preview', { choice: v });
          }}
        />
        <Button size="sm" onClick={() => run(() => call('sound.preview', { choice: value }))}>
          Play
        </Button>
      </div>
      {value === 'custom' && (
        <p className="text-xs text-muted">
          {customSound ? 'Using your sound.' : 'No sound chosen yet.'}{' '}
          <button className="font-bold text-accent-strong hover:underline" onClick={() => input.current?.click()}>
            {customSound ? 'Choose another' : 'Choose a file'}
          </button>
          . MP3, OGG or WAV, up to 1 MB.
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
      label="Show previews for links"
      hint={
        granted === false && enabled
          ? 'Needs permission to read the pages your links point to. Turn this on to grant it.'
          : 'Pictures, titles and descriptions for links in your feed. Pushpilot reads only the page header of each link.'
      }
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
