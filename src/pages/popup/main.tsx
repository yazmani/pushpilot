import React from 'react';
import { browser } from 'wxt/browser';
import ReactDOM from 'react-dom/client';
import { App } from '@/ui/app/App';
import '@/ui/styles/globals.css';
import '@/ui/locale';

// The same page doubles as the pop-out window (?window=1), which fills its frame.
const isWindow = new URLSearchParams(location.search).has('window');
if (isWindow) document.body.className = 'fill';

// Chrome caps toolbar popups at 600 pixels. With the browser zoomed above
// 100%, 600 CSS pixels are taller than that: the popup gets cut off and the
// Send button ends up below the edge. Lay the popup out at the height that
// actually fits. (From the zoom setting, not the window: while a popup opens,
// its window is briefly smaller than it will be.)
if (!isWindow) {
  void browser.tabs
    .getZoomSettings()
    .then(({ defaultZoomFactor }) => {
      if (defaultZoomFactor && defaultZoomFactor > 1) {
        document.body.style.height = `${Math.floor(600 / defaultZoomFactor)}px`;
      }
    })
    .catch(() => undefined);
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App mode={isWindow ? 'window' : 'popup'} />
  </React.StrictMode>,
);
