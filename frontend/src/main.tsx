// Must stay the first import: other modules use crypto.randomUUID while loading.
import './polyfills';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './app/App';
import './app/styles/index.css';

import { QueryClientProvider } from "@tanstack/react-query";

import { queryClient } from "@/core/api/query";
import { restoreBackendIdentity } from "@/core/persistence/backendSession";

// Backend mode: put the signed-in identity back before the providers read it.
restoreBackendIdentity();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </React.StrictMode>
);
