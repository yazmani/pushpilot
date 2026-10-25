import clsx from 'clsx';
import { ArrowLeft, Bell, BellOff } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { call } from '@/core/messaging/rpc';
import type { Chat, Push, User } from '@/core/pushbullet/types';
import { clockTime, isImage, looksLikeUrl, normalizeUrl, personName, pushOpenUrl } from '@/core/utils/format';
import { Avatar, Empty, IconButton, MessageComposer } from '@/ui/components';
import { useRun } from '@/ui/hooks/use-toast';

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
        <IconButton label="Back to feed" onClick={onBack}>
          <ArrowLeft size={16} />
        </IconButton>
        <Avatar src={chat?.with.image_url} name={name} size={30} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold">{name}</p>
          <p className="truncate text-2xs text-muted">{chat?.with.email ?? email}</p>
        </div>
        {chat && (
          <IconButton
            label={chat.muted ? 'Unmute' : 'Mute notifications'}
            onClick={() =>
              run(
                () => call('chat.mute', { iden: chat.iden, muted: !chat.muted }),
                chat.muted ? `Notifications on for ${first}` : `${first} muted`,
              )
            }
          >
            {chat.muted ? <BellOff size={15} /> : <Bell size={15} />}
          </IconButton>
        )}
      </div>
      <div className="scroll-area min-h-0 flex-1 px-3.5 py-3">
        {ordered.length === 0 && (
          <Empty title={`Say hi to ${first}`}>Anything you send here reaches all of {first}’s devices.</Empty>
        )}
        <div className="flex flex-col gap-2">
          {ordered.map((p) => {
            const mine = p.direction === 'outgoing' || p.sender_email_normalized === me?.email_normalized;
            const url = pushOpenUrl(p);
            return (
              <div key={p.iden} className={clsx('flex max-w-[82%] flex-col', mine ? 'items-end self-end' : 'self-start')}>
                <div
                  className={clsx(
                    'rounded-2xl px-3.5 py-2 text-sm',
                    mine ? 'rounded-br-md bg-accent text-on-accent' : 'rounded-bl-md border border-line bg-surface',
                  )}
                >
                  {p.title && <p className="font-bold">{p.title}</p>}
                  {p.body && <p className="whitespace-pre-wrap break-words">{p.body}</p>}
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
      <MessageComposer value={text} onChange={setText} onSend={send} busy={busy} placeholder={`Message ${first}`} />
    </div>
  );
}
