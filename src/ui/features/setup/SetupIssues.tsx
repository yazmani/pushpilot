import { TriangleAlert, X } from 'lucide-react';
import { useMemo } from 'react';
import { browser } from 'wxt/browser';
import { issueKey, type SetupIssue, setupIssues } from '@/core/setup';
import * as store from '@/core/storage/store';
import { deviceName } from '@/core/utils/format';
import { IconButton } from '@/ui/components';
import { useStore } from '@/ui/hooks/use-store';
import { i18n } from '#i18n';

const APPS = 'https://www.pushbullet.com/apps';

function day(t: number) {
  return new Date(t * 1000).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function issueText(i: SetupIssue): { title: string; body: string } {
  switch (i.kind) {
    case 'noPhone':
      return { title: i18n.t('setup.noPhoneTitle'), body: i18n.t('setup.noPhoneBody') };
    case 'phoneGone':
      return {
        title: i18n.t('setup.phoneGoneTitle', [deviceName(i.device)]),
        body: i18n.t('setup.phoneGoneBody'),
      };
    case 'quiet':
      return {
        title: i18n.t('setup.quietTitle', [deviceName(i.device)]),
        body: i18n.t('setup.quietBody', [day(i.since)]),
      };
    case 'sameName':
      return { title: i18n.t('setup.sameNameTitle', [i.name]), body: i18n.t('setup.sameNameBody') };
  }
}

export function useSetupIssues() {
  const { devices, pushes, mirrors, ready } = useStore(['devices', 'pushes', 'mirrors']);
  // Before the first device sync there's nothing to judge.
  return useMemo(
    () => (ready && devices.length ? setupIssues(devices, { pushes, mirrors }) : []),
    [ready, devices, pushes, mirrors],
  );
}

/** Every issue, as rows at the top of Settings › Devices. */
export function IssueList() {
  const issues = useSetupIssues();
  return (
    <>
      {issues.map((i) => {
        const { title, body } = issueText(i);
        return (
          <div key={issueKey(i)} className="flex gap-3 py-3.5">
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-note-bg text-ink">
              <TriangleAlert size={16} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">{title}</p>
              <p className="mt-0.5 text-xs leading-relaxed text-muted">
                {body}
                {i.kind === 'noPhone' && (
                  <>
                    {' '}
                    <a className="font-bold text-accent-strong hover:underline" href={APPS} target="_blank" rel="noreferrer">
                      {i18n.t('setup.getApp')}
                    </a>
                  </>
                )}
              </p>
            </div>
          </div>
        );
      })}
    </>
  );
}

/**
 * The most pressing issue, in the popup, until dismissed. Having no phone at
 * all is a choice some people make, so that one stays in Settings.
 */
export function IssueBanner() {
  const issues = useSetupIssues();
  const { dismissedIssues } = useStore(['dismissedIssues']);
  const issue = issues.find((i) => i.kind !== 'noPhone' && !dismissedIssues.includes(issueKey(i)));
  if (!issue) return null;
  const { title, body } = issueText(issue);
  const dismiss = () => void store.update('dismissedIssues', (all) => [...all, issueKey(issue)]);
  return (
    <section className="mb-3 rounded-2xl bg-note-bg p-3.5" role="status">
      <div className="flex items-start gap-2">
        <p className="flex flex-1 items-start gap-1.5 text-sm font-bold">
          <TriangleAlert size={15} className="mt-0.5 shrink-0" /> {title}
        </p>
        <IconButton label={i18n.t('common.dismiss')} className="-me-1.5 -mt-1.5 size-7" onClick={dismiss}>
          <X size={14} />
        </IconButton>
      </div>
      <p className="mt-1 text-xs leading-relaxed text-muted">{body}</p>
      <button
        onClick={() => void browser.tabs.create({ url: browser.runtime.getURL('/options.html#devices') })}
        className="mt-2 text-xs font-bold text-accent-strong hover:underline"
      >
        {i18n.t('targets.seeDevices')}
      </button>
    </section>
  );
}
