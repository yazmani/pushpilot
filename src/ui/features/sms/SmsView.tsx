import clsx from 'clsx';
import { ArrowLeft, MessageSquareText, RefreshCw, SquarePen } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { call } from '@/core/messaging/rpc';
import type { Device, SmsThread } from '@/core/pushbullet/types';
import { deviceName, extractCode, isReachable, threadName, timeAgo } from '@/core/utils/format';
import {
  Avatar,
  Centered,
  CodeChip,
  Empty,
  fieldClass,
  Group,
  IconButton,
  MessageComposer,
  Notice,
  Spinner,
} from '@/ui/components';
import { useNow } from '@/ui/hooks/use-now';
import { useStore } from '@/ui/hooks/use-store';
import { useWide } from '@/ui/hooks/use-wide';
import { errorText, useToast } from '@/ui/hooks/use-toast';
import { recipientImage, ThreadView } from './ThreadView';
import { i18n } from '#i18n';

function lastSeen(d: Device) {
  return new Date(d.modified * 1000).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export function SmsView({
  device: wantDevice,
  thread: wantThread,
  split: canSplit = false,
}: {
  device?: string;
  thread?: string;
  /** On a full page: conversations on the left, the open one on the right. */
  split?: boolean;
}) {
  const wide = useWide(768);
  const split = canSplit && wide;
  const { devices, smsThreads } = useStore(['devices', 'smsThreads']);
  // Phones that are still connected first, then the most recently active.
  const phones = useMemo(
    () =>
      devices.filter((d) => d.has_sms).sort((a, b) => Number(isReachable(b)) - Number(isReachable(a)) || b.modified - a.modified),
    [devices],
  );
  const [device, setDevice] = useState<string | undefined>(wantDevice);
  const [threadId, setThreadId] = useState<string | undefined>(wantThread);
  const [composing, setComposing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // No phone picked yet: use the first one whose texts actually load.
  useEffect(() => {
    if (device || !phones.length) return;
    let cancelled = false;
    void (async () => {
      setLoading(true);
      for (const p of phones) {
        try {
          await call('sms.threads', { device: p.iden });
          if (!cancelled) setDevice(p.iden);
          setLoading(false);
          return;
        } catch {
          // try the next phone
        }
      }
      if (!cancelled) {
        setDevice(phones[0]!.iden);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [device, phones]);

  const refresh = useCallback(
    async (force = false) => {
      if (!device) return;
      setLoading(true);
      setError(null);
      try {
        await call('sms.threads', { device, force });
      } catch (err) {
        setError(errorText(err));
      } finally {
        setLoading(false);
      }
    },
    [device],
  );

  useEffect(() => {
    void refresh();
  }, [refresh]);

  if (!phones.length) {
    return (
      <Empty icon={<MessageSquareText size={24} />} title={i18n.t('sms.noPhoneTitle')}>
        {i18n.t('sms.noPhoneBody')}
      </Empty>
    );
  }

  const phone = phones.find((p) => p.iden === device);
  const threads = (device && smsThreads[device]) || [];
  const thread = threads.find((t) => t.id === threadId);

  const detail =
    composing && device ? (
      <NewMessage
        device={device}
        onBack={() => setComposing(false)}
        onSent={() => {
          setComposing(false);
          setTimeout(() => void refresh(true), 2500);
        }}
      />
    ) : thread && device ? (
      <ThreadView key={thread.id} device={device} thread={thread} onBack={() => setThreadId(undefined)} />
    ) : null;
  if (detail && !split) return detail;

  const list = (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 items-center gap-2 px-3.5 pb-2 pt-3">
        {phones.length === 1 && phone ? (
          <p className="min-w-0 flex-1 truncate ps-1 text-sm font-bold">
            {deviceName(phone)}
            {!isReachable(phone) && (
              <span className="ms-1.5 font-medium text-faint">{i18n.t('sms.lastSeen', [lastSeen(phone)])}</span>
            )}
          </p>
        ) : (
          <select
            value={device ?? ''}
            onChange={(e) => {
              setDevice(e.target.value);
              setThreadId(undefined);
            }}
            aria-label={i18n.t('sms.phone')}
            className={clsx(fieldClass, 'h-9 min-w-0 flex-1 font-semibold')}
          >
            {phones.map((p) => (
              <option key={p.iden} value={p.iden}>
                {deviceName(p)} {isReachable(p) ? '' : i18n.t('sms.lastSeen', [lastSeen(p)])}
              </option>
            ))}
          </select>
        )}
        <IconButton label={i18n.t('sms.refresh')} onClick={() => void refresh(true)} disabled={loading}>
          <RefreshCw size={15} className={clsx(loading && 'animate-spin')} />
        </IconButton>
        <IconButton label={i18n.t('sms.newText')} onClick={() => setComposing(true)}>
          <SquarePen size={15} />
        </IconButton>
      </div>

      <div className="scroll-area min-h-0 flex-1 px-2 pb-3">
        {phone && !isReachable(phone) && (
          <div className="mx-1.5 mb-2">
            <Notice tone="warn">{i18n.t('sms.offlineNotice', [deviceName(phone), lastSeen(phone)])}</Notice>
          </div>
        )}
        {error && (
          <div className="mx-1.5 mb-2">
            <Notice tone="error">{error}</Notice>
          </div>
        )}
        {!threads.length && loading && (
          <Centered>
            <Spinner />
          </Centered>
        )}
        {!threads.length && !loading && !error && (
          <Empty title={i18n.t('sms.noThreadsTitle')}>{i18n.t('sms.noThreadsBody')}</Empty>
        )}
        {threads.length > 0 && (
          <Group className="mx-1.5">
            {threads.map((t) => (
              <ThreadRow
                key={t.id}
                t={t}
                active={split && t.id === threadId}
                onOpen={() => {
                  setComposing(false);
                  setThreadId(t.id);
                }}
              />
            ))}
          </Group>
        )}
      </div>
    </div>
  );
  if (!split) return list;

  return (
    <div className="flex h-full overflow-hidden rounded-t-2xl border border-b-0 border-line bg-surface shadow-sm">
      <div className="flex w-[340px] shrink-0 flex-col border-e border-line bg-bg">{list}</div>
      <div className="flex min-w-0 flex-1 flex-col bg-bg">
        {detail ?? (
          <Empty icon={<MessageSquareText size={24} />} title={i18n.t('sms.pickTitle')}>
            {i18n.t('sms.pickBody')}
          </Empty>
        )}
      </div>
    </div>
  );
}

function ThreadRow({ t, active, onOpen }: { t: SmsThread; active?: boolean; onOpen: () => void }) {
  useNow();
  const name = threadName(t);
  // Only a fresh code is worth a button; old ones are usually used up.
  const fresh = t.latest && Date.now() / 1000 - t.latest.timestamp < 30 * 60;
  const code = fresh && t.latest?.direction === 'incoming' ? extractCode(t.latest.body, { strict: true }) : undefined;
  return (
    <li className={clsx('flex items-center transition-colors', active ? 'bg-accent-soft/70' : 'hover:bg-raised/50')}>
      <button onClick={onOpen} className="flex min-w-0 flex-1 items-center gap-3 py-2.5 ps-3.5 pe-2 text-start">
        <Avatar src={t.recipients.length === 1 ? recipientImage(t.recipients[0]) : undefined} name={name} size={38} />
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline gap-2">
            <span className="truncate text-sm font-bold">{name}</span>
            {t.latest && <span className="ms-auto shrink-0 text-2xs font-medium text-faint">{timeAgo(t.latest.timestamp)}</span>}
          </span>
          <span dir="auto" className="mt-0.5 block truncate text-xs text-muted">
            {t.latest?.direction === 'outgoing' && i18n.t('sms.you')}
            {t.latest?.body || (t.latest?.image_urls?.length ? i18n.t('sms.photo') : '')}
          </span>
        </span>
      </button>
      {code && <CodeChip code={code} small className="me-3" />}
    </li>
  );
}

function NewMessage({ device, onBack, onSent }: { device: string; onBack: () => void; onSent: () => void }) {
  const notify = useToast();
  const [to, setTo] = useState('');
  const [text, setText] = useState('');
  const send = async () => {
    const addresses = to
      .split(/[,;]/)
      .map((a) => a.trim())
      .filter(Boolean);
    if (!addresses.length) return notify(i18n.t('sms.addNumber'), 'error');
    if (!text.trim()) return;
    try {
      await call('sms.send', { device, addresses, message: text.trim() });
      notify(i18n.t('sms.sent'));
      onSent();
    } catch (err) {
      notify(errorText(err), 'error');
    }
  };
  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 items-center gap-2 border-b border-line bg-surface/60 px-2 py-2">
        <IconButton label={i18n.t('sms.back')} onClick={onBack}>
          <ArrowLeft size={16} className="rtl:-scale-x-100" />
        </IconButton>
        <p className="text-sm font-bold">{i18n.t('sms.newText')}</p>
      </div>
      <label className="flex shrink-0 items-center gap-2 border-b border-line px-4 py-3">
        <span className="text-sm font-semibold text-muted">{i18n.t('sms.to')}</span>
        <input
          autoFocus
          value={to}
          onChange={(e) => setTo(e.target.value)}
          placeholder={i18n.t('sms.toPlaceholder')}
          inputMode="tel"
          className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-faint"
        />
      </label>
      <div className="flex-1" />
      <MessageComposer value={text} onChange={setText} onSend={send} placeholder={i18n.t('sms.placeholder')} />
    </div>
  );
}
