// Highlights shown once in the popup after an update to a new minor version.
// Patch releases show nothing new; the full list is in CHANGELOG.md.
export const WHATS_NEW: Record<string, string[]> = {
  '1.1': [
    'Push from any app: copy something and press ⌘⇧9 (Ctrl+Shift+9).',
    'Images, PDFs and other files open in a new tab as they arrive.',
    'iPhone, iPad and Mac: the Pushpilot shortcut pushes from the Share sheet.',
    'Light theme, a roomier popup, and receiving fixes.',
  ],
};

/** "1.1" for "1.1.3": what WHATS_NEW and the seen marker are keyed by. */
export function minorVersion(version: string): string {
  return version.split('.').slice(0, 2).join('.');
}
