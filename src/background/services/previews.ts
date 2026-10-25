import { browser } from 'wxt/browser';
import * as store from '@/core/storage/store';
import { type LinkPreview, parseHtmlPreview, youtubeId } from '@/core/utils/links';

const KEEP = 400;
const RETRY_FAILED_MS = 24 * 3_600_000;
export const SITE_ACCESS = { origins: ['<all_urls>'] };

async function put(entries: [string, LinkPreview][]) {
  if (!entries.length) return;
  await store.update('previews', (all) => {
    const next = { ...all, ...Object.fromEntries(entries) };
    const keys = Object.keys(next);
    if (keys.length > KEEP) {
      keys.sort((a, b) => next[a]!.fetchedAt - next[b]!.fetchedAt);
      for (const k of keys.slice(0, keys.length - KEEP)) delete next[k];
    }
    return next;
  });
}

/** Stores metadata the composer already read from the page you sent. */
export function savePreview(url: string, preview: LinkPreview) {
  return put([[url, { ...preview, fetchedAt: Date.now() }]]);
}

/** YouTube answers oEmbed without page access, so videos get titles even without the optional permission. */
async function fetchYouTube(url: string, id: string): Promise<LinkPreview> {
  try {
    const res = await fetch(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(url)}`, {
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) throw new Error(String(res.status));
    const j = (await res.json()) as { title?: string; author_name?: string };
    return {
      kind: 'video',
      title: j.title,
      siteName: j.author_name ? `YouTube, ${j.author_name}` : 'YouTube',
      image: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
      fetchedAt: Date.now(),
    };
  } catch {
    return { kind: 'video', failed: true, fetchedAt: Date.now() };
  }
}

async function fetchOne(url: string): Promise<LinkPreview> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(6000), credentials: 'omit', redirect: 'follow' });
    const type = res.headers.get('content-type') ?? '';
    if (!res.ok || !type.includes('html')) return { kind: 'web', failed: true, fetchedAt: Date.now() };
    // Metadata lives in <head>; never read more than the first ~300 KB.
    const reader = res.body?.getReader();
    let html = '';
    const decoder = new TextDecoder();
    while (reader && html.length < 300_000) {
      const { done, value } = await reader.read();
      if (done) break;
      html += decoder.decode(value, { stream: true });
      if (/<\/head>/i.test(html)) break;
    }
    void reader?.cancel().catch(() => undefined);
    return parseHtmlPreview(html, res.url || url);
  } catch {
    return { kind: 'web', failed: true, fetchedAt: Date.now() };
  }
}

/** Fetches Open Graph data for feed links, when the user granted site access. */
export async function fetchPreviews(urls: string[]) {
  const settings = await store.get('settings');
  if (!settings.linkPreviews) return;
  const allSites = await browser.permissions.contains(SITE_ACCESS);
  const cache = await store.get('previews');
  const todo = [...new Set(urls)]
    .filter((u) => /^https?:/i.test(u))
    .filter((u) => allSites || youtubeId(u))
    .filter((u) => {
      const hit = cache[u];
      return !hit || (hit.failed && Date.now() - hit.fetchedAt > RETRY_FAILED_MS);
    })
    .slice(0, 24);
  const results: [string, LinkPreview][] = [];
  for (let i = 0; i < todo.length; i += 4) {
    const batch = todo.slice(i, i + 4);
    const done = await Promise.all(
      batch.map(async (u) => {
        const yt = youtubeId(u);
        return [u, yt ? await fetchYouTube(u, yt) : await fetchOne(u)] as [string, LinkPreview];
      }),
    );
    results.push(...done);
  }
  await put(results);
}
