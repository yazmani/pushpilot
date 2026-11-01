import { describe, expect, it, vi } from 'vitest';
import type { Device } from '@/core/pushbullet/types';

// The service module talks to the background session; only the pure picker is under test.
vi.mock('@/background/session', () => ({ guard: vi.fn(), requireClient: vi.fn() }));
const { abandonedTwin } = await import('@/background/services/account');

const NOW = 1_800_000_000;
const DAY = 86_400;
const device = (over: Partial<Device>): Device => ({
  iden: 'd',
  active: true,
  created: NOW - 400 * DAY,
  modified: NOW - 60 * DAY,
  nickname: 'Brave on macOS',
  manufacturer: 'Pushpilot',
  type: 'chrome',
  ...over,
});
const pick = (devices: Device[]) => abandonedTwin(devices, 'Brave on macOS', null, NOW)?.iden;

describe('abandonedTwin', () => {
  it('reuses an abandoned Pushpilot device with the same name', () => {
    expect(pick([device({ iden: 'old' })])).toBe('old');
  });

  it('never takes one that checked in recently: it may be another computer', () => {
    expect(pick([device({ iden: 'live', modified: NOW - 3 * DAY })])).toBeUndefined();
  });

  it('leaves other names and devices that Pushpilot did not register alone', () => {
    expect(pick([device({ nickname: 'Chrome on macOS' }), device({ manufacturer: 'Google' })])).toBeUndefined();
  });

  it('picks the most recently used of several abandoned ones', () => {
    expect(
      pick([device({ iden: 'older', modified: NOW - 300 * DAY }), device({ iden: 'newer', modified: NOW - 40 * DAY })]),
    ).toBe('newer');
  });

  it('skips inactive devices and the one to exclude', () => {
    expect(
      abandonedTwin([device({ iden: 'x', active: false }), device({ iden: 'saved' })], 'Brave on macOS', 'saved', NOW),
    ).toBeUndefined();
  });
});
