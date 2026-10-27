import { isAddressNote } from '@/core/utils/format';
import type { Push, User } from '@/core/pushbullet/types';

/** The other person in a push, if it's a conversation rather than your own device traffic. */
export function counterpart(p: Push, me: User | null): string | null {
  if (p.channel_iden) return null;
  const mine = me?.email_normalized;
  if (p.direction === 'incoming' && p.sender_email_normalized && p.sender_email_normalized !== mine)
    return p.sender_email_normalized;
  if (p.direction === 'outgoing' && p.receiver_email_normalized && p.receiver_email_normalized !== mine)
    return p.receiver_email_normalized;
  return null;
}

export type PushKind = 'link' | 'note' | 'file';
export type Filter =
  { kind: 'all' } | { kind: 'type'; type: PushKind } | { kind: 'channels' } | { kind: 'person'; email: string };

/** What a push is to look at: a note holding only an address counts as a link. */
export function pushKind(p: Push): PushKind {
  if (p.type === 'link' || isAddressNote(p)) return 'link';
  return p.type === 'file' ? 'file' : 'note';
}

export function matches(p: Push, filter: Filter, me: User | null, query: string, showChannels: boolean): boolean {
  if (p.channel_iden && !showChannels) return false;
  const who = counterpart(p, me);
  if (filter.kind === 'type' && pushKind(p) !== filter.type) return false;
  if (filter.kind === 'channels' && !p.channel_iden) return false;
  if (filter.kind === 'person' && who !== filter.email) return false;
  if (query && !`${p.title ?? ''} ${p.body ?? ''} ${p.url ?? ''} ${p.file_name ?? ''}`.toLowerCase().includes(query))
    return false;
  return true;
}
