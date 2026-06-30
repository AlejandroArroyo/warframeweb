/**
 * Fetcher dinámico de reliquias desde la API pública de Warframe.
 * 
 * Fuente: WFCD (Warframe Community Drops) - https://drops.warframestat.us/
 * Mantenido por la comunidad, se actualiza automáticamente con cada update de DE.
 * 
 * Estrategia:
 * 1. Intenta fetch desde la API pública
 * 2. Cachea en memoria por 1 hora
 * 3. Si la API falla, usa fallback hardcodeado
 */

const RELICS_API_URL = 'https://drops.warframestat.us/data/relics.json';

interface RelicEntry {
  tier: string;
  relicName: string;
  state?: string;
}

interface ApiResponse {
  relics: RelicEntry[];
}

/** Valores posibles del enum RelicEra de Prisma */
type RelicEra = 'Lith' | 'Meso' | 'Neo' | 'Axi' | 'Requiem';
const VALID_ERAS: Set<string> = new Set<RelicEra>(['Lith', 'Meso', 'Neo', 'Axi', 'Requiem']);

interface CachedRelics {
  relics: Array<{ era: RelicEra; name: string }>;
  fetchedAt: number;
}

let cache: CachedRelics | null = null;
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hora

/**
 * Fetch reliquias desde la API pública de Warframe.
 * La API devuelve { relics: [{ tier, relicName, state, rewards, _id }] }.
 * Extrae pares únicos (tier, relicName) filtrando eras y nombres válidos.
 */
async function fetchFromAPI(): Promise<Array<{ era: RelicEra; name: string }>> {
  const response = await fetch(RELICS_API_URL);
  if (!response.ok) {
    throw new Error(`API returned ${response.status}`);
  }

  const body = await response.json() as ApiResponse;
  const data = body.relics;
  if (!Array.isArray(data)) {
    throw new Error('Invalid API response format: missing relics array');
  }

  // Extraer pares únicos (tier, relicName)
  const seen = new Set<string>();
  const relics: Array<{ era: RelicEra; name: string }> = [];

  for (const entry of data) {
    if (!entry.tier || !entry.relicName) continue;
    if (!VALID_ERAS.has(entry.tier)) continue; // skip Vanguard y otros
    const key = `${entry.tier}:${entry.relicName}`;
    if (seen.has(key)) continue;
    seen.add(key);
    relics.push({ era: entry.tier as RelicEra, name: entry.relicName });
  }

  // Ordenar por era y nombre
  const eraOrder = ['Lith', 'Meso', 'Neo', 'Axi', 'Requiem'] as const;
  relics.sort((a, b) => {
    const eraDiff = eraOrder.indexOf(a.era) - eraOrder.indexOf(b.era);
    if (eraDiff !== 0) return eraDiff;
    return a.name.localeCompare(b.name);
  });

  return relics;
}

/**
 * Obtiene la lista de reliquias, con cache.
 * 1. Intenta API pública
 * 2. Si falla, usa fallback hardcodeado
 */
export async function getRelicList(): Promise<Array<{ era: RelicEra; name: string }>> {
  // Cache válido?
  if (cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS) {
    return cache.relics;
  }

  try {
    console.log('🌐 Fetching relics from Warframe API...');
    const relics = await fetchFromAPI();
    cache = { relics, fetchedAt: Date.now() };
    console.log(`✅ Fetched ${relics.length} relics from API`);
    return relics;
  } catch (err) {
    console.warn('⚠️  Failed to fetch relics from API, using fallback:', (err as Error).message);
    return FALLBACK_RELICS;
  }
}

/**
 * Fuerza la recarga de reliquias desde la API (invalida cache).
 */
export async function forceRefreshRelics(): Promise<Array<{ era: RelicEra; name: string }>> {
  cache = null;
  return getRelicList();
}

