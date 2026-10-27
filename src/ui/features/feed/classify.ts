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
export type FileKind = 'image' | 'video' | 'pdf' | 'doc' | 'audio' | 'other';
export const FILE_KINDS: FileKind[] = ['image', 'video', 'pdf', 'doc', 'audio', 'other'];
export type Filter =
  { kind: 'all' } | { kind: 'type'; type: PushKind; file?: FileKind } | { kind: 'channels' } | { kind: 'person'; email: string };

const DOC_EXTENSIONS = /\.(docx?|xlsx?|pptx?|odt|ods|odp|rtf|txt|md|csv|json|epub|pages|numbers|key)$/i;
const BY_EXTENSION: [RegExp, FileKind][] = [
  [/\.(jpe?g|png|gif|webp|heic|heif|bmp|svg|avif)$/i, 'image'],
  [/\.(mp4|mov|m4v|webm|mkv|avi|3gp)$/i, 'video'],
  [/\.(mp3|m4a|aac|ogg|opus|wav|flac|amr)$/i, 'audio'],
  [/\.pdf$/i, 'pdf'],
  [DOC_EXTENSIONS, 'doc'],
];

/** Images, videos, PDFs… from the file's type, or its name when the type is generic. */
export function fileKind(p: Push): FileKind {
  const type = p.file_type ?? '';
  if (type.startsWith('image/')) return 'image';
  if (type.startsWith('video/')) return 'video';
  if (type.startsWith('audio/')) return 'audio';
  if (type === 'application/pdf') return 'pdf';
  if (type.startsWith('text/') || /word|excel|powerpoint|officedocument|opendocument|rtf|epub|csv/.test(type)) return 'doc';
  return BY_EXTENSION.find(([re]) => re.test(p.file_name ?? ''))?.[1] ?? 'other';
}

/** What a push is to look at: a note holding only an address counts as a link. */
export function pushKind(p: Push): PushKind {
  if (p.type === 'link' || isAddressNote(p)) return 'link';
  return p.type === 'file' ? 'file' : 'note';
}

export function matches(p: Push, filter: Filter, me: User | null, query: string, showChannels: boolean): boolean {
  if (p.channel_iden && !showChannels) return false;
  const who = counterpart(p, me);
  if (filter.kind === 'type' && pushKind(p) !== filter.type) return false;
  if (filter.kind === 'type' && filter.file && fileKind(p) !== filter.file) return false;
  if (filter.kind === 'channels' && !p.channel_iden) return false;
  if (filter.kind === 'person' && who !== filter.email) return false;
  if (query && !`${p.title ?? ''} ${p.body ?? ''} ${p.url ?? ''} ${p.file_name ?? ''}`.toLowerCase().includes(query))
    return false;
  return true;
}
