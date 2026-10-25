import React from 'react';
import ReactDOM from 'react-dom/client';
import { SettingsPage } from '@/ui/features/settings/SettingsPage';
import '@/ui/styles/globals.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <SettingsPage />
  </React.StrictMode>,
);
