import '@fontsource-variable/atkinson-hyperlegible-next';
import '@/styles.css';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import * as ReactDOM from 'react-dom/client';
import { App } from './app';
import { installDebugOverlay } from './debug-overlay';

if (location.search.includes('debug')) installDebugOverlay();

const queryClient = new QueryClient();

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);

root.render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
);
