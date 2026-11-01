import clsx from 'clsx';
import { File, Globe, Laptop, Link2, Monitor, Server, Smartphone, StickyNote, Tablet, User, Watch } from 'lucide-react';
import type { Device, PushType } from '@/core/pushbullet/types';

/** Pushpilot's mark: a paper plane. Mirrors src/assets/logo.svg. */
export function Logo({ size = 24, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 128 128" aria-hidden="true" className={className}>
      <defs>
        <linearGradient id="pp-bg" x1="0" y1="0" x2="128" y2="128" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#2BCB74" />
          <stop offset="1" stopColor="#0B8545" />
        </linearGradient>
      </defs>
      <rect width="128" height="128" rx="28" fill="url(#pp-bg)" />
      <LogoGlyph ink="#fff" fold="#B9F2D1" />
    </svg>
  );
}

/** The plane on its own for coloured backgrounds like the header band: white with a mint fold. */
export function LogoMark({ size = 22, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="14 18 98 98" aria-hidden="true" className={className}>
      <LogoGlyph ink="#fff" fold="#B9F2D1" />
    </svg>
  );
}

// Plane drawn in a 128 box, optically centred, corners softened by round joins.
function LogoGlyph({ ink, fold, foldOpacity = 1 }: { ink: string; fold: string; foldOpacity?: number }) {
  return (
    <g transform="translate(61 66) scale(1.1) translate(-64 -64)" strokeLinejoin="round" strokeWidth="5">
      <path d="M30 64 L98 24 L76 104 L56 84 L40 98 L44 76 Z" fill={ink} stroke={ink} />
      <path d="M44 76 L98 24 L56 84 L40 98 Z" fill={fold} stroke={fold} fillOpacity={foldOpacity} strokeOpacity={foldOpacity} />
    </g>
  );
}

export function Avatar({ src, name, size = 28, className }: { src?: string; name?: string; size?: number; className?: string }) {
  const initials = (name || '?')
    .split(/[\s@._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('');
  if (src) {
    return (
      <img
        src={src}
        alt=""
        className={clsx('shrink-0 rounded-full bg-raised object-cover', className)}
        style={{ width: size, height: size }}
      />
    );
  }
  // Phone numbers and short codes have no meaningful initials.
  const numeric = /^[\d+(\s]/.test(name ?? '');
  return (
    <span
      aria-hidden="true"
      className={clsx('grid shrink-0 place-items-center rounded-full bg-accent-soft font-bold text-accent-strong', className)}
      style={{ width: size, height: size, fontSize: Math.max(10, size * 0.38) }}
    >
      {numeric ? <User size={size * 0.48} strokeWidth={2} /> : initials}
    </span>
  );
}

export function DeviceGlyph({ device, size = 16 }: { device?: Pick<Device, 'icon' | 'type'>; size?: number }) {
  const icon = device?.icon ?? (device?.type === 'android' || device?.type === 'ios' ? 'phone' : 'desktop');
  const props = { size, strokeWidth: 1.8, 'aria-hidden': true } as const;
  switch (icon) {
    case 'phone':
      return <Smartphone {...props} />;
    case 'tablet':
      return <Tablet {...props} />;
    case 'laptop':
      return <Laptop {...props} />;
    case 'watch':
      return <Watch {...props} />;
    case 'browser':
    case 'website':
      return <Globe {...props} />;
    case 'system':
      return <Server {...props} />;
    default:
      return <Monitor {...props} />;
  }
}

const TYPE_STYLE: Record<PushType, string> = {
  link: 'bg-link-bg text-link-fg',
  note: 'bg-note-bg text-note-fg',
  file: 'bg-file-bg text-file-fg',
};

/** Tinted tile that tells links, notes and files apart at a glance. */
export function TypeTile({
  type,
  size = 32,
  width,
  icon,
  label,
}: {
  type: PushType;
  size?: number;
  width?: number;
  /** A more specific icon (a film for videos, say). */
  icon?: typeof File;
  /** Short text under the icon, like a file's extension. */
  label?: string;
}) {
  const Icon = icon ?? (type === 'link' ? Link2 : type === 'file' ? File : StickyNote);
  return (
    <span
      className={clsx(
        'flex shrink-0 flex-col items-center justify-center gap-0.5',
        size >= 40 ? 'rounded-xl' : 'rounded-[10px]',
        TYPE_STYLE[type],
      )}
      style={{ width: width ?? size, height: size }}
    >
      <Icon size={label ? size * 0.36 : size * 0.48} strokeWidth={2} aria-hidden="true" />
      {label && <span className="text-[9px] font-extrabold leading-none tracking-wide">{label}</span>}
    </span>
  );
}

/** Site icon via Chrome's _favicon API (needs the "favicon" permission). Firefox has no equivalent. */
export function Favicon({ url, size = 16, className }: { url?: string; size?: number; className?: string }) {
  if (!url || import.meta.env.FIREFOX) return null;
  return (
    <img
      src={`/_favicon/?pageUrl=${encodeURIComponent(url)}&size=${size * 2}`}
      alt=""
      width={size}
      height={size}
      onError={(e) => (e.currentTarget.style.visibility = 'hidden')}
      className={clsx('shrink-0 rounded-[4px]', className)}
    />
  );
}
