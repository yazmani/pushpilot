import type { Device, Mirror, Push } from '@/core/pushbullet/types';
import { deviceCategory, deviceName, isReachable } from '@/core/utils/format';

const DAY = 24 * 60 * 60;
/** A connected phone that hasn't shown a sign of life for this long has probably stopped working. */
export const QUIET_AFTER = 60 * DAY;
/** A phone that dropped off longer ago than this was likely replaced on purpose. */
const GONE_RECENTLY = 90 * DAY;

export type SetupIssue =
  /** No phone or tablet on the account at all. */
  | { kind: 'noPhone' }
  /** The phone is still listed but no longer takes pushes (signed out, app removed, token expired). */
  | { kind: 'phoneGone'; device: Device }
  /** The phone says it's connected, yet nothing has come from it for a long time. */
  | { kind: 'quiet'; device: Device; since: number }
  /** Two connected devices share a name, so it's a guess which one you're sending to. */
  | { kind: 'sameName'; name: string };

export function isPhone(d: Device): boolean {
  const c = deviceCategory(d);
  return c === 'phone' || c === 'tablet' || !!d.has_sms;
}

/** The newest sign that a device is alive: its own record, or anything it sent. */
export function lastActivity(d: Device, pushes: Push[], mirrors: Mirror[]): number {
  let t = d.modified;
  for (const p of pushes) if (p.source_device_iden === d.iden && p.created > t) t = p.created;
  for (const m of mirrors) if (m.source_device_iden === d.iden && m.created > t) t = m.created;
  return t;
}

/** Stable key for remembering that an issue was dismissed. */
export function issueKey(i: SetupIssue): string {
  switch (i.kind) {
    case 'noPhone':
      return 'noPhone';
    case 'phoneGone':
    case 'quiet':
      return `${i.kind}:${i.device.iden}`;
    case 'sameName':
      return `sameName:${i.name}`;
  }
}

/** Things about the account's devices that quietly stop pushes from getting through. */
export function setupIssues(
  devices: Device[],
  { pushes = [], mirrors = [], now = Date.now() / 1000 }: { pushes?: Push[]; mirrors?: Mirror[]; now?: number } = {},
): SetupIssue[] {
  const issues: SetupIssue[] = [];
  const phones = devices.filter(isPhone);
  const live = phones.filter(isReachable);

  if (!phones.length) issues.push({ kind: 'noPhone' });
  else if (!live.length) {
    const latest = [...phones].sort((a, b) => b.modified - a.modified)[0]!;
    if (now - latest.modified < GONE_RECENTLY) issues.push({ kind: 'phoneGone', device: latest });
  }

  for (const d of live) {
    const since = lastActivity(d, pushes, mirrors);
    if (now - since > QUIET_AFTER) issues.push({ kind: 'quiet', device: d, since });
  }

  const seen = new Map<string, number>();
  for (const d of devices.filter(isReachable)) {
    const name = deviceName(d);
    seen.set(name, (seen.get(name) ?? 0) + 1);
  }
  for (const [name, n] of seen) if (n > 1) issues.push({ kind: 'sameName', name });

  return issues;
}
