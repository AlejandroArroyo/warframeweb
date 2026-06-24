import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client.js';
import { useAuth } from '../contexts/AuthContext.js';
import { getReputationTier, canChangeRole, canManageUsers, USER_ROLES } from '@warframe/shared';
import type { UserRole } from '@warframe/shared';

/* eslint-disable @typescript-eslint/no-explicit-any */

interface UserListItem {
  id: string;
  username: string;
  discordId: string | null;
  masteryRank: number;
  reputation: number;
  reputationTier: string;
  role: UserRole;
  warns: number;
  isAdmin: boolean;
  isBanned: boolean;
  createdAt: string;
}

export default function UserManagement() {
  const { t } = useTranslation();
  const { user: currentUser } = useAuth();

  const [users, setUsers] = useState<UserListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [actionMsg, setActionMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Detail modal
  const [detailUser, setDetailUser] = useState<any>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Warn modal
  const [warnUser, setWarnUser] = useState<UserListItem | null>(null);
  const [warnReason, setWarnReason] = useState('');
  const [warnSubmitting, setWarnSubmitting] = useState(false);

  // Role change modal
  const [roleChangeUser, setRoleChangeUser] = useState<UserListItem | null>(null);
  const [newRole, setNewRole] = useState<UserRole>('USER');
  const [roleChangeSubmitting, setRoleChangeSubmitting] = useState(false);

  const flash = (text: string, type: 'success' | 'error' = 'success') => {
    setActionMsg({ text, type });
    setTimeout(() => setActionMsg(null), 3000);
  };

  const loadUsers = useCallback(async (p: number = 1) => {
    setLoading(true);
    try {
      const data = await api.getAdminUsers({
        search: search || undefined,
        role: roleFilter || undefined,
        page: p,
        limit: 20,
      });
      setUsers(data.users as unknown as UserListItem[]);
      setTotal(data.total);
      setPage(data.page);
      setHasMore(data.hasMore);
    } catch (err: any) {
      flash(err.message || 'Error loading users', 'error');
    } finally {
      setLoading(false);
    }
  }, [search, roleFilter]);

  useEffect(() => {
    loadUsers(1);
  }, [loadUsers]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    loadUsers(1);
  };

  const showDetail = async (id: string) => {
    setDetailLoading(true);
    setDetailUser(null);
    try {
      const data = await api.getAdminUserDetail(id);
      setDetailUser(data);
    } catch (err: any) {
      flash(err.message || 'Error loading user details', 'error');
    } finally {
      setDetailLoading(false);
    }
  };

  const handleWarn = async () => {
    if (!warnUser || !warnReason.trim()) return;
    setWarnSubmitting(true);
    try {
      const result = await api.warnUser(warnUser.id, warnReason.trim());
      flash(`${t('userManagement.warnSuccess')} (${result.warns} warns)`, 'success');
      setWarnUser(null);
      setWarnReason('');
      loadUsers(page);
    } catch (err: any) {
      flash(err.message || 'Error adding warning', 'error');
    } finally {
      setWarnSubmitting(false);
    }
  };

  const handleRoleChange = async () => {
    if (!roleChangeUser) return;
    setRoleChangeSubmitting(true);
    try {
      await api.changeUserRole(roleChangeUser.id, newRole as 'MODERATOR' | 'ADMIN');
      flash(t('userManagement.roleChangeSuccess'), 'success');
      setRoleChangeUser(null);
      loadUsers(page);
    } catch (err: any) {
      flash(err.message || 'Error changing role', 'error');
    } finally {
      setRoleChangeSubmitting(false);
    }
  };

  const tierColor = (tier: string) => {
    const t = tier.toLowerCase();
    if (t === 'legend' || t === 'leyenda') return 'text-amber-400';
    if (t === 'master' || t === 'maestro') return 'text-purple-400';
    if (t === 'veteran' || t === 'veterano') return 'text-blue-400';
    return 'text-green-400';
  };

  const roleColor = (role: UserRole) => {
    if (role === 'ADMIN') return 'text-red-400 bg-red-900/20';
    if (role === 'MODERATOR') return 'text-amber-400 bg-amber-900/20';
    return 'text-gray-400 bg-gray-700/50';
  };

  const tierBadge = (tier: string) => {
    const t = tier.toLowerCase();
    if (t === 'legend' || t === 'leyenda') return '🏆';
    if (t === 'master' || t === 'maestro') return '⭐';
    if (t === 'veteran' || t === 'veterano') return '⚔️';
    return '🌱';
  };

  const canManage = currentUser ? canManageUsers(currentUser) : false;
  const canChange = currentUser ? canChangeRole(currentUser) : false;

  return (
    <div className="space-y-4">
      {/* Flash messages */}
      {actionMsg && (
        <div className={`px-3 py-2 rounded text-sm ${
          actionMsg.type === 'success' ? 'bg-green-900/50 text-green-300' : 'bg-red-900/50 text-red-300'
        }`}>
          {actionMsg.text}
        </div>
      )}

      {/* Search & filters */}
      <form onSubmit={handleSearch} className="flex gap-2 flex-wrap">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('userManagement.searchPlaceholder')}
          className="flex-1 min-w-[200px] px-3 py-1.5 bg-gray-800 border border-gray-700 rounded text-sm text-white placeholder-gray-500 focus:outline-none focus:border-amber-600"
        />
        <select
          value={roleFilter}
          onChange={(e) => { setRoleFilter(e.target.value); }}
          className="px-3 py-1.5 bg-gray-800 border border-gray-700 rounded text-sm text-white focus:outline-none focus:border-amber-600"
        >
          <option value="">{t('userManagement.allRoles')}</option>
          {USER_ROLES.map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
        <button
          type="submit"
          className="px-3 py-1.5 bg-amber-700 hover:bg-amber-600 text-white text-sm rounded transition-colors"
        >
          {t('common.search')}
        </button>
      </form>

      {/* Stats */}
      <div className="text-xs text-gray-400">
        {t('userManagement.totalUsers', { count: total })}
      </div>

      {/* Users table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-400 border-b border-gray-700">
              <th className="pb-2 pr-2">{t('userManagement.username')}</th>
              <th className="pb-2 pr-2">{t('userManagement.rank')}</th>
              <th className="pb-2 pr-2">{t('userManagement.reputation')}</th>
              <th className="pb-2 pr-2">{t('userManagement.roleLabel')}</th>
              <th className="pb-2 pr-2">{t('userManagement.warns')}</th>
              <th className="pb-2 pr-2">{t('userManagement.status')}</th>
              <th className="pb-2">{t('userManagement.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="py-8 text-center text-gray-500">
                  {t('common.loading')}...
                </td>
              </tr>
            ) : users.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-8 text-center text-gray-500">
                  {t('userManagement.noUsers')}
                </td>
              </tr>
            ) : (
              users.map((u) => {
                const tier = getReputationTier(u.reputation);
                return (
                  <tr key={u.id} className="border-b border-gray-800 hover:bg-gray-800/50">
                    <td className="py-2 pr-2">
                      <div className="flex items-center gap-1.5">
                        <span className="text-white font-medium">{u.username}</span>
                        {u.isBanned && (
                          <span className="text-[10px] px-1 py-0.5 bg-red-900/50 text-red-400 rounded">
                            BANNED
                          </span>
                        )}
                      </div>
                      {u.discordId && (
                        <div className="text-[10px] text-gray-500">{u.discordId}</div>
                      )}
                    </td>
                    <td className="py-2 pr-2 text-gray-300">MR {u.masteryRank}</td>
                    <td className="py-2 pr-2">
                      <span className={`${tierColor(tier.nameEs)}`}>
                        {tierBadge(tier.nameEs)} {tier.nameEs} ({u.reputation})
                      </span>
                    </td>
                    <td className="py-2 pr-2">
                      <span className={`text-[11px] px-1.5 py-0.5 rounded ${roleColor(u.role)}`}>
                        {u.role}
                      </span>
                    </td>
                    <td className="py-2 pr-2 text-gray-300">{u.warns}</td>
                    <td className="py-2 pr-2">
                      {u.isBanned ? (
                        <span className="text-red-400">{t('userManagement.banned')}</span>
                      ) : (
                        <span className="text-green-400">{t('userManagement.active')}</span>
                      )}
                    </td>
                    <td className="py-2">
                      <div className="flex gap-1 flex-wrap">
                        <button
                          onClick={() => showDetail(u.id)}
                          className="text-[11px] px-2 py-0.5 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded transition-colors"
                        >
                          {t('userManagement.view')}
                        </button>
                        {canManage && (
                          <button
                            onClick={() => { setWarnUser(u); setWarnReason(''); }}
                            className="text-[11px] px-2 py-0.5 bg-orange-900/50 hover:bg-orange-800/50 text-orange-400 rounded transition-colors"
                          >
                            {t('userManagement.warn')}
                          </button>
                        )}
                        {canChange && u.role !== 'ADMIN' && (
                          <button
                            onClick={() => { setRoleChangeUser(u); setNewRole(u.role === 'MODERATOR' ? 'USER' : 'MODERATOR'); }}
                            className="text-[11px] px-2 py-0.5 bg-purple-900/50 hover:bg-purple-800/50 text-purple-400 rounded transition-colors"
                          >
                            {t('userManagement.changeRole')}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex justify-between items-center text-sm text-gray-400">
        <span>
          {t('userManagement.pageInfo', { page, total: Math.ceil(total / 20) })}
        </span>
        <div className="flex gap-2">
          <button
            onClick={() => loadUsers(page - 1)}
            disabled={page <= 1}
            className="px-3 py-1 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed rounded text-xs transition-colors"
          >
            {t('common.previous')}
          </button>
          <button
            onClick={() => loadUsers(page + 1)}
            disabled={!hasMore}
            className="px-3 py-1 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed rounded text-xs transition-colors"
          >
            {t('common.next')}
          </button>
        </div>
      </div>

      {/* User Detail Modal */}
      {detailUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setDetailUser(null)}>
          <div className="bg-gray-900 border border-gray-700 rounded-lg p-6 max-w-lg w-full mx-4 max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-lg font-bold text-white">{detailUser.user.username}</h3>
                <p className="text-xs text-gray-400">ID: {detailUser.user.id}</p>
                {detailUser.user.discordId && (
                  <p className="text-xs text-gray-400">Discord: {detailUser.user.discordId}</p>
                )}
              </div>
              <button onClick={() => setDetailUser(null)} className="text-gray-400 hover:text-white text-xl">&times;</button>
            </div>

            {detailLoading ? (
              <p className="text-gray-400 text-center py-4">{t('common.loading')}...</p>
            ) : (
              <div className="space-y-3">
                {/* Stats */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-gray-800 rounded p-3">
                    <div className="text-xs text-gray-400">{t('userManagement.masteryRank')}</div>
                    <div className="text-lg font-bold text-white">{detailUser.user.masteryRank}</div>
                  </div>
                  <div className="bg-gray-800 rounded p-3">
                    <div className="text-xs text-gray-400">{t('userManagement.reputation')}</div>
                    <div className="text-lg font-bold text-amber-400">{detailUser.user.reputation}</div>
                  </div>
                  <div className="bg-gray-800 rounded p-3">
                    <div className="text-xs text-gray-400">{t('userManagement.roleLabel')}</div>
                    <div className={`text-lg font-bold ${detailUser.user.role === 'ADMIN' ? 'text-red-400' : detailUser.user.role === 'MODERATOR' ? 'text-amber-400' : 'text-gray-300'}`}>
                      {detailUser.user.role}
                    </div>
                  </div>
                  <div className="bg-gray-800 rounded p-3">
                    <div className="text-xs text-gray-400">{t('userManagement.warns')}</div>
                    <div className="text-lg font-bold text-orange-400">{detailUser.user.warns}</div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-gray-800 rounded p-3">
                    <div className="text-xs text-gray-400">{t('userManagement.totalRuns')}</div>
                    <div className="text-lg font-bold text-white">{detailUser.stats?.totalRuns ?? '-'}</div>
                  </div>
                  <div className="bg-gray-800 rounded p-3">
                    <div className="text-xs text-gray-400">{t('userManagement.completedRuns')}</div>
                    <div className="text-lg font-bold text-green-400">{detailUser.stats?.completedRuns ?? '-'}</div>
                  </div>
                  <div className="bg-gray-800 rounded p-3">
                    <div className="text-xs text-gray-400">{t('userManagement.totalReports')}</div>
                    <div className="text-lg font-bold text-yellow-400">{detailUser.stats?.totalReports ?? '-'}</div>
                  </div>
                  <div className="bg-gray-800 rounded p-3">
                    <div className="text-xs text-gray-400">{t('userManagement.totalBans')}</div>
                    <div className="text-lg font-bold text-red-400">{detailUser.stats?.totalBans ?? '-'}</div>
                  </div>
                </div>

                {/* Platform info */}
                <div className="bg-gray-800 rounded p-3 flex justify-between items-center">
                  <span className="text-xs text-gray-400">{t('userManagement.platform')}</span>
                  <span className="text-sm text-white">{detailUser.user.platform || '-'}</span>
                </div>

                {/* Created at */}
                <div className="bg-gray-800 rounded p-3 flex justify-between items-center">
                  <span className="text-xs text-gray-400">{t('userManagement.memberSince')}</span>
                  <span className="text-sm text-white">
                    {detailUser.user.createdAt
                      ? new Date(detailUser.user.createdAt).toLocaleDateString()
                      : '-'}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Warn Modal */}
      {warnUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setWarnUser(null)}>
          <div className="bg-gray-900 border border-gray-700 rounded-lg p-6 max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-white mb-4">
              {t('userManagement.warnUser')}: {warnUser.username}
            </h3>
            <textarea
              value={warnReason}
              onChange={(e) => setWarnReason(e.target.value)}
              placeholder={t('userManagement.warnReasonPlaceholder')}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-sm text-white placeholder-gray-500 focus:outline-none focus:border-amber-600 mb-4"
              rows={3}
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setWarnUser(null)}
                className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={handleWarn}
                disabled={!warnReason.trim() || warnSubmitting}
                className="px-4 py-2 bg-orange-700 hover:bg-orange-600 disabled:opacity-50 text-white text-sm rounded transition-colors"
              >
                {warnSubmitting ? t('common.loading') + '...' : t('userManagement.addWarn')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Role Change Modal */}
      {roleChangeUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setRoleChangeUser(null)}>
          <div className="bg-gray-900 border border-gray-700 rounded-lg p-6 max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-white mb-4">
              {t('userManagement.changeRoleFor')}: {roleChangeUser.username}
            </h3>
            <p className="text-sm text-gray-400 mb-4">
              {t('userManagement.currentRole')}: <span className={`${roleColor(roleChangeUser.role)} px-1.5 py-0.5 rounded text-xs`}>{roleChangeUser.role}</span>
            </p>
            <select
              value={newRole}
              onChange={(e) => setNewRole(e.target.value as UserRole)}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-sm text-white focus:outline-none focus:border-amber-600 mb-4"
            >
              {USER_ROLES.filter((r) => r !== 'ADMIN').map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setRoleChangeUser(null)}
                className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={handleRoleChange}
                disabled={newRole === roleChangeUser.role || roleChangeSubmitting}
                className="px-4 py-2 bg-purple-700 hover:bg-purple-600 disabled:opacity-50 text-white text-sm rounded transition-colors"
              >
                {roleChangeSubmitting ? t('common.loading') + '...' : t('common.save')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
