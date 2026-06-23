import type { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma.js';
import { getIO } from '../plugins/socket.js';

import { verifyToken as jwtVerify } from '../lib/jwt.js';

function verifyToken(authHeader: string | undefined): string | null {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  try {
    return jwtVerify(authHeader.slice(7)).userId;
  } catch {
    return null;
  }
}

function formatLobby(lobby: any) {
  return {
    ...lobby,
    participantCount: lobby.participants?.length ?? 0,
  };
}

export async function rotationRoutes(app: FastifyInstance): Promise<void> {
  // ----------------------------------------------------------------
  // POST /api/lobbies/:id/start-rotation - Iniciar rotación desde un lobby
  // Convierte el lobby actual en ronda 1 de N de una RotationGroup
  // Requiere: lobby radshare, OPEN, host autenticado
  // ----------------------------------------------------------------
  app.post('/api/lobbies/:id/start-rotation', async (request, reply) => {
    const { id } = request.params as { id: string };

    const userId = verifyToken(request.headers.authorization);
    if (!userId) {
      return reply.status(401).send({ error: 'Authentication required' });
    }

    const lobby = await prisma.lobby.findUnique({
      where: { id },
      include: { participants: true },
    });

    if (!lobby) return reply.status(404).send({ error: 'Lobby not found' });
    if (lobby.hostId !== userId) {
      return reply.status(403).send({ error: 'Only the host can start a rotation' });
    }
    if (lobby.status !== 'OPEN') {
      return reply.status(400).send({ error: 'Lobby must be OPEN to start a rotation' });
    }
    if (!lobby.isRadshare) {
      return reply.status(400).send({ error: 'Only radshare lobbies can be rotations' });
    }
    if (lobby.participants.length < 2) {
      return reply.status(400).send({ error: 'Need at least 2 participants for a rotation' });
    }

    const totalRounds = lobby.participants.length; // 1 ronda por participante

    // Crear el grupo de rotación
    const group = await prisma.rotationGroup.create({
      data: {
        relicEra: lobby.relicEra,
        relicName: lobby.relicName || 'Unknown',
        totalRounds,
      },
    });

    // Vincular el lobby actual como ronda 1
    const updated = await prisma.lobby.update({
      where: { id },
      data: {
        rotationGroupId: group.id,
        rotationRound: 1,
        rotationTotal: totalRounds,
        title: `${lobby.relicEra} ${lobby.relicName} Rad | ${lobby.missionType} (1/${totalRounds})`,
      },
      include: {
        host: { select: { id: true, username: true, platform: true, masteryRank: true, reputation: true } },
        participants: {
          include: {
            user: { select: { id: true, username: true, platform: true, masteryRank: true, reputation: true } },
          },
        },
      },
    });

    const io = getIO();
    io.emit('lobby:updated', formatLobby(updated));

    return reply.send({
      groupId: group.id,
      totalRounds,
      lobby: formatLobby(updated),
    });
  });

  // ----------------------------------------------------------------
  // GET /api/rotations/:groupId - Ver progreso de una rotación
  // ----------------------------------------------------------------
  app.get('/api/rotations/:groupId', async (request, reply) => {
    const { groupId } = request.params as { groupId: string };

    const group = await prisma.rotationGroup.findUnique({
      where: { id: groupId },
      include: {
        lobbies: {
          orderBy: { rotationRound: 'asc' },
          include: {
            host: { select: { id: true, username: true, platform: true } },
            participants: {
              include: {
                user: { select: { id: true, username: true } },
              },
            },
          },
        },
      },
    });

    if (!group) {
      return reply.status(404).send({ error: 'Rotation group not found' });
    }

    return reply.send({
      id: group.id,
      relicEra: group.relicEra,
      relicName: group.relicName,
      totalRounds: group.totalRounds,
      completedAt: group.completedAt,
      createdAt: group.createdAt,
      lobbies: group.lobbies.map((l) => ({
        id: l.id,
        round: l.rotationRound,
        title: l.title,
        status: l.status,
        host: l.host,
        participantCount: l.participants.length,
      })),
    });
  });

  // ----------------------------------------------------------------
  // POST /api/rotations/:groupId/complete - Cerrar rotación manualmente
  // ----------------------------------------------------------------
  app.post('/api/rotations/:groupId/complete', async (request, reply) => {
    const { groupId } = request.params as { groupId: string };

    const userId = verifyToken(request.headers.authorization);
    if (!userId) {
      return reply.status(401).send({ error: 'Authentication required' });
    }

    const group = await prisma.rotationGroup.findUnique({
      where: { id: groupId },
      include: { lobbies: { take: 1 } },
    });

    if (!group) return reply.status(404).send({ error: 'Rotation group not found' });

    // Verificar que el solicitante sea host de alguna lobby del grupo
    const isHost = group.lobbies.some((l) => l.hostId === userId);
    if (!isHost) {
      return reply.status(403).send({ error: 'Only a rotation host can complete it' });
    }

    await prisma.rotationGroup.update({
      where: { id: groupId },
      data: { completedAt: new Date() },
    });

    return reply.send({ success: true, completedAt: new Date().toISOString() });
  });
}
