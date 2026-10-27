import clsx from 'clsx';
import { ImageDown, Pencil, Timer, X } from 'lucide-react';
import { useState } from 'react';
import { host } from '@/core/utils/format';
import { formatDuration, type LinkPreview, supportsTimestamp } from '@/core/utils/links';
import { IconButton, KindBadge, LinkThumb } from '@/ui/components';
import type { PageInfo } from './page';
import { i18n } from '#i18n';

/**
 * The link you're about to send as a share-sheet header: thumbnail, title,
 * site and kind, plus options that only make sense for this kind of page.
 */
export function LinkCard({
  url,
  title,
  page,
  preview,
  timestamp,
  onTitle,
  onUrl,
  onTimestamp,
  onSendImage,
  onRemove,
}: {
  url: string;
  title: string;
  page: PageInfo | null;
  preview: LinkPreview;
  timestamp: boolean;
  onTitle: (v: string) => void;
  onUrl: (v: string) => void;
  onTimestamp: (v: boolean) => void;
  onSendImage?: () => void;
  onRemove: () => void;
}) {
  const [editingUrl, setEditingUrl] = useState(false);
  const site = preview.siteName?.split(',')[0] || host(url);
  const canStamp = !!page?.videoTime && supportsTimestamp(url);

  return (
    <div className="px-3.5 pb-1 pt-3.5">
      <div className="flex items-start gap-3">
        <LinkThumb preview={preview} url={url} size={62} shape="wide" />
        <div className="min-w-0 flex-1">
          <textarea
            dir="auto"
            value={title}
            onChange={(e) => onTitle(e.target.value.replace(/\n/g, ' '))}
            rows={1}
            placeholder={i18n.t('link.title')}
            aria-label={i18n.t('link.titleLabel')}
            className="line-clamp-2 max-h-[2.7em] w-full resize-none bg-transparent text-sm font-bold leading-snug outline-none [field-sizing:content] placeholder:text-faint focus:line-clamp-none focus:max-h-none"
          />
          <div className="mt-1 flex min-w-0 items-center gap-1.5">
            <span className="truncate text-2xs font-semibold text-muted">{site}</span>
            {preview.kind !== 'web' && (
              <KindBadge preview={preview} className="shrink-0 bg-raised !py-0 leading-[18px] text-muted" />
            )}
          </div>
          {editingUrl ? (
            <input
              autoFocus
              value={url}
              onChange={(e) => onUrl(e.target.value)}
              onBlur={() => setEditingUrl(false)}
              onKeyDown={(e) => e.key === 'Enter' && setEditingUrl(false)}
              aria-label={i18n.t('link.address')}
              spellCheck={false}
              className="mt-1 w-full rounded-md border border-accent bg-surface px-1.5 py-0.5 text-2xs font-semibold text-accent-strong outline-none"
            />
          ) : (
            <button
              onClick={() => setEditingUrl(true)}
              className="group mt-0.5 flex max-w-full items-center gap-1 text-2xs font-semibold text-accent-strong"
              title={i18n.t('link.edit')}
            >
              <span className="truncate">{url.replace(/^https?:\/\/(www\.)?/, '')}</span>
              <Pencil size={10} className="shrink-0 opacity-0 transition-opacity group-hover:opacity-100" />
            </button>
          )}
        </div>
        <IconButton label={i18n.t('link.remove')} onClick={onRemove} className="-me-1.5 -mt-1 size-7">
          <X size={14} />
        </IconButton>
      </div>

      {(canStamp || onSendImage) && (
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {canStamp && (
            <button
              type="button"
              aria-pressed={timestamp}
              onClick={() => onTimestamp(!timestamp)}
              className={clsx(
                'flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-xs font-bold transition-colors',
                timestamp ? 'border-accent bg-accent-soft text-accent-strong' : 'border-line text-muted hover:text-ink',
              )}
            >
              <Timer size={13} /> {i18n.t('link.startAt', [formatDuration(page!.videoTime!)])}
            </button>
          )}
          {onSendImage && (
            <button
              type="button"
              onClick={onSendImage}
              className="flex h-7 items-center gap-1.5 rounded-full border border-line px-2.5 text-xs font-bold text-muted transition-colors hover:text-ink"
            >
              <ImageDown size={13} /> {i18n.t('link.sendImage')}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
