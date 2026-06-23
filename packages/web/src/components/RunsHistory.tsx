import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client.js';

interface Props {
  username: string;
}

interface RunData {
  id: string;
  completed: boolean;
  createdAt: string;
  completedAt: string | null;
  lobby: {
    id: string;
    title: string;
    missionType: string;
    relicEra: string;
    relicName: string | null;
    isRadshare: boolean;
  } | null;
}

interface StatsData {
  totalRuns: number;
  completedRuns: number;
  radshareRuns: number;
}

export default function RunsHistory({ username }: Props) {
  const { t } = useTranslation();
  const [runs, setRuns] = useState<RunData[]>([]);
  const [stats, setStats] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getUserRuns(username)
      .then((data) => {
        setRuns(data.runs);
        setStats(data.stats);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [username]);

  if (loading) {
    return (
      <div className="animate-pulse space-y-3">
        <div className="h-4 bg-gray-800 rounded w-1/3" />
        <div className="h-20 bg-gray-800 rounded-lg" />
        <div className="h-12 bg-gray-800 rounded-lg" />
      </div>
    );
  }

  return (
    <div>
      {/* Stats cards */}
      {stats && (
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="bg-gray-800/50 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-white">{stats.totalRuns}</div>
            <div className="text-xs text-gray-500">{t('runs.stats.total')}</div>
          </div>
          <div className="bg-gray-800/50 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-green-400">{stats.completedRuns}</div>
            <div className="text-xs text-gray-500">{t('runs.stats.completed')}</div>
          </div>
          <div className="bg-gray-800/50 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-amber-400">{stats.radshareRuns}</div>
            <div className="text-xs text-gray-500">{t('runs.stats.radshare')}</div>
          </div>
        </div>
      )}

      {/* Run list */}
      {runs.length === 0 ? (
        <div className="text-center py-8 text-gray-500 text-sm">
          {t('runs.empty')}
        </div>
      ) : (
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {runs.map((run) => (
            <div
              key={run.id}
              className="flex items-center justify-between bg-gray-800/30 rounded-lg px-4 py-2.5 text-sm"
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className={`w-2 h-2 rounded-full shrink-0 ${run.completed ? 'bg-green-500' : 'bg-yellow-500'}`} />
                <div className="truncate">
                  <span className="text-gray-200">{run.lobby?.title || t('runs.deletedLobby')}</span>
                  {run.lobby?.isRadshare && (
                    <span className="ml-2 text-xs text-amber-400">RAD</span>
                  )}
                </div>
              </div>
              <div className="text-xs text-gray-500 shrink-0 ml-3">
                {new Date(run.createdAt).toLocaleDateString('es-ES', {
                  day: '2-digit',
                  month: '2-digit',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
