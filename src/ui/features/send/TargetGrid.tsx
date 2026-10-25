import clsx from 'clsx';
import { Check } from 'lucide-react';
import type { MouseEvent } from 'react';
import { browser } from 'wxt/browser';
import type { TargetOption } from './targets';

/**
 * AirDrop-style row of round targets: devices first, then people. Click picks
 * one; ⌘/Ctrl/Shift-click builds a multi-send.
 */
export function TargetGrid({
  targets,
  selected,
  unreachable,
  onChange,
}: {
  targets: TargetOption[];
  selected: string[];
  unreachable: number;
  onChange: (keys: string[]) => void;
}) {
  const pick = (key: string, e: MouseEvent) => {
    const multi = e.metaKey || e.ctrlKey || e.shiftKey;
    if (!multi || key === 'all') return onChange([key]);
    const without = selected.filter((k) => k !== 'all');
    const next = without.includes(key) ? without.filter((k) => k !== key) : [...without, key];
    onChange(next.length ? next : ['all']);
  };

  const firstPerson = targets.findIndex((t) => t.kind === 'person');

  return (
    <section className="mt-4" aria-label="Send to">
      <div className="mb-1 flex items-baseline px-0.5">
        <h3 className="text-xs font-bold text-muted">Send to</h3>
        {targets.length > 2 && <span className="ml-auto text-2xs font-medium text-faint">⌘-click for several</span>}
      </div>
      <div className="fade-x no-scrollbar -mx-3.5 flex overflow-x-auto px-2.5 pb-1">
        {targets.map((t, i) => {
          const on = selected.includes(t.key);
          return (
            <div key={t.key} className="flex shrink-0 items-stretch">
              {i === firstPerson && i > 0 && <span className="mx-1.5 my-4 w-px bg-line" aria-hidden="true" />}
              <button
                type="button"
                aria-pressed={on}
                onClick={(e) => pick(t.key, e)}
                title={t.kind === 'person' ? t.sub : `${t.label} (${t.sub})`}
                className="group flex w-[74px] flex-col items-center gap-1.5 rounded-2xl px-1 py-2 transition-colors hover:bg-raised"
              >
                <span
                  className={clsx(
                    'relative grid size-[52px] place-items-center rounded-full transition-[background-color,box-shadow,color]',
                    t.kind === 'person'
                      ? on
                        ? 'ring-[2.5px] ring-accent ring-offset-2 ring-offset-bg'
                        : ''
                      : on
                        ? 'bg-accent text-on-accent shadow-glow'
                        : 'bg-surface text-muted shadow-sm ring-1 ring-line group-hover:text-ink',
                  )}
                >
                  {t.icon}
                  {on && (
                    <span className="absolute -bottom-0.5 -right-0.5 grid size-[18px] place-items-center rounded-full bg-accent text-on-accent ring-2 ring-bg">
                      <Check size={11} strokeWidth={3.2} />
                    </span>
                  )}
                </span>
                <span
                  className={clsx(
                    'line-clamp-2 w-full text-center text-[11px] font-semibold leading-tight',
                    on ? 'text-ink' : 'text-muted',
                  )}
                >
                  {t.label}
                </span>
              </button>
            </div>
          );
        })}
      </div>

      {unreachable > 0 && (
        <p className="mt-1 px-0.5 text-2xs leading-relaxed text-faint">
          {unreachable} older {unreachable === 1 ? 'device isn’t' : 'devices aren’t'} receiving pushes, so{' '}
          {unreachable === 1 ? 'it’s' : 'they’re'} hidden.{' '}
          <button
            className="font-semibold text-accent-strong hover:underline"
            onClick={() => void browser.tabs.create({ url: browser.runtime.getURL('/options.html#devices') })}
          >
            See devices
          </button>
        </p>
      )}
    </section>
  );
}
