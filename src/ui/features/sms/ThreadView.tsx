import clsx from 'clsx';
import { ArrowLeft } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { call } from '@/core/messaging/rpc';
import type { SmsMessage, SmsRecipient, SmsThread } from '@/core/pushbullet/types';
import { clockTime, dayLabel, threadName } from '@/core/utils/format';
import { Avatar, Centered, IconButton, MessageComposer, Notice, Spinner } from '@/ui/components';
import { errorText, useToast } from '@/ui/hooks/use-toast';
import { i18n } from '#i18n';

export function recipientImage(r?: SmsRecipient) {
  if (r?.thumbnail) return `data:image/jpeg;base64,${r.thumbnail}`;
  return r?.image_url;
}

export function ThreadView({ device, thread, onBack }: { device: string; thread: SmsThread; onBack: () => void }) {
  const notify = useToast();
  const [messages, setMessages] = useState<SmsMessage[] | null>(null);
  const [pending, setPending] = useState<SmsMessage[]>([]);
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const end = useRef<HTMLDivElement>(null);
  const name = threadName(thread);
  const latestStamp = thread.latest?.timestamp;

  const load = useCallback(async () => {
    try {
      const list = await call('sms.thread', { device, thread: thread.id });
      setMessages(list);
      // Drop optimistic bubbles once the phone reports them.
      setPending((p) =>
        p.filter((m) => !list.some((x) => x.direction === 'outgoing' && x.body === m.body && x.timestamp >= m.timestamp - 120)),
      );
      setError(null);
    } catch (err) {
      setError(errorText(err));
    }
  }, [device, thread.id]);

  // Reload whenever the background sees this thread change (sms_changed).
  useEffect(() => {
    void load();
  }, [load, latestStamp]);

  const ordered = useMemo(
    () => [...(messages ?? [])].sort((a, b) => a.timestamp - b.timestamp).concat(pending),
    [messages, pending],
  );
  useEffect(() => {
    end.current?.scrollIntoView({ block: 'end' });
  }, [ordered.length]);

  const send = async () => {
    const body = text.trim();
    if (!body) return;
    const optimistic: SmsMessage = {
      id: `local-${Date.now()}`,
      timestamp: Date.now() / 1000,
      direction: 'outgoing',
      body,
      pending: true,
    };
    setPending((p) => [...p, optimistic]);
    setText('');
    try {
      await call('sms.send', { device, addresses: thread.recipients.map((r) => r.address), message: body });
      setTimeout(() => void load(), 3000);
    } catch (err) {
      setPending((p) => p.filter((m) => m.id !== optimistic.id));
      setText(body);
      notify(errorText(err), 'error');
    }
  };

  let lastDay = '';
  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 items-center gap-2.5 border-b border-line bg-surface/60 px-2 py-2">
        <IconButton label={i18n.t('sms.back')} onClick={onBack}>
          <ArrowLeft size={16} className="rtl:-scale-x-100" />
        </IconButton>
        <Avatar src={thread.recipients.length === 1 ? recipientImage(thread.recipients[0]) : undefined} name={name} size={30} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold">{name}</p>
          <p className="truncate text-2xs text-muted">{thread.recipients.map((r) => r.number || r.address).join(', ')}</p>
        </div>
      </div>
      <div className="scroll-area min-h-0 flex-1 px-3.5 py-2">
        {error && (
          <div className="mb-2">
            <Notice tone="error">{error}</Notice>
          </div>
        )}
        {messages === null && !error && (
          <Centered>
            <Spinner />
          </Centered>
        )}
        <div className="flex flex-col gap-1.5">
          {ordered.map((m) => {
            const day = dayLabel(m.timestamp);
            const showDay = day !== lastDay;
            lastDay = day;
            const mine = m.direction === 'outgoing';
            const sender = !mine && thread.recipients.length > 1 ? thread.recipients[m.recipient_index ?? 0] : undefined;
            return (
              <div key={m.id} className="flex flex-col">
                {showDay && <p className="my-2.5 text-center text-2xs font-bold text-faint">{day}</p>}
                <div className={clsx('flex max-w-[82%] flex-col', mine ? 'items-end self-end' : 'self-start')}>
                  {sender && (
                    <span className="mb-0.5 px-1 text-2xs font-semibold text-muted">{sender.name || sender.address}</span>
                  )}
                  <div
                    className={clsx(
                      'rounded-2xl px-3.5 py-2 text-sm',
                      mine ? 'rounded-ee-md bg-accent text-on-accent' : 'rounded-es-md border border-line bg-surface',
                      m.pending && 'opacity-60',
                    )}
                  >
                    {m.image_urls?.map((u) => (
                      <img key={u} src={u} alt="" className="mb-1 max-h-48 rounded-lg" />
                    ))}
                    {m.body && (
                      <p dir="auto" className="whitespace-pre-wrap break-words">
                        {m.body}
                      </p>
                    )}
                  </div>
                  <span className="mt-0.5 px-1 text-2xs text-faint">
                    {m.pending ? i18n.t('send.sending') : clockTime(m.timestamp)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
        <div ref={end} />
      </div>
      <MessageComposer value={text} onChange={setText} onSend={send} placeholder={i18n.t('sms.placeholder')} />
    </div>
  );
}
