import { Group } from '@/ui/components';
import { FeedItem } from '@/ui/features/feed/FeedItem';
import { useStore } from '@/ui/hooks/use-store';
import { i18n } from '#i18n';

/** The last few pushes under the composer, so the popup doubles as a quick inbox. */
export function RecentPushes({ onSeeAll }: { onSeeAll: () => void }) {
  const ctx = useStore(['pushes', 'devices', 'chats', 'subscriptions', 'me', 'selfDeviceIden', 'previews', 'settings']);
  const recent = ctx.pushes.filter((p) => !p.channel_iden || ctx.settings.showChannels).slice(0, 3);
  if (!ctx.ready || !recent.length) return null;
  return (
    <section className="mt-4" aria-label={i18n.t('recent.heading')}>
      <div className="mb-1.5 flex items-baseline px-0.5">
        <h3 className="text-xs font-bold text-muted">{i18n.t('recent.heading')}</h3>
        <button onClick={onSeeAll} className="ms-auto text-2xs font-bold text-accent-strong hover:underline">
          {i18n.t('recent.seeAll')}
        </button>
      </div>
      <Group>
        {recent.map((p) => (
          <FeedItem key={p.iden} push={p} ctx={ctx} isNew={false} onPerson={onSeeAll} />
        ))}
      </Group>
    </section>
  );
}
