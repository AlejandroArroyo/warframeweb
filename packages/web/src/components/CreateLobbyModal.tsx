import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client.js';
import { MISSION_TYPES, RELIC_ERAS } from '@warframe/shared';
import type { CreateLobbyRequest, MissionType, RelicEra } from '@warframe/shared';

interface Props {
  onSubmit: (data: CreateLobbyRequest) => Promise<void>;
  onClose: () => void;
}

interface RelicOption {
  id: string;
  era: string;
  name: string;
}

export default function CreateLobbyModal({ onSubmit, onClose }: Props) {
  const { t } = useTranslation();
  const [missionType, setMissionType] = useState<MissionType>('Capture');
  const [relicEra, setRelicEra] = useState<RelicEra>('Neo');
  const [relicName, setRelicName] = useState('');
  const [isRadshare, setIsRadshare] = useState(false);
  const [isRotation, setIsRotation] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [relics, setRelics] = useState<RelicOption[]>([]);
  const [loadingRelics, setLoadingRelics] = useState(false);

  // Cargar reliquias cuando cambia la era
  useEffect(() => {
    if (!isRadshare) return;
    setLoadingRelics(true);
    api.getRelics(relicEra)
      .then(setRelics)
      .catch(() => setRelics([]))
      .finally(() => setLoadingRelics(false));
  }, [relicEra, isRadshare]);

  // Resetear nombre de reliquia si se desactiva radshare
  useEffect(() => {
    if (!isRadshare) {
      setRelicName('');
      setIsRotation(false);
    }
  }, [isRadshare]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    try {
      await onSubmit({
        missionType,
        relicEra,
        relicName: isRadshare ? relicName : undefined,
        isRadshare,
        isRotation,
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-gray-900 border border-gray-800 rounded-xl w-full max-w-md mx-4 p-6">
        <h2 className="text-lg font-semibold text-white mb-4">
          {t('create.title')}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Tipo de misión */}
          <div>
            <label className="block text-sm text-gray-400 mb-1">{t('create.missionType')}</label>
            <select
              value={missionType}
              onChange={(e) => setMissionType(e.target.value as MissionType)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-gray-100 text-sm focus:outline-none focus:border-amber-500"
            >
              {MISSION_TYPES.map((mt) => (
                <option key={mt} value={mt}>
                  {t(`missionTypes.${mt}` as any)}
                </option>
              ))}
            </select>
          </div>

          {/* Era de la reliquia */}
          <div>
            <label className="block text-sm text-gray-400 mb-1">{t('create.relicEra')}</label>
            <select
              value={relicEra}
              onChange={(e) => setRelicEra(e.target.value as RelicEra)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-gray-100 text-sm focus:outline-none focus:border-amber-500"
            >
              {RELIC_ERAS.map((era) => (
                <option key={era} value={era}>
                  {t(`relicEras.${era}` as any)}
                </option>
              ))}
            </select>
          </div>

          {/* Radshare toggle */}
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="radshare"
              checked={isRadshare}
              onChange={(e) => setIsRadshare(e.target.checked)}
              className="w-4 h-4 rounded border-gray-600 bg-gray-800 text-amber-500 focus:ring-amber-500"
            />
            <label htmlFor="radshare" className="text-sm text-gray-300">
              {t('create.radshare')}
            </label>
          </div>

          {/* Rotation toggle (solo si radshare está activo) */}
          {isRadshare && (
            <div className="flex items-center gap-3 ml-6">
              <input
                type="checkbox"
                id="rotation"
                checked={isRotation}
                onChange={(e) => setIsRotation(e.target.checked)}
                className="w-4 h-4 rounded border-gray-600 bg-gray-800 text-blue-500 focus:ring-blue-500"
              />
              <label htmlFor="rotation" className="text-sm text-gray-300">
                <span className="text-blue-400 font-medium">Rotación</span> — 4 rondas, 1 host cada una
              </label>
            </div>
          )}

          {/* Nombre de reliquia (solo para radshare) */}
          {isRadshare && (
            <div>
              <label className="block text-sm text-gray-400 mb-1">{t('create.relicName')}</label>
              {loadingRelics ? (
                <div className="text-sm text-gray-500 py-2">{t('create.loadingRelics')}</div>
              ) : relics.length > 0 ? (
                <select
                  value={relicName}
                  onChange={(e) => setRelicName(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-gray-100 text-sm focus:outline-none focus:border-amber-500"
                  required
                >
                  <option value="">{t('create.selectRelic')}</option>
                  {relics.map((r) => (
                    <option key={r.id} value={r.name}>
                      {r.era} {r.name}
                    </option>
                  ))}
                </select>
              ) : (
                <div className="text-sm text-gray-500 py-2">{t('create.noRelics')}</div>
              )}
            </div>
          )}

          {/* Botones */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-sm font-medium transition-colors"
            >
              {t('create.cancel')}
            </button>
            <button
              type="submit"
              disabled={submitting || (isRadshare && !relicName)}
              className="flex-1 py-2 bg-amber-600 hover:bg-amber-500 disabled:bg-gray-700 disabled:cursor-not-allowed text-black font-medium rounded-lg text-sm transition-colors"
            >
              {submitting ? '...' : t('create.submit')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
