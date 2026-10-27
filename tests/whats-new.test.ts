import { describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { minorVersion, WHATS_NEW } from '@/core/whats-new';
import pkg from '../package.json';

describe("what's new", () => {
  it('keys notes by minor version', () => {
    expect(minorVersion('1.1.3')).toBe('1.1');
    expect(minorVersion('2.0.0')).toBe('2.0');
  });

  it('has notes for the version being released', () => {
    // The fake browser has no message catalog; any string will do here.
    vi.spyOn(fakeBrowser.i18n, 'getMessage').mockImplementation((key: string) => key);
    expect(WHATS_NEW[minorVersion(pkg.version)]?.().length).toBeGreaterThan(0);
  });
});
