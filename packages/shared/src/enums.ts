// ============================================
// Warframe Relic & Lobby Enums
// ============================================

export const RELIC_ERAS = ['Lith', 'Meso', 'Neo', 'Axi', 'Requiem'] as const;
export type RelicEra = (typeof RELIC_ERAS)[number];

export const REFINEMENTS = ['Intact', 'Exceptional', 'Flawless', 'Radiant'] as const;
export type Refinement = (typeof REFINEMENTS)[number];

export const LOBBY_STATUSES = ['OPEN', 'CONFIRMING', 'IN_PROGRESS', 'CLOSED', 'CANCELLED'] as const;
export type LobbyStatus = (typeof LOBBY_STATUSES)[number];

export const MISSION_TYPES = [
  'Capture',
  'Exterminate',
  'Rescue',
  'Spy',
  'Sabotage',
  'Defense',
  'Survival',
  'Interception',
  'Excavation',
  'Disruption',
  'VoidFlood',
  'VoidCascade',
  'VoidArmageddon',
] as const;
export type MissionType = (typeof MISSION_TYPES)[number];

export const PLATFORMS = ['PC', 'PS4', 'PS5', 'XB1', 'XSX', 'SWITCH'] as const;
export type Platform = (typeof PLATFORMS)[number];

export const REPORT_REASONS = [
  'LEECHING',
  'ABANDON',
  'TOXICITY',
  'SCAM',
  'MULTI_ACCOUNT',
  'OTHER',
] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];

export const REPORT_STATUSES = ['PENDING', 'DISMISSED', 'ACTION_TAKEN'] as const;
export type ReportStatus = (typeof REPORT_STATUSES)[number];

export const USER_ROLES = ['USER', 'MODERATOR', 'ADMIN'] as const;
export type UserRole = (typeof USER_ROLES)[number];

// ============================================
// Reputation Tiers (Rango de Honor)
// ============================================

export interface ReputationTier {
  min: number;
  max: number;
  nameEn: string;
  nameEs: string;
  color: string;      // Tailwind color name
  level: number;      // 1-4
}

export const REPUTATION_TIERS: ReputationTier[] = [
  { min: 0, max: 9, nameEn: 'Novice',    nameEs: 'Novato',   color: 'green',  level: 1 },
  { min: 10, max: 49, nameEn: 'Veteran',  nameEs: 'Veterano', color: 'blue',   level: 2 },
  { min: 50, max: 99, nameEn: 'Master',   nameEs: 'Maestro',  color: 'purple', level: 3 },
  { min: 100, max: Infinity, nameEn: 'Legend', nameEs: 'Leyenda', color: 'amber', level: 4 },
];

export function getReputationTier(reputation: number): ReputationTier {
  return REPUTATION_TIERS.find((t) => reputation >= t.min && reputation <= t.max) || REPUTATION_TIERS[0];
}

// ============================================
// Permission helpers (basadas en rol + rango)
// ============================================

/** Puede kickear jugadores del lobby */
export function canKick(user: { role: UserRole; reputation: number }): boolean {
  if (user.role === 'ADMIN' || user.role === 'MODERATOR') return true;
  return getReputationTier(user.reputation).level >= 2; // Veterano+
}

/** Puede moderar reportes */
export function canModerate(user: { role: UserRole; reputation: number }): boolean {
  if (user.role === 'ADMIN' || user.role === 'MODERATOR') return true;
  return getReputationTier(user.reputation).level >= 3; // Maestro+
}

/** Puede gestionar usuarios (warn, ban, cambiar rol) */
export function canManageUsers(user: { role: UserRole; reputation: number }): boolean {
  if (user.role === 'ADMIN') return true;
  if (user.role === 'MODERATOR') return true;
  return getReputationTier(user.reputation).level >= 4; // Leyenda+
}

/** Puede cambiar roles (solo ADMIN) */
export function canChangeRole(user: { role: UserRole }): boolean {
  return user.role === 'ADMIN';
}
