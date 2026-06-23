import { useTranslation } from 'react-i18next';
import LobbyCard from './LobbyCard.js';
import type { LobbyDTO, UserDTO } from '@warframe/shared';

interface Props {
  lobbies: LobbyDTO[];
  loading: boolean;
  testUser: UserDTO | null;
  onError: (msg: string) => void;
  onSelectLobby: (lobby: LobbyDTO) => void;
}

function SkeletonCard() {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 animate-pulse">
      <div className="flex justify-between mb-3">
        <div className="space-y-2 flex-1">
          <div className="h-4 bg-gray-800 rounded w-3/4" />
          <div className="h-3 bg-gray-800 rounded w-1/2" />
        </div>
        <div className="h-5 bg-gray-800 rounded w-16" />
      </div>
      <div className="flex gap-3 mb-3">
        <div className="h-3 bg-gray-800 rounded w-20" />
        <div className="h-3 bg-gray-800 rounded w-16" />
      </div>
      <div className="flex gap-1.5 mb-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="w-7 h-7 rounded-full bg-gray-800" />
        ))}
      </div>
      <div className="h-9 bg-gray-800 rounded-lg w-full" />
    </div>
  );
}

export default function LobbyList({ lobbies, loading, testUser, onError, onSelectLobby }: Props) {
  const { t } = useTranslation();

  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    );
  }

  if (lobbies.length === 0) {
    return (
      <div className="text-center py-20">
        <div className="text-6xl mb-4">💠</div>
        <h2 className="text-xl font-semibold text-gray-300 mb-2">
          {t('empty.title')}
        </h2>
        <p className="text-gray-500">
          {t('empty.description')}
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {lobbies.map((lobby) => (
        <LobbyCard
          key={lobby.id}
          lobby={lobby}
          testUser={testUser}
          onError={onError}
          onSelect={onSelectLobby}
        />
      ))}
    </div>
  );
}
