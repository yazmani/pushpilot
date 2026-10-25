import { Check, Copy, Download, ExternalLink, Trash } from 'lucide-react';
import { call } from '@/core/messaging/rpc';
import type { Chat, Device, Push, Subscription, User } from '@/core/pushbullet/types';
import { deviceName, host, isImage, looksLikeUrl, personName, pushOpenUrl, pushText, timeAgo } from '@/core/utils/format';
import { Avatar, IconButton, LinkThumb, TypeTile } from '@/ui/components';
import { type LinkPreview, urlPreview, youtubeId } from '@/core/utils/links';
import { useNow } from '@/ui/hooks/use-now';
import { useRun, useToast } from '@/ui/hooks/use-toast';
import { counterpart } from './classify';

export interface FeedContext {
  devices: Device[];
  chats: Chat[];
  subscriptions: Subscription[];
  me: User | null;
  selfDeviceIden: string | null;
  previews: Record<string, LinkPreview>;
}

function describe(p: Push, ctx: FeedContext, who: string | null, chat?: Chat, sub?: Subscription): string {
  const source = ctx.devices.find((d) => d.iden === p.source_device_iden);
  const target = ctx.devices.find((d) => d.iden === p.target_device_iden);
  const fromHere = !!source && source.iden === ctx.selfDeviceIden;
  const toHere = !!target && target.iden === ctx.selfDeviceIden;
  if (sub) return sub.channel.name;
  if (who) return p.direction === 'incoming' ? `From ${p.sender_name || personName(chat, who)}` : `To ${personName(chat, who)}`;
  if (fromHere && toHere) return 'Saved for later';
  if (fromHere) return `Sent to ${target ? deviceName(target) : 'all devices'}`;
  if (source && toHere) return `From ${deviceName(source)}`;
  if (source && target) return `${deviceName(source)} to ${deviceName(target)}`;
  if (source) return `From ${deviceName(source)} to all devices`;
  if (toHere) return 'Sent to this browser';
  if (target) return `Sent to ${deviceName(target)}`;
  return 'Sent to all devices';
}

/** What we know about a link: fetched or saved metadata over what the URL alone says. */
function mergePreview(url: string, cached?: LinkPreview): LinkPreview {
  const base = urlPreview(url);
  if (!cached || cached.failed) return base;
  const known = Object.fromEntries(Object.entries(cached).filter(([, v]) => v !== undefined && v !== '')) as Partial<LinkPreview>;
  const merged = { ...base, ...known };
  // A bare site name ("YouTube") isn't a title, and a video's own thumbnail beats a site logo.
  if (merged.title && merged.title === merged.siteName?.split(',')[0]) delete merged.title;
  if (youtubeId(url)) merged.image = base.image;
  return merged;
}

