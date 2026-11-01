import { Inbox, X } from 'lucide-react';
import { useState } from 'react';
import { browser } from 'wxt/browser';
import * as store from '@/core/storage/store';
import { Button, IconButton } from '@/ui/components';
import { signInWithPushbulletSite } from '@/ui/features/auth/oauth';
import { useStore } from '@/ui/hooks/use-store';
import { useRun } from '@/ui/hooks/use-toast';
import { i18n } from '#i18n';

const DISMISSED = 'oauthPushes';

/**
 * Signed in through the OAuth app, so the Pushbullet apps file this install's
 * pushes under Following › Pushpilot rather than Me. Installs from before the
 * sign-in kind was recorded give it away in their own pushes.
 */
export function useOauthPushes() {
  const { authKind, pushes, selfDeviceIden, ready } = useStore(['authKind', 'pushes', 'selfDeviceIden']);
  if (!ready) return false;
  if (authKind) return authKind === 'oauth';
  return pushes.some((p) => !!p.client_iden && p.source_device_iden === selfDeviceIden);
}

/** Settings › Account: where pushes land, and the switch to the pushbullet.com sign-in. */
export function MeFixRow() {
  const oauth = useOauthPushes();
  const run = useRun();
  const [busy, setBusy] = useState(false);
  if (!oauth) return null;
  return (
    <div className="flex flex-wrap items-center gap-3 py-3.5">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">{i18n.t('meFix.title')}</p>
        <p className="mt-0.5 text-xs leading-relaxed text-muted">{i18n.t('meFix.body')}</p>
      </div>
      <Button
        size="sm"
        busy={busy}
        onClick={async () => {
          setBusy(true);
          await run(() => signInWithPushbulletSite({ sameAccount: true }), i18n.t('meFix.done'));
          setBusy(false);
        }}
      >
        {i18n.t('meFix.action')}
      </Button>
    </div>
  );
}

/** The popup says so once; the switch itself is in Settings (asking for access needs a page that stays open). */
export function MeFixBanner() {
  const oauth = useOauthPushes();
  const { dismissedIssues } = useStore(['dismissedIssues']);
  if (!oauth || dismissedIssues.includes(DISMISSED)) return null;
  const dismiss = () => void store.update('dismissedIssues', (all) => [...all, DISMISSED]);
  return (
    <section className="mb-3 rounded-2xl bg-accent-soft p-3.5" aria-label={i18n.t('meFix.title')}>
      <div className="flex items-start gap-2">
        <p className="flex flex-1 items-start gap-1.5 text-sm font-bold">
          <Inbox size={15} className="mt-0.5 shrink-0 text-accent-strong" /> {i18n.t('meFix.title')}
        </p>
        <IconButton label={i18n.t('common.dismiss')} className="-me-1.5 -mt-1.5 size-7" onClick={dismiss}>
          <X size={14} />
        </IconButton>
      </div>
      <p className="mt-1 text-xs leading-relaxed text-muted">{i18n.t('meFix.body')}</p>
      <button
        onClick={() => void browser.tabs.create({ url: browser.runtime.getURL('/options.html#account') })}
        className="mt-2 text-xs font-bold text-accent-strong hover:underline"
      >
        {i18n.t('meFix.action')}
      </button>
    </section>
  );
}
