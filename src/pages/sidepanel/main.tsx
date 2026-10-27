import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from '@/ui/app/App';
import '@/ui/styles/globals.css';
import '@/ui/locale';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App mode="panel" />
  </React.StrictMode>,
);
