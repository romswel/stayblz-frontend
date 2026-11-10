import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { AuthProvider } from './auth';
import './styles.css';
import './themes/dark.css';
import './components/ui/ui.css';
import './confirmation';
import ErrorBoundary from './components/status/ErrorBoundary';
import ConnectionNotice from './components/status/ConnectionNotice';
import { ConfirmProvider } from './components/ui/Confirm';
import { registerServiceWorker } from './pwa';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <ErrorBoundary standalone>
        <ConfirmProvider>
          <AuthProvider>
            <App />
            <ConnectionNotice />
          </AuthProvider>
        </ConfirmProvider>
      </ErrorBoundary>
    </BrowserRouter>
  </React.StrictMode>
);

registerServiceWorker();
