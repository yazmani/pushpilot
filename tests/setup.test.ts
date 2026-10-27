import { describe, expect, it } from 'vitest';
import type { Device, Push } from '@/core/pushbullet/types';
import { issueKey, setupIssues } from '@/core/setup';

const NOW = 1_800_000_000;
const DAY = 86_400;

function device(over: Partial<Device>): Device {
  return { iden: 'd', active: true, created: NOW - 400 * DAY, modified: NOW - DAY, pushable: true, ...over };
}
const phone = (over: Partial<Device> = {}) =>
  device({ iden: 'phone', nickname: 'Pixel', type: 'android', icon: 'phone', ...over });
const browserDevice = (over: Partial<Device> = {}) =>
  device({ iden: 'chrome', nickname: 'Chrome', type: 'chrome', icon: 'browser', ...over });

const kinds = (devices: Device[], pushes: Push[] = []) => setupIssues(devices, { pushes, now: NOW }).map(issueKey);

describe('setupIssues', () => {
  it('is quiet when a phone is connected and active', () => {
    expect(kinds([phone(), browserDevice()])).toEqual([]);
  });

  it('notices when there is no phone at all', () => {
    expect(kinds([browserDevice()])).toEqual(['noPhone']);
  });

  it('flags a phone that stopped taking pushes recently', () => {
    expect(kinds([phone({ pushable: false, modified: NOW - 10 * DAY }), browserDevice()])).toEqual(['phoneGone:phone']);
  });

  it('leaves alone a phone that was retired long ago', () => {
    expect(kinds([phone({ pushable: false, modified: NOW - 300 * DAY }), browserDevice()])).toEqual([]);
  });

  it('flags a connected phone with no sign of life for two months', () => {
    expect(kinds([phone({ modified: NOW - 70 * DAY })])).toEqual(['quiet:phone']);
  });

  it('counts a recent push from the phone as a sign of life', () => {
    const push = { iden: 'p', created: NOW - 2 * DAY, source_device_iden: 'phone' } as Push;
    expect(kinds([phone({ modified: NOW - 70 * DAY })], [push])).toEqual([]);
  });

  it('flags two connected devices with the same name', () => {
    expect(kinds([phone(), browserDevice(), browserDevice({ iden: 'chrome2' })])).toEqual(['sameName:Chrome']);
  });

  it('ignores a duplicate name on a device that no longer takes pushes', () => {
    expect(kinds([phone(), browserDevice(), browserDevice({ iden: 'chrome2', pushable: false })])).toEqual([]);
  });
});
