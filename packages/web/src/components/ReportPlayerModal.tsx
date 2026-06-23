import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client.js';
import { REPORT_REASONS, type ReportReason } from '@warframe/shared';

interface ReportPlayerModalProps {
  reportedUsername: string;
  lobbyId?: string;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function ReportPlayerModal({ reportedUsername, lobbyId, onClose, onSuccess }: ReportPlayerModalProps) {
  const { t } = useTranslation();
  const [reason, setReason] = useState<ReportReason>('LEECHING');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await api.createReport({
        reportedUsername,
        reason,
        description: description.trim() || undefined,
        lobbyId,
      });
      setSuccess(true);
      setTimeout(() => {
        onClose();
        onSuccess?.();
      }, 2000);
    } catch (err: any) {
      setError(err.message || 'Error al reportar');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-gray-900 border border-gray-800 rounded-xl w-full max-w-md mx-4 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">
            Reportar a {reportedUsername}
          </h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300 text-lg">✕</button>
        </div>

        {success ? (
          <div className="text-center py-8">
            <div className="text-4xl mb-3">✅</div>
            <p className="text-green-400 font-medium">Reporte enviado</p>
            <p className="text-gray-500 text-sm mt-1">Gracias por ayudar a mantener la comunidad.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-2">Motivo</label>
              <select
                value={reason}
                onChange={(e) => setReason(e.target.value as ReportReason)}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-amber-500 text-sm"
              >
                {REPORT_REASONS.map((r) => (
                  <option key={r} value={r}>
                    {t(`reportReasons.${r}` as any)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-2">Descripción (opcional)</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={500}
                rows={3}
                placeholder="Contanos qué pasó..."
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-amber-500 text-sm resize-none"
              />
              <div className="text-right text-xs text-gray-600 mt-1">{description.length}/500</div>
            </div>

            {error && (
              <div className="p-2 bg-red-900/50 border border-red-700 rounded text-red-200 text-xs">{error}</div>
            )}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg transition-colors text-sm"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 px-4 py-2 bg-red-700 hover:bg-red-600 disabled:bg-gray-700 text-white font-medium rounded-lg transition-colors text-sm"
              >
                {loading ? 'Enviando...' : 'Enviar reporte'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
