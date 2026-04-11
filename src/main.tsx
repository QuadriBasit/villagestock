import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { ThemeProvider } from '@/components/theme/ThemeProvider';
import { ShopAccessProvider, ShopSyncEffects } from '@/context/ShopAccessContext';
import { ShopLocationProvider } from '@/context/ShopLocationContext';
import './index.css';
import App from './App';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 1000 * 60, retry: 1 },
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <ShopAccessProvider>
            <ShopLocationProvider>
              <ShopSyncEffects />
              <App />
              <Toaster richColors position="top-center" closeButton className="font-sans" />
            </ShopLocationProvider>
          </ShopAccessProvider>
        </BrowserRouter>
      </QueryClientProvider>
    </ThemeProvider>
  </StrictMode>
);
