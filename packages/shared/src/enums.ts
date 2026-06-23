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
