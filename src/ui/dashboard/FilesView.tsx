import clsx from 'clsx';
import { Download, ExternalLink, FolderOpen, LayoutGrid, List } from 'lucide-react';
import { useMemo, useState } from 'react';
import { call } from '@/core/messaging/rpc';
import type { Push } from '@/core/pushbullet/types';
import { deviceName } from '@/core/utils/format';
import { Button, Empty, Segmented, Spinner, TypeTile } from '@/ui/components';
import { FILE_KINDS, type FileKind, fileKind } from '@/ui/features/feed/classify';
import { extension, FILE_ICONS } from '@/ui/features/feed/FeedItem';
import { imageSrc, Lightbox } from '@/ui/features/feed/Gallery';
import { useStore } from '@/ui/hooks/use-store';
import { Page } from './parts';
import { i18n } from '#i18n';

type View = 'grid' | 'list';

function year(p: Push) {
  return new Date(p.created * 1000).getFullYear();
}

/** Everything pushed as a file, as a gallery or a list, with the full-screen viewer for images. */
export function FilesView() {
  const { pushes, devices, historyCursor } = useStore(['pushes', 'devices', 'historyCursor']);
  const [kind, setKind] = useState<FileKind | 'all'>('all');
  const [view, setView] = useState<View>('grid');
  const [open, setOpen] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  const files = useMemo(() => pushes.filter((p) => p.type === 'file' && p.file_url), [pushes]);
  const kinds = useMemo(() => {
    const present = new Set(files.map(fileKind));
    return FILE_KINDS.filter((k) => present.has(k));
  }, [files]);
  const shown = useMemo(() => (kind === 'all' ? files : files.filter((p) => fileKind(p) === kind)), [files, kind]);
  const images = useMemo(() => shown.filter((p) => fileKind(p) === 'image'), [shown]);
  const years = useMemo(() => {
    const out: { year: number; items: Push[] }[] = [];
    for (const p of shown) {
      const y = year(p);
      const last = out[out.length - 1];
      if (last?.year === y) last.items.push(p);
      else out.push({ year: y, items: [p] });
    }
    return out;
  }, [shown]);

  const openFile = (p: Push) => {
    if (fileKind(p) === 'image') setOpen(images.indexOf(p));
    else window.open(p.file_url, '_blank', 'noreferrer');
  };
  const loadOlder = () => {
    setLoading(true);
    void call('pushes.all')
      .catch(() => undefined)
      .finally(() => setLoading(false));
  };
  const from = (p: Push) => devices.find((d) => d.iden === p.source_device_iden);

  return (
    <Page
      title={i18n.t('dash.files')}
      subtitle={i18n.t('dash.filesCount', files.length)}
      actions={
        <Segmented<View>
          value={view}
          onChange={setView}
          className="w-24"
          options={[
            { value: 'grid', label: <LayoutGrid size={15} />, title: i18n.t('dash.viewGrid') },
            { value: 'list', label: <List size={15} />, title: i18n.t('dash.viewList') },
          ]}
        />
      }
    >
      {kinds.length > 1 && (
        <div className="mb-6 flex flex-wrap gap-2">
          {(['all', ...kinds] as const).map((k) => {
            const on = kind === k;
            const Icon = k === 'all' ? FolderOpen : FILE_ICONS[k];
            const n = k === 'all' ? files.length : files.filter((p) => fileKind(p) === k).length;
            return (
              <button
                key={k}
                onClick={() => setKind(k)}
                aria-pressed={on}
                className={clsx(
                  'flex h-9 items-center gap-2 rounded-full border px-4 text-sm font-bold transition-colors',
                  on ? 'border-accent bg-accent text-on-accent shadow-sm' : 'border-line bg-surface text-muted hover:text-ink',
                )}
              >
                <Icon size={15} />
                {i18n.t(k === 'all' ? 'feed.fileKind.all' : `feed.fileKind.${k}`)}
                <span className={clsx('text-xs tabular-nums', on ? 'text-on-accent/75' : 'text-faint')}>{n}</span>
              </button>
            );
          })}
        </div>
      )}

      {!shown.length ? (
        <Empty icon={<FolderOpen size={24} />} title={i18n.t('dash.filesEmptyTitle')}>
          {i18n.t('dash.filesEmpty')}
        </Empty>
      ) : view === 'grid' ? (
        years.map((y) => (
          <section key={y.year} className="mb-8">
            <h2 className="mb-3 text-sm font-extrabold text-muted">{y.year}</h2>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(168px,1fr))] gap-3">
              {y.items.map((p) => {
                const image = fileKind(p) === 'image';
                return (
                  <button
                    key={p.iden}
                    onClick={() => openFile(p)}
                    title={p.file_name}
                    className="group flex flex-col overflow-hidden rounded-2xl border border-line bg-surface text-start shadow-sm transition-shadow hover:shadow-card"
                  >
                    <span className="relative block aspect-[4/3] overflow-hidden bg-raised">
                      {image ? (
                        <img
                          src={imageSrc(p, 's480-c')}
                          alt=""
                          loading="lazy"
                          className="size-full object-cover transition-transform duration-300 group-hover:scale-[1.04]"
                        />
                      ) : (
                        <span className="grid size-full place-items-center bg-file-bg/70">
                          <TypeTile type="file" size={64} icon={FILE_ICONS[fileKind(p)]} label={extension(p.file_name)} />
                        </span>
                      )}
                    </span>
                    <span className="block px-3 pb-2.5 pt-2">
                      <span className="block truncate text-xs font-bold">{p.file_name}</span>
                      <span className="block truncate text-2xs text-faint">
                        {new Date(p.created * 1000).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                        {from(p) && ` · ${deviceName(from(p))}`}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        ))
      ) : (
        <div className="overflow-hidden rounded-[22px] border border-line bg-surface shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-start text-xs font-bold text-muted">
                <th className="px-5 py-3 text-start">{i18n.t('dash.colName')}</th>
                <th className="px-3 py-3 text-start">{i18n.t('dash.colFrom')}</th>
                <th className="px-3 py-3 text-start">{i18n.t('dash.colType')}</th>
                <th className="px-3 py-3 text-end">{i18n.t('dash.colDate')}</th>
                <th className="w-24" />
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {shown.map((p) => (
                <tr key={p.iden} className="group hover:bg-raised/50">
                  <td className="px-5 py-2.5">
                    <button onClick={() => openFile(p)} className="flex min-w-0 items-center gap-3 text-start">
                      {fileKind(p) === 'image' ? (
                        <img
                          src={imageSrc(p, 's96-c')}
                          alt=""
                          loading="lazy"
                          className="size-9 shrink-0 rounded-lg object-cover"
                        />
                      ) : (
                        <TypeTile type="file" size={36} icon={FILE_ICONS[fileKind(p)]} />
                      )}
                      <span className="truncate font-semibold group-hover:text-accent-strong">{p.file_name}</span>
                    </button>
                  </td>
                  <td className="truncate px-3 py-2.5 text-muted">{from(p) ? deviceName(from(p)) : ''}</td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-xs font-bold text-muted">
                    {extension(p.file_name) ?? i18n.t(`feed.fileKind.${fileKind(p)}`)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-end text-muted">
                    {new Date(p.created * 1000).toLocaleDateString(undefined, { dateStyle: 'medium' })}
                  </td>
                  <td className="px-3 py-2.5">
                    <span className="flex justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                      <a
                        href={p.file_url}
                        target="_blank"
                        rel="noreferrer"
                        title={i18n.t('actions.open')}
                        className="grid size-8 place-items-center rounded-lg text-muted hover:bg-raised hover:text-ink"
                      >
                        <ExternalLink size={15} />
                      </a>
                      <a
                        href={p.file_url}
                        download={p.file_name}
                        title={i18n.t('actions.download')}
                        className="grid size-8 place-items-center rounded-lg text-muted hover:bg-raised hover:text-ink"
                      >
                        <Download size={15} />
                      </a>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {historyCursor !== null && (
        <div className="mt-6 flex justify-center">
          <Button onClick={loadOlder} disabled={loading}>
            {loading ? <Spinner className="size-4" /> : null} {i18n.t('dash.loadOlder')}
          </Button>
        </div>
      )}

      {open !== null && images[open] && <Lightbox pushes={images} index={open} onIndex={setOpen} onClose={() => setOpen(null)} />}
    </Page>
  );
}
