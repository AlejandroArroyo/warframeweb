import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.js';
import { AuthProvider } from './contexts/AuthContext.js';
import { ToastProvider } from './contexts/ToastContext.js';
import './index.css';
import './i18n/index.js'; // i18n initialization

// Auth token cleanup from URL params (Discord OAuth callback edge case)
const params = new URLSearchParams(window.location.search);
const tokenParam = params.get('token');
if (tokenParam) {
  localStorage.setItem('wf_token', tokenParam);
  // Limpiar token de la URL sin recargar
  window.history.replaceState({}, '', window.location.pathname);
}

const root = document.getElementById('root');
if (!root) throw new Error('Root element not found');

createRoot(root).render(
  <StrictMode>
    <AuthProvider>
      <ToastProvider>
        <App />
      </ToastProvider>
    </AuthProvider>
  </StrictMode>,
);
