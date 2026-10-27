import { Layers } from 'lucide-react';
import { type ReactNode, useMemo } from 'react';
import { deviceKind, deviceName, isReachable, personName } from '@/core/utils/format';
import { Avatar, DeviceGlyph } from '@/ui/components';
import { useStore } from '@/ui/hooks/use-store';
import { i18n } from '#i18n';

export interface TargetOption {
  key: string;
  label: string;
  sub: string;
  kind: 'all' | 'device' | 'person';
  icon: ReactNode;
}

/** Everything a push can go to, in picker order. Unreachable registrations are left out. */
export function useTargets(): { targets: TargetOption[]; unreachable: number } {
  const { devices, chats, selfDeviceIden } = useStore(['devices', 'chats', 'selfDeviceIden']);
  return useMemo(() => {
    const reachable = devices.filter((d) => isReachable(d) && d.iden !== selfDeviceIden).sort((a, b) => b.modified - a.modified);
    const targets: TargetOption[] = [
      {
        key: 'all',
        label: i18n.t('targets.all'),
        sub: i18n.t('targets.allSub'),
        kind: 'all',
        icon: <Layers size={22} strokeWidth={1.9} />,
      },
      ...reachable.map((d) => ({
        key: `device:${d.iden}`,
        label: deviceName(d),
        sub: deviceKind(d),
        kind: 'device' as const,
        icon: <DeviceGlyph device={d} size={22} />,
      })),
      // Pushing to yourself parks a link or note in the feed for later.
      ...(selfDeviceIden
        ? [
            {
              key: `device:${selfDeviceIden}`,
              label: i18n.t('targets.self'),
              sub: i18n.t('targets.selfSub'),
              kind: 'device' as const,
              icon: <DeviceGlyph device={{ icon: 'browser' }} size={22} />,
            },
          ]
        : []),
      ...chats.map((c) => ({
        key: `person:${c.with.email}`,
        label: personName(c),
        sub: c.with.email,
        kind: 'person' as const,
        icon: <Avatar src={c.with.image_url} name={personName(c)} size={52} />,
      })),
    ];
    const unreachable = devices.filter((d) => d.active && !isReachable(d)).length;
    return { targets, unreachable };
  }, [devices, chats, selfDeviceIden]);
}

export function targetLabel(selected: string[], targets: TargetOption[]): string {
  if (!selected.length) return '…';
  const names = selected.map((k) => targets.find((t) => t.key === k)?.label ?? i18n.t('targets.device'));
  if (names.length === 1) return names[0]!;
  if (names.length === 2) return i18n.t('targets.two', [names[0]!, names[1]!]);
  return i18n.t('targets.many', [String(names.length)]);
}
