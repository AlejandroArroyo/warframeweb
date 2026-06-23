import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client.js';
import { RELIC_ERAS } from '@warframe/shared';
import type { LobbyDTO, UserDTO, RelicEra } from '@warframe/shared';
import { useSocket } from '../hooks/useSocket.js';
import ConfirmDialog from './ConfirmDialog.js';
import RotationProgress from './RotationProgress.js';
import ReportPlayerModal from './ReportPlayerModal.js';

interface Props {
  lobby: LobbyDTO;
  testUser: UserDTO | null;
  onError: (msg: string) => void;
  onBack: () => void;
  onLobbyUpdated: (lobby: LobbyDTO) => void;
  onViewProfile?: (username: string) => void;
}

export default function LobbyDetail({ lobby, testUser, onError, onBack, onLobbyUpdated, onViewProfile }: Props) {
  const { t } = useTranslation();
  const { joinLobbyRoom, leaveLobbyRoom } = useSocket();
  const [acting, setActing] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportTargetUser, setReportTargetUser] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<{ type: 'kick' | 'cancel' | 'leave'; targetUserId?: string } | null>(null);

  // Unirse al room del lobby al montar, salir al desmontar
  useEffect(() => {
    joinLobbyRoom(lobby.id);
    return () => {
      leaveLobbyRoom(lobby.id);
    };
  }, [lobby.id]);

  const isHost = testUser && lobby.host.id === testUser.id;
  const isParticipant = testUser && lobby.participants.some((p) => p.user.id === testUser.id);
  const myParticipation = testUser && lobby.participants.find((p) => p.user.id === testUser.id);

  const statusColors: Record<string, string> = {
    OPEN: 'bg-green-600',
    CONFIRMING: 'bg-yellow-600 animate-pulse',
    IN_PROGRESS: 'bg-blue-600',
    CLOSED: 'bg-gray-600',
    CANCELLED: 'bg-red-600',
  };

  const confirmCount = lobby.participants.filter((p) => p.confirmed).length;
  const readyCount = lobby.participants.filter((p) => p.ready).length;
  const isFull = lobby.participants.length >= lobby.squadSize;
  const allConfirmed = isFull && lobby.participants.every((p) => p.confirmed);
  const allReady = isFull && lobby.participants.every((p) => p.ready);

  // Countdown logic for ready check
  useEffect(() => {
    if (lobby.status !== 'CONFIRMING' || allReady) {
      setCountdown(null);
      return;
    }

    // Si todos confirmaron, iniciar countdown de 30s
    if (allConfirmed) {
      setCountdown(30);
      const timer = setInterval(() => {
        setCountdown((prev) => {
          if (prev === null || prev <= 1) {
            clearInterval(timer);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [lobby.status, allConfirmed, allReady]);

  // Auto-redirect cuando todos están ready y pasa a IN_PROGRESS
  useEffect(() => {
    if (lobby.status === 'IN_PROGRESS' && allReady) {
      setCountdown(null);
    }
  }, [lobby.status, allReady]);

  const handleJoin = async () => {
    if (!testUser) return;
    setActing(true);
    try {
      await api.joinLobby(lobby.id, testUser.id);
    } catch (err: any) {
      onError(err.message || t('errors.joinLobby'));
    } finally {
      setActing(false);
    }
  };

  const handleLeave = async () => {
    if (!testUser) return;
    setActing(true);
    try {
      await api.leaveLobby(lobby.id, testUser.id);
    } finally {
      setActing(false);
    }
  };

  const handleConfirm = async () => {
    if (!testUser) return;
    setActing(true);
    try {
      const updated = await api.confirmRelic(lobby.id, testUser.id, lobby.relicName || undefined);
      onLobbyUpdated(updated);
    } catch (err: any) {
      onError(err.message || 'Error al confirmar');
    } finally {
      setActing(false);
    }
  };

  const handleReady = async () => {
    if (!testUser) return;
    setActing(true);
    try {
      const updated = await api.markReady(lobby.id, testUser.id);
      onLobbyUpdated(updated);
    } catch (err: any) {
      onError(err.message || 'Error al marcar listo');
    } finally {
      setActing(false);
    }
  };

  const handleUnready = async () => {
    if (!testUser) return;
    setActing(true);
    try {
      await api.markUnready(lobby.id, testUser.id);
      // Refetch lobby
      const refreshed = await api.getLobby(lobby.id);
      onLobbyUpdated(refreshed);
    } catch (err: any) {
      onError(err.message);
    } finally {
      setActing(false);
    }
  };

  const handleKick = async (targetUserId: string) => {
    if (!testUser) return;
    setConfirmAction(null);
    setActing(true);
    try {
      await api.kickParticipant(lobby.id, testUser.id, targetUserId);
    } catch (err: any) {
      onError(err.message || 'Error al expulsar');
    } finally {
      setActing(false);
    }
  };

  const handleLeaveWithConfirm = async () => {
    if (!testUser) return;
    setConfirmAction(null);
    setActing(true);
    try {
      await api.leaveLobby(lobby.id, testUser.id);
    } catch (err: any) {
      onError(err.message || t('errors.leaveLobby'));
    } finally {
      setActing(false);
    }
  };

  const handleCancelWithConfirm = async () => {
    if (!testUser) return;
    setConfirmAction(null);
    setActing(true);
    try {
      const updated = await api.updateLobbyStatus(lobby.id, 'CANCELLED', testUser.id);
      onLobbyUpdated(updated);
    } catch (err: any) {
      onError(err.message);
    } finally {
      setActing(false);
    }
  };

  const handleStatusChange = async (status: string) => {
    if (!testUser) return;
    setActing(true);
    try {
      const updated = await api.updateLobbyStatus(lobby.id, status, testUser.id);
      onLobbyUpdated(updated);
    } catch (err: any) {
      onError(err.message);
    } finally {
      setActing(false);
    }
  };

  return (
    <div>
      {/* Back button */}
      <button
        onClick={onBack}
        className="mb-4 text-sm text-gray-400 hover:text-gray-200 transition-colors flex items-center gap-1"
      >
        ← {t('lobby.back')}
      </button>

      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold text-white">{lobby.title}</h2>
            <p className="text-gray-400 mt-1">
              {t('lobby.createdBy')}{' '}
              <button
                onClick={() => onViewProfile?.(lobby.host.username)}
                className="text-amber-400 hover:text-amber-300 hover:underline font-medium"
              >
                {lobby.host.username}
              </button>
              {' · MR'}{lobby.host.masteryRank}
            </p>
          </div>
          <span className={`px-3 py-1 rounded text-sm font-medium text-white ${statusColors[lobby.status]}`}>
            {t(`lobby.status.${lobby.status}` as any)}
          </span>
        </div>

        {/* Info grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          <div className="bg-gray-800/50 rounded-lg p-3">
            <div className="text-xs text-gray-500 mb-1">{t('lobby.info.mission')}</div>
            <div className="text-sm font-medium">{t(`missionTypes.${lobby.missionType}` as any)}</div>
          </div>
          <div className="bg-gray-800/50 rounded-lg p-3">
            <div className="text-xs text-gray-500 mb-1">{t('lobby.info.era')}</div>
            <div className="text-sm font-medium">{t(`relicEras.${lobby.relicEra}` as any)}</div>
          </div>
          <div className="bg-gray-800/50 rounded-lg p-3">
            <div className="text-xs text-gray-500 mb-1">{t('lobby.info.relic')}</div>
            <div className="text-sm font-medium">{lobby.relicName || '—'}</div>
          </div>
          <div className="bg-gray-800/50 rounded-lg p-3">
            <div className="text-xs text-gray-500 mb-1">{t('lobby.info.players')}</div>
            <div className="text-sm font-medium">{lobby.participantCount}/{lobby.squadSize}</div>
          </div>
        </div>

        {/* Badges */}
        <div className="flex gap-2 mb-6 flex-wrap">
          {lobby.isRadshare && (
            <span className="inline-block px-3 py-1 bg-amber-600/20 border border-amber-600/30 rounded-lg text-amber-400 text-sm font-medium">
              {t('lobby.radshare')}
            </span>
          )}
          {lobby.rotationGroupId && (
            <span className="inline-block px-3 py-1 bg-blue-600/20 border border-blue-600/30 rounded-lg text-blue-400 text-sm font-medium">
              🔄 Rotación {lobby.rotationRound}/{lobby.rotationTotal}
            </span>
          )}
        </div>

        {/* Rotation progress */}
        {lobby.rotationGroupId && (
          <RotationProgress
            rotationGroupId={lobby.rotationGroupId}
            currentRound={lobby.rotationRound || 1}
            totalRounds={lobby.rotationTotal || 4}
          />
        )}

        {/* Radshare confirmation progress */}
        {lobby.isRadshare && lobby.status === 'OPEN' && (
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-300">
                {t('lobby.confirmationProgress')}
              </span>
              <span className="text-sm text-gray-400">
                {confirmCount}/{lobby.squadSize} {t('lobby.confirmed').toLowerCase()}
              </span>
            </div>

            {/* Progress bar */}
            <div className="w-full bg-gray-800 rounded-full h-2 mb-4">
              <div
                className={`h-2 rounded-full transition-all duration-500 ${
                  confirmCount === lobby.squadSize ? 'bg-green-500' : 'bg-amber-500'
                }`}
                style={{ width: `${(confirmCount / lobby.squadSize) * 100}%` }}
              />
            </div>

            {/* Mi botón de confirmar */}
            {myParticipation && !myParticipation.confirmed && (
              <button
                onClick={handleConfirm}
                disabled={acting}
                className="w-full py-2.5 bg-amber-600 hover:bg-amber-500 text-black font-medium rounded-lg transition-colors disabled:opacity-50"
              >
                {acting ? '...' : t('lobby.confirmRelic')}
              </button>
            )}

            {myParticipation?.confirmed && (
              <div className="text-sm text-green-400 text-center py-2">
                ✅ {t('lobby.relicConfirmed')}
              </div>
            )}
          </div>
        )}

        {/* Ready check in CONFIRMING state */}
        {lobby.status === 'CONFIRMING' && (
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-300">
                {t('lobby.readyCheck')}
              </span>
              <span className="text-sm text-gray-400">
                {readyCount}/{lobby.participantCount} {t('lobby.ready').toLowerCase()}
              </span>
            </div>

            {/* Ready progress bar */}
            <div className="w-full bg-gray-800 rounded-full h-2 mb-3">
              <div
                className={`h-2 rounded-full transition-all duration-500 ${
                  allReady ? 'bg-green-500' : 'bg-amber-500'
                }`}
                style={{ width: `${lobby.participantCount > 0 ? (readyCount / lobby.participantCount) * 100 : 0}%` }}
              />
            </div>

            {/* Countdown */}
            {countdown !== null && countdown > 0 && !allReady && (
              <div className="text-center mb-3">
                <span className="text-2xl font-bold text-amber-400">{countdown}s</span>
                <span className="text-gray-500 text-sm ml-2">{t('lobby.readyCountdown')}</span>
              </div>
            )}

            {/* Ready / Unready buttons */}
            {myParticipation && (
              <div className="flex gap-2">
                {!myParticipation.ready ? (
                  <button
                    onClick={handleReady}
                    disabled={acting}
                    className="flex-1 py-2.5 bg-green-700 hover:bg-green-600 text-white font-medium rounded-lg transition-colors disabled:opacity-50"
                  >
                    {acting ? '...' : '✅ ' + t('lobby.ready')}
                  </button>
                ) : (
                  <button
                    onClick={handleUnready}
                    disabled={acting}
                    className="flex-1 py-2.5 bg-yellow-700 hover:bg-yellow-600 text-white font-medium rounded-lg transition-colors"
                  >
                    {acting ? '...' : t('lobby.unready')}
                  </button>
                )}
              </div>
            )}

            {allReady && (
              <div className="text-green-400 text-center py-2 text-sm font-medium">
                ✅ {t('lobby.allReady')}
              </div>
            )}
          </div>
        )}

        {/* Participant list */}
        <div className="mb-6">
          <h3 className="text-sm font-medium text-gray-300 mb-3">
            {t('lobby.participantsTitle')} ({lobby.participantCount}/{lobby.squadSize})
          </h3>
          <div className="space-y-2">
            {lobby.participants.map((p, idx) => (
              <div
                key={p.id}
                className="flex items-center justify-between bg-gray-800/30 rounded-lg px-4 py-2.5"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center text-sm font-medium text-gray-300">
                    {p.user.username.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="text-sm font-medium text-gray-200">
                      {p.user.username}
                      {lobby.host.id === p.user.id && (
                        <span className="ml-2 text-xs text-amber-400">({t('lobby.host')})</span>
                      )}
                    </div>
                    <div className="text-xs text-gray-500">
                      MR{p.user.masteryRank} · {p.user.platform}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {p.confirmed && (
                    <span className="text-xs px-2 py-0.5 rounded bg-green-900/50 text-green-400">
                      {t('lobby.confirmed')}
                    </span>
                  )}
                  {p.ready && (
                    <span className="text-xs px-2 py-0.5 rounded bg-amber-900/50 text-amber-400">
                      {t('lobby.ready')}
                    </span>
                  )}
                  {p.refinement && p.confirmed && (
                    <span className="text-xs text-gray-500">{p.refinement}</span>
                  )}
                  {/* Kick button (solo host, no a si mismo, solo OPEN/CONFIRMING) */}
                  {isHost && p.user.id !== lobby.host.id && (lobby.status === 'OPEN' || lobby.status === 'CONFIRMING') && (
                    <button
                      onClick={() => setConfirmAction({ type: 'kick', targetUserId: p.user.id })}
                      disabled={acting}
                      className="text-xs px-2 py-0.5 rounded bg-red-900/40 hover:bg-red-800 text-red-400 transition-colors"
                    >
                      {t('lobby.kick')}
                    </button>
                  )}
                </div>
              </div>
            ))}
            {/* Empty slots */}
            {Array.from({ length: lobby.squadSize - lobby.participants.length }).map((_, i) => (
              <div
                key={`empty-${i}`}
                className="flex items-center justify-between bg-gray-800/10 border border-dashed border-gray-700/50 rounded-lg px-4 py-2.5"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-gray-800/50 border border-dashed border-gray-700 flex items-center justify-center">
                    <span className="text-gray-600 text-lg">+</span>
                  </div>
                  <span className="text-sm text-gray-600">{t('lobby.emptySlot')}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Estado completado */}
        {lobby.status === 'CLOSED' && (
          <div className="mb-4 p-4 bg-green-900/20 border border-green-700/30 rounded-lg text-center">
            <div className="text-2xl mb-1">✅</div>
            <div className="text-green-400 font-medium text-sm mb-3">{t('lobby.completedMessage')}</div>
            {/* Reportar jugadores */}
            <div className="flex flex-wrap gap-2 justify-center">
              {lobby.participants
                .filter((p) => testUser && p.user.id !== testUser.id)
                .map((p) => (
                  <button
                    key={p.user.id}
                    onClick={() => {
                      setReportTargetUser(p.user.username);
                      setShowReportModal(true);
                    }}
                    className="text-xs px-3 py-1.5 bg-red-900/40 hover:bg-red-800 text-red-400 rounded-lg transition-colors"
                  >
                    {t('lobby.reportPlayer', { username: p.user.username })}
                  </button>
                ))}
            </div>
          </div>
        )}

        {/* Estado cancelado */}
        {lobby.status === 'CANCELLED' && (
          <div className="mb-4 p-4 bg-red-900/20 border border-red-700/30 rounded-lg text-center">
            <div className="text-2xl mb-1">🚫</div>
            <div className="text-red-400 font-medium text-sm">{t('lobby.cancelledMessage')}</div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          {lobby.status === 'OPEN' && !isHost && !isParticipant && (
            <button
              onClick={handleJoin}
              disabled={acting}
              className="flex-1 py-2.5 bg-amber-600 hover:bg-amber-500 text-black font-medium rounded-lg transition-colors disabled:opacity-50"
            >
              {acting ? '...' : t('lobby.join')}
            </button>
          )}
          {lobby.status === 'OPEN' && isParticipant && !isHost && (
            <button
              onClick={() => setConfirmAction({ type: 'leave' })}
              disabled={acting}
              className="flex-1 py-2.5 bg-red-900/50 hover:bg-red-800 text-red-200 font-medium rounded-lg transition-colors"
            >
              {acting ? '...' : t('lobby.leave')}
            </button>
          )}
          {isHost && lobby.status === 'OPEN' && !lobby.isRadshare && (
            <button
              onClick={() => handleStatusChange('CONFIRMING')}
              disabled={acting}
              className="flex-1 py-2.5 bg-amber-600 hover:bg-amber-500 text-black font-medium rounded-lg transition-colors"
            >
              {t('lobby.start')}
            </button>
          )}
          {isHost && lobby.status === 'IN_PROGRESS' && (
            <button
              onClick={() => handleStatusChange('CLOSED')}
              disabled={acting}
              className="flex-1 py-2.5 bg-green-700 hover:bg-green-600 text-white font-medium rounded-lg transition-colors"
            >
              {acting ? '...' : t('lobby.complete')}
            </button>
          )}
          {isHost && lobby.status !== 'CLOSED' && lobby.status !== 'CANCELLED' && lobby.status !== 'CONFIRMING' && (
            <button
              onClick={() => setConfirmAction({ type: 'cancel' })}
              disabled={acting}
              className="py-2.5 px-4 bg-gray-800 hover:bg-gray-700 text-gray-400 font-medium rounded-lg transition-colors"
            >
              {t('lobby.cancel')}
            </button>
          )}
          {/* Volver atrás cuando está cerrado */}
          {(lobby.status === 'CLOSED' || lobby.status === 'CANCELLED') && (
            <button
              onClick={onBack}
              className="flex-1 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-300 font-medium rounded-lg transition-colors"
            >
              {t('lobby.back')}
            </button>
          )}
        </div>
      </div>

      {/* Confirm Action Dialog */}
      {confirmAction && (
        <ConfirmDialog
          title={
            confirmAction.type === 'kick' ? 'Expulsar jugador' :
            confirmAction.type === 'cancel' ? 'Cancelar misión' :
            'Salir del grupo'
          }
          message={
            confirmAction.type === 'kick' ? '¿Estás seguro de expulsar a este jugador?' :
            confirmAction.type === 'cancel' ? '¿Estás seguro? Esta acción no se puede deshacer.' :
            '¿Estás seguro de que quieres salir del grupo?'
          }
          confirmLabel={
            confirmAction.type === 'kick' ? 'Expulsar' :
            confirmAction.type === 'cancel' ? 'Cancelar misión' :
            'Salir'
          }
          variant="danger"
          onConfirm={() => {
            if (confirmAction.type === 'kick' && confirmAction.targetUserId) {
              handleKick(confirmAction.targetUserId);
            } else if (confirmAction.type === 'cancel') {
              handleCancelWithConfirm();
            } else if (confirmAction.type === 'leave') {
              handleLeaveWithConfirm();
            }
          }}
          onCancel={() => setConfirmAction(null)}
          loading={acting}
        />
      )}

      {/* Report Player Modal */}
      {showReportModal && reportTargetUser && (
        <ReportPlayerModal
          reportedUsername={reportTargetUser}
          lobbyId={lobby.id}
          onClose={() => {
            setShowReportModal(false);
            setReportTargetUser(null);
          }}
        />
      )}
    </div>
  );
}
