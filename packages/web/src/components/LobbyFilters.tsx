import { useTranslation } from 'react-i18next';
import { RELIC_ERAS, MISSION_TYPES } from '@warframe/shared';
import type { RelicEra, MissionType, LobbyStatus } from '@warframe/shared';

export interface FiltersState {
  era: RelicEra | '';
  missionType: MissionType | '';
  status: LobbyStatus | '';
  search: string;
}

interface Props {
  filters: FiltersState;
  onChange: (filters: FiltersState) => void;
}

export default function LobbyFilters({ filters, onChange }: Props) {
  const { t } = useTranslation();

  const update = (partial: Partial<FiltersState>) => {
    onChange({ ...filters, ...partial });
  };

  const activeEraStyle = 'bg-amber-600 text-black font-medium';
  const inactiveEraStyle = 'bg-gray-800 text-gray-300 hover:bg-gray-700';

  return (
    <div className="space-y-3 mb-6">
      {/* Search bar */}
      <div className="relative">
        <input
          type="text"
          value={filters.search}
          onChange={(e) => update({ search: e.target.value })}
          placeholder="Buscar por título, era o reliquia..."
          className="w-full px-4 py-2.5 pl-10 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-amber-500 text-sm"
        />
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      </div>

      {/* Era tabs */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => update({ era: '' })}
          className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
            filters.era === '' ? activeEraStyle : inactiveEraStyle
          }`}
        >
          {t('lobby.filters.all')}
        </button>
        {RELIC_ERAS.map((era) => (
          <button
            key={era}
            onClick={() => update({ era: filters.era === era ? '' : era as RelicEra })}
            className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
              filters.era === era ? activeEraStyle : inactiveEraStyle
            }`}
          >
            {t(`relicEras.${era}` as any)}
          </button>
        ))}
      </div>

      {/* Mission type + Status selects */}
      <div className="flex gap-3 flex-wrap">
        <select
          value={filters.missionType}
          onChange={(e) => update({ missionType: e.target.value as MissionType | '' })}
          className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-gray-300 focus:outline-none focus:border-amber-500"
        >
          <option value="">{t('lobby.filters.allMissions')}</option>
          {MISSION_TYPES.map((mt) => (
            <option key={mt} value={mt}>
              {t(`missionTypes.${mt}` as any)}
            </option>
          ))}
        </select>

        <select
          value={filters.status}
          onChange={(e) => update({ status: e.target.value as LobbyStatus | '' })}
          className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-gray-300 focus:outline-none focus:border-amber-500"
        >
          <option value="">{t('lobby.filters.allStatus')}</option>
          <option value="OPEN">{t('lobby.status.OPEN')}</option>
          <option value="CONFIRMING">{t('lobby.status.CONFIRMING')}</option>
          <option value="IN_PROGRESS">{t('lobby.status.IN_PROGRESS')}</option>
        </select>
      </div>
    </div>
  );
}
