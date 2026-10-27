import clsx from 'clsx';
import { Copy, Reply, SendHorizontal, Smartphone, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { call } from '@/core/messaging/rpc';
import type { Device, Mirror } from '@/core/pushbullet/types';
import { deviceName, timeAgo } from '@/core/utils/format';
import { Button, fieldClass, IconButton } from '@/ui/components';
import { useNow } from '@/ui/hooks/use-now';
import { useRun, useToast } from '@/ui/hooks/use-toast';
import { i18n } from '#i18n';

export function MirrorCard({ m, devices, autoFocus }: { m: Mirror; devices: Device[]; autoFocus?: boolean }) {
  useNow();
  const notify = useToast();
  const run = useRun();
  const [replying, setReplying] = useState(!!autoFocus && !!m.conversation_iden);
  const [reply, setReply] = useState('');
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const card = useRef<HTMLLIElement>(null);
  const app = m.application_name || m.package_name;
  const device = devices.find((d) => d.iden === m.source_device_iden);

  useEffect(() => {
    if (autoFocus) card.current?.scrollIntoView({ block: 'center' });
  }, [autoFocus]);
  useEffect(() => {
    if (replying) input.current?.focus();
  }, [replying]);

  const act = async (fn: () => Promise<unknown>, done?: string) => {
    setBusy(true);
    await run(fn, done);
    setBusy(false);
  };

  const sendReply = () =>
    act(async () => {
      if (!reply.trim()) return;
      await call('mirror.reply', { id: m.id, message: reply.trim() });
      setReply('');
      setReplying(false);
    }, i18n.t('phone.replySent'));

  return (
    <li ref={card} className={clsx('group relative px-3.5 py-3', autoFocus && 'bg-accent-soft/50', m.dismissed && 'opacity-70')}>
      <div className="flex gap-3">
        {m.icon ? (
          <img src={`data:image/jpeg;base64,${m.icon}`} alt="" className="size-10 shrink-0 rounded-xl" />
        ) : (
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-raised text-muted">
            <Smartphone size={16} />
          </span>
        )}
        <div className="min-w-0 flex-1 pe-6">
          <p className="flex items-center gap-1.5 text-2xs text-faint">
            <span className="truncate font-bold text-muted">{app}</span>
            {device && <span className="truncate">{i18n.t('phone.onDevice', [deviceName(device)])}</span>}
            <span className="ms-auto shrink-0">{timeAgo(m.created)}</span>
          </p>
          {m.title && <p className="mt-0.5 break-words text-sm font-bold leading-snug">{m.title}</p>}
          {m.body && <p className="line-clamp-5 whitespace-pre-wrap break-words text-sm leading-relaxed text-ink/85">{m.body}</p>}

          {(m.code || m.conversation_iden || (m.actions?.length && !m.dismissed)) && (
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {m.code && (
                <button
                  className="flex h-8 items-center gap-2 rounded-xl bg-accent-soft px-3 text-base font-extrabold tracking-[0.12em] text-accent-strong transition hover:brightness-95"
                  onClick={async () => {
                    await navigator.clipboard.writeText(m.code!);
                    notify(i18n.t('phone.copiedCode', [m.code!]));
                  }}
                  title={i18n.t('phone.copyCode')}
                >
                  {m.code}
                  <Copy size={14} />
                </button>
              )}
              {m.conversation_iden && !replying && (
                <Button size="sm" className="h-8" onClick={() => setReplying(true)}>
                  <Reply size={13} /> {i18n.t('phone.reply')}
                </Button>
              )}
              {!m.dismissed &&
                m.actions?.map((a) => (
                  <Button
                    key={a.trigger_key}
                    size="sm"
                    className="h-8"
                    disabled={busy}
                    onClick={() => act(() => call('mirror.action', { id: m.id, key: a.trigger_key }), a.label)}
                  >
                    {a.label}
                  </Button>
                ))}
            </div>
          )}

          {replying && (
            <form
              className="mt-2.5 flex items-center gap-1.5"
              onSubmit={(e) => {
                e.preventDefault();
                void sendReply();
              }}
            >
              <input
                ref={input}
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                onKeyDown={(e) => e.key === 'Escape' && setReplying(false)}
                placeholder={i18n.t('phone.replyIn', [app])}
                aria-label={i18n.t('phone.reply')}
                className={clsx(fieldClass, 'h-9 min-w-0 flex-1 bg-bg')}
              />
              <IconButton
                label={i18n.t('phone.sendReply')}
                type="submit"
                tone="accent"
                disabled={busy || !reply.trim()}
                className="size-9 rounded-xl"
              >
                <SendHorizontal size={15} />
              </IconButton>
            </form>
          )}
        </div>
      </div>
      {!m.dismissed && m.dismissible !== false && (
        <IconButton
          label={i18n.t('phone.dismiss')}
          className="absolute end-2 top-2 size-7"
          disabled={busy}
          onClick={() => act(() => call('mirror.dismiss', { id: m.id }))}
        >
          <X size={14} />
        </IconButton>
      )}
    </li>
  );
}
