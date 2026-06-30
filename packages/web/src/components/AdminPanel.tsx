import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client.js';
import { useAuth } from '../contexts/AuthContext.js';
import UserManagement from './UserManagement.js';

/* eslint-disable @typescript-eslint/no-explicit-any */

type Tab = 'reports' | 'bans' | 'appeals' | 'users';

export default function AdminPanel({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const [tab, setTab] = useState<Tab>('reports');
  const [loading, setLoading] = useState(true);
  const [actionMsg, setActionMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Reports state
  const [reports, setReports] = useState<any[]>([]);
  const [reportTotal, setReportTotal] = useState(0);
  const [reportPage, setReportPage] = useState(1);
  const [reportHasMore, setReportHasMore] = useState(false);
  const [reportFilter, setReportFilter] = useState('PENDING');

  // Bans state
  const [bans, setBans] = useState<any[]>([]);
  const [banTotal, setBanTotal] = useState(0);
  const [banPage, setBanPage] = useState(1);
  const [banHasMore, setBanHasMore] = useState(false);
  const [showBanForm, setShowBanForm] = useState(false);
  const [banUsername, setBanUsername] = useState('');
  const [banReason, setBanReason] = useState('');
  const [banDays, setBanDays] = useState('');

  // Appeals state
  const [appeals, setAppeals] = useState<any[]>([]);
  const [appealTotal, setAppealTotal] = useState(0);
  const [appealPage, setAppealPage] = useState(1);
  const [appealHasMore, setAppealHasMore] = useState(false);
  const [appealFilter, setAppealFilter] = useState('PENDING');

  const [clearing, setClearing] = useState(false);

  const handleClearLobbies = async () => {
    if (!window.confirm('¿Estás seguro de borrar TODOS los lobbies? Esta acción no se puede deshacer.')) return;
    setClearing(true);
    try {
      const result = await api.clearAllLobbies();
      flash(`✅ ${result.message}`, 'success');
    } catch (err: any) {
      flash(`❌ ${err.message || 'Error al borrar lobbies'}`, 'error');
    } finally {
      setClearing(false);
    }
  };

  const flash = (text: string, type: 'success' | 'error' = 'success') => {
    setActionMsg({ text, type });
    setTimeout(() => setActionMsg(null), 3000);
  };

  const loadReports = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const data = await api.getAdminReports(reportFilter || undefined, page);
      setReports(data.reports);
      setReportTotal(data.total);
      setReportPage(data.page);
      setReportHasMore(data.hasMore);
    } catch (err: any) {
      flash(`Error al cargar reportes: ${err.message}`, 'error');
    } finally {
      setLoading(false);
    }
  }, [reportFilter]);

  const loadBans = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const data = await api.getAdminBans(page);
      setBans(data.bans);
      setBanTotal(data.total);
      setBanPage(data.page);
      setBanHasMore(data.hasMore);
    } catch (err: any) {
      flash(`Error al cargar baneos: ${err.message}`, 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadAppeals = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const data = await api.getAdminAppeals(appealFilter || undefined, page);
      setAppeals(data.appeals);
      setAppealTotal(data.total);
      setAppealPage(data.page);
      setAppealHasMore(data.hasMore);
    } catch (err: any) {
      flash(`Error al cargar apelaciones: ${err.message}`, 'error');
    } finally {
      setLoading(false);
    }
  }, [appealFilter]);

  useEffect(() => {
    if (tab === 'reports') loadReports(1);
    else if (tab === 'bans') loadBans(1);
    else if (tab === 'appeals') loadAppeals(1);
  }, [tab]);

  useEffect(() => { if (tab === 'reports') loadReports(1); }, [reportFilter]);
  useEffect(() => { if (tab === 'appeals') loadAppeals(1); }, [appealFilter]);

  const handleResolveReport = async (reportId: string, status: 'DISMISSED' | 'ACTION_TAKEN', username: string) => {
    try {
      if (status === 'ACTION_TAKEN') {
        await api.resolveReport(reportId, {
          status,
          banUserId: reports.find(r => r.id === reportId)?.reportedUser.id,
          banReason: `Auto-ban por reporte: ${username}`,
          banDurationDays: 3,
        });
      } else {
        await api.resolveReport(reportId, { status });
      }
      flash(`Reporte ${status === 'DISMISSED' ? 'desestimado' : 'acción tomada (baneado 3d)'}`);
      loadReports(reportPage);
    } catch (err: any) {
      flash(`Error: ${err.message}`, 'error');
    }
  };

  const handleCreateBan = async () => {
    if (!banUsername.trim() || !banReason.trim()) {
      flash('Completá username y motivo', 'error');
      return;
    }
    try {
      await api.createAdminBan({
        username: banUsername.trim(),
        reason: banReason.trim(),
        durationDays: banDays ? parseInt(banDays, 10) : undefined,
      });
      flash(`Usuario ${banUsername.trim()} baneado`);
      setShowBanForm(false);
      setBanUsername('');
      setBanReason('');
      setBanDays('');
      loadBans(1);
    } catch (err: any) {
      flash(`Error: ${err.message}`, 'error');
    }
  };

  const handleUnban = async (banId: string) => {
    try {
      await api.unbanUser(banId);
      flash('Usuario desbaneado');
      loadBans(banPage);
    } catch (err: any) {
      flash(`Error: ${err.message}`, 'error');
    }
  };

  const handleResolveAppeal = async (appealId: string, status: 'APPROVED' | 'DENIED') => {
    try {
      await api.resolveAppeal(appealId, status);
      flash(`Apelación ${status === 'APPROVED' ? 'aprobada (usuario desbaneado)' : 'denegada'}`);
      loadAppeals(appealPage);
    } catch (err: any) {
      flash(`Error: ${err.message}`, 'error');
    }
  };

  const statusBadge = (status: string) => {
    const colors: Record<string, string> = {
      PENDING: 'bg-yellow-900/50 text-yellow-400',
      DISMISSED: 'bg-gray-800 text-gray-400',
      ACTION_TAKEN: 'bg-red-900/50 text-red-400',
      APPROVED: 'bg-green-900/50 text-green-400',
      DENIED: 'bg-gray-800 text-gray-400',
    };
    return (
      <span className={`text-xs px-2 py-0.5 rounded ${colors[status] || 'bg-gray-800 text-gray-400'}`}>
        {status}
      </span>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-gray-900 border border-gray-800 rounded-xl w-full max-w-4xl mx-4 p-6 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-semibold text-white">Panel de Administración</h2>
            <p className="text-xs text-gray-500 mt-0.5">Gestión de reportes, baneos, apelaciones y usuarios</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleClearLobbies}
              disabled={clearing}
              className="text-xs px-3 py-1.5 bg-red-900/50 hover:bg-red-800 text-red-300 rounded transition-colors disabled:opacity-50"
            >
              {clearing ? '...' : '🗑 Clear all lobbies'}
            </button>
            <button onClick={onClose} className="text-gray-500 hover:text-gray-300 text-lg">✕</button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-4 bg-gray-800 rounded-lg p-1 flex-wrap">
          {(['reports', 'bans', 'appeals', 'users'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 px-3 py-2 text-sm rounded-md transition-colors min-w-[80px] ${
                tab === t ? 'bg-amber-600 text-black font-medium' : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              {t === 'reports' ? '📋 Reportes' : t === 'bans' ? '🔨 Baneos' : t === 'appeals' ? '📩 Apelaciones' : '👥 Usuarios'}
            </button>
          ))}
        </div>

        {/* Flash message */}
        {actionMsg && (
          <div className={`mb-4 p-2 rounded text-sm ${
            actionMsg.type === 'error'
              ? 'bg-red-900/50 border border-red-700 text-red-200'
              : 'bg-green-900/50 border border-green-700 text-green-200'
          }`}>
            {actionMsg.text}
          </div>
        )}

        {/* ============= REPORTS TAB ============= */}
        {tab === 'reports' && (
          <div>
            {/* Filter */}
            <div className="flex items-center gap-2 mb-4">
              <span className="text-xs text-gray-500">Filtrar:</span>
              {['', 'PENDING', 'DISMISSED', 'ACTION_TAKEN'].map((s) => (
                <button
                  key={s}
                  onClick={() => setReportFilter(s)}
                  className={`text-xs px-2.5 py-1 rounded transition-colors ${
                    reportFilter === s
                      ? 'bg-amber-600/20 text-amber-400 border border-amber-600/30'
                      : 'bg-gray-800 text-gray-400 hover:text-gray-200'
                  }`}
                >
                  {s || 'TODOS'}
                </button>
              ))}
              <span className="text-xs text-gray-600 ml-auto">{reportTotal} reportes</span>
            </div>

            {loading ? (
              <div className="text-gray-500 text-sm py-8 text-center">Cargando...</div>
            ) : reports.length === 0 ? (
              <div className="text-gray-500 text-sm py-8 text-center">No hay reportes{reportFilter ? ` con estado ${reportFilter}` : ''}.</div>
            ) : (
              <div className="space-y-3">
                {reports.map((r) => (
                  <div key={r.id} className="bg-gray-800/30 rounded-lg p-4 border border-gray-800/50">
                    <div className="flex items-start justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className="text-white font-medium text-sm">{r.reportedUser.username}</span>
                        <span className="text-gray-500 text-xs">MR{r.reportedUser.masteryRank}</span>
                        {statusBadge(r.status)}
                      </div>
                      <span className="text-xs text-gray-600">{new Date(r.createdAt).toLocaleString()}</span>
                    </div>
                    <div className="text-xs text-gray-400 mb-2">
                      <span className="text-amber-400">{r.reason}</span>
                      {' · por '}
                      <span className="text-gray-300">{r.reporter.username}</span>
                      {r.lobby && <span> · sala: {r.lobby.title}</span>}
                      {r.bans.length > 0 && (
                        <span className="text-red-400"> · {r.bans.length} ban(es) asociado(s)</span>
                      )}
                    </div>
                    {r.description && (
                      <div className="text-xs text-gray-500 mb-2 italic bg-gray-800/30 p-2 rounded">
                        "{r.description}"
                      </div>
                    )}
                    {r.status === 'PENDING' && (
                      <div className="flex gap-2 mt-2">
                        <button
                          onClick={() => handleResolveReport(r.id, 'DISMISSED', r.reportedUser.username)}
                          className="text-xs px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded transition-colors"
                        >
                          Desestimar
                        </button>
                        <button
                          onClick={() => handleResolveReport(r.id, 'ACTION_TAKEN', r.reportedUser.username)}
                          className="text-xs px-3 py-1.5 bg-red-700 hover:bg-red-600 text-white rounded transition-colors"
                        >
                          Banear 3d
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Pagination */}
            {reportHasMore && (
              <div className="text-center mt-4">
                <button
                  onClick={() => loadReports(reportPage + 1)}
                  className="text-xs px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded transition-colors"
                >
                  Cargar más ({reportTotal - reportPage * 50} restantes)
                </button>
              </div>
            )}
          </div>
        )}

        {/* ============= BANS TAB ============= */}
        {tab === 'bans' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs text-gray-500">{banTotal} baneos</span>
              <button
                onClick={() => setShowBanForm(!showBanForm)}
                className="text-xs px-3 py-1.5 bg-red-700 hover:bg-red-600 text-white rounded transition-colors"
              >
                {showBanForm ? 'Cancelar' : '+ Banear usuario'}
              </button>
            </div>

            {/* Create ban form */}
            {showBanForm && (
              <div className="bg-gray-800/40 rounded-lg p-4 mb-4 border border-gray-700/50">
                <h3 className="text-sm font-medium text-white mb-3">Banear usuario</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
                  <input
                    value={banUsername}
                    onChange={(e) => setBanUsername(e.target.value)}
                    placeholder="Username del usuario"
                    className="bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white placeholder-gray-500"
                  />
                  <input
                    value={banReason}
                    onChange={(e) => setBanReason(e.target.value)}
                    placeholder="Motivo del ban"
                    className="bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white placeholder-gray-500"
                  />
                  <input
                    value={banDays}
                    onChange={(e) => setBanDays(e.target.value)}
                    placeholder="Días (vacío = permanente)"
                    type="number"
                    min="1"
                    className="bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white placeholder-gray-500"
                  />
                </div>
                <button
                  onClick={handleCreateBan}
                  className="text-xs px-4 py-2 bg-red-700 hover:bg-red-600 text-white rounded transition-colors"
                >
                  Ejecutar ban
                </button>
              </div>
            )}

            {loading ? (
              <div className="text-gray-500 text-sm py-8 text-center">Cargando...</div>
            ) : bans.length === 0 ? (
              <div className="text-gray-500 text-sm py-8 text-center">No hay baneos.</div>
            ) : (
              <div className="space-y-3">
                {bans.map((b) => (
                  <div key={b.id} className="bg-gray-800/30 rounded-lg p-4 border border-gray-800/50">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-white font-medium text-sm">{b.user.username}</span>
                          <span className="text-xs text-gray-500">MR{b.user.masteryRank} · {b.user.platform}</span>
                          <span className={`text-xs px-1.5 py-0.5 rounded ${
                            b.isPermanent ? 'bg-red-900/50 text-red-400' : 'bg-yellow-900/50 text-yellow-400'
                          }`}>
                            {b.isPermanent ? 'PERMANENTE' : b.expiresAt ? `Hasta ${new Date(b.expiresAt).toLocaleDateString()}` : '?'}
                          </span>
                        </div>
                        <div className="text-xs text-gray-400 mt-1">
                          {b.reason} · por {b.bannedBy.username} · {new Date(b.createdAt).toLocaleDateString()}
                        </div>
                        {b.appeals.length > 0 && (
                          <div className="text-xs text-gray-500 mt-1">
                            {b.appeals.length} apelación(es): {b.appeals.map((a: any) => a.status).join(', ')}
                          </div>
                        )}
                      </div>
                      <button
                        onClick={() => handleUnban(b.id)}
                        className="text-xs px-2.5 py-1 bg-green-800 hover:bg-green-700 text-green-200 rounded transition-colors"
                        title="Desbanear"
                      >
                        Desbanear
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {banHasMore && (
              <div className="text-center mt-4">
                <button
                  onClick={() => loadBans(banPage + 1)}
                  className="text-xs px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded transition-colors"
                >
                  Cargar más
                </button>
              </div>
            )}
          </div>
        )}

        {/* ============= USERS TAB ============= */}
        {tab === 'users' && (
          <div>
            <UserManagement />
          </div>
        )}

        {/* ============= APPEALS TAB ============= */}
        {tab === 'appeals' && (
          <div>
            {/* Filter */}
            <div className="flex items-center gap-2 mb-4">
              <span className="text-xs text-gray-500">Filtrar:</span>
              {['', 'PENDING', 'APPROVED', 'DENIED'].map((s) => (
                <button
                  key={s}
                  onClick={() => setAppealFilter(s)}
                  className={`text-xs px-2.5 py-1 rounded transition-colors ${
                    appealFilter === s
                      ? 'bg-amber-600/20 text-amber-400 border border-amber-600/30'
                      : 'bg-gray-800 text-gray-400 hover:text-gray-200'
                  }`}
                >
                  {s || 'TODOS'}
                </button>
              ))}
              <span className="text-xs text-gray-600 ml-auto">{appealTotal} apelaciones</span>
            </div>

            {loading ? (
              <div className="text-gray-500 text-sm py-8 text-center">Cargando...</div>
            ) : appeals.length === 0 ? (
              <div className="text-gray-500 text-sm py-8 text-center">No hay apelaciones{appealFilter ? ` con estado ${appealFilter}` : ''}.</div>
            ) : (
              <div className="space-y-3">
                {appeals.map((a) => (
                  <div key={a.id} className="bg-gray-800/30 rounded-lg p-4 border border-gray-800/50">
                    <div className="flex items-start justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className="text-white font-medium text-sm">{a.user.username}</span>
                        <span className="text-gray-500 text-xs">MR{a.user.masteryRank}</span>
                        {statusBadge(a.status)}
                      </div>
                      <span className="text-xs text-gray-600">{new Date(a.createdAt).toLocaleString()}</span>
                    </div>
                    <div className="text-xs text-gray-400 mb-2">
                      Ban: <span className="text-gray-300">{a.ban.reason}</span>
                      {' · '}{a.ban.isPermanent ? 'Permanente' : a.ban.expiresAt ? `Hasta ${new Date(a.ban.expiresAt).toLocaleDateString()}` : '?'}
                      {' · por '}{a.ban.bannedBy.username}
                    </div>
                    <div className="text-xs text-gray-500 mb-2 italic bg-gray-800/30 p-2 rounded">
                      "{a.message}"
                    </div>
                    {a.status === 'PENDING' && (
                      <div className="flex gap-2 mt-2">
                        <button
                          onClick={() => handleResolveAppeal(a.id, 'DENIED')}
                          className="text-xs px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded transition-colors"
                        >
                          Denegar
                        </button>
                        <button
                          onClick={() => handleResolveAppeal(a.id, 'APPROVED')}
                          className="text-xs px-3 py-1.5 bg-green-700 hover:bg-green-600 text-white rounded transition-colors"
                        >
                          Aprobar (desbanear)
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {appealHasMore && (
              <div className="text-center mt-4">
                <button
                  onClick={() => loadAppeals(appealPage + 1)}
                  className="text-xs px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded transition-colors"
                >
                  Cargar más
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
