import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from '@/ui/app/App';
import '@/ui/styles/globals.css';
import '@/ui/locale';

// The same page doubles as the pop-out window (?window=1), which fills its frame.
const isWindow = new URLSearchParams(location.search).has('window');
if (isWindow) document.body.className = 'fill';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App mode={isWindow ? 'window' : 'popup'} />
  </React.StrictMode>,
);
