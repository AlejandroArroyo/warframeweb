import type { LobbyDTO, CreateLobbyRequest, UserDTO } from '@warframe/shared';

// En desarrollo: Vite proxy sirve /api -> localhost:3001
// En producción: usa VITE_API_URL si está seteada, sino usa Render directo
const _RENDER_URL = 'https://warframeweb-api.onrender.com';
const _VITE_API_URL = import.meta.env.VITE_API_URL;
const API_BASE = _VITE_API_URL
  ? `${_VITE_API_URL.replace(/\/+$/, '')}/api`
  : import.meta.env.PROD
    ? `${_RENDER_URL}/api`
    : '/api';

function getToken(): string | null {
  try {
    return localStorage.getItem('wf_token');
  } catch {
    return null;
  }
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    headers: {
      ...headers,
      ...(options?.headers as Record<string, string>),
    },
    ...options,
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(error.error || 'Request failed');
  }

  return res.json();
}

export const api = {
  // Health
  health: () => request<{ status: string }>('/health'),

  // Users
  getUserByUsername: (username: string) =>
    request<UserDTO>(`/users/${encodeURIComponent(username)}`),

  getUsers: () => request<UserDTO[]>('/users'),

  // Lobbies
  getLobbies: (filters?: { era?: string; missionType?: string; status?: string }) => {
    const params = new URLSearchParams();
    if (filters?.era) params.set('era', filters.era);
    if (filters?.missionType) params.set('missionType', filters.missionType);
    if (filters?.status) params.set('status', filters.status);
    const qs = params.toString();
    return request<LobbyDTO[]>(`/lobbies${qs ? `?${qs}` : ''}`);
  },

  getLobby: (id: string) => request<LobbyDTO>(`/lobbies/${id}`),

  createLobby: (data: CreateLobbyRequest & { hostId: string }) =>
    request<LobbyDTO>('/lobbies', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  joinLobby: (lobbyId: string, userId: string) =>
    request<{ success: boolean }>(`/lobbies/${lobbyId}/join`, {
      method: 'POST',
      body: JSON.stringify({ userId }),
    }),

  leaveLobby: (lobbyId: string, userId: string) =>
    request<{ success: boolean }>(`/lobbies/${lobbyId}/leave`, {
      method: 'POST',
      body: JSON.stringify({ userId }),
    }),

  updateLobbyStatus: (lobbyId: string, status: string, userId: string) =>
    request<LobbyDTO>(`/lobbies/${lobbyId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status, userId }),
    }),

  // Radshare endpoints
  confirmRelic: (lobbyId: string, userId: string, relicName?: string) =>
    request<LobbyDTO>(`/lobbies/${lobbyId}/confirm`, {
      method: 'POST',
      body: JSON.stringify({ userId, relicName, refinement: 'Radiant' }),
    }),

  markReady: (lobbyId: string, userId: string) =>
    request<LobbyDTO>(`/lobbies/${lobbyId}/ready`, {
      method: 'POST',
      body: JSON.stringify({ userId }),
    }),

  markUnready: (lobbyId: string, userId: string) =>
    request<{ success: boolean }>(`/lobbies/${lobbyId}/unready`, {
      method: 'POST',
      body: JSON.stringify({ userId }),
    }),

  // Relics
  getRelics: (era?: string) => {
    const path = era ? `/relics/${era}` : '/relics';
    return request<Array<{ id: string; era: string; name: string }>>(path);
  },

  // Auth
  devLogin: (username: string) =>
    request<{ token: string; user: UserDTO }>('/auth/dev-login', {
      method: 'POST',
      body: JSON.stringify({ username }),
    }),

  getMe: () => request<UserDTO>('/auth/me'),

  getDiscordAuthUrl: () => `${API_BASE}/auth/discord`,

  // Reports
  createReport: (data: { reportedUsername: string; reason: string; description?: string; lobbyId?: string; runId?: string }) =>
    request<{ id: string; reason: string; status: string; createdAt: string }>('/reports', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  getReports: (filter?: string) => {
    const qs = filter ? `?filter=${filter}` : '';
    return request<Array<{ id: string; reason: string; status: string; createdAt: string; reportedUser: { id: string; username: string } }>>(`/reports${qs}`);
  },

  resolveReport: (id: string, data: { status: 'DISMISSED' | 'ACTION_TAKEN'; banUserId?: string; banReason?: string; banDurationDays?: number }) =>
    request<any>(`/reports/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  // Bans
  getBans: () => request<Array<{ id: string; reason: string; createdAt: string; user: { username: string } }>>('/bans'),

  createBan: (data: { username: string; reason: string; durationDays?: number }) =>
    request<any>('/bans', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  getUserBans: (userId: string) =>
    request<Array<{ id: string; reason: string; isPermanent: boolean; expiresAt: string | null; createdAt: string }>>(`/bans/${userId}`),

  // Ban appeals
  createBanAppeal: (data: { message: string }) =>
    request<{ id: string; status: string; message: string }>('/ban-appeals', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // Admin endpoints
  adminCheck: () =>
    request<{ isAdmin: boolean }>('/admin/check'),

  getAdminReports: (status?: string, page: number = 1) => {
    const params = new URLSearchParams();
    if (status) params.set('status', status);
    params.set('page', String(page));
    return request<{
      reports: Array<{
        id: string; reason: string; description: string | null;
        status: string; createdAt: string; resolvedAt: string | null;
        reporter: { id: string; username: string; masteryRank: number };
        reportedUser: { id: string; username: string; masteryRank: number };
        lobby: { id: string; title: string } | null;
        bans: Array<{ id: string; reason: string; createdAt: string }>;
      }>;
      total: number; page: number; hasMore: boolean;
    }>(`/admin/reports?${params.toString()}`);
  },

  getAdminBans: (page: number = 1) =>
    request<{
      bans: Array<{
        id: string; reason: string; isPermanent: boolean;
        expiresAt: string | null; createdAt: string;
        user: { id: string; username: string; platform: string; masteryRank: number };
        bannedBy: { id: string; username: string };
        appeals: Array<{ id: string; status: string }>;
      }>;
      total: number; page: number; hasMore: boolean;
    }>(`/admin/bans?page=${page}`),

  createAdminBan: (data: { username: string; reason: string; durationDays?: number }) =>
    request<any>('/admin/bans', { method: 'POST', body: JSON.stringify(data) }),

  unbanUser: (banId: string) =>
    request<{ success: boolean }>(`/admin/bans/${banId}/unban`, { method: 'PATCH' }),

  getAdminAppeals: (status?: string, page: number = 1) => {
    const params = new URLSearchParams();
    if (status) params.set('status', status);
    params.set('page', String(page));
    return request<{
      appeals: Array<{
        id: string; message: string; status: string;
        createdAt: string; resolvedAt: string | null;
        user: { id: string; username: string; platform: string; masteryRank: number };
        ban: {
          id: string; reason: string; isPermanent: boolean;
          expiresAt: string | null; createdAt: string;
          bannedBy: { username: string };
        };
      }>;
      total: number; page: number; hasMore: boolean;
    }>(`/admin/ban-appeals?${params.toString()}`);
  },

  resolveAppeal: (appealId: string, status: 'APPROVED' | 'DENIED') =>
    request<any>(`/admin/ban-appeals/${appealId}`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),

  // Kick
  kickParticipant: (lobbyId: string, userId: string, targetUserId: string) =>
    request<{ success: boolean }>(`/lobbies/${lobbyId}/kick`, {
      method: 'POST',
      body: JSON.stringify({ userId, targetUserId }),
    }),

  // Rotations
  startRotation: (lobbyId: string) =>
    request<{ groupId: string; totalRounds: number; lobby: LobbyDTO }>(`/lobbies/${lobbyId}/start-rotation`, {
      method: 'POST',
    }),

  getRotation: (groupId: string) =>
    request<{
      id: string;
      relicEra: string;
      relicName: string;
      totalRounds: number;
      completedAt: string | null;
      lobbies: Array<{ id: string; round: number; title: string; status: string; host: { username: string }; participantCount: number }>;
    }>(`/rotations/${groupId}`),

  completeRotation: (groupId: string) =>
    request<{ success: boolean }>(`/rotations/${groupId}/complete`, {
      method: 'POST',
    }),

  // Runs
  getUserRuns: (username: string) =>
    request<{
      user: { id: string; username: string };
      stats: { totalRuns: number; completedRuns: number; radshareRuns: number };
      runs: Array<{
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
      }>;
    }>(`/users/${encodeURIComponent(username)}/runs`),

  // Profile
  getUserProfile: (username: string) =>
    request<import('@warframe/shared').PlayerProfile>(`/users/${encodeURIComponent(username)}/profile`),

  getUserRunsPaginated: (username: string, page: number = 1, limit: number = 20) =>
    request<import('@warframe/shared').PaginatedRuns>(
      `/users/${encodeURIComponent(username)}/runs?page=${page}&limit=${limit}`
    ),

  // Settings
  updateSettings: (data: { platform?: string; masteryRank?: number }) =>
    request<{ user: UserDTO }>('/users/settings', {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
};
