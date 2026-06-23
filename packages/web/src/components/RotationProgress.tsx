import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client.js';

interface Props {
  rotationGroupId: string;
  currentRound: number;
  totalRounds: number;
}

export default function RotationProgress({ rotationGroupId, currentRound, totalRounds }: Props) {
  const { t } = useTranslation();
  const [rotation, setRotation] = useState<{
    lobbies: Array<{ id: string; round: number; status: string; host: { username: string }; participantCount: number }>;
    completedAt: string | null;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getRotation(rotationGroupId)
      .then(setRotation)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [rotationGroupId]);

  if (loading) {
    return <div className="text-sm text-gray-500 animate-pulse">Cargando rotación...</div>;
  }

  if (!rotation) {
    return null;
  }

  const completedRounds = rotation.lobbies.filter((l) => l.status === 'CLOSED' || l.status === 'IN_PROGRESS').length;

  return (
    <div className="bg-gray-800/30 rounded-lg p-4 mb-6 border border-blue-900/30">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-blue-400">
          🔄 Rotación {completedRounds}/{totalRounds}
        </h3>
        {rotation.completedAt && (
          <span className="text-xs text-green-400">✅ Completada</span>
        )}
      </div>

      {/* Progress bar */}
      <div className="w-full bg-gray-800 rounded-full h-2 mb-4">
        <div
          className="h-2 rounded-full bg-blue-500 transition-all duration-500"
          style={{ width: `${(completedRounds / totalRounds) * 100}%` }}
        />
      </div>

      {/* Rounds list */}
      <div className="space-y-2">
        {rotation.lobbies.map((lobby) => (
          <div
            key={lobby.id}
            className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm ${
              lobby.status === 'CLOSED' ? 'bg-green-900/20 text-green-400' :
              lobby.status === 'IN_PROGRESS' ? 'bg-blue-900/20 text-blue-400' :
              lobby.status === 'OPEN' && lobby.id ? 'bg-gray-800/50 text-gray-300' :
              'bg-gray-800/30 text-gray-500'
            }`}
          >
            <div className="flex items-center gap-3">
              <span className="font-medium">Ronda {lobby.round}</span>
              <span className="text-xs text-gray-500">— {lobby.host.username}</span>
            </div>
            <div className="flex items-center gap-2">
              {lobby.status === 'CLOSED' && <span className="text-xs">✅</span>}
              {lobby.status === 'IN_PROGRESS' && <span className="text-xs">🔄</span>}
              {lobby.status === 'OPEN' && <span className="text-xs">⏳</span>}
              <span className="text-xs">{lobby.participantCount}/4</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
