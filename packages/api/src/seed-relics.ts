import { prisma } from './lib/prisma.js';
import { getRelicList } from './lib/relics-api.js';

/**
 * Seed de reliquias si la tabla está vacía.
 * Usa la API pública de Warframe (WFCD Drops) para obtener la lista actualizada.
 * Idempotente: si ya hay reliquias, no hace nada.
 * Fallback hardcodeado en relics-api.ts si la API no responde.
 */
export async function seedRelicsIfEmpty(): Promise<void> {
  const count = await prisma.relic.count();
  if (count > 0) {
    console.log(`🗂️  Relic table already has ${count} relics, skipping seed`);
    return;
  }

  console.log('🌱 Seeding relics from Warframe API...');
  const relics = await getRelicList();

  await prisma.relic.createMany({
    data: relics,
    skipDuplicates: true,
  });
  console.log(`✅ Seeded ${relics.length} relics`);
}

/**
 * Refresca todas las reliquias desde la API (upsert).
 * Agrega las que faltan, no elimina existentes.
 */
export async function refreshRelicsFromAPI(): Promise<{ added: number; total: number; source: string }> {
  const relics = await getRelicList();
  const countBefore = await prisma.relic.count();

  // createMany con skipDuplicates aprovecha @@unique([era, name])
  await prisma.relic.createMany({
    data: relics,
    skipDuplicates: true,
  });

  const total = await prisma.relic.count();
  const added = total - countBefore;
  return { added, total, source: 'WFCD Drops API (drops.warframestat.us)' };
}
