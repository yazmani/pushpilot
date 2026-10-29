import { describe, expect, it } from 'vitest';
import { extractCode, formatPhone, host, isReachable, looksLikeUrl, normalizeUrl } from '@/core/utils/format';
import type { Device } from '@/core/pushbullet/types';

describe('extractCode strict', () => {
  it('finds codes next to a code word', () => {
    expect(extractCode('Your Northwind verification code is 739204.', { strict: true })).toBe('739204');
    expect(extractCode('482913 is your sign-in code', { strict: true })).toBe('482913');
  });

  it('ignores lone numbers like order numbers and short codes', () => {
    expect(extractCode('Votre colis no 423161277 arrive demain. STOP 33800', { strict: true })).toBeUndefined();
    expect(extractCode('Christmas sale! Reply STOP to 36191', { strict: true })).toBeUndefined();
  });
});

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

describe('formatPhone', () => {
  it('shows international numbers the way the phone does', () => {
    expect(formatPhone('+33612345678', 'US')).toBe('+33 6 12 34 56 78');
    expect(formatPhone('+12025550142', 'FR')).toBe('+1 202 555 0142');
  });

  it('shows numbers from the browser’s own country in the national format', () => {
    expect(formatPhone('+33612345678', 'FR')).toBe('06 12 34 56 78');
    expect(formatPhone('0612345678', 'FR')).toBe('06 12 34 56 78');
    expect(formatPhone('+12025550142', 'US')).toBe('(202) 555-0142');
  });

  it('leaves names, short codes and odd numbers alone', () => {
    expect(formatPhone('Orange', 'FR')).toBe('Orange');
    expect(formatPhone('36191', 'FR')).toBe('36191');
    expect(formatPhone('555', 'US')).toBe('555');
    expect(formatPhone('+15550142', 'US')).toBe('+15550142');
    expect(formatPhone('0612345678', undefined)).toBe('0612345678');
  });
});
