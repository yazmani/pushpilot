import clsx from 'clsx';
import { KeyRound } from 'lucide-react';
import { useState } from 'react';
import { call } from '@/core/messaging/rpc';
import { Button, fieldClass, Logo, Notice } from '@/ui/components';
import { errorText } from '@/ui/hooks/use-toast';

export function SignIn({ wide = false }: { wide?: boolean }) {
  const [showToken, setShowToken] = useState(false);
  const [token, setToken] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<'web' | 'token' | null>(null);

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
          className="pointer-events-none absolute -right-24 -top-24 size-72 rounded-full opacity-60 blur-3xl"
          style={{ background: 'radial-gradient(circle, var(--accent-soft), transparent 70%)' }}
        />
      )}
      <Logo size={52} className="relative rounded-2xl shadow-glow" />
      <h1 className="relative mt-6 text-2xl font-extrabold leading-[1.15] tracking-[-0.03em]">Send this page to your phone.</h1>
      <p className="relative mt-2.5 text-sm leading-relaxed text-muted">
        Pushpilot moves links, notes, files and texts between your devices with your Pushbullet account, and brings your phone’s
        notifications to your desktop.
      </p>

      <Button
        variant="primary"
        size="lg"
        className="relative mt-7 w-full"
        busy={busy === 'web'}
        onClick={() => attempt('web', () => call('auth.signin'))}
      >
        Sign in with Pushbullet
      </Button>
      <p className="relative mt-2 text-xs leading-relaxed text-muted">
        Opens pushbullet.com. Once you’re signed in there, Pushpilot connects by itself.
      </p>

      {!showToken ? (
        <button
          className="relative mt-6 flex items-center gap-1.5 self-start text-xs font-bold text-muted hover:text-ink"
          onClick={() => setShowToken(true)}
        >
          <KeyRound size={13} /> Use an access token instead
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
            Access token
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
              Connect
            </Button>
          </div>
          <p className="mt-1.5 text-xs text-muted">
            Create one under{' '}
            <a
              className="font-bold text-accent-strong hover:underline"
              href="https://www.pushbullet.com/#settings/account"
              target="_blank"
              rel="noreferrer"
            >
              Settings › Account
            </a>{' '}
            on pushbullet.com.
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
