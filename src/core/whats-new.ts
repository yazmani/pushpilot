import { i18n } from '#i18n';

// Highlights shown once in the popup after an update to a new minor version.
// Patch releases show nothing new; the full list is in CHANGELOG.md.
export const WHATS_NEW: Record<string, () => string[]> = {
  '1.1': () => [
    i18n.t('whatsNew.v1_1.pushAnywhere'),
    i18n.t('whatsNew.v1_1.filesOpen'),
    i18n.t('whatsNew.v1_1.shortcut'),
    i18n.t('whatsNew.v1_1.polish'),
  ],
};

/** "1.1" for "1.1.3": what WHATS_NEW and the seen marker are keyed by. */
export function minorVersion(version: string): string {
  return version.split('.').slice(0, 2).join('.');
}
