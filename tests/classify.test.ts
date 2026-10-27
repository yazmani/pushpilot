import { describe, expect, it } from 'vitest';
import type { Push } from '@/core/pushbullet/types';
import { fileKind } from '@/ui/features/feed/classify';

const file = (file_name: string, file_type?: string) => ({ type: 'file', file_name, file_type }) as Push;

describe('fileKind', () => {
  it('uses the file type', () => {
    expect(fileKind(file('a', 'image/jpeg'))).toBe('image');
    expect(fileKind(file('a', 'video/mp4'))).toBe('video');
    expect(fileKind(file('a', 'audio/mpeg'))).toBe('audio');
    expect(fileKind(file('a', 'application/pdf'))).toBe('pdf');
    expect(fileKind(file('a', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'))).toBe('doc');
  });

  it('falls back to the name when the type is generic', () => {
    expect(fileKind(file('IMG_1234.HEIC', 'application/octet-stream'))).toBe('image');
    expect(fileKind(file('clip.mov'))).toBe('video');
    expect(fileKind(file('notes.md', 'application/octet-stream'))).toBe('doc');
    expect(fileKind(file('backup.zip', 'application/zip'))).toBe('other');
  });
});
