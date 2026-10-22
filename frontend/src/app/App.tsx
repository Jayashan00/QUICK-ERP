import { RouterProvider } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { router } from '@/app/routes';
import { AppProviders } from './AppProviders';

export function App() {
  return (
    <AppProviders>
      <RouterProvider router={router} />
      <Toaster
        position="top-right"
        gutter={8}
        toastOptions={{
          duration: 4000,
          style: {
            maxWidth: '380px',
            padding: '10px 12px',
            border: '1px solid #e2e8f0',
            borderRadius: '10px',
            background: '#ffffff',
            color: '#0f172a',
            boxShadow: '0 10px 25px -8px rgb(15 23 42 / 0.2)',
            fontSize: '14px',
          },
          success: {
            iconTheme: { primary: '#059669', secondary: '#ffffff' },
          },
          error: {
            duration: 5000,
            iconTheme: { primary: '#dc2626', secondary: '#ffffff' },
          },
          loading: { duration: Infinity },
        }}
      />
    </AppProviders>
  );
}

export default App;
