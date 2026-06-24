import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * Componente que maneja el callback de Discord OAuth.
 * Lee el token JWT de la URL y lo guarda en localStorage.
 * Renderizado en la ruta /auth/callback?token=...
 */
export default function AuthCallback() {
  const { t } = useTranslation();
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    // Si main.tsx ya guardó el token en localStorage y limpió la URL,
    // redirigimos al home directamente sin mostrar error.
    const existingToken = localStorage.getItem('wf_token');

    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    const errorParam = params.get('error');

    if (errorParam) {
      setStatus('error');
      setErrorMsg(decodeURIComponent(errorParam));
      return;
    }

    if (token) {
      try {
        localStorage.setItem('wf_token', token);
        setStatus('success');
        setTimeout(() => { window.location.href = '/'; }, 1500);
        return;
      } catch {
        setStatus('error');
        setErrorMsg('Failed to store authentication token');
        return;
      }
    }

    // No hay token en la URL. Si ya está en localStorage, redirigimos igual.
    if (existingToken) {
      window.location.href = '/';
      return;
    }

    setStatus('error');
    setErrorMsg('No token received from Discord authentication');
  }, []);

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 max-w-sm w-full mx-4 text-center">
        {status === 'processing' && (
          <>
            <div className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-gray-300">Autenticando con Discord...</p>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="w-12 h-12 bg-green-600 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl">
              ✓
            </div>
            <p className="text-green-400 font-medium mb-2">¡Autenticación exitosa!</p>
            <p className="text-gray-500 text-sm">Redirigiendo...</p>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="w-12 h-12 bg-red-600 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl">
              ✕
            </div>
            <p className="text-red-400 font-medium mb-2">Error de autenticación</p>
            <p className="text-gray-500 text-sm mb-4">{errorMsg}</p>
            <a
              href="/"
              className="inline-block px-4 py-2 bg-amber-600 hover:bg-amber-500 text-black font-medium rounded-lg transition-colors text-sm"
            >
              Volver al inicio
            </a>
          </>
        )}
      </div>
    </div>
  );
}
