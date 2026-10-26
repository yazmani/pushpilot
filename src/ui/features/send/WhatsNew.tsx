import { Sparkles, X } from 'lucide-react';
import { browser } from 'wxt/browser';
import { LINKS } from '@/core/links';
import * as store from '@/core/storage/store';
import { minorVersion, WHATS_NEW } from '@/core/whats-new';
import { IconButton } from '@/ui/components';
import { useStore } from '@/ui/hooks/use-store';

/** Shown once after an update to a new minor version, until dismissed. */
export function WhatsNew() {
  const { whatsNewSeen, ready } = useStore(['whatsNewSeen']);
  const version = browser.runtime.getManifest().version;
  const minor = minorVersion(version);
  const notes = WHATS_NEW[minor];
  if (!ready || !notes || whatsNewSeen === minor) return null;

  const done = () => void store.set({ whatsNewSeen: minor });

  return (
    <section className="mb-3 rounded-2xl bg-accent-soft p-3.5" aria-label="What's new">
      <div className="flex items-start gap-2">
        <p className="flex flex-1 items-center gap-1.5 text-sm font-bold">
          <Sparkles size={15} className="text-accent-strong" /> New in Pushpilot {minor}
        </p>
        <IconButton label="Dismiss" className="-mr-1.5 -mt-1.5 size-7" onClick={done}>
          <X size={14} />
        </IconButton>
      </div>
      <ul className="mt-1.5 flex list-disc flex-col gap-1 pl-5 text-xs leading-relaxed text-muted marker:text-accent-strong">
        {notes.map((n) => (
          <li key={n}>{n}</li>
        ))}
      </ul>
      <button
        onClick={() => {
          done();
          void browser.tabs.create({ url: `${LINKS.repo}/releases/tag/v${version}` });
        }}
        className="mt-2.5 text-xs font-bold text-accent-strong hover:underline"
      >
        See all changes
      </button>
    </section>
  );
}
