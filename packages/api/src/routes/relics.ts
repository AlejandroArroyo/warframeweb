import type { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma.js';
import { z } from 'zod';
import { seedRelicsIfEmpty, refreshRelicsFromAPI } from '../seed-relics.js';

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

  // POST /api/seed - Seedear reliquias desde API pública (idempotente, sin auth)
  app.post('/api/seed', async (request, reply) => {
    const count = await prisma.relic.count();
    if (count > 0) {
      return reply.send({
        message: `Already have ${count} relics. Use POST /api/admin/refresh-relics to update from API.`,
      });
    }

    try {
      await seedRelicsIfEmpty();
      const total = await prisma.relic.count();
      return reply.send({ message: `Seeded ${total} relics from Warframe API` });
    } catch (err) {
      return reply.status(500).send({ error: 'Seed failed', message: (err as Error).message });
    }
  });

  // POST /api/admin/refresh-relics - Refrescar reliquias desde API pública (admin)
  app.post('/api/admin/refresh-relics', async (request, reply) => {
    try {
      const result = await refreshRelicsFromAPI();
      return reply.send(result);
    } catch (err) {
      return reply.status(500).send({ error: 'Refresh failed', message: (err as Error).message });
    }
  });
}
