import clsx from 'clsx';
import { ClipboardPaste, File as FileIcon, Link2, Paperclip, SendHorizontal, StickyNote, X } from 'lucide-react';
import { type ClipboardEvent, type DragEvent, type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { browser, type Browser } from 'wxt/browser';
import { call, type OutgoingPush } from '@/core/messaging/rpc';
import { Pushbullet } from '@/core/pushbullet/client';
import * as store from '@/core/storage/store';
import { formatBytes, isHttpUrl, looksLikeUrl, normalizeUrl } from '@/core/utils/format';
import { supportsTimestamp, urlPreview, withTimestamp } from '@/core/utils/links';
import type { Mode } from '@/ui/app/App';
import { Button, IconButton } from '@/ui/components';
import { useStore } from '@/ui/hooks/use-store';
import { errorText, useToast } from '@/ui/hooks/use-toast';
import { LinkCard } from './LinkCard';
import { RecentPushes } from './RecentPushes';
import { RatePrompt, SupportPrompt } from './SupportPrompt';
import { IssueBanner } from '@/ui/features/setup/SetupIssues';
import { SetupGuide } from '@/ui/features/setup/SetupGuide';
import { WhatsNew } from './WhatsNew';
import { grabImage, type PageInfo, readPage } from './page';
import { TargetGrid } from './TargetGrid';
import { targetLabel, useTargets } from './targets';
import { Trail, type TrailHandle } from './Trail';
import { i18n } from '#i18n';

type Kind = 'link' | 'note' | 'file';

interface Attachment {
  id: string;
  file: File;
  progress: number;
}

async function activeTab(mode: Mode) {
  if (mode === 'window') {
    const win = await browser.windows.getLastFocused({ windowTypes: ['normal'] });
    return (await browser.tabs.query({ active: true, windowId: win.id }))[0];
  }
  return (await browser.tabs.query({ active: true, currentWindow: true }))[0];
}

export function SendView({
  mode,
  onOpenFeed,
  target,
}: {
  mode: Mode;
  onOpenFeed: () => void;
  /** Start on this target (a targetKey) instead of the remembered one. */
  target?: string;
}) {
  const { settings, me, ready } = useStore(['settings', 'me']);
  const { targets, unreachable } = useTargets();
  const notify = useToast();
  const [kind, setKind] = useState<Kind>('note');
  const [page, setPage] = useState<PageInfo | null>(null);
  const [timestamp, setTimestamp] = useState(true);
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [body, setBody] = useState('');
  // An empty note stays one line until you start writing, so the targets fit.
  const [writing, setWriting] = useState(false);
  const [files, setFiles] = useState<Attachment[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [sending, setSending] = useState(false);
  const [dragging, setDragging] = useState(false);
  const edited = useRef(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const trail = useRef<TrailHandle>(null);
  const sendButton = useRef<HTMLDivElement>(null);

  // Start on the remembered target; fall back to all devices if it's gone.
  useEffect(() => {
    if (!ready || selected.length || targets.length < 2) return;
    const wanted = target ?? settings.defaultTarget;
    setSelected([targets.some((t) => t.key === wanted) ? wanted : 'all']);
  }, [ready, targets, settings.defaultTarget, selected.length, target]);

  const loadPage = useCallback(
    async (force = false) => {
      if (edited.current && !force) return;
      const tab = await activeTab(mode);
      if (tab?.url && isHttpUrl(tab.url)) {
        const info = await readPage(tab);
        setPage(info);
        setTitle(info.title);
        setUrl(info.url);
        setKind((k) => (k === 'file' ? k : 'link'));
        // Text you highlighted before opening Pushpilot rides along as the message.
        if (info.selection && !force) setBody((b) => b || `“${info.selection}”`);
      } else {
        setPage(null);
        setKind((k) => (k === 'link' ? 'note' : k));
      }
    },
    [mode],
  );

  // The defining feature: open Pushpilot on a page and that page is ready to send.
  useEffect(() => {
    if (!ready) return;
    if (settings.prefillCurrentPage) void loadPage();
    else bodyRef.current?.focus();
  }, [ready, settings.prefillCurrentPage, loadPage]);

  // The side panel follows whichever tab you're looking at until you start editing.
  useEffect(() => {
    if (mode !== 'panel' || !settings.prefillCurrentPage) return;
    const refresh = () => void loadPage(false);
    const onUpdated = (_id: number, info: Browser.tabs.OnUpdatedInfo, tab: Browser.tabs.Tab) => {
      if (tab.active && (info.url || info.title || info.status === 'complete')) refresh();
    };
    browser.tabs.onActivated.addListener(refresh);
    browser.tabs.onUpdated.addListener(onUpdated);
    return () => {
      browser.tabs.onActivated.removeListener(refresh);
      browser.tabs.onUpdated.removeListener(onUpdated);
    };
  }, [mode, settings.prefillCurrentPage, loadPage]);

  const addFiles = (list: FileList | File[]) => {
    const next = Array.from(list).map((file) => ({ id: crypto.randomUUID(), file, progress: 0 }));
    if (!next.length) return;
    const limit = me?.max_upload_size ?? 25 * 1024 * 1024;
    const tooBig = next.find((a) => a.file.size > limit);
    if (tooBig) return notify(i18n.t('send.tooBig', [tooBig.file.name, formatBytes(limit)]), 'error');
    edited.current = true;
    setFiles((f) => [...f, ...next]);
    setKind('file');
  };

  const onPaste = (e: ClipboardEvent) => {
    if (!e.clipboardData.files.length) return;
    e.preventDefault();
    addFiles(e.clipboardData.files);
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files.length) return addFiles(e.dataTransfer.files);
    const text = e.dataTransfer.getData('text/uri-list') || e.dataTransfer.getData('text/plain');
    if (text) insertText(text);
  };

  /** An address becomes the link to send; other text goes into the message. */
  const insertText = (text: string, asNote = false) => {
    edited.current = true;
    if (looksLikeUrl(text)) {
      const address = normalizeUrl(text.trim());
      setKind('link');
      setUrl(address);
      setTitle('');
      setPage({ url: address, title: '', preview: urlPreview(address) });
    } else {
      if (asNote && kind === 'link') setKind('note');
      setBody((b) => (b ? `${b}\n${text}` : text));
    }
  };

  const switchTo = (k: Kind) => {
    edited.current = true;
    if (k === 'file') return fileInput.current?.click();
    setKind(k);
    if (k === 'link' && !url) void loadPage(true);
    if (k === 'note') setTimeout(() => bodyRef.current?.focus(), 0);
  };

  const expanded = writing || !!body || !!title;

  const canSend =
    !sending &&
    selected.length > 0 &&
    (kind === 'link' ? !!url.trim() : kind === 'file' ? files.length > 0 : !!(body.trim() || title.trim()));

  const reset = () => {
    edited.current = false;
    setBody('');
    setFiles([]);
    if (settings.prefillCurrentPage) void loadPage();
    else {
      setPage(null);
      setUrl('');
      setTitle('');
      setKind('note');
    }
  };

  // The page's own metadata when we could read it, else what the URL alone tells us.
  const preview = useMemo(
    () => (page && normalizeUrl(url.trim()) === page.url ? page.preview : urlPreview(normalizeUrl(url.trim() || 'about:blank'))),
    [page, url],
  );
  const sendUrl = () => {
    const u = normalizeUrl(url.trim());
    return timestamp && page?.videoTime && u === page.url && supportsTimestamp(u) ? withTimestamp(u, page.videoTime) : u;
  };

  const sendImageFile = async () => {
    if (!page?.tabId) return;
    const file = await grabImage(page.tabId, page.url);
    if (file) addFiles([file]);
    else notify(i18n.t('send.imageUnreadable'), 'error');
  };

  const send = async () => {
    if (!canSend) return;
    setSending(true);
    const where = targetLabel(selected, targets);
    let queued = false;
    try {
      if (kind === 'file') {
        const { token, e2eKey } = await store.getMany(['token', 'e2eKey']);
        const pb = new Pushbullet(token!, e2eKey);
        for (const a of files) {
          const uploaded = await pb.upload(a.file, a.file.name || 'file', (p) =>
            setFiles((fs) => fs.map((x) => (x.id === a.id ? { ...x, progress: p } : x))),
          );
          const r = await call('push.send', {
            push: { type: 'file', ...uploaded, body: body.trim() || undefined },
            targets: selected,
          });
          queued ||= r.queued;
        }
      } else {
        let push: OutgoingPush;
        if (kind === 'link') {
          const finalUrl = sendUrl();
          push = { type: 'link', title: title.trim() || undefined, url: finalUrl, body: body.trim() || undefined };
          if (preview.title || preview.image) void call('preview.save', { url: finalUrl, preview }).catch(() => undefined);
        } else if (!title.trim() && looksLikeUrl(body)) push = { type: 'link', url: normalizeUrl(body.trim()) };
        else push = { type: 'note', title: title.trim() || undefined, body: body.trim() };
        queued = (await call('push.send', { push, targets: selected })).queued;
      }
      if (selected.length === 1 && selected[0] !== settings.defaultTarget)
        void store.updateSettings({ defaultTarget: selected[0] });
      if (queued) notify(i18n.t('send.queued'));
      else {
        if (sendButton.current?.lastElementChild) trail.current?.fire(sendButton.current.lastElementChild);
        void store.update('sendCount', (n) => n + 1);
        notify(i18n.t('send.sentTo', [where]));
      }
      if (settings.closeAfterSend && mode === 'popup') setTimeout(() => window.close(), 700);
      else reset();
    } catch (err) {
      notify(errorText(err), 'error');
    } finally {
      setSending(false);
    }
  };

  // Puts what you copied in the composer, ready to send: an image as a file,
  // an address as a link, anything else as a note.
  const pasteClipboard = async () => {
    try {
      const items = await navigator.clipboard.read().catch(() => []);
      for (const item of items) {
        const type = item.types.find((t) => t.startsWith('image/'));
        if (!type) continue;
        const blob = await item.getType(type);
        return addFiles([new File([blob], `clipboard.${type.split('/')[1]}`, { type })]);
      }
      const text = (await navigator.clipboard.readText()).trim();
      if (!text) return notify(i18n.t('send.clipboardEmpty'), 'error');
      insertText(text, true);
    } catch (err) {
      notify(errorText(err), 'error');
    }
  };

  const sendRef = useRef(send);
  sendRef.current = send;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        void sendRef.current();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const isMac = useMemo(() => navigator.platform.toLowerCase().includes('mac'), []);

  return (
    <div
      className="relative flex h-full flex-col"
      onPaste={onPaste}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={(e) => e.currentTarget === e.target && setDragging(false)}
      onDrop={onDrop}
    >
      <div className="scroll-area min-h-0 flex-1 px-3.5 pb-4 pt-3.5">
        <WhatsNew />
        <SetupGuide />
        <IssueBanner />
        <div
          className={clsx(
            'overflow-hidden rounded-[20px] bg-surface shadow-card ring-1 transition-colors',
            dragging ? 'ring-2 ring-accent' : 'ring-line',
          )}
          onFocus={() => setWriting(true)}
          onBlur={(e) => !e.currentTarget.contains(e.relatedTarget as Node | null) && setWriting(false)}
        >
          {kind === 'link' && (
            <LinkCard
              url={url}
              title={title}
              page={page}
              preview={preview}
              timestamp={timestamp}
              onTitle={(v) => {
                edited.current = true;
                setTitle(v);
              }}
              onUrl={(v) => {
                edited.current = true;
                setUrl(v);
              }}
              onTimestamp={setTimestamp}
              onSendImage={page?.isImageTab ? sendImageFile : undefined}
              onRemove={() => {
                edited.current = true;
                setKind('note');
                setUrl('');
                setTitle('');
              }}
            />
          )}

          {kind === 'file' && (
            <ul className="flex flex-col gap-1.5 p-3 pb-0">
              {files.map((a) => (
                <li key={a.id} className="relative flex items-center gap-2.5 overflow-hidden rounded-xl bg-raised p-2">
                  {sending && (
                    <span
                      className="absolute inset-y-0 start-0 bg-accent/20 transition-[width]"
                      style={{ width: `${Math.round(a.progress * 100)}%` }}
                    />
                  )}
                  <FileThumb file={a.file} />
                  <span className="relative min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{a.file.name || i18n.t('send.pastedImage')}</span>
                    <span className="block text-2xs text-muted">{formatBytes(a.file.size)}</span>
                  </span>
                  {!sending && (
                    <IconButton
                      label={i18n.t('send.removeFile', [a.file.name])}
                      className="relative size-7"
                      onClick={() => {
                        const left = files.filter((x) => x.id !== a.id);
                        setFiles(left);
                        if (!left.length) setKind(url ? 'link' : 'note');
                      }}
                    >
                      <X size={14} />
                    </IconButton>
                  )}
                </li>
              ))}
            </ul>
          )}

          {kind === 'note' && expanded && (
            <div className="flex items-start pe-2 pt-2">
              <input
                dir="auto"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={i18n.t('send.titlePlaceholder')}
                aria-label={i18n.t('send.noteTitle')}
                className="min-w-0 flex-1 bg-transparent ps-4 pt-2 text-[15px] font-bold outline-none placeholder:text-faint"
              />
              {(body || title) && (
                <IconButton
                  label={i18n.t('send.clear')}
                  className="size-7"
                  onClick={() => {
                    setBody('');
                    setTitle('');
                    bodyRef.current?.focus();
                  }}
                >
                  <X size={14} />
                </IconButton>
              )}
            </div>
          )}

          <div ref={sendButton} className={clsx('flex items-end', kind !== 'note' && 'mt-2 border-t border-line')}>
            <textarea
              dir="auto"
              ref={bodyRef}
              value={body}
              onChange={(e) => {
                edited.current = true;
                setBody(e.target.value);
              }}
              rows={kind === 'note' ? (expanded ? 5 : 1) : 2}
              placeholder={kind === 'note' ? i18n.t('send.notePlaceholder') : i18n.t('send.messagePlaceholder')}
              aria-label={i18n.t('send.message')}
              className="block max-h-56 min-w-0 flex-1 resize-none bg-transparent px-4 py-3 text-sm leading-relaxed outline-none [field-sizing:content] placeholder:text-faint"
              style={{ minHeight: kind === 'note' && expanded ? 140 : undefined }}
            />
            {/* Send sits where you write, so it's never scrolled out of view: level with
                the last line, inset as much from the bottom as from the side, its corner
                following the card's. */}
            <Button
              variant="primary"
              className="mb-[6px] me-[6px] shrink-0 rounded-[14px]"
              onClick={send}
              disabled={!canSend}
              busy={sending}
              title={`${i18n.t('send.sendTo', [targetLabel(selected, targets)])} (${isMac ? '⌘' : 'Ctrl'} ↵)`}
            >
              {!sending && <SendHorizontal size={15} strokeWidth={2.2} />}
              {sending ? (kind === 'file' ? i18n.t('send.uploading') : i18n.t('send.sending')) : i18n.t('tabs.send')}
            </Button>
          </div>
        </div>

        <div className="mt-2 flex items-center gap-1.5">
          {kind !== 'link' && (
            <ActionPill icon={<Link2 size={14} />} onClick={() => switchTo('link')}>
              {i18n.t('send.thisPage')}
            </ActionPill>
          )}
          {kind !== 'note' && (
            <ActionPill icon={<StickyNote size={14} />} onClick={() => switchTo('note')}>
              {i18n.t('send.note')}
            </ActionPill>
          )}
          <ActionPill icon={<Paperclip size={14} />} onClick={() => switchTo('file')}>
            {kind === 'file' ? i18n.t('send.addFile') : i18n.t('send.file')}
          </ActionPill>
          <ActionPill icon={<ClipboardPaste size={14} />} onClick={pasteClipboard} title={i18n.t('send.clipboardHint')}>
            {i18n.t('send.clipboard')}
          </ActionPill>
          <input
            ref={fileInput}
            type="file"
            multiple
            hidden
            onChange={(e) => {
              if (e.target.files) addFiles(e.target.files);
              e.target.value = '';
            }}
          />
        </div>

        <TargetGrid targets={targets} selected={selected} unreachable={unreachable} onChange={setSelected} />
        <SupportPrompt />
        <RatePrompt />
        <RecentPushes onSeeAll={onOpenFeed} />
      </div>
      <Trail ref={trail} />
    </div>
  );
}

function ActionPill({
  icon,
  children,
  onClick,
  title,
}: {
  icon: ReactNode;
  children: ReactNode;
  onClick: () => void;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className="flex h-8 items-center gap-1.5 rounded-full bg-surface px-3 text-xs font-bold text-muted shadow-sm ring-1 ring-line transition-colors hover:text-ink"
    >
      {icon}
      {children}
    </button>
  );
}

function FileThumb({ file }: { file: File }) {
  const [src, setSrc] = useState<string>();
  useEffect(() => {
    if (!file.type.startsWith('image/')) return;
    const u = URL.createObjectURL(file);
    setSrc(u);
    return () => URL.revokeObjectURL(u);
  }, [file]);
  return src ? (
    <img src={src} alt="" className="relative size-9 shrink-0 rounded-lg object-cover" />
  ) : (
    <span className="relative grid size-9 shrink-0 place-items-center rounded-lg bg-file-bg text-file-fg">
      <FileIcon size={16} />
    </span>
  );
}
