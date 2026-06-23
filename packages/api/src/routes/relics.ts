import type { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma.js';
import { z } from 'zod';

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
}
