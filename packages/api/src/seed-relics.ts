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

  // Insertar solo las que no existen
  let added = 0;
  for (const relic of relics) {
    const exists = await prisma.relic.findFirst({
      where: { era: relic.era as any, name: relic.name },
    });
    if (!exists) {
      await prisma.relic.create({
        data: { era: relic.era as any, name: relic.name },
      });
      added++;
    }
  }

  const total = await prisma.relic.count();
  return { added, total, source: 'WFCD Drops API (drops.warframestat.us)' };
}
