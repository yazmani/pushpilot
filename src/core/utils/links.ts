// What a link points at, and how to preview it without loading the page.

export type LinkKind = 'video' | 'image' | 'article' | 'code' | 'music' | 'map' | 'document' | 'social' | 'shop' | 'web';

export interface LinkPreview {
  title?: string;
  description?: string;
  image?: string;
  siteName?: string;
  kind: LinkKind;
  /** Estimated reading time for articles, in minutes. */
  readMinutes?: number;
  /** Length of the page's main video, in seconds. */
  duration?: number;
  fetchedAt: number;
  failed?: boolean;
}

const VIDEO_HOSTS =
  /(^|\.)(youtube\.com|youtu\.be|vimeo\.com|twitch\.tv|tiktok\.com|dailymotion\.com|netflix\.com|primevideo\.com|disneyplus\.com|loom\.com)$/;
const MUSIC_HOSTS = /(^|\.)(spotify\.com|soundcloud\.com|music\.apple\.com|deezer\.com|bandcamp\.com|tidal\.com)$/;
const CODE_HOSTS = /(^|\.)(github\.com|gitlab\.com|bitbucket\.org|codepen\.io|codesandbox\.io|stackoverflow\.com|npmjs\.com)$/;
const SOCIAL_HOSTS =
  /(^|\.)(x\.com|twitter\.com|instagram\.com|facebook\.com|threads\.net|bsky\.app|reddit\.com|linkedin\.com|mastodon\.social)$/;
const SHOP_HOSTS = /(^|\.)(amazon\.[a-z.]+|ebay\.[a-z.]+|aliexpress\.com|etsy\.com|jumia\.[a-z.]+)$/;
const ARTICLE_HOSTS = /(^|\.)(medium\.com|substack\.com|dev\.to|hashnode\.dev|wikipedia\.org|nytimes\.com|theverge\.com)$/;

function parse(url: string): URL | null {
  try {
    return new URL(url);
  } catch {
    return null;
  }
}

export function linkKind(url: string, ogType?: string, contentType?: string): LinkKind {
  const u = parse(url);
  const host = u?.hostname.replace(/^www\./, '') ?? '';
  const path = u?.pathname.toLowerCase() ?? '';
  if (contentType?.startsWith('image/') || /\.(png|jpe?g|gif|webp|avif|svg|bmp)$/.test(path)) return 'image';
  if (contentType?.startsWith('video/') || /\.(mp4|webm|mov|m4v)$/.test(path)) return 'video';
  if (contentType === 'application/pdf' || /\.(pdf|docx?|xlsx?|pptx?)$/.test(path)) return 'document';
  if (VIDEO_HOSTS.test(host) || ogType?.startsWith('video')) return 'video';
  if (MUSIC_HOSTS.test(host) || ogType?.startsWith('music')) return 'music';
  if (
    (host === 'google.com' && path.startsWith('/maps')) ||
    host.startsWith('maps.') ||
    (host === 'goo.gl' && path.startsWith('/maps'))
  )
    return 'map';
  if (CODE_HOSTS.test(host)) return 'code';
  if (SOCIAL_HOSTS.test(host)) return 'social';
  if (SHOP_HOSTS.test(host) || ogType === 'product') return 'shop';
  if (ARTICLE_HOSTS.test(host) || ogType === 'article') return 'article';
  return 'web';
}

export function youtubeId(url: string): string | null {
  const u = parse(url);
  if (!u) return null;
  const host = u.hostname.replace(/^(www|m|music)\./, '');
  if (host === 'youtu.be') return u.pathname.slice(1) || null;
  if (host === 'youtube.com') {
    if (u.pathname === '/watch') return u.searchParams.get('v');
    const m = u.pathname.match(/^\/(shorts|embed|live)\/([\w-]{6,})/);
    return m?.[2] ?? null;
  }
  return null;
}

