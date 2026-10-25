import { describe, expect, it } from 'vitest';
import {
  cleanTitle,
  formatDuration,
  linkKind,
  parseHtmlPreview,
  samePage,
  supportsTimestamp,
  urlPreview,
  withTimestamp,
  youtubeId,
} from '@/core/utils/links';

describe('linkKind', () => {
  it.each([
    ['https://www.youtube.com/watch?v=aqz-KE-bpKQ', 'video'],
    ['https://vimeo.com/76979871', 'video'],
    ['https://example.com/photo.JPG', 'image'],
    ['https://example.com/report.pdf', 'document'],
    ['https://github.com/wxt-dev/wxt', 'code'],
    ['https://open.spotify.com/track/1', 'music'],
    ['https://www.google.com/maps/place/Paris', 'map'],
    ['https://x.com/someone/status/1', 'social'],
    ['https://www.amazon.fr/dp/B000', 'shop'],
    ['https://en.wikipedia.org/wiki/Paper_plane', 'article'],
    ['https://example.com/', 'web'],
  ])('%s is %s', (url, kind) => {
    expect(linkKind(url)).toBe(kind);
  });

  it('trusts og:type and the document content type', () => {
    expect(linkKind('https://example.com/post', 'article')).toBe('article');
    expect(linkKind('https://cdn.example.com/x', undefined, 'image/webp')).toBe('image');
  });
});

describe('youtubeId', () => {
  it.each([
    ['https://www.youtube.com/watch?v=aqz-KE-bpKQ&t=10', 'aqz-KE-bpKQ'],
    ['https://youtu.be/aqz-KE-bpKQ', 'aqz-KE-bpKQ'],
    ['https://m.youtube.com/shorts/abcdefghijk', 'abcdefghijk'],
    ['https://www.youtube.com/embed/aqz-KE-bpKQ', 'aqz-KE-bpKQ'],
    ['https://www.youtube.com/feed/subscriptions', null],
    ['not a url', null],
  ])('%s → %s', (url, id) => {
    expect(youtubeId(url)).toBe(id);
  });
});

describe('timestamps', () => {
  it('adds a start time where the site supports one', () => {
    expect(withTimestamp('https://www.youtube.com/watch?v=aqz-KE-bpKQ', 754.9)).toBe(
      'https://www.youtube.com/watch?v=aqz-KE-bpKQ&t=754s',
    );
    expect(withTimestamp('https://vimeo.com/76979871', 90)).toBe('https://vimeo.com/76979871#t=90s');
    expect(withTimestamp('https://www.twitch.tv/videos/1', 3723)).toBe('https://www.twitch.tv/videos/1?t=1h2m3s');
    expect(withTimestamp('https://example.com/video', 60)).toBe('https://example.com/video');
  });

  it('knows which sites support it', () => {
    expect(supportsTimestamp('https://youtu.be/aqz-KE-bpKQ')).toBe(true);
    expect(supportsTimestamp('https://example.com')).toBe(false);
  });

  it('formats durations', () => {
    expect(formatDuration(59)).toBe('0:59');
    expect(formatDuration(213)).toBe('3:33');
    expect(formatDuration(7225)).toBe('2:00:25');
  });
});

describe('urlPreview', () => {
  it('builds YouTube thumbnails from the video id', () => {
    expect(urlPreview('https://youtu.be/aqz-KE-bpKQ')).toMatchObject({
      kind: 'video',
      image: 'https://i.ytimg.com/vi/aqz-KE-bpKQ/hqdefault.jpg',
    });
  });

  it('uses the image itself for image links', () => {
    expect(urlPreview('https://example.com/a.png').image).toBe('https://example.com/a.png');
  });

  it('uses GitHub social cards for repositories', () => {
    expect(urlPreview('https://github.com/wxt-dev/wxt/issues').image).toBe('https://opengraph.githubassets.com/1/wxt-dev/wxt');
  });
});

describe('parseHtmlPreview', () => {
  const html = `<!doctype html><html><head>
    <title>Fallback &amp; title</title>
    <meta content="Shared title" property="og:title">
    <meta property="og:description" content="It&#39;s a &quot;description&quot;">
    <meta property="og:image" content="/img/card.png">
    <meta property="og:site_name" content="Example">
    <meta property="og:type" content="article">
  </head><body></body></html>`;

  it('reads Open Graph tags in either attribute order and resolves relative images', () => {
    expect(parseHtmlPreview(html, 'https://example.com/post/1')).toMatchObject({
      title: 'Shared title',
      description: 'It\'s a "description"',
      image: 'https://example.com/img/card.png',
      siteName: 'Example',
      kind: 'article',
    });
  });

  it('falls back to <title>', () => {
    expect(parseHtmlPreview('<title>Only &amp; this</title>', 'https://example.com').title).toBe('Only & this');
  });
});

describe('cleanTitle', () => {
  it('drops unread counters and site suffixes', () => {
    expect(cleanTitle('(3) Big Buck Bunny - YouTube')).toBe('Big Buck Bunny');
    expect(cleanTitle('Release notes | Example', 'Example')).toBe('Release notes');
  });

  it('keeps a homepage title that is the site name', () => {
    expect(cleanTitle('appstorrent - games for macOS', 'appstorrent - games for macOS')).toBe('appstorrent - games for macOS');
  });
});

describe('samePage', () => {
  it('ignores www and trailing slashes', () => {
    expect(samePage('https://www.example.com/a/', 'https://example.com/a')).toBe(true);
  });

  it('tells YouTube videos apart even though the path is the same', () => {
    expect(samePage('https://www.youtube.com/watch?v=a', 'https://www.youtube.com/watch?v=b')).toBe(false);
    expect(samePage('https://www.youtube.com/', 'https://www.youtube.com/watch?v=b')).toBe(false);
  });
});
