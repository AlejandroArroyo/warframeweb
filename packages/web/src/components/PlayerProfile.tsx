import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client.js';
import type { PlayerProfile as ProfileData, RunWithLobbyDTO } from '@warframe/shared';

interface Props {
  username: string;
  onClose: () => void;
  isOwnProfile?: boolean;
  onSettings?: () => void;
}

export default function PlayerProfile({ username, onClose, isOwnProfile, onSettings }: Props) {
  const { t } = useTranslation();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.getUserProfile(username)
      .then(setProfile)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [username]);

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
        <div className="bg-gray-900 border border-gray-800 rounded-xl w-full max-w-2xl mx-4 p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-gray-800 rounded w-1/3" />
            <div className="h-20 bg-gray-800 rounded" />
            <div className="h-32 bg-gray-800 rounded" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
        <div className="bg-gray-900 border border-gray-800 rounded-xl w-full max-w-sm mx-4 p-6 text-center">
          <div className="text-red-400 mb-4">⚠️ {error || 'Error al cargar perfil'}</div>
          <button onClick={onClose} className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-sm">
            Cerrar
          </button>
        </div>
      </div>
    );
  }

  const { user, stats, recentRuns, createdAt } = profile;
  const maxEraCount = Math.max(...Object.values(stats.runsByEra), 1);
  const maxMissionCount = Math.max(...Object.values(stats.runsByMission), 1);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-gray-900 border border-gray-800 rounded-xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-gray-900/95 backdrop-blur-sm border-b border-gray-800 px-6 py-4 flex items-center justify-between z-10">
          <h2 className="text-lg font-semibold text-white">Perfil de jugador</h2>
          <div className="flex items-center gap-2">
            {isOwnProfile && onSettings && (
              <button
                onClick={onSettings}
                className="text-gray-500 hover:text-gray-300 transition-colors"
                title="Ajustes"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </button>
            )}
            <button onClick={onClose} className="text-gray-500 hover:text-gray-300 text-lg">✕</button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* User info card */}
          <div className="bg-gradient-to-r from-gray-800/50 to-gray-800/30 rounded-xl p-5 border border-gray-700/30">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-full bg-amber-600/20 border-2 border-amber-500/30 flex items-center justify-center text-2xl font-bold text-amber-400">
                {user.username.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1">
                <div className="text-white text-xl font-semibold">{user.username}</div>
                <div className="text-sm text-gray-400 mt-0.5">
                  <span className="text-amber-400 font-medium">MR{user.masteryRank}</span>
                  <span className="mx-2">·</span>
                  {user.platform}
                  <span className="mx-2">·</span>
                  <span title="Puntuación de reputación">
                    🏆 {user.reputation} rep
                  </span>
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  Miembro desde {new Date(createdAt).toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' })}
                </div>
              </div>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard label="Runs totales" value={stats.totalRuns} icon="📊" />
            <StatCard label="Completados" value={stats.completedRuns} icon="✅" color="text-green-400" />
            <StatCard label="Radshares" value={stats.radshareRuns} icon="💎" color="text-amber-400" />
            <StatCard label="Rotaciones" value={stats.rotationsCompleted} icon="🔄" color="text-blue-400" />
            <StatCard label="Racha actual" value={`${stats.currentStreak} 📅`} icon="🔥" color="text-orange-400" />
            <StatCard label="Mejor racha" value={`${stats.longestStreak} 📅`} icon="⚡" color="text-yellow-400" />
            <StatCard label="Reputación" value={stats.reputation} icon="🏆" color="text-purple-400" />
            {stats.topRelic && (
              <StatCard
                label="Reliquia top"
                value={`${stats.topRelic.era} ${stats.topRelic.name}`}
                icon="⭐"
                color="text-cyan-400"
                small
              />
            )}
          </div>

          {/* Runs by Era chart */}
          <div>
            <h3 className="text-sm font-medium text-gray-300 mb-3">Runs por era</h3>
            <div className="space-y-2">
              {['Lith', 'Meso', 'Neo', 'Axi'].map((era) => {
                const count = stats.runsByEra[era] || 0;
                const pct = (count / maxEraCount) * 100;
                return (
                  <div key={era} className="flex items-center gap-3">
                    <span className="text-xs text-gray-400 w-12 text-right">{era}</span>
                    <div className="flex-1 bg-gray-800 rounded-full h-5 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${Math.max(pct, count > 0 ? 5 : 0)}%`,
                          backgroundColor: era === 'Lith' ? '#10b981' : era === 'Meso' ? '#f59e0b' : era === 'Neo' ? '#3b82f6' : '#ef4444',
                        }}
                      />
                    </div>
                    <span className="text-xs text-gray-500 w-8">{count}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Runs by Mission chart */}
          <div>
            <h3 className="text-sm font-medium text-gray-300 mb-3">Runs por misión</h3>
            <div className="space-y-2">
              {Object.entries(stats.runsByMission)
                .sort(([, a], [, b]) => b - a)
                .map(([mission, count]) => {
                  const pct = (count / maxMissionCount) * 100;
                  return (
                    <div key={mission} className="flex items-center gap-3">
                      <span className="text-xs text-gray-400 w-24 text-right truncate">{mission}</span>
                      <div className="flex-1 bg-gray-800 rounded-full h-5 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-indigo-500 transition-all duration-500"
                          style={{ width: `${Math.max(pct, count > 0 ? 5 : 0)}%` }}
                        />
                      </div>
                      <span className="text-xs text-gray-500 w-8">{count}</span>
                    </div>
                  );
                })}
            </div>
          </div>

          {/* Recent Runs */}
          <div>
            <h3 className="text-sm font-medium text-gray-300 mb-3">Actividad reciente</h3>
            {recentRuns.length === 0 ? (
              <div className="text-sm text-gray-500 text-center py-6">
                Aún no hay runs registrados. ¡Unite a un lobby y completá misiones!
              </div>
            ) : (
              <div className="space-y-2">
                {recentRuns.map((run) => (
                  <div
                    key={run.id}
                    className="flex items-center justify-between px-4 py-2.5 bg-gray-800/30 rounded-lg text-sm"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className={run.completed ? 'text-green-400' : 'text-red-400'}>
                        {run.completed ? '✅' : '❌'}
                      </span>
                      <div className="truncate">
                        {run.lobby ? (
                          <>
                            <span className="text-gray-200">{run.lobby.title}</span>
                            <span className="text-gray-500 ml-2 text-xs">
                              {run.lobby.relicEra} {run.lobby.relicName}
                            </span>
                          </>
                        ) : (
                          <span className="text-gray-500">Run sin lobby asociado</span>
                        )}
                      </div>
                    </div>
                    <div className="text-xs text-gray-500 shrink-0 ml-3">
                      {new Date(run.createdAt).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Ver historial completo */}
          {recentRuns.length > 0 && (
            <div className="text-center">
              <span className="text-xs text-gray-500">
                Mostrando los últimos {recentRuns.length} runs
              </span>
            </div>
          )}

          {/* Logout */}
          <button
            onClick={onClose}
            className="w-full px-4 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg transition-colors text-sm"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, icon, color = 'text-gray-200', small = false }: {
  label: string;
  value: string | number;
  icon: string;
  color?: string;
  small?: boolean;
}) {
  return (
    <div className="bg-gray-800/30 rounded-lg p-3 border border-gray-700/20">
      <div className="text-xs text-gray-500 mb-1">{label}</div>
      <div className={`font-semibold ${color} ${small ? 'text-xs truncate' : 'text-lg'}`}>
        {icon} {value}
      </div>
    </div>
  );
}
