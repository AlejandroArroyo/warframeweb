import type { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma.js';
import { PLATFORMS } from '@warframe/shared';

export async function userRoutes(app: FastifyInstance): Promise<void> {
  // GET /api/users - Listar usuarios
  app.get('/api/users', async (_request, reply) => {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        username: true,
        platform: true,
        masteryRank: true,
        reputation: true,
      },
      take: 20,
      orderBy: { createdAt: 'desc' },
    });

    return reply.send(users);
  });

  // GET /api/users/:username - Buscar usuario por nombre
  app.get('/api/users/:username', async (request, reply) => {
    const { username } = request.params as { username: string };

    const user = await prisma.user.findUnique({
      where: { username },
      select: {
        id: true,
        username: true,
        platform: true,
        masteryRank: true,
        reputation: true,
        isBanned: true,
      },
    });

    if (!user) {
      return reply.status(404).send({ error: 'User not found' });
    }

    return reply.send(user);
  });

  // ------------------------------------------------------------------
  // GET /api/users/:username/profile - Perfil completo con estadísticas
  // ------------------------------------------------------------------
  app.get('/api/users/:username/profile', async (request, reply) => {
    const { username } = request.params as { username: string };

    const user = await prisma.user.findUnique({
      where: { username },
    });

    if (!user) {
      return reply.status(404).send({ error: 'User not found' });
    }

    // Obtener todos los runs del usuario con included lobby
    const allRuns = await prisma.run.findMany({
      where: { userId: user.id },
      include: {
        lobby: {
          select: {
            id: true,
            title: true,
            missionType: true,
            relicEra: true,
            relicName: true,
            isRadshare: true,
            rotationGroupId: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const completedRuns = allRuns.filter((r) => r.completed);
    const radshareRuns = allRuns.filter((r) => r.lobby?.isRadshare);

    // Runs por era
    const runsByEra: Record<string, number> = {};
    for (const r of allRuns) {
      if (r.lobby?.relicEra) {
        const era = r.lobby.relicEra;
        runsByEra[era] = (runsByEra[era] || 0) + 1;
      }
    }

    // Runs por misión
    const runsByMission: Record<string, number> = {};
    for (const r of allRuns) {
      if (r.lobby?.missionType) {
        const mission = r.lobby.missionType;
        runsByMission[mission] = (runsByMission[mission] || 0) + 1;
      }
    }

    // Reliquia más usada
    const relicCounts: Record<string, { era: string; name: string; count: number }> = {};
    for (const r of allRuns) {
      if (r.lobby?.relicName && r.lobby.relicEra) {
        const key = `${r.lobby.relicEra}/${r.lobby.relicName}`;
        if (!relicCounts[key]) {
          relicCounts[key] = { era: r.lobby.relicEra, name: r.lobby.relicName, count: 0 };
        }
        relicCounts[key].count++;
      }
    }
    const topRelic = Object.values(relicCounts).sort((a, b) => b.count - a.count)[0] || null;

    // Rotaciones completadas (contar grupos de rotación únicos donde el usuario participó)
    const rotationGroupIds = new Set<string>();
    for (const r of allRuns) {
      if (r.lobby?.rotationGroupId) {
        rotationGroupIds.add(r.lobby.rotationGroupId);
      }
    }
    const completeRotations = await prisma.rotationGroup.count({
      where: {
        id: { in: Array.from(rotationGroupIds) },
        completedAt: { not: null },
      },
    });

    // Racha actual (días consecutivos con al menos un run completado)
    const runDates = completedRuns
      .map((r) => r.completedAt || r.createdAt)
      .filter(Boolean)
      .map((d) => new Date(d).toISOString().slice(0, 10))
      .filter((v, i, a) => a.indexOf(v) === i) // unique dates
      .sort()
      .reverse();

    let currentStreak = 0;
    const today = new Date().toISOString().slice(0, 10);
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

    if (runDates[0] === today || runDates[0] === yesterday) {
      currentStreak = 1;
      for (let i = 1; i < runDates.length; i++) {
        const expected = new Date(new Date(runDates[i - 1]).getTime() - 86400000)
          .toISOString().slice(0, 10);
        if (runDates[i] === expected) {
          currentStreak++;
        } else {
          break;
        }
      }
    }

    // Longest streak
    let longestStreak = 0;
    let tempStreak = 0;
    const sortedAsc = [...runDates].sort();
    for (let i = 0; i < sortedAsc.length; i++) {
      if (i === 0) {
        tempStreak = 1;
      } else {
        const expected = new Date(new Date(sortedAsc[i - 1]).getTime() + 86400000)
          .toISOString().slice(0, 10);
        if (sortedAsc[i] === expected) {
          tempStreak++;
        } else {
          tempStreak = 1;
        }
      }
      longestStreak = Math.max(longestStreak, tempStreak);
    }

    const recentRuns = allRuns.slice(0, 10).map((r) => ({
      id: r.id,
      completed: r.completed,
      createdAt: r.createdAt.toISOString(),
      completedAt: r.completedAt?.toISOString() || null,
      lobbyId: r.lobbyId,
      lobby: r.lobby ? {
        id: r.lobby.id,
        title: r.lobby.title,
        missionType: r.lobby.missionType,
        relicEra: r.lobby.relicEra,
        relicName: r.lobby.relicName,
        isRadshare: r.lobby.isRadshare,
      } : null,
    }));

    return reply.send({
      user: {
        id: user.id,
        username: user.username,
        platform: user.platform,
        masteryRank: user.masteryRank,
        reputation: user.reputation,
      },
      stats: {
        totalRuns: allRuns.length,
        completedRuns: completedRuns.length,
        radshareRuns: radshareRuns.length,
        runsByEra,
        runsByMission,
        topRelic,
        rotationsCompleted: completeRotations,
        currentStreak,
        longestStreak,
        reputation: user.reputation,
      },
      recentRuns,
      createdAt: user.createdAt.toISOString(),
    });
  });

  // ------------------------------------------------------------------
  // GET /api/users/:username/runs - Runs paginados
  // ------------------------------------------------------------------
  app.get('/api/users/:username/runs', async (request, reply) => {
    const { username } = request.params as { username: string };
    const query = request.query as { limit?: string; page?: string };

    const user = await prisma.user.findUnique({
      where: { username },
      select: { id: true },
    });

    if (!user) {
      return reply.status(404).send({ error: 'User not found' });
    }

    const limit = Math.min(parseInt(query.limit || '20', 10), 100);
    const page = Math.max(parseInt(query.page || '1', 10), 1);
    const skip = (page - 1) * limit;

    const [runs, total] = await Promise.all([
      prisma.run.findMany({
        where: { userId: user.id },
        include: {
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
        skip,
        take: limit,
      }),
      prisma.run.count({ where: { userId: user.id } }),
    ]);

    return reply.send({
      runs: runs.map((r) => ({
        id: r.id,
        completed: r.completed,
        createdAt: r.createdAt.toISOString(),
        completedAt: r.completedAt?.toISOString() || null,
        lobbyId: r.lobbyId,
        lobby: r.lobby ? {
          id: r.lobby.id,
          title: r.lobby.title,
          missionType: r.lobby.missionType,
          relicEra: r.lobby.relicEra,
          relicName: r.lobby.relicName,
          isRadshare: r.lobby.isRadshare,
        } : null,
      })),
      total,
      page,
      limit,
      hasMore: skip + limit < total,
    });
  });

  // ------------------------------------------------------------------
  // PATCH /api/users/settings - Actualizar perfil del usuario autenticado
  // ------------------------------------------------------------------
  app.patch('/api/users/settings', {
    preHandler: [app.authenticate()],
  }, async (request, reply) => {
    const userId = request.user!.userId;
    const body = request.body as {
      platform?: string;
      masteryRank?: number;
    };

    // Validar platform
    if (body.platform !== undefined && !PLATFORMS.includes(body.platform as never)) {
      return reply.status(400).send({
        error: `Invalid platform. Valid values: ${PLATFORMS.join(', ')}`,
      });
    }

    // Validar masteryRank
    if (body.masteryRank !== undefined) {
      const mr = body.masteryRank;
      if (!Number.isInteger(mr) || mr < 0 || mr > 30) {
        return reply.status(400).send({
          error: 'Mastery rank must be an integer between 0 and 30',
        });
      }
    }

    // Construir update data
    const updateData: Record<string, unknown> = {};
    if (body.platform !== undefined) updateData.platform = body.platform;
    if (body.masteryRank !== undefined) updateData.masteryRank = body.masteryRank;

    if (Object.keys(updateData).length === 0) {
      return reply.status(400).send({ error: 'No valid fields to update' });
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
        username: true,
        platform: true,
        masteryRank: true,
        reputation: true,
        isAdmin: true,
      },
    });

    return reply.send({ user });
  });
}
