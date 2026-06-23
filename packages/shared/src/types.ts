import type { RelicEra, Refinement, LobbyStatus, MissionType, Platform } from './enums.js';

// ============================================
// Data Transfer Objects & API Types
// ============================================

export interface RelicDTO {
  id: string;
  era: RelicEra;
  name: string;
}

export interface UserDTO {
  id: string;
  username: string;
  platform: Platform;
  masteryRank: number;
  reputation: number;
  isAdmin?: boolean;
}

export interface LobbyDTO {
  id: string;
  title: string;
  status: LobbyStatus;
  missionType: MissionType;
  squadSize: number;
  isRadshare: boolean;
  relicEra: RelicEra;
  relicName: string | null;
  refinement: Refinement | null;
  createdAt: string;
  host: UserDTO;
  participants: LobbyParticipantDTO[];
  participantCount: number;

  // Rotación (staggered runs)
  rotationGroupId?: string | null;
  rotationRound?: number | null;
  rotationTotal?: number | null;
}

export interface LobbyParticipantDTO {
  id: string;
  user: UserDTO;
  confirmed: boolean;
  ready: boolean;
  refinement: Refinement | null;
  joinedAt: string;
}

export interface RunDTO {
  id: string;
  completed: boolean;
  createdAt: string;
  completedAt: string | null;
  lobbyId: string | null;
}

// ============================================
// WebSocket Event Payloads
// ============================================

export type WSEvent =
  | { type: 'lobby:created'; lobby: LobbyDTO }
  | { type: 'lobby:updated'; lobby: LobbyDTO }
  | { type: 'lobby:status-changed'; lobbyId: string; status: LobbyStatus }
  | { type: 'lobby:participant-joined'; lobbyId: string; participant: LobbyParticipantDTO }
  | { type: 'lobby:participant-left'; lobbyId: string; userId: string }
  | { type: 'lobby:deleted'; lobbyId: string };

// ============================================
// API Request / Response
// ============================================

export interface CreateLobbyRequest {
  missionType: MissionType;
  relicEra: RelicEra;
  relicName?: string;
  isRadshare?: boolean;
  isRotation?: boolean;
}

export interface JoinLobbyResponse {
  success: boolean;
  lobby: LobbyDTO;
}

export interface ApiError {
  statusCode: number;
  error: string;
  message: string;
}

// ============================================
// Player Profile & Stats
// ============================================

export interface PlayerStats {
  totalRuns: number;
  completedRuns: number;
  radshareRuns: number;
  runsByEra: Record<string, number>;
  runsByMission: Record<string, number>;
  topRelic: { era: string; name: string; count: number } | null;
  rotationsCompleted: number;
  currentStreak: number;
  longestStreak: number;
  reputation: number;
}

export interface PlayerProfile {
  user: UserDTO;
  stats: PlayerStats;
  recentRuns: RunWithLobbyDTO[];
  createdAt: string;
}

export interface RunWithLobbyDTO extends RunDTO {
  lobby: {
    id: string;
    title: string;
    missionType: MissionType;
    relicEra: RelicEra;
    relicName: string | null;
    isRadshare: boolean;
  } | null;
}

export interface PaginatedRuns {
  runs: RunWithLobbyDTO[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}