/** A preview we can build from the URL alone, no network needed. */
export function urlPreview(url: string): LinkPreview {
  const kind = linkKind(url);
  const yt = youtubeId(url);
  if (yt) return { kind: 'video', image: `https://i.ytimg.com/vi/${yt}/hqdefault.jpg`, siteName: 'YouTube', fetchedAt: 0 };
  if (kind === 'image') return { kind, image: url, fetchedAt: 0 };
  const u = parse(url);
  const gh = u?.hostname === 'github.com' && u.pathname.match(/^\/([^/]+)\/([^/]+)/);
  if (gh)
    return { kind: 'code', image: `https://opengraph.githubassets.com/1/${gh[1]}/${gh[2]}`, siteName: 'GitHub', fetchedAt: 0 };
  return { kind, fetchedAt: 0 };
}

/** Adds a start time to video links that support one (YouTube, Vimeo, Twitch). */
export function withTimestamp(url: string, seconds: number): string {
  const u = parse(url);
  if (!u) return url;
  const s = Math.max(0, Math.floor(seconds));
  const host = u.hostname.replace(/^(www|m)\./, '');
  if (youtubeId(url)) {
    u.searchParams.set('t', `${s}s`);
    return u.toString();
  }
  if (host === 'vimeo.com') {
    u.hash = `t=${s}s`;
    return u.toString();
  }
  if (host === 'twitch.tv') {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    u.searchParams.set('t', `${h}h${m}m${s % 60}s`);
    return u.toString();
  }
  return url;
}

export function supportsTimestamp(url: string): boolean {
  const host = parse(url)?.hostname.replace(/^(www|m)\./, '') ?? '';
  return !!youtubeId(url) || host === 'vimeo.com' || host === 'twitch.tv';
}

export function formatDuration(seconds: number): string {
  const s = Math.floor(seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`;
}

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

function decode(text: string): string {
  return text
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([\da-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&(\w+);/g, (m, name) => ENTITIES[name] ?? m)
    .trim();
}

/** Reads Open Graph / Twitter / <title> metadata from raw HTML (no DOM in the service worker). */
export function parseHtmlPreview(html: string, pageUrl: string): LinkPreview {
  const head = html.slice(0, 200_000);
  const meta = (key: string) => {
    const re = new RegExp(
      `<meta[^>]+(?:property|name)=["']${key}["'][^>]*content=["']([^"']*)["']|<meta[^>]+content=["']([^"']*)["'][^>]*(?:property|name)=["']${key}["']`,
      'i',
    );
    const m = head.match(re);
    const v = m?.[1] ?? m?.[2];
    return v ? decode(v) : undefined;
  };
  const title = meta('og:title') ?? meta('twitter:title') ?? head.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1];
  let image = meta('og:image') ?? meta('og:image:url') ?? meta('twitter:image');
  if (image) {
    try {
      image = new URL(image, pageUrl).toString();
    } catch {
      image = undefined;
    }
  }
  const ogType = meta('og:type');
  return {
    title: title ? decode(title) : undefined,
    description: meta('og:description') ?? meta('description') ?? meta('twitter:description'),
    image,
    siteName: meta('og:site_name'),
    kind: linkKind(pageUrl, ogType),
    fetchedAt: Date.now(),
  };
}

/** Whether two URLs are the same page (ignoring www., trailing slashes, query noise; YouTube by video). */
export function samePage(a: string, b: string): boolean {
  try {
    const x = new URL(a);
    const y = new URL(b);
    const path = (u: URL) => u.pathname.replace(/\/+$/, '') || '/';
    return (
      x.hostname.replace(/^(www|m)\./, '') === y.hostname.replace(/^(www|m)\./, '') &&
      path(x) === path(y) &&
      youtubeId(a) === youtubeId(b)
    );
  } catch {
    return true;
  }
}

/**
 * Drops unread counters like "(3) " and a trailing " - YouTube" / " | Site".
 * A homepage whose title *is* the site name keeps it.
 */
export function cleanTitle(title: string, siteName?: string): string {
  let t = title.replace(/^\(\d+\+?\)\s+/, '').trim();
  for (const site of [siteName, 'YouTube'].filter(Boolean) as string[]) {
    for (const sep of [' - ', ' | ', ' – ', ' — ']) {
      if (t.endsWith(sep + site)) t = t.slice(0, -(sep + site).length).trim();
    }
  }
  return t;
}
