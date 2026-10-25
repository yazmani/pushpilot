import { useEffect } from 'react';
import type { Theme } from '@/core/storage/store';
import { useStore } from './use-store';

export function applyTheme(theme: Theme) {
  const dark = theme === 'dark' || (theme === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
}

/** Keeps <html data-theme> in step with the setting and the OS preference. */
export function useTheme() {
  const { settings, ready } = useStore(['settings']);
  useEffect(() => {
    if (!ready) return;
    applyTheme(settings.theme);
    const mq = matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => applyTheme(settings.theme);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [settings.theme, ready]);
}
