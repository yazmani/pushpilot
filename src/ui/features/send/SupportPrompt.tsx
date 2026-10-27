import { Coffee, Heart, Star, X } from 'lucide-react';
import { browser } from 'wxt/browser';
import { LINKS, SUPPORT_PROMPT_AFTER } from '@/core/links';
import * as store from '@/core/storage/store';
import { IconButton } from '@/ui/components';
import { useStore } from '@/ui/hooks/use-store';
import { i18n } from '#i18n';

/** Asks once, after a while of real use, whether the person would like to support the project. */
export function SupportPrompt() {
  const { sendCount, supportPromptSeen, ready } = useStore(['sendCount', 'supportPromptSeen']);
  if (!ready || supportPromptSeen || sendCount < SUPPORT_PROMPT_AFTER) return null;

  const done = () => void store.set({ supportPromptSeen: true });
  const open = (url: string) => {
    done();
    void browser.tabs.create({ url });
  };

  return (
    <section className="mt-4 rounded-2xl bg-accent-soft p-3.5" aria-label={i18n.t('settings.section.supportPushpilot')}>
      <div className="flex items-start gap-2">
        <p className="flex-1 text-sm font-bold">
          {i18n.t('support.count', [String(sendCount)])}
          <span className="mt-0.5 block text-xs font-medium leading-relaxed text-muted">{i18n.t('support.pitch')}</span>
        </p>
        <IconButton label={i18n.t('support.never')} className="-me-1.5 -mt-1.5 size-7" onClick={done}>
          <X size={14} />
        </IconButton>
      </div>
      <div className="mt-2.5 flex flex-wrap gap-1.5">
        <button
          onClick={() => open(LINKS.kofi)}
          className="flex h-8 items-center gap-1.5 rounded-full bg-accent px-3 text-xs font-bold text-on-accent shadow-glow hover:brightness-105"
        >
          <Coffee size={14} /> {i18n.t('support.coffee')}
        </button>
        <button
          onClick={() => open(LINKS.sponsor)}
          className="flex h-8 items-center gap-1.5 rounded-full bg-surface px-3 text-xs font-bold text-ink ring-1 ring-line hover:bg-raised"
        >
          <Heart size={14} className="text-accent-strong" /> {i18n.t('support.sponsor')}
        </button>
        <button
          onClick={() => open(LINKS.review)}
          className="flex h-8 items-center gap-1.5 rounded-full bg-surface px-3 text-xs font-bold text-ink ring-1 ring-line hover:bg-raised"
        >
          <Star size={14} className="text-accent-strong" /> {i18n.t('support.review')}
        </button>
      </div>
    </section>
  );
}
