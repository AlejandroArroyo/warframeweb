import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client.js';
import { useAuth } from '../contexts/AuthContext.js';
import { useToast } from '../contexts/ToastContext.js';
import { PLATFORMS, type Platform } from '@warframe/shared';

interface Props {
  onClose: () => void;
}

export default function UserSettings({ onClose }: Props) {
  const { t, i18n } = useTranslation();
  const { user, updateUser } = useAuth();
  const { addToast } = useToast();

  const [platform, setPlatform] = useState(user?.platform || 'PC');
  const [masteryRank, setMasteryRank] = useState(user?.masteryRank ?? 0);
  const [saving, setSaving] = useState(false);

  const currentLang = i18n.language.startsWith('en') ? 'en' : 'es';

  const handleLanguageChange = (lang: string) => {
    i18n.changeLanguage(lang);
  };

  const handleSave = async () => {
    if (!user) return;

    const mr = Math.max(0, Math.min(30, Math.round(masteryRank)));

    setSaving(true);
    try {
      const result = await api.updateSettings({ platform, masteryRank: mr });
      updateUser(result.user);
      addToast(t('settings.saved'), 'success');
      onClose();
    } catch (err: any) {
      addToast(err.message || t('settings.error'), 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-gray-900 border border-gray-800 rounded-xl w-full max-w-md mx-4 overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-800 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-100">{t('settings.title')}</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-300 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-5">
          {/* Platform */}
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1.5">
              {t('settings.platform')}
            </label>
            <select
              value={platform}
               onChange={(e) => setPlatform(e.target.value as Platform)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500"
            >
              {PLATFORMS.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>

          {/* Mastery Rank */}
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1.5">
              {t('settings.masteryRank')}
            </label>
            <input
              type="number"
              min={0}
              max={30}
              value={masteryRank}
              onChange={(e) => setMasteryRank(parseInt(e.target.value) || 0)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500"
            />
          </div>

          {/* Language */}
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1.5">
              {t('settings.language')}
            </label>
            <div className="flex gap-2">
              <button
                onClick={() => handleLanguageChange('es')}
                className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  currentLang === 'es'
                    ? 'bg-amber-600 text-black'
                    : 'bg-gray-800 text-gray-400 hover:text-gray-200'
                }`}
              >
                Español
              </button>
              <button
                onClick={() => handleLanguageChange('en')}
                className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  currentLang === 'en'
                    ? 'bg-amber-600 text-black'
                    : 'bg-gray-800 text-gray-400 hover:text-gray-200'
                }`}
              >
                English
              </button>
            </div>
          </div>

          {/* User info */}
          <div className="pt-2 border-t border-gray-800">
            <div className="text-xs text-gray-500 space-y-1">
              <p><span className="text-gray-400">ID:</span> {user?.id}</p>
              <p><span className="text-gray-400">Usuario:</span> {user?.username}</p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-800 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-400 hover:text-gray-200 transition-colors"
          >
            {t('settings.cancel')}
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 text-sm bg-amber-600 hover:bg-amber-500 disabled:bg-gray-700 disabled:cursor-not-allowed text-black font-medium rounded-lg transition-colors"
          >
            {saving ? t('settings.saving') : t('settings.save')}
          </button>
        </div>
      </div>
    </div>
  );
}
