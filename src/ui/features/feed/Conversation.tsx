import clsx from 'clsx';
import { ArrowLeft, Bell, BellOff } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { call } from '@/core/messaging/rpc';
import type { Chat, Push, User } from '@/core/pushbullet/types';
import { clockTime, isImage, looksLikeUrl, normalizeUrl, personName, pushOpenUrl } from '@/core/utils/format';
import { Avatar, Empty, IconButton, MessageComposer } from '@/ui/components';
import { useRun } from '@/ui/hooks/use-toast';
import { i18n } from '#i18n';

/** Chat-style view of everything exchanged with one person. */
export function Conversation({
  chat,
  email,
  pushes,
  me,
  onBack,
}: {
  chat?: Chat;
  email: string;
  pushes: Push[];
  me: User | null;
  onBack: () => void;
}) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const run = useRun();
  const end = useRef<HTMLDivElement>(null);
  const ordered = useMemo(() => [...pushes].reverse(), [pushes]);
  const name = personName(chat, email);
  const first = name.split(' ')[0];

  useEffect(() => {
    end.current?.scrollIntoView({ block: 'end' });
  }, [ordered.length]);

  const send = async () => {
    const body = text.trim();
    if (!body) return;
    setBusy(true);
    const ok = await run(() =>
      call('push.send', {
        push: looksLikeUrl(body) ? { type: 'link', url: normalizeUrl(body) } : { type: 'note', body },
        targets: [`person:${chat?.with.email ?? email}`],
      }),
    );
    if (ok) setText('');
    setBusy(false);
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 items-center gap-2.5 border-b border-line bg-surface/60 px-2 py-2">
        <IconButton label={i18n.t('chat.back')} onClick={onBack}>
          <ArrowLeft size={16} className="rtl:-scale-x-100" />
        </IconButton>
        <Avatar src={chat?.with.image_url} name={name} size={30} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold">{name}</p>
          <p className="truncate text-2xs text-muted">{chat?.with.email ?? email}</p>
        </div>
        {chat && (
          <IconButton
            label={chat.muted ? i18n.t('chat.unmute') : i18n.t('chat.mute')}
            onClick={() =>
              run(
                () => call('chat.mute', { iden: chat.iden, muted: !chat.muted }),
                chat.muted ? i18n.t('chat.unmuted', [first!]) : i18n.t('chat.muted', [first!]),
              )
            }
          >
            {chat.muted ? <BellOff size={15} /> : <Bell size={15} />}
          </IconButton>
        )}
      </div>
      <div className="scroll-area min-h-0 flex-1 px-3.5 py-3">
        {ordered.length === 0 && <Empty title={i18n.t('chat.emptyTitle', [first!])}>{i18n.t('chat.emptyBody', [first!])}</Empty>}
        <div className="flex flex-col gap-2">
          {ordered.map((p) => {
            const mine = p.direction === 'outgoing' || p.sender_email_normalized === me?.email_normalized;
            const url = pushOpenUrl(p);
            return (
              <div key={p.iden} className={clsx('flex max-w-[82%] flex-col', mine ? 'items-end self-end' : 'self-start')}>
                <div
                  className={clsx(
                    'rounded-2xl px-3.5 py-2 text-sm',
                    mine ? 'rounded-ee-md bg-accent text-on-accent' : 'rounded-es-md border border-line bg-surface',
                  )}
                >
                  {p.title && (
                    <p dir="auto" className="font-bold">
                      {p.title}
                    </p>
                  )}
                  {p.body && (
                    <p dir="auto" className="whitespace-pre-wrap break-words">
                      {p.body}
                    </p>
                  )}
                  {url && (
                    <a
                      href={url}
                      target="_blank"
                      rel="noreferrer"
                      className={clsx('break-all underline underline-offset-2', !mine && 'text-accent-strong')}
                    >
                      {p.type === 'file' ? p.file_name : p.url}
                    </a>
                  )}
                  {isImage(p) && p.image_url && <img src={`${p.image_url}=s400`} alt="" className="mt-1.5 max-h-40 rounded-lg" />}
                </div>
                <span className="mt-0.5 px-1 text-2xs text-faint">{clockTime(p.created)}</span>
              </div>
            );
          })}
        </div>
        <div ref={end} />
      </div>
      <MessageComposer
        value={text}
        onChange={setText}
        onSend={send}
        busy={busy}
        placeholder={i18n.t('chat.placeholder', [first!])}
      />
    </div>
  );
}
