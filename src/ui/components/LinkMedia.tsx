import clsx from 'clsx';
import { CodeXml, FileText, Globe, Headphones, Image, MapPin, MessageCircle, Newspaper, Play, ShoppingBag } from 'lucide-react';
import { useState } from 'react';
import type { LinkKind, LinkPreview } from '@/core/utils/links';
import { formatDuration } from '@/core/utils/links';
import { Favicon } from './Identity';
import { i18n } from '#i18n';

const KINDS: Record<LinkKind, typeof Globe> = {
  video: Play,
  image: Image,
  article: Newspaper,
  code: CodeXml,
  music: Headphones,
  map: MapPin,
  document: FileText,
  social: MessageCircle,
  shop: ShoppingBag,
  web: Globe,
};

/** "Video 12:04", "Article, 6 min read"… */
export function kindLabel(p: LinkPreview): string {
  const base = i18n.t(`linkKind.${p.kind}`);
  if (p.kind === 'video' && p.duration) return `${base} ${formatDuration(p.duration)}`;
  if (p.readMinutes) return i18n.t('linkKind.readTime', [base, String(p.readMinutes)]);
  return base;
}

export function KindBadge({ preview, className }: { preview: LinkPreview; className?: string }) {
  const Icon = KINDS[preview.kind];
  return (
    <span className={clsx('inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-2xs font-bold', className)}>
      <Icon size={11} strokeWidth={2.4} aria-hidden="true" />
      {kindLabel(preview)}
    </span>
  );
}

/**
 * Compact picture for a link: a 16:9 frame with a play badge for videos and
 * images, a square crop for pages with a share image, the site icon otherwise.
 */
export function LinkThumb({
  preview,
  url,
  size = 56,
  shape = 'auto',
}: {
  preview: LinkPreview;
  url?: string;
  /** Height in px. */
  size?: number;
  /** auto: wide for videos and images, square otherwise. Lists force one shape so text lines up. */
  shape?: 'auto' | 'square' | 'wide';
}) {
  const [broken, setBroken] = useState(false);
  const wide = shape === 'wide' || (shape === 'auto' && (preview.kind === 'video' || preview.kind === 'image'));
  const width = wide ? Math.round(size * 1.78) : size;
  if (!preview.image || broken) {
    return (
      <span
        className="grid shrink-0 place-items-center rounded-xl bg-raised text-muted ring-1 ring-line"
        style={{ width, height: size }}
      >
        {url ? <Favicon url={url} size={Math.round(size * 0.42)} /> : <Globe size={size * 0.42} />}
      </span>
    );
  }
  return (
    <span
      className="relative block shrink-0 overflow-hidden rounded-xl bg-sunken ring-1 ring-black/5"
      style={{ width, height: size }}
    >
      <img src={preview.image} alt="" loading="lazy" onError={() => setBroken(true)} className="h-full w-full object-cover" />
      {preview.kind === 'video' && (
        <>
          <span className="absolute inset-0 bg-black/15" />
          <span
            className={clsx(
              'absolute left-1/2 top-1/2 grid -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-white/95 text-black shadow-sm',
              size < 56 ? 'size-[22px]' : 'size-7',
            )}
          >
            <Play size={size < 56 ? 10 : 12} fill="currentColor" className="ms-px" />
          </span>
          {preview.duration ? (
            <span className="absolute bottom-1 end-1 rounded bg-black/75 px-1 text-[9px] font-bold leading-[14px] text-white">
              {formatDuration(preview.duration)}
            </span>
          ) : null}
        </>
      )}
    </span>
  );
}

/** Full-width picture, for images sent as files and expanded views. */
export function LinkMedia({
  preview,
  className,
  rounded = 'rounded-xl',
  height,
}: {
  preview: LinkPreview;
  className?: string;
  rounded?: string;
  height?: number;
}) {
  const [broken, setBroken] = useState(false);
  if (!preview.image || broken) return null;
  const isVideo = preview.kind === 'video';
  const isImage = preview.kind === 'image';
  return (
    <div
      className={clsx(
        'relative overflow-hidden bg-sunken',
        rounded,
        !height && (isVideo ? 'aspect-video' : isImage ? 'max-h-56' : 'aspect-[1.91/1] max-h-40'),
        className,
      )}
      style={height ? { height } : undefined}
    >
      <img
        src={preview.image}
        alt=""
        loading="lazy"
        onError={() => setBroken(true)}
        className={clsx('h-full w-full', isImage && !height ? 'max-h-56 object-contain' : 'object-cover')}
      />
      {isVideo && (
        <span className="absolute left-1/2 top-1/2 grid size-11 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-white/95 text-black shadow-card">
          <Play size={18} fill="currentColor" className="ms-0.5" />
        </span>
      )}
    </div>
  );
}
