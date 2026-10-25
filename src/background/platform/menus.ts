import { browser, type Browser } from 'wxt/browser';
import * as store from '@/core/storage/store';
import { deviceName, isReachable, personName } from '@/core/utils/format';
import { sendImage, sendQuietly } from '@/background/services/send';

type Ctx = 'page' | 'link' | 'image' | 'selection';
const ROOTS: { ctx: Ctx; title: string }[] = [
  { ctx: 'page', title: 'Push this page' },
  { ctx: 'link', title: 'Push this link' },
  { ctx: 'image', title: 'Push this image' },
  { ctx: 'selection', title: 'Push selected text' },
];

let building: Promise<void> = Promise.resolve();

/** Rebuilds the right-click menu: one submenu per context, one item per target. */
export function rebuildMenus() {
  building = building.then(build).catch((err) => console.warn('[pushpilot] menus', err));
  return building;
}

async function build() {
  await browser.contextMenus.removeAll();
  const { token, settings, devices, chats, selfDeviceIden } = await store.getMany([
    'token',
    'settings',
    'devices',
    'chats',
    'selfDeviceIden',
  ]);
  if (!token || !settings.contextMenu) return;

  const targets: { key: string; title: string }[] = [
    { key: 'all', title: 'All my other devices' },
    ...devices
      .filter((d) => isReachable(d) && d.iden !== selfDeviceIden)
      .map((d) => ({ key: `device:${d.iden}`, title: deviceName(d) })),
  ];
  const people = chats.slice(0, 12).map((c) => ({ key: `person:${c.with.email}`, title: personName(c) }));

  for (const root of ROOTS) {
    const parent = `root|${root.ctx}`;
    browser.contextMenus.create({ id: parent, title: root.title, contexts: [root.ctx] });
    for (const t of targets) {
      browser.contextMenus.create({ id: `${root.ctx}|${t.key}`, parentId: parent, title: t.title, contexts: [root.ctx] });
    }
    if (people.length) {
      browser.contextMenus.create({ id: `${parent}|sep`, parentId: parent, type: 'separator', contexts: [root.ctx] });
      for (const p of people) {
        browser.contextMenus.create({ id: `${root.ctx}|${p.key}`, parentId: parent, title: p.title, contexts: [root.ctx] });
      }
    }
  }
}

export function registerMenuClicks() {
  browser.contextMenus.onClicked.addListener((info: Browser.contextMenus.OnClickData, tab?: Browser.tabs.Tab) => {
    const id = String(info.menuItemId);
    const bar = id.indexOf('|');
    const ctx = id.slice(0, bar) as Ctx;
    const target = id.slice(bar + 1);
    if (ctx === ('root' as Ctx)) return;
    const targets = [target];
    switch (ctx) {
      case 'page':
        void sendQuietly({ type: 'link', title: tab?.title, url: info.pageUrl ?? tab?.url }, targets, tab?.title ?? '');
        break;
      case 'link':
        void sendQuietly({ type: 'link', title: info.linkUrl, url: info.linkUrl }, targets, info.linkUrl ?? '');
        break;
      case 'image':
        if (info.srcUrl) void sendImage(info.srcUrl, targets, info.pageUrl);
        break;
      case 'selection':
        void sendQuietly(
          { type: 'note', title: tab?.title, body: `${info.selectionText ?? ''}\n\n${info.pageUrl ?? ''}`.trim() },
          targets,
          (info.selectionText ?? '').slice(0, 80),
        );
        break;
    }
  });
}
