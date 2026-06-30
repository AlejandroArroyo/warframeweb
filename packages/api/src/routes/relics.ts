import type { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma.js';
import { z } from 'zod';

// Lista completa de reliquias para seed manual
const RELICS_DATA = [
  { era: 'Lith', name: 'A1' }, { era: 'Lith', name: 'A2' },
  { era: 'Lith', name: 'B1' }, { era: 'Lith', name: 'B2' }, { era: 'Lith', name: 'B3' }, { era: 'Lith', name: 'B4' }, { era: 'Lith', name: 'B5' }, { era: 'Lith', name: 'B6' }, { era: 'Lith', name: 'B7' }, { era: 'Lith', name: 'B8' }, { era: 'Lith', name: 'B9' }, { era: 'Lith', name: 'B10' },
  { era: 'Lith', name: 'C1' }, { era: 'Lith', name: 'C2' }, { era: 'Lith', name: 'C3' }, { era: 'Lith', name: 'C4' }, { era: 'Lith', name: 'C5' }, { era: 'Lith', name: 'C6' }, { era: 'Lith', name: 'C7' }, { era: 'Lith', name: 'C8' }, { era: 'Lith', name: 'C9' },
  { era: 'Lith', name: 'D1' },
  { era: 'Lith', name: 'F1' }, { era: 'Lith', name: 'F2' },
  { era: 'Lith', name: 'G1' }, { era: 'Lith', name: 'G2' }, { era: 'Lith', name: 'G3' },
  { era: 'Lith', name: 'H1' }, { era: 'Lith', name: 'H2' },
  { era: 'Lith', name: 'K1' }, { era: 'Lith', name: 'K2' },
  { era: 'Lith', name: 'M1' },
  { era: 'Lith', name: 'N1' }, { era: 'Lith', name: 'N2' }, { era: 'Lith', name: 'N3' }, { era: 'Lith', name: 'N4' }, { era: 'Lith', name: 'N5' }, { era: 'Lith', name: 'N6' }, { era: 'Lith', name: 'N7' }, { era: 'Lith', name: 'N8' },
  { era: 'Lith', name: 'P1' },
  { era: 'Lith', name: 'S1' }, { era: 'Lith', name: 'S2' }, { era: 'Lith', name: 'S3' }, { era: 'Lith', name: 'S4' }, { era: 'Lith', name: 'S5' }, { era: 'Lith', name: 'S6' }, { era: 'Lith', name: 'S7' }, { era: 'Lith', name: 'S8' },
  { era: 'Lith', name: 'T1' }, { era: 'Lith', name: 'T2' }, { era: 'Lith', name: 'T3' }, { era: 'Lith', name: 'T4' }, { era: 'Lith', name: 'T5' }, { era: 'Lith', name: 'T6' }, { era: 'Lith', name: 'T7' }, { era: 'Lith', name: 'T8' }, { era: 'Lith', name: 'T9' },
  { era: 'Lith', name: 'V1' }, { era: 'Lith', name: 'V2' }, { era: 'Lith', name: 'V3' }, { era: 'Lith', name: 'V4' }, { era: 'Lith', name: 'V5' }, { era: 'Lith', name: 'V6' }, { era: 'Lith', name: 'V7' }, { era: 'Lith', name: 'V8' },
  { era: 'Lith', name: 'W1' }, { era: 'Lith', name: 'W2' },

  { era: 'Meso', name: 'A1' },
  { era: 'Meso', name: 'B1' }, { era: 'Meso', name: 'B2' }, { era: 'Meso', name: 'B3' }, { era: 'Meso', name: 'B4' }, { era: 'Meso', name: 'B5' }, { era: 'Meso', name: 'B6' }, { era: 'Meso', name: 'B7' }, { era: 'Meso', name: 'B8' },
  { era: 'Meso', name: 'C1' }, { era: 'Meso', name: 'C2' }, { era: 'Meso', name: 'C3' }, { era: 'Meso', name: 'C4' }, { era: 'Meso', name: 'C5' }, { era: 'Meso', name: 'C6' }, { era: 'Meso', name: 'C7' }, { era: 'Meso', name: 'C8' }, { era: 'Meso', name: 'C9' }, { era: 'Meso', name: 'C10' }, { era: 'Meso', name: 'C11' }, { era: 'Meso', name: 'C12' }, { era: 'Meso', name: 'C13' }, { era: 'Meso', name: 'C14' }, { era: 'Meso', name: 'C15' }, { era: 'Meso', name: 'C16' }, { era: 'Meso', name: 'C17' }, { era: 'Meso', name: 'C18' }, { era: 'Meso', name: 'C19' }, { era: 'Meso', name: 'C20' }, { era: 'Meso', name: 'C21' }, { era: 'Meso', name: 'C22' }, { era: 'Meso', name: 'C23' },
  { era: 'Meso', name: 'D1' }, { era: 'Meso', name: 'D2' }, { era: 'Meso', name: 'D3' }, { era: 'Meso', name: 'D4' },
  { era: 'Meso', name: 'F1' }, { era: 'Meso', name: 'F2' },
  { era: 'Meso', name: 'G1' }, { era: 'Meso', name: 'G2' },
  { era: 'Meso', name: 'H1' }, { era: 'Meso', name: 'H2' },
  { era: 'Meso', name: 'K1' }, { era: 'Meso', name: 'K2' },
  { era: 'Meso', name: 'N1' }, { era: 'Meso', name: 'N2' }, { era: 'Meso', name: 'N3' }, { era: 'Meso', name: 'N4' }, { era: 'Meso', name: 'N5' }, { era: 'Meso', name: 'N6' }, { era: 'Meso', name: 'N7' }, { era: 'Meso', name: 'N8' }, { era: 'Meso', name: 'N9' }, { era: 'Meso', name: 'N10' }, { era: 'Meso', name: 'N11' }, { era: 'Meso', name: 'N12' },
  { era: 'Meso', name: 'O1' },
  { era: 'Meso', name: 'P1' }, { era: 'Meso', name: 'P2' }, { era: 'Meso', name: 'P3' },
  { era: 'Meso', name: 'R1' },
  { era: 'Meso', name: 'S1' }, { era: 'Meso', name: 'S2' }, { era: 'Meso', name: 'S3' }, { era: 'Meso', name: 'S4' }, { era: 'Meso', name: 'S5' }, { era: 'Meso', name: 'S6' }, { era: 'Meso', name: 'S7' }, { era: 'Meso', name: 'S8' }, { era: 'Meso', name: 'S9' }, { era: 'Meso', name: 'S10' }, { era: 'Meso', name: 'S11' }, { era: 'Meso', name: 'S12' }, { era: 'Meso', name: 'S13' },
  { era: 'Meso', name: 'T1' },
  { era: 'Meso', name: 'V1' }, { era: 'Meso', name: 'V2' }, { era: 'Meso', name: 'V3' }, { era: 'Meso', name: 'V4' }, { era: 'Meso', name: 'V5' }, { era: 'Meso', name: 'V6' }, { era: 'Meso', name: 'V7' }, { era: 'Meso', name: 'V8' }, { era: 'Meso', name: 'V9' },

  { era: 'Neo', name: 'A1' }, { era: 'Neo', name: 'A2' }, { era: 'Neo', name: 'A3' }, { era: 'Neo', name: 'A4' }, { era: 'Neo', name: 'A5' }, { era: 'Neo', name: 'A6' }, { era: 'Neo', name: 'A7' }, { era: 'Neo', name: 'A8' },
  { era: 'Neo', name: 'B1' }, { era: 'Neo', name: 'B2' }, { era: 'Neo', name: 'B3' }, { era: 'Neo', name: 'B4' }, { era: 'Neo', name: 'B5' }, { era: 'Neo', name: 'B6' }, { era: 'Neo', name: 'B7' }, { era: 'Neo', name: 'B8' }, { era: 'Neo', name: 'B9' }, { era: 'Neo', name: 'B10' },
  { era: 'Neo', name: 'C1' }, { era: 'Neo', name: 'C2' }, { era: 'Neo', name: 'C3' }, { era: 'Neo', name: 'C4' }, { era: 'Neo', name: 'C5' }, { era: 'Neo', name: 'C6' }, { era: 'Neo', name: 'C7' }, { era: 'Neo', name: 'C8' }, { era: 'Neo', name: 'C9' }, { era: 'Neo', name: 'C10' },
  { era: 'Neo', name: 'D1' }, { era: 'Neo', name: 'D2' },
  { era: 'Neo', name: 'G1' },
  { era: 'Neo', name: 'K1' },
  { era: 'Neo', name: 'N1' }, { era: 'Neo', name: 'N2' }, { era: 'Neo', name: 'N3' }, { era: 'Neo', name: 'N4' }, { era: 'Neo', name: 'N5' }, { era: 'Neo', name: 'N6' }, { era: 'Neo', name: 'N7' }, { era: 'Neo', name: 'N8' }, { era: 'Neo', name: 'N9' }, { era: 'Neo', name: 'N10' }, { era: 'Neo', name: 'N11' }, { era: 'Neo', name: 'N12' }, { era: 'Neo', name: 'N13' }, { era: 'Neo', name: 'N14' }, { era: 'Neo', name: 'N15' }, { era: 'Neo', name: 'N16' }, { era: 'Neo', name: 'N17' }, { era: 'Neo', name: 'N18' },
  { era: 'Neo', name: 'S1' }, { era: 'Neo', name: 'S2' }, { era: 'Neo', name: 'S3' }, { era: 'Neo', name: 'S4' }, { era: 'Neo', name: 'S5' }, { era: 'Neo', name: 'S6' }, { era: 'Neo', name: 'S7' }, { era: 'Neo', name: 'S8' }, { era: 'Neo', name: 'S9' }, { era: 'Neo', name: 'S10' }, { era: 'Neo', name: 'S11' }, { era: 'Neo', name: 'S12' }, { era: 'Neo', name: 'S13' },
  { era: 'Neo', name: 'T1' }, { era: 'Neo', name: 'T2' }, { era: 'Neo', name: 'T3' }, { era: 'Neo', name: 'T4' }, { era: 'Neo', name: 'T5' }, { era: 'Neo', name: 'T6' }, { era: 'Neo', name: 'T7' }, { era: 'Neo', name: 'T8' }, { era: 'Neo', name: 'T9' }, { era: 'Neo', name: 'T10' },
  { era: 'Neo', name: 'V1' }, { era: 'Neo', name: 'V2' }, { era: 'Neo', name: 'V3' }, { era: 'Neo', name: 'V4' }, { era: 'Neo', name: 'V5' }, { era: 'Neo', name: 'V6' }, { era: 'Neo', name: 'V7' }, { era: 'Neo', name: 'V8' },
  { era: 'Neo', name: 'Z1' },

  { era: 'Axi', name: 'A1' }, { era: 'Axi', name: 'A2' }, { era: 'Axi', name: 'A3' }, { era: 'Axi', name: 'A4' }, { era: 'Axi', name: 'A5' }, { era: 'Axi', name: 'A6' }, { era: 'Axi', name: 'A7' },
  { era: 'Axi', name: 'B1' }, { era: 'Axi', name: 'B2' }, { era: 'Axi', name: 'B3' }, { era: 'Axi', name: 'B4' }, { era: 'Axi', name: 'B5' }, { era: 'Axi', name: 'B6' }, { era: 'Axi', name: 'B7' }, { era: 'Axi', name: 'B8' }, { era: 'Axi', name: 'B9' },
  { era: 'Axi', name: 'C1' }, { era: 'Axi', name: 'C2' }, { era: 'Axi', name: 'C3' }, { era: 'Axi', name: 'C4' }, { era: 'Axi', name: 'C5' }, { era: 'Axi', name: 'C6' }, { era: 'Axi', name: 'C7' }, { era: 'Axi', name: 'C8' }, { era: 'Axi', name: 'C9' },
  { era: 'Axi', name: 'D1' }, { era: 'Axi', name: 'D2' },
  { era: 'Axi', name: 'E1' },
  { era: 'Axi', name: 'G1' }, { era: 'Axi', name: 'G2' },
  { era: 'Axi', name: 'H1' }, { era: 'Axi', name: 'H2' }, { era: 'Axi', name: 'H3' }, { era: 'Axi', name: 'H4' },
  { era: 'Axi', name: 'K1' },
  { era: 'Axi', name: 'L1' }, { era: 'Axi', name: 'L2' }, { era: 'Axi', name: 'L3' }, { era: 'Axi', name: 'L4' }, { era: 'Axi', name: 'L5' },
  { era: 'Axi', name: 'N1' }, { era: 'Axi', name: 'N2' }, { era: 'Axi', name: 'N3' }, { era: 'Axi', name: 'N4' }, { era: 'Axi', name: 'N5' }, { era: 'Axi', name: 'N6' }, { era: 'Axi', name: 'N7' }, { era: 'Axi', name: 'N8' }, { era: 'Axi', name: 'N9' }, { era: 'Axi', name: 'N10' },
  { era: 'Axi', name: 'P1' },
  { era: 'Axi', name: 'S1' }, { era: 'Axi', name: 'S2' }, { era: 'Axi', name: 'S3' }, { era: 'Axi', name: 'S4' }, { era: 'Axi', name: 'S5' }, { era: 'Axi', name: 'S6' }, { era: 'Axi', name: 'S7' }, { era: 'Axi', name: 'S8' }, { era: 'Axi', name: 'S9' }, { era: 'Axi', name: 'S10' }, { era: 'Axi', name: 'S11' },
  { era: 'Axi', name: 'T1' }, { era: 'Axi', name: 'T2' }, { era: 'Axi', name: 'T3' }, { era: 'Axi', name: 'T4' }, { era: 'Axi', name: 'T5' }, { era: 'Axi', name: 'T6' }, { era: 'Axi', name: 'T7' }, { era: 'Axi', name: 'T8' }, { era: 'Axi', name: 'T9' }, { era: 'Axi', name: 'T10' },
  { era: 'Axi', name: 'V1' }, { era: 'Axi', name: 'V2' }, { era: 'Axi', name: 'V3' }, { era: 'Axi', name: 'V4' }, { era: 'Axi', name: 'V5' }, { era: 'Axi', name: 'V6' }, { era: 'Axi', name: 'V7' }, { era: 'Axi', name: 'V8' },
  { era: 'Axi', name: 'W1' },

  { era: 'Requiem', name: 'I' }, { era: 'Requiem', name: 'II' }, { era: 'Requiem', name: 'III' },
  { era: 'Requiem', name: 'IV' }, { era: 'Requiem', name: 'V' }, { era: 'Requiem', name: 'VI' },
  { era: 'Requiem', name: 'VII' }, { era: 'Requiem', name: 'VIII' },
  { era: 'Requiem', name: 'IX' }, { era: 'Requiem', name: 'X' },
  { era: 'Requiem', name: 'XI' }, { era: 'Requiem', name: 'XII' },
  { era: 'Requiem', name: 'XIII' }, { era: 'Requiem', name: 'XIV' },
  { era: 'Requiem', name: 'XV' }, { era: 'Requiem', name: 'XVI' },
];

const relicFiltersSchema = z.object({
  era: z.enum(['Lith', 'Meso', 'Neo', 'Axi', 'Requiem']).optional(),
  query: z.string().optional(),
});

export async function relicRoutes(app: FastifyInstance): Promise<void> {
  // GET /api/relics - Listar reliquias con filtros
  app.get('/api/relics', async (request, reply) => {
    const parsed = relicFiltersSchema.safeParse(request.query);

    const where: Record<string, unknown> = {};

    if (parsed.success) {
      if (parsed.data.era) {
        where.era = parsed.data.era;
      }
      if (parsed.data.query) {
        where.name = {
          contains: parsed.data.query.toUpperCase(),
          mode: 'insensitive',
        };
      }
    }

    const relics = await prisma.relic.findMany({
      where,
      orderBy: [
        { era: 'asc' },
        { name: 'asc' },
      ],
    });

    return reply.send(relics);
  });

  // GET /api/relics/:era - Reliquias por era (atajo)
  app.get('/api/relics/:era', async (request, reply) => {
    const { era } = request.params as { era: string };

    const validEras = ['Lith', 'Meso', 'Neo', 'Axi', 'Requiem'] as const;
    if (!validEras.includes(era as any)) {
      return reply.status(400).send({
        error: 'Invalid era',
        message: `Era must be one of: ${validEras.join(', ')}`,
      });
    }

    const relics = await prisma.relic.findMany({
      where: { era: era as any },
      orderBy: { name: 'asc' },
    });

    return reply.send(relics);
  });

  // POST /api/seed - Seedear reliquias (idempotente, sin auth)
  app.post('/api/seed', async (request, reply) => {
    const count = await prisma.relic.count();
    if (count > 0) {
      return reply.send({ message: `Already have ${count} relics, skipping` });
    }

    await prisma.relic.createMany({
      data: RELICS_DATA,
      skipDuplicates: true,
    });

    const total = await prisma.relic.count();
    return reply.send({ message: `Seeded ${total} relics` });
  });
}
