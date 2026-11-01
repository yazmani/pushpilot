import { i18n } from '#i18n';

// Highlights shown once in the popup after an update to a new minor version.
// Patch releases show nothing new; the full list is in CHANGELOG.md.
export const WHATS_NEW: Record<string, () => string[]> = {
  '1.6': () => [i18n.t('whatsNew.v1_6.browsers')],
  '1.5': () => [i18n.t('whatsNew.v1_5.fullPage'), i18n.t('whatsNew.v1_5.files')],
  '1.4': () => [i18n.t('whatsNew.v1_4.jump'), i18n.t('whatsNew.v1_4.numbers')],
  '1.3': () => [
    i18n.t('whatsNew.v1_3.history'),
    i18n.t('whatsNew.v1_3.codes'),
    i18n.t('whatsNew.v1_3.outbox'),
    i18n.t('whatsNew.v1_3.phones'),
  ],
  '1.2': () => [i18n.t('whatsNew.v1_2.languages')],
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
