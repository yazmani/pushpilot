import clsx from 'clsx';
import { KeyRound } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { call } from '@/core/messaging/rpc';
import { Button, fieldClass, Logo, Notice } from '@/ui/components';
import { errorText } from '@/ui/hooks/use-toast';
import { continueSignInInSettings, oauthClientId, signInWithPushbullet } from './oauth';
import { i18n } from '#i18n';

export function SignIn({
  wide = false,
  inPopup = false,
  autoStart = false,
}: {
  wide?: boolean;
  inPopup?: boolean;
  autoStart?: boolean;
}) {
  // Without an OAuth client for this extension ID, the token is the only way in.
  const web = !!oauthClientId();
  const [showToken, setShowToken] = useState(!web);
  const [token, setToken] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<'web' | 'token' | null>(null);

  const startWeb = () => {
    if (inPopup) return continueSignInInSettings();
    void attempt('web', signInWithPushbullet);
  };

  // Settings opened from the popup's "Sign in" button: go straight to Pushbullet.
  const started = useRef(false);
  useEffect(() => {
    if (!autoStart || !web || started.current) return;
    started.current = true;
    history.replaceState(null, '', location.pathname);
    startWeb();
  }, [autoStart]);

  const attempt = async (which: 'web' | 'token', fn: () => Promise<unknown>) => {
    setBusy(which);
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className={clsx('relative flex flex-col', wide ? 'max-w-md' : 'h-full justify-center overflow-hidden px-7')}>
      {!wide && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -end-24 -top-24 size-72 rounded-full opacity-60 blur-3xl"
          style={{ background: 'radial-gradient(circle, var(--accent-soft), transparent 70%)' }}
        />
      )}
      <Logo size={52} className="relative rounded-2xl shadow-glow" />
      <h1 className="relative mt-6 text-2xl font-extrabold leading-[1.15] tracking-[-0.03em]">{i18n.t('signIn.title')}</h1>
      <p className="relative mt-2.5 text-sm leading-relaxed text-muted">{i18n.t('signIn.intro')}</p>

      {web && (
        <>
          <Button variant="primary" size="lg" className="relative mt-7 w-full" busy={busy === 'web'} onClick={startWeb}>
            {i18n.t('signIn.button')}
          </Button>
          <p className="relative mt-2 text-xs leading-relaxed text-muted">{i18n.t('signIn.buttonHint')}</p>
        </>
      )}

      {!showToken ? (
        <button
          className="relative mt-6 flex items-center gap-1.5 self-start text-xs font-bold text-muted hover:text-ink"
          onClick={() => setShowToken(true)}
        >
          <KeyRound size={13} /> {i18n.t('signIn.useToken')}
        </button>
      ) : (
        <form
          className="relative mt-6"
          onSubmit={(e) => {
            e.preventDefault();
            void attempt('token', () => call('auth.token', { token }));
          }}
        >
          <label className="text-xs font-bold text-muted" htmlFor="token">
            {i18n.t('signIn.token')}
          </label>
          <div className="mt-1.5 flex gap-2">
            <input
              id="token"
              autoFocus
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="o.xxxxxxxxxxxxxxxx"
              spellCheck={false}
              className={clsx(fieldClass, 'h-9 min-w-0 flex-1')}
            />
            <Button type="submit" busy={busy === 'token'} disabled={!token.trim()}>
              {i18n.t('signIn.connect')}
            </Button>
          </div>
          <p className="mt-1.5 text-xs text-muted">
            {i18n.t('signIn.createBefore')}{' '}
            <a
              className="font-bold text-accent-strong hover:underline"
              href="https://www.pushbullet.com/#settings/account"
              target="_blank"
              rel="noreferrer"
            >
              {i18n.t('signIn.createLink')}
            </a>{' '}
            {i18n.t('signIn.createAfter')}
          </p>
        </form>
      )}

      {error && (
        <div className="relative mt-4">
          <Notice tone="error">{error}</Notice>
        </div>
      )}
    </div>
  );
}
