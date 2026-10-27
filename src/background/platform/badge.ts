import { browser } from 'wxt/browser';
import * as store from '@/core/storage/store';
import { i18n } from '#i18n';

export async function updateBadge() {
  const { unread, settings, connection, token, mirrors } = await store.getMany([
    'unread',
    'settings',
    'connection',
    'token',
    'mirrors',
  ]);
  if (!token) {
    await browser.action.setBadgeText({ text: '' });
    await browser.action.setTitle({ title: i18n.t('bg.badgeSignIn') });
    return;
  }
  if (connection === 'offline') {
    await browser.action.setBadgeBackgroundColor({ color: '#587063' });
    await browser.action.setBadgeTextColor({ color: '#FFFFFF' });
    await browser.action.setBadgeText({ text: '!' });
    await browser.action.setTitle({ title: i18n.t('bg.badgeOffline') });
    return;
  }
  const phone = settings.badgePhoneLive ? mirrors.filter((m) => !m.dismissed).length : unread.phone;
  const total = settings.badge
    ? (settings.badgeFeed ? unread.feed : 0) + (settings.badgePhone ? phone : 0) + (settings.badgeSms ? unread.sms : 0)
    : 0;
  await browser.action.setBadgeBackgroundColor({ color: '#16A35A' });
  await browser.action.setBadgeTextColor({ color: '#FFFFFF' });
  await browser.action.setBadgeText({ text: total ? (total > 99 ? '99+' : String(total)) : '' });
  const snoozed = settings.snoozeUntil > Date.now();
  await browser.action.setTitle({
    title: [total ? i18n.t('bg.badgeNew', [String(total)]) : 'Pushpilot', snoozed ? i18n.t('bg.badgeSnoozed') : '']
      .filter(Boolean)
      .join(' '),
  });
}

export function registerBadge() {
  store.onChange((changes) => {
    if ('unread' in changes || 'settings' in changes || 'connection' in changes || 'token' in changes || 'mirrors' in changes) {
      void updateBadge();
    }
  });
}
