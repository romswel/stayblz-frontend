import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { AuthProvider } from './auth';
import './styles.css';
import './themes/dark.css';
import './confirmation';
import ErrorBoundary from './components/status/ErrorBoundary';
import ConnectionNotice from './components/status/ConnectionNotice';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <ErrorBoundary standalone>
        <AuthProvider>
          <App />
          <ConnectionNotice />
        </AuthProvider>
      </ErrorBoundary>
    </BrowserRouter>
  </React.StrictMode>
);
