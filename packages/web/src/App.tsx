import { useEffect, useState, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from './api/client.js';
import { useSocket } from './hooks/useSocket.js';
import { useAuth } from './contexts/AuthContext.js';
import { useToast } from './contexts/ToastContext.js';
import LobbyFilters from './components/LobbyFilters.js';
import LobbyList from './components/LobbyList.js';
import LobbyDetail from './components/LobbyDetail.js';
import CreateLobbyModal from './components/CreateLobbyModal.js';
import DevLoginModal from './components/DevLoginModal.js';
import AuthCallback from './components/AuthCallback.js';
import AdminPanel from './components/AdminPanel.js';
import RunsHistory from './components/RunsHistory.js';
import PlayerProfile from './components/PlayerProfile.js';
import NotificationBell from './components/NotificationBell.js';
import UserSettings from './components/UserSettings.js';
import { NotificationProvider } from './contexts/NotificationContext.js';
import type { LobbyDTO, CreateLobbyRequest } from '@warframe/shared';
import type { FiltersState } from './components/LobbyFilters.js';

type View = 'list' | 'detail' | 'profile' | 'settings';

function AppContent() {
  const { t } = useTranslation();
  const { connected, lobbies, setLobbies, socket } = useSocket();
  const { user, loading: authLoading, logout, isAuthenticated } = useAuth();
  const { addToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [profileUsername, setProfileUsername] = useState<string | null>(null);
  const [showAdmin, setShowAdmin] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [view, setView] = useState<View>('list');
  const [selectedLobby, setSelectedLobby] = useState<LobbyDTO | null>(null);
  const [filters, setFilters] = useState<FiltersState>({
    era: '',
    missionType: '',
    status: '',
    search: '',
  });

  // Check if we're on the auth callback page
  const isAuthCallback = window.location.pathname === '/auth/callback';

  // Cargar lobbies via REST (la primera vez)
  useEffect(() => {
    api.getLobbies()
      .then((data) => {
        setLobbies(data);
        setLoading(false);
      })
      .catch((err) => {
        addToast(t('errors.loadLobbies'), 'error');
        setLoading(false);
      });
  }, []);

  // Filtrar lobbies en cliente
  const filteredLobbies = useMemo(() => {
    return lobbies.filter((lobby) => {
      if (filters.era && lobby.relicEra !== filters.era) return false;
      if (filters.missionType && lobby.missionType !== filters.missionType) return false;
      if (filters.status && lobby.status !== filters.status) return false;
      if (filters.search) {
        const q = filters.search.toLowerCase();
        const matchTitle = lobby.title?.toLowerCase().includes(q);
        const matchRelic = lobby.relicName?.toLowerCase().includes(q);
        const matchEra = lobby.relicEra?.toLowerCase().includes(q);
        const matchHost = lobby.host?.username?.toLowerCase().includes(q);
        const matchMission = lobby.missionType?.toLowerCase().includes(q);
        if (!matchTitle && !matchRelic && !matchEra && !matchHost && !matchMission) return false;
      }
      return true;
    });
  }, [lobbies, filters]);

  const handleCreateLobby = useCallback(async (data: CreateLobbyRequest) => {
    if (!user) {
      setShowLoginModal(true);
      return;
    }

    try {
      await api.createLobby({ ...data, hostId: user.id });
      setShowCreateModal(false);
      addToast('Grupo creado con éxito', 'success');
    } catch (err: any) {
      addToast(err.message || t('errors.createLobby'), 'error');
    }
  }, [user, t]);

  const handleSelectLobby = useCallback((lobby: LobbyDTO) => {
    setSelectedLobby(lobby);
    setView('detail');
  }, []);

  const handleBackToList = useCallback(() => {
    setView('list');
    setSelectedLobby(null);
    setProfileUsername(null);
  }, []);

  const handleViewProfile = useCallback((username: string) => {
    setProfileUsername(username);
    setView('profile');
  }, []);

  const handleLobbyUpdated = useCallback((updated: LobbyDTO) => {
    setLobbies((prev) => prev.map((l) => (l.id === updated.id ? updated : l)));
    setSelectedLobby(updated);
  }, []);

  const lobbyForDetail = useMemo(() => {
    if (!selectedLobby) return null;
    return lobbies.find((l) => l.id === selectedLobby.id) || selectedLobby;
  }, [lobbies, selectedLobby]);

  // Renderizar pantalla de callback de OAuth
  if (isAuthCallback) {
    return <AuthCallback />;
  }

  return (
    <NotificationProvider socket={socket} currentUser={user} lobbies={lobbies} onToast={addToast}>
    <div className="min-h-screen bg-gray-950">
      {/* Header */}
      <header className="border-b border-gray-800 bg-gray-900/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-amber-400 tracking-tight">
              {t('app.title')}
            </h1>
            <span className="text-xs text-gray-500 hidden sm:inline">{t('app.subtitle')}</span>
          </div>

          <div className="flex items-center gap-2 sm:gap-4">
            {/* Usuario autenticado - visible en mobile como avatar solo */}
              {isAuthenticated && user ? (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setProfileUsername(user.username);
                    setView('profile');
                  }}
                  className="text-sm text-gray-400 hover:text-gray-200 transition-colors flex items-center gap-1.5"
                  title={user.username}
                >
                  <div className="w-7 h-7 sm:w-6 sm:h-6 rounded-full bg-gray-700 flex items-center justify-center text-xs font-medium">
                    {user.username.charAt(0)}
                  </div>
                  <span className="hidden sm:inline">{user.username} · MR{user.masteryRank}</span>
                </button>
                <button
                  onClick={logout}
                  className="text-xs text-gray-500 hover:text-red-400 transition-colors p-1"
                  title={t('auth.logout')}
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowLoginModal(true)}
                className="text-sm text-gray-400 hover:text-amber-400 transition-colors flex items-center gap-1"
                title="Iniciar sesión"
              >
                <svg className="w-5 h-5 sm:w-4 sm:h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                </svg>
                <span className="hidden sm:inline">{t('auth.login')}</span>
              </button>
            )}

            {/* Settings button */}
            {isAuthenticated && (
              <button
                onClick={() => setShowSettings(true)}
                className="text-xs px-2 py-1 bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-gray-200 rounded transition-colors hidden sm:block"
                title={t('settings.title')}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </button>
            )}

            {/* Admin button - solo si el usuario es admin */}
            {isAuthenticated && user?.isAdmin && (
              <button
                onClick={() => setShowAdmin(true)}
                className="text-xs px-2 py-1 bg-gray-800 hover:bg-amber-800 text-amber-400 rounded transition-colors hidden sm:block border border-amber-800/30"
                title="Admin"
              >
                ⚙ Admin
              </button>
            )}

            {/* Notificaciones */}
            {isAuthenticated && <NotificationBell />}

            {/* Estado de conexión */}
            <div className="flex items-center gap-1.5">
              <div className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'}`} />
              <span className="text-xs text-gray-400 hidden sm:inline">
                {connected ? t('connection.connected') : t('connection.disconnected')}
              </span>
            </div>

            {/* Botón crear lobby */}
            {view === 'list' && (
              <button
                onClick={() => {
                  if (!user) {
                    setShowLoginModal(true);
                  } else {
                    setShowCreateModal(true);
                  }
                }}
                className="px-3 sm:px-4 py-2 bg-amber-600 hover:bg-amber-500 disabled:bg-gray-700 disabled:cursor-not-allowed text-black font-medium rounded-lg transition-colors text-xs sm:text-sm whitespace-nowrap"
              >
                {t('lobby.create')}
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        {view === 'list' && (
          <>
            {/* Filtros */}
            <LobbyFilters filters={filters} onChange={setFilters} />

            {/* Contador de resultados */}
            {!loading && (
              <div className="text-xs text-gray-500 mb-4">
                {filteredLobbies.length} grupo{filteredLobbies.length !== 1 ? 's' : ''} encontrado{filteredLobbies.length !== 1 ? 's' : ''}
                {filters.era || filters.missionType || filters.status ? ' (con filtros)' : ''}
              </div>
            )}

            {/* Lista */}
            <LobbyList
              lobbies={filteredLobbies}
              loading={loading}
              testUser={user}
              onError={(msg) => addToast(msg, 'error')}
              onSelectLobby={handleSelectLobby}
            />
          </>
        )}

        {view === 'detail' && lobbyForDetail && (
          <LobbyDetail
            lobby={lobbyForDetail}
            testUser={user}
            onError={(msg) => addToast(msg, 'error')}
            onBack={handleBackToList}
            onLobbyUpdated={handleLobbyUpdated}
            onViewProfile={handleViewProfile}
          />
        )}

        {view === 'profile' && profileUsername && (
          <div className="max-w-2xl mx-auto">
            <button
              onClick={handleBackToList}
              className="text-sm text-gray-400 hover:text-gray-200 mb-4 flex items-center gap-1"
            >
              ← Volver al listado
            </button>
            <PlayerProfile
              username={profileUsername}
              onClose={handleBackToList}
              isOwnProfile={user?.username === profileUsername}
              onSettings={() => setShowSettings(true)}
            />
          </div>
        )}
      </main>

      {/* Modal de creación */}
      {showCreateModal && (
        <CreateLobbyModal
          onSubmit={handleCreateLobby}
          onClose={() => setShowCreateModal(false)}
        />
      )}

      {/* Modal de login */}
      {showLoginModal && (
        <DevLoginModal onClose={() => setShowLoginModal(false)} />
      )}

      {/* Admin Panel */}
      {showAdmin && (
        <AdminPanel onClose={() => setShowAdmin(false)} />
      )}

      {/* User Settings */}
      {showSettings && (
        <UserSettings onClose={() => setShowSettings(false)} />
      )}
    </div>
    </NotificationProvider>
  );
}

function App() {
  return (
    <AppContent />
  );
}

export default App;
