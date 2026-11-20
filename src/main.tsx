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
import { listenForInstall } from './install/installState';
import { startViewportWatch } from './viewport';

// Before React starts: the browser can offer "Install app" straight away.
listenForInstall();
// Phones: keep chat, sheets and the tab bar inside the visible area when the keyboard opens and closes.
startViewportWatch();

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
