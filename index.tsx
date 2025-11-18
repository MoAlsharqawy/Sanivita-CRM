import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App';
import { LanguageProvider } from './hooks/useLanguage';
import './index.css';

// Create a client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false, // Better UX for this type of CRM
      retry: 1,
      staleTime: 1000 * 60 * 5, // Data is fresh for 5 minutes
    },
  },
});

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <HashRouter>
          <App />
        </HashRouter>
      </LanguageProvider>
    </QueryClientProvider>
  </React.StrictMode>
);