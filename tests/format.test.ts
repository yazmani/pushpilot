import { describe, expect, it } from 'vitest';
import { extractCode, host, isReachable, looksLikeUrl, normalizeUrl } from '@/core/utils/format';
import type { Device } from '@/core/pushbullet/types';

describe('extractCode', () => {
  it.each([
    ['Your verification code is 482913. Never share it.', '482913'],
    ['G-731904 is your Google verification code.', '731904'],
    ['Code: 5521', '5521'],
    ['Votre code de connexion : 908172', '908172'],
    ['Use 12345678 to sign in', '12345678'],
  ])('finds the code in "%s"', (text, code) => {
    expect(extractCode(text)).toBe(code);
  });

  it.each(['Your order total is $1,250.00', 'Meeting at 10:30 on 2026-10-25', 'Call me back'])('ignores "%s"', (text) => {
    expect(extractCode(text)).toBeUndefined();
  });
});

describe('urls', () => {
  it('normalizes bare domains', () => {
    expect(normalizeUrl('example.com/a')).toBe('https://example.com/a');
    expect(normalizeUrl('mailto:a@b.c')).toBe('mailto:a@b.c');
  });

  it('recognises a pasted link', () => {
    expect(looksLikeUrl('  https://example.com/x ')).toBe(true);
    expect(looksLikeUrl('www.example.com')).toBe(true);
    expect(looksLikeUrl('see https://example.com')).toBe(false);
  });

  it('recognises a bare address, not a file name', () => {
    expect(looksLikeUrl('chromewebstore.google.com/detail/x')).toBe(true);
    expect(looksLikeUrl('example.com')).toBe(true);
    expect(looksLikeUrl('news.site.dev/a?b=1')).toBe(true);
    expect(looksLikeUrl('notes.md')).toBe(false);
    expect(looksLikeUrl('file.txt')).toBe(false);
    expect(looksLikeUrl('v1.2')).toBe(false);
  });

  it('shows a short host', () => {
    expect(host('https://www.example.com/path')).toBe('example.com');
  });
});

describe('isReachable', () => {
  const device = (patch: Partial<Device>): Device => ({ iden: 'd', active: true, created: 0, modified: 0, ...patch });
  it('treats pushable:false registrations as unreachable', () => {
    expect(isReachable(device({}))).toBe(true);
    expect(isReachable(device({ pushable: false }))).toBe(false);
    expect(isReachable(device({ active: false }))).toBe(false);
  });
});