// ──────────────────────────────────────────────
// Fallback hardcodeado por si la API no responde
// (generado desde WFCD drops el 2026-06-30)
// ──────────────────────────────────────────────
const FALLBACK_RELICS: Array<{ era: RelicEra; name: string }> = [
  { era: 'Lith', name: 'A1' }, { era: 'Lith', name: 'A10' }, { era: 'Lith', name: 'A11' }, { era: 'Lith', name: 'A12' }, { era: 'Lith', name: 'A2' }, { era: 'Lith', name: 'A3' }, { era: 'Lith', name: 'A4' }, { era: 'Lith', name: 'A5' }, { era: 'Lith', name: 'A6' }, { era: 'Lith', name: 'A7' }, { era: 'Lith', name: 'A8' }, { era: 'Lith', name: 'A9' },
  { era: 'Lith', name: 'B1' }, { era: 'Lith', name: 'B10' }, { era: 'Lith', name: 'B11' }, { era: 'Lith', name: 'B2' }, { era: 'Lith', name: 'B3' }, { era: 'Lith', name: 'B4' }, { era: 'Lith', name: 'B5' }, { era: 'Lith', name: 'B6' }, { era: 'Lith', name: 'B7' }, { era: 'Lith', name: 'B8' }, { era: 'Lith', name: 'B9' },
  { era: 'Lith', name: 'C1' }, { era: 'Lith', name: 'C10' }, { era: 'Lith', name: 'C11' }, { era: 'Lith', name: 'C12' }, { era: 'Lith', name: 'C13' }, { era: 'Lith', name: 'C14' }, { era: 'Lith', name: 'C2' }, { era: 'Lith', name: 'C3' }, { era: 'Lith', name: 'C4' }, { era: 'Lith', name: 'C5' }, { era: 'Lith', name: 'C6' }, { era: 'Lith', name: 'C7' }, { era: 'Lith', name: 'C8' }, { era: 'Lith', name: 'C9' },
  { era: 'Lith', name: 'D1' }, { era: 'Lith', name: 'D2' }, { era: 'Lith', name: 'D3' }, { era: 'Lith', name: 'D4' }, { era: 'Lith', name: 'D5' }, { era: 'Lith', name: 'D6' }, { era: 'Lith', name: 'D7' },
  { era: 'Lith', name: 'E1' }, { era: 'Lith', name: 'E2' },
  { era: 'Lith', name: 'F1' }, { era: 'Lith', name: 'F2' }, { era: 'Lith', name: 'F3' },
  { era: 'Lith', name: 'G1' }, { era: 'Lith', name: 'G10' }, { era: 'Lith', name: 'G11' }, { era: 'Lith', name: 'G12' }, { era: 'Lith', name: 'G13' }, { era: 'Lith', name: 'G14' }, { era: 'Lith', name: 'G2' }, { era: 'Lith', name: 'G3' }, { era: 'Lith', name: 'G4' }, { era: 'Lith', name: 'G5' }, { era: 'Lith', name: 'G6' }, { era: 'Lith', name: 'G7' }, { era: 'Lith', name: 'G8' }, { era: 'Lith', name: 'G9' },
  { era: 'Lith', name: 'H1' }, { era: 'Lith', name: 'H10' }, { era: 'Lith', name: 'H2' }, { era: 'Lith', name: 'H3' }, { era: 'Lith', name: 'H4' }, { era: 'Lith', name: 'H5' }, { era: 'Lith', name: 'H6' }, { era: 'Lith', name: 'H7' }, { era: 'Lith', name: 'H8' }, { era: 'Lith', name: 'H9' },
  { era: 'Lith', name: 'I1' },
  { era: 'Lith', name: 'K1' }, { era: 'Lith', name: 'K10' }, { era: 'Lith', name: 'K11' }, { era: 'Lith', name: 'K12' }, { era: 'Lith', name: 'K2' }, { era: 'Lith', name: 'K3' }, { era: 'Lith', name: 'K4' }, { era: 'Lith', name: 'K5' }, { era: 'Lith', name: 'K6' }, { era: 'Lith', name: 'K7' }, { era: 'Lith', name: 'K8' }, { era: 'Lith', name: 'K9' },
  { era: 'Lith', name: 'L1' }, { era: 'Lith', name: 'L2' }, { era: 'Lith', name: 'L3' }, { era: 'Lith', name: 'L4' }, { era: 'Lith', name: 'L5' }, { era: 'Lith', name: 'L6' }, { era: 'Lith', name: 'L7' },
  { era: 'Lith', name: 'M1' }, { era: 'Lith', name: 'M10' }, { era: 'Lith', name: 'M2' }, { era: 'Lith', name: 'M3' }, { era: 'Lith', name: 'M4' }, { era: 'Lith', name: 'M5' }, { era: 'Lith', name: 'M6' }, { era: 'Lith', name: 'M7' }, { era: 'Lith', name: 'M8' }, { era: 'Lith', name: 'M9' },
  { era: 'Lith', name: 'N1' }, { era: 'Lith', name: 'N10' }, { era: 'Lith', name: 'N11' }, { era: 'Lith', name: 'N12' }, { era: 'Lith', name: 'N13' }, { era: 'Lith', name: 'N14' }, { era: 'Lith', name: 'N15' }, { era: 'Lith', name: 'N16' }, { era: 'Lith', name: 'N17' }, { era: 'Lith', name: 'N18' }, { era: 'Lith', name: 'N19' }, { era: 'Lith', name: 'N2' }, { era: 'Lith', name: 'N3' }, { era: 'Lith', name: 'N4' }, { era: 'Lith', name: 'N5' }, { era: 'Lith', name: 'N6' }, { era: 'Lith', name: 'N7' }, { era: 'Lith', name: 'N8' }, { era: 'Lith', name: 'N9' },
  { era: 'Lith', name: 'O1' }, { era: 'Lith', name: 'O2' }, { era: 'Lith', name: 'O3' }, { era: 'Lith', name: 'O4' },
  { era: 'Lith', name: 'P1' }, { era: 'Lith', name: 'P2' }, { era: 'Lith', name: 'P3' }, { era: 'Lith', name: 'P4' }, { era: 'Lith', name: 'P5' }, { era: 'Lith', name: 'P6' }, { era: 'Lith', name: 'P7' }, { era: 'Lith', name: 'P8' }, { era: 'Lith', name: 'P9' },
  { era: 'Lith', name: 'Q1' }, { era: 'Lith', name: 'Q2' }, { era: 'Lith', name: 'Q3' },
  { era: 'Lith', name: 'R1' }, { era: 'Lith', name: 'R2' }, { era: 'Lith', name: 'R3' }, { era: 'Lith', name: 'R4' }, { era: 'Lith', name: 'R5' },
  { era: 'Lith', name: 'S1' }, { era: 'Lith', name: 'S10' }, { era: 'Lith', name: 'S11' }, { era: 'Lith', name: 'S12' }, { era: 'Lith', name: 'S13' }, { era: 'Lith', name: 'S14' }, { era: 'Lith', name: 'S15' }, { era: 'Lith', name: 'S16' }, { era: 'Lith', name: 'S17' }, { era: 'Lith', name: 'S18' }, { era: 'Lith', name: 'S2' }, { era: 'Lith', name: 'S3' }, { era: 'Lith', name: 'S4' }, { era: 'Lith', name: 'S5' }, { era: 'Lith', name: 'S6' }, { era: 'Lith', name: 'S7' }, { era: 'Lith', name: 'S8' }, { era: 'Lith', name: 'S9' },
  { era: 'Lith', name: 'T1' }, { era: 'Lith', name: 'T10' }, { era: 'Lith', name: 'T11' }, { era: 'Lith', name: 'T12' }, { era: 'Lith', name: 'T13' }, { era: 'Lith', name: 'T14' }, { era: 'Lith', name: 'T2' }, { era: 'Lith', name: 'T3' }, { era: 'Lith', name: 'T4' }, { era: 'Lith', name: 'T5' }, { era: 'Lith', name: 'T6' }, { era: 'Lith', name: 'T7' }, { era: 'Lith', name: 'T8' }, { era: 'Lith', name: 'T9' },
  { era: 'Lith', name: 'V1' }, { era: 'Lith', name: 'V10' }, { era: 'Lith', name: 'V11' }, { era: 'Lith', name: 'V2' }, { era: 'Lith', name: 'V3' }, { era: 'Lith', name: 'V4' }, { era: 'Lith', name: 'V5' }, { era: 'Lith', name: 'V6' }, { era: 'Lith', name: 'V7' }, { era: 'Lith', name: 'V8' }, { era: 'Lith', name: 'V9' },
  { era: 'Lith', name: 'W1' }, { era: 'Lith', name: 'W2' }, { era: 'Lith', name: 'W3' }, { era: 'Lith', name: 'W4' },
  { era: 'Lith', name: 'X1' },
  { era: 'Lith', name: 'Y1' },
  { era: 'Lith', name: 'Z1' }, { era: 'Lith', name: 'Z2' }, { era: 'Lith', name: 'Z3' }, { era: 'Lith', name: 'Z4' },

  { era: 'Meso', name: 'A1' }, { era: 'Meso', name: 'A10' }, { era: 'Meso', name: 'A11' }, { era: 'Meso', name: 'A12' }, { era: 'Meso', name: 'A2' }, { era: 'Meso', name: 'A3' }, { era: 'Meso', name: 'A4' }, { era: 'Meso', name: 'A5' }, { era: 'Meso', name: 'A6' }, { era: 'Meso', name: 'A7' }, { era: 'Meso', name: 'A8' }, { era: 'Meso', name: 'A9' },
  { era: 'Meso', name: 'B1' }, { era: 'Meso', name: 'B10' }, { era: 'Meso', name: 'B2' }, { era: 'Meso', name: 'B3' }, { era: 'Meso', name: 'B4' }, { era: 'Meso', name: 'B5' }, { era: 'Meso', name: 'B6' }, { era: 'Meso', name: 'B7' }, { era: 'Meso', name: 'B8' }, { era: 'Meso', name: 'B9' },
  { era: 'Meso', name: 'C1' }, { era: 'Meso', name: 'C10' }, { era: 'Meso', name: 'C2' }, { era: 'Meso', name: 'C3' }, { era: 'Meso', name: 'C4' }, { era: 'Meso', name: 'C5' }, { era: 'Meso', name: 'C6' }, { era: 'Meso', name: 'C7' }, { era: 'Meso', name: 'C8' }, { era: 'Meso', name: 'C9' },
  { era: 'Meso', name: 'D1' }, { era: 'Meso', name: 'D2' }, { era: 'Meso', name: 'D3' }, { era: 'Meso', name: 'D4' }, { era: 'Meso', name: 'D5' }, { era: 'Meso', name: 'D6' }, { era: 'Meso', name: 'D7' }, { era: 'Meso', name: 'D8' },
  { era: 'Meso', name: 'E1' }, { era: 'Meso', name: 'E2' }, { era: 'Meso', name: 'E3' }, { era: 'Meso', name: 'E4' }, { era: 'Meso', name: 'E5' }, { era: 'Meso', name: 'E6' }, { era: 'Meso', name: 'E7' },
  { era: 'Meso', name: 'F1' }, { era: 'Meso', name: 'F2' }, { era: 'Meso', name: 'F3' }, { era: 'Meso', name: 'F4' }, { era: 'Meso', name: 'F5' },
  { era: 'Meso', name: 'G1' }, { era: 'Meso', name: 'G10' }, { era: 'Meso', name: 'G2' }, { era: 'Meso', name: 'G3' }, { era: 'Meso', name: 'G4' }, { era: 'Meso', name: 'G5' }, { era: 'Meso', name: 'G6' }, { era: 'Meso', name: 'G7' }, { era: 'Meso', name: 'G8' }, { era: 'Meso', name: 'G9' },
  { era: 'Meso', name: 'H1' }, { era: 'Meso', name: 'H2' }, { era: 'Meso', name: 'H3' }, { era: 'Meso', name: 'H4' }, { era: 'Meso', name: 'H5' }, { era: 'Meso', name: 'H6' }, { era: 'Meso', name: 'H7' }, { era: 'Meso', name: 'H8' },
  { era: 'Meso', name: 'I1' }, { era: 'Meso', name: 'I2' },
  { era: 'Meso', name: 'K1' }, { era: 'Meso', name: 'K2' }, { era: 'Meso', name: 'K3' }, { era: 'Meso', name: 'K4' }, { era: 'Meso', name: 'K5' }, { era: 'Meso', name: 'K6' }, { era: 'Meso', name: 'K7' }, { era: 'Meso', name: 'K8' },
  { era: 'Meso', name: 'L1' }, { era: 'Meso', name: 'L2' }, { era: 'Meso', name: 'L3' }, { era: 'Meso', name: 'L4' }, { era: 'Meso', name: 'L5' },
  { era: 'Meso', name: 'M1' }, { era: 'Meso', name: 'M2' }, { era: 'Meso', name: 'M3' }, { era: 'Meso', name: 'M4' }, { era: 'Meso', name: 'M5' },
  { era: 'Meso', name: 'N1' }, { era: 'Meso', name: 'N10' }, { era: 'Meso', name: 'N11' }, { era: 'Meso', name: 'N12' }, { era: 'Meso', name: 'N13' }, { era: 'Meso', name: 'N14' }, { era: 'Meso', name: 'N15' }, { era: 'Meso', name: 'N16' }, { era: 'Meso', name: 'N17' }, { era: 'Meso', name: 'N2' }, { era: 'Meso', name: 'N3' }, { era: 'Meso', name: 'N4' }, { era: 'Meso', name: 'N5' }, { era: 'Meso', name: 'N6' }, { era: 'Meso', name: 'N7' }, { era: 'Meso', name: 'N8' }, { era: 'Meso', name: 'N9' },
  { era: 'Meso', name: 'O1' }, { era: 'Meso', name: 'O2' }, { era: 'Meso', name: 'O3' }, { era: 'Meso', name: 'O4' }, { era: 'Meso', name: 'O5' }, { era: 'Meso', name: 'O6' },
  { era: 'Meso', name: 'P1' }, { era: 'Meso', name: 'P10' }, { era: 'Meso', name: 'P11' }, { era: 'Meso', name: 'P12' }, { era: 'Meso', name: 'P13' }, { era: 'Meso', name: 'P14' }, { era: 'Meso', name: 'P15' }, { era: 'Meso', name: 'P16' }, { era: 'Meso', name: 'P17' }, { era: 'Meso', name: 'P2' }, { era: 'Meso', name: 'P3' }, { era: 'Meso', name: 'P4' }, { era: 'Meso', name: 'P5' }, { era: 'Meso', name: 'P6' }, { era: 'Meso', name: 'P7' }, { era: 'Meso', name: 'P8' }, { era: 'Meso', name: 'P9' },
  { era: 'Meso', name: 'R1' }, { era: 'Meso', name: 'R2' }, { era: 'Meso', name: 'R3' }, { era: 'Meso', name: 'R4' }, { era: 'Meso', name: 'R5' }, { era: 'Meso', name: 'R6' },
  { era: 'Meso', name: 'S1' }, { era: 'Meso', name: 'S10' }, { era: 'Meso', name: 'S11' }, { era: 'Meso', name: 'S12' }, { era: 'Meso', name: 'S13' }, { era: 'Meso', name: 'S14' }, { era: 'Meso', name: 'S15' }, { era: 'Meso', name: 'S2' }, { era: 'Meso', name: 'S3' }, { era: 'Meso', name: 'S4' }, { era: 'Meso', name: 'S5' }, { era: 'Meso', name: 'S6' }, { era: 'Meso', name: 'S7' }, { era: 'Meso', name: 'S8' }, { era: 'Meso', name: 'S9' },
  { era: 'Meso', name: 'T1' }, { era: 'Meso', name: 'T2' }, { era: 'Meso', name: 'T3' }, { era: 'Meso', name: 'T4' }, { era: 'Meso', name: 'T5' }, { era: 'Meso', name: 'T6' }, { era: 'Meso', name: 'T7' }, { era: 'Meso', name: 'T8' },
  { era: 'Meso', name: 'V1' }, { era: 'Meso', name: 'V10' }, { era: 'Meso', name: 'V11' }, { era: 'Meso', name: 'V12' }, { era: 'Meso', name: 'V13' }, { era: 'Meso', name: 'V14' }, { era: 'Meso', name: 'V15' }, { era: 'Meso', name: 'V2' }, { era: 'Meso', name: 'V3' }, { era: 'Meso', name: 'V4' }, { era: 'Meso', name: 'V5' }, { era: 'Meso', name: 'V6' }, { era: 'Meso', name: 'V7' }, { era: 'Meso', name: 'V8' }, { era: 'Meso', name: 'V9' },
  { era: 'Meso', name: 'W1' }, { era: 'Meso', name: 'W2' }, { era: 'Meso', name: 'W3' }, { era: 'Meso', name: 'W4' }, { era: 'Meso', name: 'W5' },
  { era: 'Meso', name: 'X1' },
  { era: 'Meso', name: 'Y1' }, { era: 'Meso', name: 'Y2' },
  { era: 'Meso', name: 'Z1' }, { era: 'Meso', name: 'Z2' }, { era: 'Meso', name: 'Z3' }, { era: 'Meso', name: 'Z4' }, { era: 'Meso', name: 'Z5' }, { era: 'Meso', name: 'Z6' },

  { era: 'Neo', name: 'A1' }, { era: 'Neo', name: 'A10' }, { era: 'Neo', name: 'A11' }, { era: 'Neo', name: 'A12' }, { era: 'Neo', name: 'A13' }, { era: 'Neo', name: 'A14' }, { era: 'Neo', name: 'A15' }, { era: 'Neo', name: 'A16' }, { era: 'Neo', name: 'A2' }, { era: 'Neo', name: 'A3' }, { era: 'Neo', name: 'A4' }, { era: 'Neo', name: 'A5' }, { era: 'Neo', name: 'A6' }, { era: 'Neo', name: 'A7' }, { era: 'Neo', name: 'A8' }, { era: 'Neo', name: 'A9' },
  { era: 'Neo', name: 'B1' }, { era: 'Neo', name: 'B2' }, { era: 'Neo', name: 'B3' }, { era: 'Neo', name: 'B4' }, { era: 'Neo', name: 'B5' }, { era: 'Neo', name: 'B6' }, { era: 'Neo', name: 'B7' }, { era: 'Neo', name: 'B8' }, { era: 'Neo', name: 'B9' },
  { era: 'Neo', name: 'C1' }, { era: 'Neo', name: 'C2' }, { era: 'Neo', name: 'C3' }, { era: 'Neo', name: 'C4' }, { era: 'Neo', name: 'C5' }, { era: 'Neo', name: 'C6' }, { era: 'Neo', name: 'C7' }, { era: 'Neo', name: 'C8' }, { era: 'Neo', name: 'C9' },
  { era: 'Neo', name: 'D1' }, { era: 'Neo', name: 'D10' }, { era: 'Neo', name: 'D2' }, { era: 'Neo', name: 'D3' }, { era: 'Neo', name: 'D4' }, { era: 'Neo', name: 'D5' }, { era: 'Neo', name: 'D6' }, { era: 'Neo', name: 'D7' }, { era: 'Neo', name: 'D8' }, { era: 'Neo', name: 'D9' },
  { era: 'Neo', name: 'E1' }, { era: 'Neo', name: 'E2' }, { era: 'Neo', name: 'E3' }, { era: 'Neo', name: 'E4' },
  { era: 'Neo', name: 'F1' }, { era: 'Neo', name: 'F2' }, { era: 'Neo', name: 'F3' },
  { era: 'Neo', name: 'G1' }, { era: 'Neo', name: 'G10' }, { era: 'Neo', name: 'G2' }, { era: 'Neo', name: 'G3' }, { era: 'Neo', name: 'G4' }, { era: 'Neo', name: 'G5' }, { era: 'Neo', name: 'G6' }, { era: 'Neo', name: 'G7' }, { era: 'Neo', name: 'G8' }, { era: 'Neo', name: 'G9' },
  { era: 'Neo', name: 'H1' }, { era: 'Neo', name: 'H2' }, { era: 'Neo', name: 'H3' }, { era: 'Neo', name: 'H4' },
  { era: 'Neo', name: 'I1' }, { era: 'Neo', name: 'I2' }, { era: 'Neo', name: 'I3' },
  { era: 'Neo', name: 'K1' }, { era: 'Neo', name: 'K2' }, { era: 'Neo', name: 'K3' }, { era: 'Neo', name: 'K4' }, { era: 'Neo', name: 'K5' }, { era: 'Neo', name: 'K6' }, { era: 'Neo', name: 'K7' }, { era: 'Neo', name: 'K8' }, { era: 'Neo', name: 'K9' },
  { era: 'Neo', name: 'L1' }, { era: 'Neo', name: 'L2' }, { era: 'Neo', name: 'L3' }, { era: 'Neo', name: 'L4' },
  { era: 'Neo', name: 'M1' }, { era: 'Neo', name: 'M2' }, { era: 'Neo', name: 'M3' }, { era: 'Neo', name: 'M4' }, { era: 'Neo', name: 'M5' }, { era: 'Neo', name: 'M6' },
  { era: 'Neo', name: 'N1' }, { era: 'Neo', name: 'N10' }, { era: 'Neo', name: 'N11' }, { era: 'Neo', name: 'N12' }, { era: 'Neo', name: 'N13' }, { era: 'Neo', name: 'N14' }, { era: 'Neo', name: 'N15' }, { era: 'Neo', name: 'N16' }, { era: 'Neo', name: 'N17' }, { era: 'Neo', name: 'N18' }, { era: 'Neo', name: 'N19' }, { era: 'Neo', name: 'N2' }, { era: 'Neo', name: 'N20' }, { era: 'Neo', name: 'N21' }, { era: 'Neo', name: 'N22' }, { era: 'Neo', name: 'N23' }, { era: 'Neo', name: 'N24' }, { era: 'Neo', name: 'N3' }, { era: 'Neo', name: 'N4' }, { era: 'Neo', name: 'N5' }, { era: 'Neo', name: 'N6' }, { era: 'Neo', name: 'N7' }, { era: 'Neo', name: 'N8' }, { era: 'Neo', name: 'N9' },
  { era: 'Neo', name: 'O1' }, { era: 'Neo', name: 'O2' }, { era: 'Neo', name: 'O3' },
  { era: 'Neo', name: 'P1' }, { era: 'Neo', name: 'P10' }, { era: 'Neo', name: 'P2' }, { era: 'Neo', name: 'P3' }, { era: 'Neo', name: 'P4' }, { era: 'Neo', name: 'P5' }, { era: 'Neo', name: 'P6' }, { era: 'Neo', name: 'P7' }, { era: 'Neo', name: 'P8' }, { era: 'Neo', name: 'P9' },
  { era: 'Neo', name: 'Q1' },
  { era: 'Neo', name: 'R1' }, { era: 'Neo', name: 'R2' }, { era: 'Neo', name: 'R3' }, { era: 'Neo', name: 'R4' }, { era: 'Neo', name: 'R5' },
  { era: 'Neo', name: 'S1' }, { era: 'Neo', name: 'S10' }, { era: 'Neo', name: 'S11' }, { era: 'Neo', name: 'S12' }, { era: 'Neo', name: 'S13' }, { era: 'Neo', name: 'S14' }, { era: 'Neo', name: 'S15' }, { era: 'Neo', name: 'S16' }, { era: 'Neo', name: 'S17' }, { era: 'Neo', name: 'S18' }, { era: 'Neo', name: 'S19' }, { era: 'Neo', name: 'S2' }, { era: 'Neo', name: 'S20' }, { era: 'Neo', name: 'S3' }, { era: 'Neo', name: 'S5' }, { era: 'Neo', name: 'S6' }, { era: 'Neo', name: 'S7' }, { era: 'Neo', name: 'S8' }, { era: 'Neo', name: 'S9' },
  { era: 'Neo', name: 'T1' }, { era: 'Neo', name: 'T10' }, { era: 'Neo', name: 'T11' }, { era: 'Neo', name: 'T2' }, { era: 'Neo', name: 'T3' }, { era: 'Neo', name: 'T4' }, { era: 'Neo', name: 'T5' }, { era: 'Neo', name: 'T6' }, { era: 'Neo', name: 'T7' }, { era: 'Neo', name: 'T8' }, { era: 'Neo', name: 'T9' },
  { era: 'Neo', name: 'V1' }, { era: 'Neo', name: 'V10' }, { era: 'Neo', name: 'V11' }, { era: 'Neo', name: 'V12' }, { era: 'Neo', name: 'V2' }, { era: 'Neo', name: 'V3' }, { era: 'Neo', name: 'V4' }, { era: 'Neo', name: 'V5' }, { era: 'Neo', name: 'V6' }, { era: 'Neo', name: 'V7' }, { era: 'Neo', name: 'V8' }, { era: 'Neo', name: 'V9' },
  { era: 'Neo', name: 'W1' }, { era: 'Neo', name: 'W2' },
  { era: 'Neo', name: 'X1' },
  { era: 'Neo', name: 'Y1' },
  { era: 'Neo', name: 'Z1' }, { era: 'Neo', name: 'Z10' }, { era: 'Neo', name: 'Z11' }, { era: 'Neo', name: 'Z2' }, { era: 'Neo', name: 'Z3' }, { era: 'Neo', name: 'Z4' }, { era: 'Neo', name: 'Z5' }, { era: 'Neo', name: 'Z6' }, { era: 'Neo', name: 'Z7' }, { era: 'Neo', name: 'Z8' }, { era: 'Neo', name: 'Z9' },

  { era: 'Axi', name: 'A1' }, { era: 'Axi', name: 'A10' }, { era: 'Axi', name: 'A11' }, { era: 'Axi', name: 'A12' }, { era: 'Axi', name: 'A13' }, { era: 'Axi', name: 'A14' }, { era: 'Axi', name: 'A15' }, { era: 'Axi', name: 'A16' }, { era: 'Axi', name: 'A17' }, { era: 'Axi', name: 'A18' }, { era: 'Axi', name: 'A19' }, { era: 'Axi', name: 'A2' }, { era: 'Axi', name: 'A20' }, { era: 'Axi', name: 'A21' }, { era: 'Axi', name: 'A22' }, { era: 'Axi', name: 'A3' }, { era: 'Axi', name: 'A4' }, { era: 'Axi', name: 'A5' }, { era: 'Axi', name: 'A6' }, { era: 'Axi', name: 'A7' }, { era: 'Axi', name: 'A8' }, { era: 'Axi', name: 'A9' },
  { era: 'Axi', name: 'B1' }, { era: 'Axi', name: 'B2' }, { era: 'Axi', name: 'B3' }, { era: 'Axi', name: 'B4' }, { era: 'Axi', name: 'B5' }, { era: 'Axi', name: 'B6' }, { era: 'Axi', name: 'B7' }, { era: 'Axi', name: 'B8' }, { era: 'Axi', name: 'B9' },
  { era: 'Axi', name: 'C1' }, { era: 'Axi', name: 'C10' }, { era: 'Axi', name: 'C11' }, { era: 'Axi', name: 'C2' }, { era: 'Axi', name: 'C3' }, { era: 'Axi', name: 'C4' }, { era: 'Axi', name: 'C5' }, { era: 'Axi', name: 'C6' }, { era: 'Axi', name: 'C7' }, { era: 'Axi', name: 'C8' }, { era: 'Axi', name: 'C9' },
  { era: 'Axi', name: 'D1' }, { era: 'Axi', name: 'D2' }, { era: 'Axi', name: 'D3' }, { era: 'Axi', name: 'D4' }, { era: 'Axi', name: 'D5' }, { era: 'Axi', name: 'D6' },
  { era: 'Axi', name: 'E1' }, { era: 'Axi', name: 'E2' },
  { era: 'Axi', name: 'F1' }, { era: 'Axi', name: 'F2' }, { era: 'Axi', name: 'F3' },
  { era: 'Axi', name: 'G1' }, { era: 'Axi', name: 'G10' }, { era: 'Axi', name: 'G11' }, { era: 'Axi', name: 'G12' }, { era: 'Axi', name: 'G13' }, { era: 'Axi', name: 'G14' }, { era: 'Axi', name: 'G15' }, { era: 'Axi', name: 'G2' }, { era: 'Axi', name: 'G3' }, { era: 'Axi', name: 'G4' }, { era: 'Axi', name: 'G5' }, { era: 'Axi', name: 'G6' }, { era: 'Axi', name: 'G7' }, { era: 'Axi', name: 'G8' }, { era: 'Axi', name: 'G9' },
  { era: 'Axi', name: 'H1' }, { era: 'Axi', name: 'H2' }, { era: 'Axi', name: 'H3' }, { era: 'Axi', name: 'H4' }, { era: 'Axi', name: 'H5' }, { era: 'Axi', name: 'H6' }, { era: 'Axi', name: 'H7' }, { era: 'Axi', name: 'H8' },
  { era: 'Axi', name: 'I1' }, { era: 'Axi', name: 'I2' }, { era: 'Axi', name: 'I3' },
  { era: 'Axi', name: 'K1' }, { era: 'Axi', name: 'K10' }, { era: 'Axi', name: 'K11' }, { era: 'Axi', name: 'K12' }, { era: 'Axi', name: 'K2' }, { era: 'Axi', name: 'K3' }, { era: 'Axi', name: 'K4' }, { era: 'Axi', name: 'K5' }, { era: 'Axi', name: 'K6' }, { era: 'Axi', name: 'K7' }, { era: 'Axi', name: 'K8' }, { era: 'Axi', name: 'K9' },
  { era: 'Axi', name: 'L1' }, { era: 'Axi', name: 'L2' }, { era: 'Axi', name: 'L3' }, { era: 'Axi', name: 'L4' }, { era: 'Axi', name: 'L5' }, { era: 'Axi', name: 'L6' },
  { era: 'Axi', name: 'M1' }, { era: 'Axi', name: 'M2' }, { era: 'Axi', name: 'M3' }, { era: 'Axi', name: 'M4' }, { era: 'Axi', name: 'M5' }, { era: 'Axi', name: 'M6' },
  { era: 'Axi', name: 'N1' }, { era: 'Axi', name: 'N10' }, { era: 'Axi', name: 'N11' }, { era: 'Axi', name: 'N12' }, { era: 'Axi', name: 'N13' }, { era: 'Axi', name: 'N2' }, { era: 'Axi', name: 'N3' }, { era: 'Axi', name: 'N4' }, { era: 'Axi', name: 'N5' }, { era: 'Axi', name: 'N6' }, { era: 'Axi', name: 'N7' }, { era: 'Axi', name: 'N8' }, { era: 'Axi', name: 'N9' },
  { era: 'Axi', name: 'O1' }, { era: 'Axi', name: 'O2' }, { era: 'Axi', name: 'O3' }, { era: 'Axi', name: 'O4' }, { era: 'Axi', name: 'O5' }, { era: 'Axi', name: 'O6' },
  { era: 'Axi', name: 'P1' }, { era: 'Axi', name: 'P10' }, { era: 'Axi', name: 'P2' }, { era: 'Axi', name: 'P3' }, { era: 'Axi', name: 'P4' }, { era: 'Axi', name: 'P5' }, { era: 'Axi', name: 'P6' }, { era: 'Axi', name: 'P7' }, { era: 'Axi', name: 'P8' }, { era: 'Axi', name: 'P9' },
  { era: 'Axi', name: 'R1' }, { era: 'Axi', name: 'R2' }, { era: 'Axi', name: 'R3' }, { era: 'Axi', name: 'R4' },
  { era: 'Axi', name: 'S1' }, { era: 'Axi', name: 'S10' }, { era: 'Axi', name: 'S11' }, { era: 'Axi', name: 'S12' }, { era: 'Axi', name: 'S13' }, { era: 'Axi', name: 'S14' }, { era: 'Axi', name: 'S15' }, { era: 'Axi', name: 'S16' }, { era: 'Axi', name: 'S17' }, { era: 'Axi', name: 'S18' }, { era: 'Axi', name: 'S19' }, { era: 'Axi', name: 'S2' }, { era: 'Axi', name: 'S20' }, { era: 'Axi', name: 'S3' }, { era: 'Axi', name: 'S4' }, { era: 'Axi', name: 'S5' }, { era: 'Axi', name: 'S6' }, { era: 'Axi', name: 'S7' }, { era: 'Axi', name: 'S8' }, { era: 'Axi', name: 'S9' },
  { era: 'Axi', name: 'T1' }, { era: 'Axi', name: 'T10' }, { era: 'Axi', name: 'T11' }, { era: 'Axi', name: 'T12' }, { era: 'Axi', name: 'T13' }, { era: 'Axi', name: 'T2' }, { era: 'Axi', name: 'T3' }, { era: 'Axi', name: 'T4' }, { era: 'Axi', name: 'T5' }, { era: 'Axi', name: 'T6' }, { era: 'Axi', name: 'T7' }, { era: 'Axi', name: 'T8' }, { era: 'Axi', name: 'T9' },
  { era: 'Axi', name: 'V1' }, { era: 'Axi', name: 'V10' }, { era: 'Axi', name: 'V11' }, { era: 'Axi', name: 'V12' }, { era: 'Axi', name: 'V13' }, { era: 'Axi', name: 'V14' }, { era: 'Axi', name: 'V2' }, { era: 'Axi', name: 'V3' }, { era: 'Axi', name: 'V4' }, { era: 'Axi', name: 'V5' }, { era: 'Axi', name: 'V6' }, { era: 'Axi', name: 'V7' }, { era: 'Axi', name: 'V8' }, { era: 'Axi', name: 'V9' },
  { era: 'Axi', name: 'W1' }, { era: 'Axi', name: 'W2' }, { era: 'Axi', name: 'W3' }, { era: 'Axi', name: 'W4' },
  { era: 'Axi', name: 'Y1' }, { era: 'Axi', name: 'Y2' }, { era: 'Axi', name: 'Y3' },
  { era: 'Axi', name: 'Z1' }, { era: 'Axi', name: 'Z2' },

  { era: 'Requiem', name: 'I' }, { era: 'Requiem', name: 'II' }, { era: 'Requiem', name: 'III' },
  { era: 'Requiem', name: 'IV' }, { era: 'Requiem', name: 'V' }, { era: 'Requiem', name: 'VI' },
  { era: 'Requiem', name: 'VII' }, { era: 'Requiem', name: 'VIII' },
  { era: 'Requiem', name: 'IX' }, { era: 'Requiem', name: 'X' },
  { era: 'Requiem', name: 'XI' }, { era: 'Requiem', name: 'XII' },
  { era: 'Requiem', name: 'XIII' }, { era: 'Requiem', name: 'XIV' },
  { era: 'Requiem', name: 'XV' }, { era: 'Requiem', name: 'XVI' },
];
