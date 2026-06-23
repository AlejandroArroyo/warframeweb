import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client.js';
import type { LobbyDTO, UserDTO } from '@warframe/shared';

interface Props {
  lobby: LobbyDTO;
  testUser: UserDTO | null;
  onError: (msg: string) => void;
  onSelect: (lobby: LobbyDTO) => void;
}

export default function LobbyCard({ lobby, testUser, onError, onSelect }: Props) {
  const { t } = useTranslation();
  const [joining, setJoining] = useState(false);

  const statusColors: Record<string, string> = {
    OPEN: 'bg-green-600',
    CONFIRMING: 'bg-yellow-600',
    IN_PROGRESS: 'bg-blue-600',
    CLOSED: 'bg-gray-600',
    CANCELLED: 'bg-red-600',
  };

  const statusPulsing = lobby.status === 'CONFIRMING' ? 'animate-pulse' : '';

  const isParticipant = testUser && lobby.participants.some((p) => p.user.id === testUser.id);
  const isHost = testUser && lobby.host.id === testUser.id;

  // Determinar acción del botón según estado y pertenencia
  const canJoin = lobby.status === 'OPEN' && !isHost;
  const canLeave = isParticipant && !isHost && lobby.status === 'OPEN';
  const canStart = isHost && lobby.status === 'OPEN';
  const canComplete = isHost && lobby.status === 'IN_PROGRESS';

  const handleJoin = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!testUser) return;
    setJoining(true);
    try {
      await api.joinLobby(lobby.id, testUser.id);
    } catch (err: any) {
      onError(err.message || t('errors.joinLobby'));
    } finally {
      setJoining(false);
    }
  };

  const handleLeave = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!testUser) return;
    setJoining(true);
    try {
      await api.leaveLobby(lobby.id, testUser.id);
    } catch (err: any) {
      onError(err.message || t('errors.leaveLobby'));
    } finally {
      setJoining(false);
    }
  };

  const handleStatusChange = async (e: React.MouseEvent, newStatus: string) => {
    e.stopPropagation();
    if (!testUser) return;
    setJoining(true);
    try {
      await api.updateLobbyStatus(lobby.id, newStatus, testUser.id);
    } catch (err: any) {
      onError(err.message);
    } finally {
      setJoining(false);
    }
  };

  return (
    <div
      onClick={() => onSelect(lobby)}
      className="bg-gray-900 border border-gray-800 rounded-xl p-5 hover:border-gray-700 transition-all cursor-pointer group"
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="min-w-0">
          <h3 className="font-semibold text-white truncate group-hover:text-amber-400 transition-colors">
            {lobby.title}
          </h3>
          <p className="text-sm text-gray-400 mt-0.5">
            {lobby.host.username} · MR {lobby.host.masteryRank}
          </p>
        </div>
        <span
          className={`px-2 py-0.5 rounded text-xs font-medium text-white shrink-0 ${statusColors[lobby.status]} ${statusPulsing}`}
        >
          {t(`lobby.status.${lobby.status}` as any)}
        </span>
      </div>

      {/* Meta info */}
      <div className="flex items-center gap-3 text-sm text-gray-400 mb-3 flex-wrap">
        <span>🎯 {t(`missionTypes.${lobby.missionType}` as any)}</span>
        <span>
          👥 {lobby.participantCount}/{lobby.squadSize}
        </span>
        {lobby.isRadshare && (
          <span className="text-amber-400 font-medium text-xs border border-amber-600/30 px-1.5 py-0.5 rounded">
            {t('lobby.radshare')}
          </span>
        )}
        {lobby.rotationGroupId && (
          <span className="text-blue-400 font-medium text-xs border border-blue-600/30 px-1.5 py-0.5 rounded">
            🔄 {lobby.rotationRound}/{lobby.rotationTotal}
          </span>
        )}
        {lobby.relicName && (
          <span className="text-gray-500 text-xs">
            {lobby.relicEra} {lobby.relicName}
          </span>
        )}
      </div>

      {/* Participantes preview */}
      {lobby.participants.length > 0 && (
        <div className="flex items-center gap-1.5 mb-3">
          {lobby.participants.map((p) => (
            <div
              key={p.id}
              className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium ${
                p.confirmed
                  ? 'bg-green-800 text-green-200'
                  : 'bg-gray-800 text-gray-400'
              }`}
              title={`${p.user.username}${p.confirmed ? ' ✓' : ''}`}
            >
              {p.user.username.charAt(0).toUpperCase()}
            </div>
          ))}
          {Array.from({ length: lobby.squadSize - lobby.participants.length }).map((_, i) => (
            <div
              key={`empty-${i}`}
              className="w-7 h-7 rounded-full bg-gray-800/50 border border-dashed border-gray-700 flex items-center justify-center"
            >
              <span className="text-gray-600 text-xs">+</span>
            </div>
          ))}
        </div>
      )}

      {/* Acciones */}
      <div className="flex gap-2">
        {canJoin && (
          <button
            onClick={handleJoin}
            disabled={joining}
            className="flex-1 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
          >
            {joining ? '...' : isParticipant ? t('lobby.leave') : t('lobby.join')}
          </button>
        )}
        {canLeave && (
          <button
            onClick={handleLeave}
            disabled={joining}
            className="flex-1 py-2 bg-red-900/50 hover:bg-red-800 text-red-200 rounded-lg text-sm font-medium transition-colors"
          >
            {joining ? '...' : t('lobby.leave')}
          </button>
        )}
        {canStart && (
          <button
            onClick={(e) => handleStatusChange(e, 'CONFIRMING')}
            className="flex-1 py-2 bg-amber-600 hover:bg-amber-500 text-black rounded-lg text-sm font-medium transition-colors"
          >
            {t('lobby.start')}
          </button>
        )}
        {canComplete && (
          <button
            onClick={(e) => handleStatusChange(e, 'CLOSED')}
            className="flex-1 py-2 bg-green-700 hover:bg-green-600 text-white rounded-lg text-sm font-medium transition-colors"
          >
            {t('lobby.complete')}
          </button>
        )}
        {!canJoin && !canLeave && !canStart && !canComplete && (
          <button
            onClick={() => onSelect(lobby)}
            className="flex-1 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm font-medium transition-colors"
          >
            {t('lobby.viewDetail')}
          </button>
        )}
      </div>
    </div>
  );
}
