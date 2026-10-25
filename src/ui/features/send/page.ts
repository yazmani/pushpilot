import { browser, type Browser } from 'wxt/browser';
import { host } from '@/core/utils/format';
import { cleanTitle, type LinkPreview, linkKind, samePage, urlPreview, youtubeId } from '@/core/utils/links';

export interface PageInfo {
  url: string;
  title: string;
  favIconUrl?: string;
  tabId?: number;
  preview: LinkPreview;
  /** Text selected on the page when Pushpilot opened. */
  selection?: string;
  /** Where the page's video is, if one is playing or paused part-way. */
  videoTime?: number;
  /** The tab is showing an image file directly. */
  isImageTab?: boolean;
}

interface Scraped {
  title?: string;
  description?: string;
  image?: string;
  siteName?: string;
  ogType?: string;
  ogUrl?: string;
  contentType: string;
  words: number;
  selection: string;
  videoTime?: number;
  videoDuration?: number;
}

// Runs inside the page. Must be self-contained: it's serialised by executeScript.
function scrape(): Scraped {
  const meta = (sel: string) => document.querySelector(sel)?.getAttribute('content') || undefined;
  const abs = (u?: string) => {
    try {
      return u ? new URL(u, location.href).toString() : undefined;
    } catch {
      return undefined;
    }
  };
  const video = [...document.querySelectorAll('video')].sort((a, b) => b.clientWidth - a.clientWidth)[0];
  const text = document.querySelector('article')?.textContent ?? document.body?.innerText ?? '';
  return {
    title: meta('meta[property="og:title"]') || meta('meta[name="twitter:title"]') || document.title,
    description: meta('meta[property="og:description"]') || meta('meta[name="description"]'),
    image: abs(meta('meta[property="og:image"]') || meta('meta[name="twitter:image"]')),
    siteName: meta('meta[property="og:site_name"]'),
    ogType: meta('meta[property="og:type"]'),
    ogUrl: abs(
      meta('meta[property="og:url"]') || document.querySelector('link[rel="canonical"]')?.getAttribute('href') || undefined,
    ),
    contentType: document.contentType,
    words: text.split(/\s+/).length,
    selection: (getSelection()?.toString() ?? '').trim().slice(0, 4000),
    videoTime: video && video.currentTime > 3 ? Math.floor(video.currentTime) : undefined,
    videoDuration: video && Number.isFinite(video.duration) ? Math.floor(video.duration) : undefined,
  };
}

/**
 * Reads the active tab and, when Chrome lets us (the toolbar click grants
 * access to the page), its Open Graph metadata, selection and video position.
 */
export async function readPage(tab: Browser.tabs.Tab): Promise<PageInfo> {
  const url = tab.url!;
  const base: PageInfo = { url, title: tab.title || '', favIconUrl: tab.favIconUrl, tabId: tab.id, preview: urlPreview(url) };
  if (tab.id === undefined) return base;
  try {
    const [res] = await browser.scripting.executeScript({ target: { tabId: tab.id }, func: scrape });
    const s = res?.result as Scraped | undefined;
    if (!s) return base;
    // Single-page apps (YouTube, X, Reddit…) change videos and posts without
    // reloading, leaving <head> describing the first page you opened. If the
    // tags point somewhere else, ignore them rather than show the wrong card.
    const yt = youtubeId(url);
    const tabTitle = cleanTitle(tab.title || '', s.siteName);
    // YouTube keeps document.title current but can leave og:title/description
    // behind, so there the tags only count when their title matches the tab's.
    const stale = (!!s.ogUrl && !samePage(s.ogUrl, url)) || (!!yt && cleanTitle(s.title ?? '', s.siteName) !== tabTitle);
    const og: Partial<Scraped> = stale ? { siteName: s.siteName } : s;
    const title = (yt ? tabTitle : '') || cleanTitle(og.title ?? '', og.siteName) || tabTitle || host(url);
    const kind = linkKind(url, og.ogType, s.contentType);
    return {
      ...base,
      title,
      selection: s.selection || undefined,
      videoTime: s.videoTime,
      isImageTab: s.contentType.startsWith('image/'),
      preview: {
        title: title || undefined,
        description: og.description,
        // A YouTube video's own thumbnail beats whatever og:image says.
        image: (yt ? base.preview.image : og.image) ?? base.preview.image ?? (kind === 'image' ? url : undefined),
        siteName: og.siteName ?? base.preview.siteName,
        kind,
        readMinutes: kind === 'article' || (kind === 'web' && s.words > 600) ? Math.max(1, Math.round(s.words / 230)) : undefined,
        duration: s.videoDuration,
        fetchedAt: Date.now(),
      },
    };
  } catch {
    // No access to this page (side panel, chrome:// pages, the Web Store…).
    return base;
  }
}

/** Grabs the image an image tab is showing, as a file ready to upload. */
export async function grabImage(tabId: number, url: string): Promise<File | null> {
  try {
    const [res] = await browser.scripting.executeScript({
      target: { tabId },
      func: async () => {
        const blob = await (await fetch(location.href)).blob();
        return await new Promise<string>((resolve) => {
          const fr = new FileReader();
          fr.onload = () => resolve(fr.result as string);
          fr.readAsDataURL(blob);
        });
      },
    });
    const dataUrl = res?.result as string | undefined;
    if (!dataUrl) return null;
    const blob = await (await fetch(dataUrl)).blob();
    const name = decodeURIComponent(new URL(url).pathname.split('/').pop() || 'image') || 'image';
    return new File([blob], /\.\w{2,5}$/.test(name) ? name : `${name}.${blob.type.split('/')[1] ?? 'png'}`, { type: blob.type });
  } catch {
    return null;
  }
}
