import type { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma.js';

export async function runRoutes(app: FastifyInstance): Promise<void> {
  // GET /api/runs - Listar runs (con filtro opcional por userId)
  app.get('/api/runs', async (request, reply) => {
    const query = request.query as { userId?: string; limit?: string };

    const where: Record<string, unknown> = {};
    if (query.userId) {
      where.userId = query.userId;
    }

    const limit = Math.min(parseInt(query.limit || '50', 10), 200);

    const runs = await prisma.run.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            username: true,
            platform: true,
            masteryRank: true,
          },
        },
        lobby: {
          select: {
            id: true,
            title: true,
            missionType: true,
            relicEra: true,
            relicName: true,
            isRadshare: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return reply.send(runs);
  });

}