export function FeedItem({
  push: p,
  ctx,
  isNew,
  onPerson,
}: {
  push: Push;
  ctx: FeedContext;
  isNew: boolean;
  onPerson: (email: string) => void;
}) {
  useNow();
  const notify = useToast();
  const run = useRun();
  const who = counterpart(p, ctx.me);
  const chat = who ? ctx.chats.find((c) => c.with.email_normalized === who) : undefined;
  const sub = p.channel_iden ? ctx.subscriptions.find((s) => s.channel.iden === p.channel_iden) : undefined;
  const url = pushOpenUrl(p);
  const preview = p.type === 'link' && p.url ? mergePreview(p.url, ctx.previews[p.url]) : undefined;
  // Some apps send the address itself as the title; a real page title reads better.
  const pushTitle = p.title && p.title !== p.url && !looksLikeUrl(p.title) ? p.title : undefined;
  const title =
    p.type === 'link'
      ? pushTitle ||
        preview?.title ||
        (preview?.kind === 'video' ? `${preview.siteName?.split(',')[0] ?? host(p.url)} video` : host(p.url))
      : p.type === 'file'
        ? p.file_name || 'File'
        : p.title || '';
  const site = preview ? preview.siteName?.split(',')[0] || host(p.url) : undefined;
  const subtitle = p.body || preview?.description || site;
  const imageFile = isImage(p) ? (p.image_url ? `${p.image_url}=s160` : p.file_url) : undefined;

  // Every row gets the same 16:9 slot, so text lines up and pictures stay big
  // enough to recognise. People and channels sit centred in it.
  const leading = sub ? (
    <span className="grid h-12 w-[85px] place-items-center rounded-xl bg-raised">
      <Avatar src={sub.channel.image_url} name={sub.channel.name} size={36} />
    </span>
  ) : who ? (
    <button
      onClick={() => onPerson(who)}
      aria-label={`Open conversation with ${personName(chat, who)}`}
      className="grid h-12 w-[85px] place-items-center rounded-xl bg-raised"
    >
      <Avatar src={chat?.with.image_url} name={personName(chat, who)} size={36} />
    </button>
  ) : preview ? (
    <LinkThumb preview={preview} url={url} size={48} shape="wide" />
  ) : imageFile ? (
    <img src={imageFile} alt="" loading="lazy" className="h-12 w-[85px] shrink-0 rounded-xl object-cover ring-1 ring-black/5" />
  ) : (
    <TypeTile type={p.type} size={48} width={85} />
  );

  return (
    <li className="group relative flex items-start gap-3 px-3.5 py-3 transition-colors hover:bg-raised/50">
      {isNew && <span className="absolute left-1.5 top-[26px] size-1.5 rounded-full bg-accent" aria-label="New" />}
      <a href={url} target="_blank" rel="noreferrer" tabIndex={-1} className={url ? 'shrink-0' : 'pointer-events-none shrink-0'}>
        {leading}
      </a>

      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-2">
          {title ? (
            url ? (
              <a
                href={url}
                target="_blank"
                rel="noreferrer"
                className="line-clamp-2 min-w-0 flex-1 break-words text-[13px] font-bold leading-snug hover:text-accent-strong"
              >
                {title}
              </a>
            ) : (
              <p className="line-clamp-2 min-w-0 flex-1 break-words text-[13px] font-bold leading-snug">{title}</p>
            )
          ) : (
            <p className="line-clamp-3 min-w-0 flex-1 whitespace-pre-wrap break-words text-[13px] leading-snug">{p.body}</p>
          )}
          <time className="mt-px shrink-0 text-2xs font-medium text-faint" title={new Date(p.created * 1000).toLocaleString()}>
            {timeAgo(p.created)}
          </time>
        </div>
        {title && subtitle && (
          <p className="mt-0.5 line-clamp-2 whitespace-pre-wrap break-words text-xs leading-relaxed text-muted">{subtitle}</p>
        )}
        <div className="mt-0.5 flex h-5 items-center gap-2">
          <p className="min-w-0 flex-1 truncate text-2xs font-medium text-faint">{describe(p, ctx, who, chat, sub)}</p>
          <div className="-mr-1.5 flex items-center opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
            {url && (
              <IconButton
                label={p.type === 'file' ? 'Download' : 'Open'}
                className="size-6"
                onClick={() => window.open(url, '_blank')}
              >
                {p.type === 'file' ? <Download size={14} /> : <ExternalLink size={14} />}
              </IconButton>
            )}
            <IconButton
              label="Copy"
              className="size-6"
              onClick={async () => {
                await navigator.clipboard.writeText(pushText(p));
                notify('Copied');
              }}
            >
              <Copy size={14} />
            </IconButton>
            {!p.dismissed && p.direction !== 'outgoing' && (
              <IconButton
                label="Mark as done"
                className="size-6"
                onClick={() => run(() => call('push.dismiss', { iden: p.iden }), 'Marked as done')}
              >
                <Check size={14} />
              </IconButton>
            )}
            <IconButton
              label="Delete everywhere"
              className="size-6 hover:!text-danger"
              onClick={() => run(() => call('push.delete', { iden: p.iden }), 'Deleted')}
            >
              <Trash size={14} />
            </IconButton>
          </div>
        </div>
      </div>
    </li>
  );
}
