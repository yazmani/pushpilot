import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from '@/ui/app/App';
import '@/ui/styles/globals.css';
import '@/ui/locale';

// Pushpilot as a full browser tab: room for the gallery, texts side by side.
document.documentElement.classList.add('app');
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App mode="tab" />
  </React.StrictMode>,
);
