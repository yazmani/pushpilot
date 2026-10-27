// Language and direction for the page, from the browser's UI language, so
// Arabic (and any other right-to-left locale) lays out mirrored.
import { browser } from 'wxt/browser';

document.documentElement.lang = browser.i18n.getUILanguage();
document.documentElement.dir = browser.i18n.getMessage('@@bidi_dir') || 'ltr';
