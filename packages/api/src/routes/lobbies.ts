import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { getIO } from '../plugins/socket.js';

// Ready check timeouts por lobby (30s countdown)
const readyCheckTimeouts = new Map<string, ReturnType<typeof setTimeout>>();

const READY_CHECK_DELAY_MS = 30_000; // 30 segundos

// Schemas de validación
const createLobbySchema = z.object({
  missionType: z.enum([
    'Capture', 'Exterminate', 'Rescue', 'Spy', 'Sabotage',
    'Defense', 'Survival', 'Interception', 'Excavation',
    'Disruption', 'VoidFlood', 'VoidCascade', 'VoidArmageddon',
  ]),
  relicEra: z.enum(['Lith', 'Meso', 'Neo', 'Axi', 'Requiem']),
  relicName: z.string().optional(),
  isRadshare: z.boolean().optional().default(false),
  isRotation: z.boolean().optional().default(false),
  hostId: z.string(),
});

const lobbyFiltersSchema = z.object({
  era: z.enum(['Lith', 'Meso', 'Neo', 'Axi', 'Requiem']).optional(),
  missionType: z.string().optional(),
  status: z.string().optional(),
});

export async function lobbyRoutes(app: FastifyInstance): Promise<void> {
  // GET /api/lobbies - Listar lobbies activos
  app.get('/api/lobbies', async (request, reply) => {
    const query = lobbyFiltersSchema.safeParse(request.query);

    const where: Record<string, unknown> = {
      status: { notIn: ['CLOSED', 'CANCELLED'] },
    };

    if (query.success) {
      if (query.data.era) where.relicEra = query.data.era;
      if (query.data.missionType) where.missionType = query.data.missionType;
      if (query.data.status) where.status = query.data.status;
    }

    const lobbies = await prisma.lobby.findMany({
      where,
      include: {
        host: {
          select: { id: true, username: true, platform: true, masteryRank: true, reputation: true },
        },
        participants: {
          include: {
            user: {
              select: { id: true, username: true, platform: true, masteryRank: true, reputation: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return reply.send(lobbies.map(formatLobby));
  });

  // GET /api/lobbies/:id - Obtener lobby por ID
  app.get('/api/lobbies/:id', async (request, reply) => {
    const { id } = request.params as { id: string };

    const lobby = await prisma.lobby.findUnique({
      where: { id },
      include: {
        host: {
          select: { id: true, username: true, platform: true, masteryRank: true, reputation: true },
        },
        participants: {
          include: {
            user: {
              select: { id: true, username: true, platform: true, masteryRank: true, reputation: true },
            },
          },
        },
      },
    });

    if (!lobby) {
      return reply.status(404).send({ error: 'Lobby not found' });
    }

    return reply.send(formatLobby(lobby));
  });

  // POST /api/lobbies - Crear lobby
  app.post('/api/lobbies', async (request, reply) => {
    const parsed = createLobbySchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.status(400).send({
        error: 'Validation Error',
        message: parsed.error.errors.map((e) => e.message).join(', '),
      });
    }

    const data = parsed.data;

    // Si es radshare, required relicName
    if (data.isRadshare && !data.relicName) {
      return reply.status(400).send({
        error: 'Validation Error',
        message: 'relicName is required for radshare lobbies',
      });
    }

    const host = await prisma.user.findUnique({ where: { id: data.hostId } });
    if (!host) {
      return reply.status(404).send({ error: 'Host user not found' });
    }

    if (host.isBanned) {
      return reply.status(403).send({ error: 'Banned users cannot create lobbies' });
    }

    const roundLabel = data.isRotation ? ' (1/4)' : '';
    const title = data.isRadshare
      ? `${data.relicEra} ${data.relicName} Rad | ${data.missionType}${roundLabel}`
      : `${data.relicEra} ${data.missionType}`;

    const lobby = await prisma.lobby.create({
      data: {
        title,
        missionType: data.missionType as any,
        relicEra: data.relicEra as any,
        relicName: data.relicName ?? null,
        isRadshare: data.isRadshare,
        refinement: data.isRadshare ? 'Radiant' as any : null,
        hostId: data.hostId,
        participants: {
          create: {
            userId: data.hostId,
            confirmed: false,
            ready: false,
          },
        },
      },
      include: {
        host: {
          select: { id: true, username: true, platform: true, masteryRank: true, reputation: true },
        },
        participants: {
          include: {
            user: {
              select: { id: true, username: true, platform: true, masteryRank: true, reputation: true },
            },
          },
        },
      },
    });

    // Si es rotación, crear el grupo y vincular
    if (data.isRotation && data.isRadshare && data.relicName) {
      const rotationGroup = await prisma.rotationGroup.create({
        data: {
          relicEra: data.relicEra as any,
          relicName: data.relicName,
          totalRounds: 4,
        },
      });
      await prisma.lobby.update({
        where: { id: lobby.id },
        data: {
          rotationGroupId: rotationGroup.id,
          rotationRound: 1,
          rotationTotal: 4,
          title: `${data.relicEra} ${data.relicName} Rad | ${data.missionType} (1/4)`,
        },
      });
    }

    // Refetch lobby with rotation data
    const finalLobby = await prisma.lobby.findUnique({
      where: { id: lobby.id },
      include: {
        host: {
          select: { id: true, username: true, platform: true, masteryRank: true, reputation: true },
        },
        participants: {
          include: {
            user: {
              select: { id: true, username: true, platform: true, masteryRank: true, reputation: true },
            },
          },
        },
      },
    });

    const io = getIO();
    const formatted = formatLobby(finalLobby || lobby);
    io.emit('lobby:created', formatted);

    return reply.status(201).send(formatted);
  });

  // POST /api/lobbies/:id/join - Unirse a lobby
  app.post('/api/lobbies/:id/join', async (request, reply) => {
    const { id } = request.params as { id: string };
    const { userId } = request.body as { userId: string };

    const lobby = await prisma.lobby.findUnique({
      where: { id },
      include: { participants: true },
    });

    if (!lobby) {
      return reply.status(404).send({ error: 'Lobby not found' });
    }

    if (lobby.status !== 'OPEN') {
      return reply.status(400).send({ error: 'Lobby is not open' });
    }

    if (lobby.participants.length >= lobby.squadSize) {
      return reply.status(400).send({ error: 'Lobby is full' });
    }

    const alreadyJoined = lobby.participants.some((p) => p.userId === userId);
    if (alreadyJoined) {
      return reply.status(400).send({ error: 'Already in this lobby' });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return reply.status(404).send({ error: 'User not found' });
    }

    if (user.isBanned) {
      return reply.status(403).send({ error: 'Banned users cannot join lobbies' });
    }

    await prisma.lobbyParticipant.create({
      data: { userId, lobbyId: id },
    });

    const updatedLobby = await prisma.lobby.findUnique({
      where: { id },
      include: {
        host: {
          select: { id: true, username: true, platform: true, masteryRank: true, reputation: true },
        },
        participants: {
          include: {
            user: {
              select: { id: true, username: true, platform: true, masteryRank: true, reputation: true },
            },
          },
        },
      },
    });

    if (updatedLobby) {
      const io = getIO();
      const formatted = formatLobby(updatedLobby);
      io.to(`lobby:${id}`).emit('lobby:updated', formatted);
      // También emitir global para listas
      io.emit('lobby:updated', formatted);
      // Emitir global para notificaciones (el host necesita saber que alguien se unió)
      io.emit('lobby:participant-joined', {
        lobbyId: id,
        participant: {
          user: {
            id: user.id,
            username: user.username,
            platform: user.platform,
            masteryRank: user.masteryRank,
            reputation: user.reputation,
          },
          confirmed: false,
          ready: false,
        },
      });
    }

    return reply.send({ success: true });
  });

  // POST /api/lobbies/:id/leave - Salir de lobby
  app.post('/api/lobbies/:id/leave', async (request, reply) => {
    const { id } = request.params as { id: string };
    const { userId } = request.body as { userId: string };

    const participant = await prisma.lobbyParticipant.findUnique({
      where: { userId_lobbyId: { userId, lobbyId: id } },
    });

    if (!participant) {
      return reply.status(404).send({ error: 'Not a participant' });
    }

    await prisma.lobbyParticipant.delete({
      where: { id: participant.id },
    });

    const io = getIO();
    io.to(`lobby:${id}`).emit('lobby:participant-left', { lobbyId: id, userId });
    io.emit('lobby:participant-left', { lobbyId: id, userId }); // global para notificaciones

    const lobby = await prisma.lobby.findUnique({
      where: { id },
      include: {
        host: {
          select: { id: true, username: true, platform: true, masteryRank: true, reputation: true },
        },
        participants: {
          include: {
            user: {
              select: { id: true, username: true, platform: true, masteryRank: true, reputation: true },
            },
          },
        },
      },
    });

    if (lobby) {
      const formatted = formatLobby(lobby);
      io.emit('lobby:updated', formatted);
    }

    return reply.send({ success: true });
  });

  // Helper: iniciar ready check timeout (30s para que todos hagan ready)
  function startReadyCheckTimeout(lobbyId: string) {
    // Limpiar timeout existente si lo hay
    const existing = readyCheckTimeouts.get(lobbyId);
    if (existing) clearTimeout(existing);

    const timeout = setTimeout(async () => {
      readyCheckTimeouts.delete(lobbyId);
      try {
        const lobby = await prisma.lobby.findUnique({
          where: { id: lobbyId },
          include: { participants: true },
        });

        if (!lobby || lobby.status !== 'CONFIRMING') return;

        // Timeout expirado → forzar IN_PROGRESS
        await prisma.lobby.update({
          where: { id: lobbyId },
          data: { status: 'IN_PROGRESS' },
        });

        const updated = await prisma.lobby.findUnique({
          where: { id: lobbyId },
          include: {
            host: {
              select: { id: true, username: true, platform: true, masteryRank: true, reputation: true },
            },
            participants: {
              include: {
                user: {
                  select: { id: true, username: true, platform: true, masteryRank: true, reputation: true },
                },
              },
            },
          },
        });

        if (updated) {
          const io = getIO();
          const formatted = formatLobby(updated);
          io.to(`lobby:${lobbyId}`).emit('lobby:status-changed', { lobbyId, status: 'IN_PROGRESS' });
          io.emit('lobby:status-changed', { lobbyId, status: 'IN_PROGRESS' });
          io.emit('lobby:updated', formatted);
        }
      } catch (err) {
        console.error(`❌ Ready check timeout error for lobby ${lobbyId}:`, err);
      }
    }, READY_CHECK_DELAY_MS);

    readyCheckTimeouts.set(lobbyId, timeout);
  }

  // Helper: cancelar ready check timeout
  function cancelReadyCheckTimeout(lobbyId: string) {
    const existing = readyCheckTimeouts.get(lobbyId);
    if (existing) {
      clearTimeout(existing);
      readyCheckTimeouts.delete(lobbyId);
    }
  }

  // PATCH /api/lobbies/:id/status - Cambiar estado del lobby (solo host)
  const validTransitions: Record<string, string[]> = {
    OPEN: ['CONFIRMING', 'CANCELLED'],
    CONFIRMING: ['IN_PROGRESS', 'CANCELLED'],
    IN_PROGRESS: ['CLOSED', 'CANCELLED'],
  };

  app.patch('/api/lobbies/:id/status', async (request, reply) => {
    const { id } = request.params as { id: string };
    const { status: newStatus, userId } = request.body as { status: string; userId: string };

    const lobby = await prisma.lobby.findUnique({
      where: { id },
      include: { participants: true },
    });

    if (!lobby) {
      return reply.status(404).send({ error: 'Lobby not found' });
    }

    // Solo el host puede cambiar estado
    if (lobby.hostId !== userId) {
      return reply.status(403).send({ error: 'Only the host can change lobby status' });
    }

    // Validar transición
    const allowed = validTransitions[lobby.status];
    if (!allowed || !allowed.includes(newStatus)) {
      return reply.status(400).send({
        error: 'Invalid status transition',
        message: `Cannot transition from ${lobby.status} to ${newStatus}`,
      });
    }

    // Si pasa a CLOSED, registrar runs para todos los participantes
    if (newStatus === 'CLOSED' && lobby.status === 'IN_PROGRESS') {
      const participantIds = lobby.participants.map((p) => p.userId);
      // Asegurar que el host también tenga run (por si no está en participants)
      const allUserIds = Array.from(new Set([...participantIds, lobby.hostId]));

      await prisma.run.createMany({
        data: allUserIds.map((uid) => ({
          userId: uid,
          lobbyId: id,
          completed: true,
          completedAt: new Date(),
        })),
      });

      // +1 reputación para todos los participantes
      for (const uid of allUserIds) {
        await prisma.user.update({
          where: { id: uid },
          data: { reputation: { increment: 1 } },
        });
      }

      // Auto-advance: si es una rotación, crear la siguiente ronda
      if (lobby.rotationGroupId && lobby.rotationRound < lobby.rotationTotal) {
        const nextRound = lobby.rotationRound + 1;
        const nextHostIdx = (nextRound - 1) % lobby.participants.length;
        const nextHostId = lobby.participants[nextHostIdx]?.userId || lobby.hostId;

        const nextTitle = `${lobby.relicEra} ${lobby.relicName} Rad | ${lobby.missionType} (${nextRound}/${lobby.rotationTotal})`;

        const nextLobby = await prisma.lobby.create({
          data: {
            title: nextTitle,
            missionType: lobby.missionType,
            relicEra: lobby.relicEra,
            relicName: lobby.relicName,
            isRadshare: lobby.isRadshare,
            refinement: 'Radiant' as any,
            hostId: nextHostId,
            rotationGroupId: lobby.rotationGroupId,
            rotationRound: nextRound,
            rotationTotal: lobby.rotationTotal,
            status: 'OPEN',
            participants: {
              create: {
                userId: nextHostId,
                confirmed: false,
                ready: false,
              },
            },
          },
        });

        // Unir automáticamente a los participantes anteriores (excepto el nuevo host que ya está)
        for (const p of lobby.participants) {
          if (p.userId !== nextHostId) {
            await prisma.lobbyParticipant.create({
              data: {
                userId: p.userId,
                lobbyId: nextLobby.id,
                confirmed: false,
                ready: false,
              },
            });
          }
        }

        // Emitir evento de nueva lobby
        const io = getIO();
        const fullLobby = await prisma.lobby.findUnique({
          where: { id: nextLobby.id },
          include: {
            host: { select: { id: true, username: true, platform: true, masteryRank: true, reputation: true } },
            participants: {
              include: {
                user: { select: { id: true, username: true, platform: true, masteryRank: true, reputation: true } },
              },
            },
          },
        });
        if (fullLobby) {
          io.emit('lobby:created', formatLobby(fullLobby));
          io.to(`lobby:${id}`).emit('lobby:rotation-advanced', {
            previousLobbyId: id,
            nextLobbyId: nextLobby.id,
            round: nextRound,
            total: lobby.rotationTotal,
          });
          io.emit('lobby:rotation-advanced', {
            previousLobbyId: id,
            nextLobbyId: nextLobby.id,
            round: nextRound,
            total: lobby.rotationTotal,
          });
        }
      }
    }

    // Manejar ready check timeout en transiciones
    if (newStatus === 'CONFIRMING') {
      startReadyCheckTimeout(id);
    } else if (lobby.status === 'CONFIRMING' && (newStatus === 'IN_PROGRESS' || newStatus === 'CANCELLED')) {
      cancelReadyCheckTimeout(id);
    }

    const updated = await prisma.lobby.update({
      where: { id },
      data: { status: newStatus as any },
      include: {
        host: {
          select: { id: true, username: true, platform: true, masteryRank: true, reputation: true },
        },
        participants: {
          include: {
            user: {
              select: { id: true, username: true, platform: true, masteryRank: true, reputation: true },
            },
          },
        },
      },
    });

    const io = getIO();
    const formatted = formatLobby(updated);
    io.to(`lobby:${id}`).emit('lobby:status-changed', { lobbyId: id, status: newStatus });
    io.emit('lobby:status-changed', { lobbyId: id, status: newStatus }); // global para notificaciones
    io.emit('lobby:updated', formatted);

    return reply.send(formatted);
  });

  // POST /api/lobbies/:id/confirm - Confirmar reliquia (radshare)
  app.post('/api/lobbies/:id/confirm', async (request, reply) => {
    const { id } = request.params as { id: string };
    const { userId, relicName, refinement } = request.body as {
      userId: string;
      relicName?: string;
      refinement: string;
    };

    const lobby = await prisma.lobby.findUnique({
      where: { id },
      include: { participants: true },
    });

    if (!lobby) {
      return reply.status(404).send({ error: 'Lobby not found' });
    }

    if (!lobby.isRadshare) {
      return reply.status(400).send({ error: 'This lobby is not a radshare' });
    }

    if (lobby.status !== 'OPEN') {
      return reply.status(400).send({ error: 'Lobby is not open for confirmation' });
    }

    const participant = lobby.participants.find((p) => p.userId === userId);
    if (!participant) {
      return reply.status(400).send({ error: 'You are not a participant in this lobby' });
    }

    // Validar que la reliquia coincida con la del lobby
    if (relicName && relicName !== lobby.relicName) {
      return reply.status(400).send({
        error: 'Relic mismatch',
        message: `Expected ${lobby.relicName}, got ${relicName}`,
      });
    }

    // Validar refinement
    if (refinement !== 'Radiant') {
      return reply.status(400).send({
        error: 'Invalid refinement',
        message: 'Radshare requires Radiant refinement',
      });
    }

    // Actualizar confirmación
    await prisma.lobbyParticipant.update({
      where: { id: participant.id },
      data: {
        confirmed: true,
        refinement: 'Radiant' as any,
      },
    });

    // Verificar si todos los participantes confirmaron
    const updatedLobby = await prisma.lobby.findUnique({
      where: { id },
      include: {
        host: {
          select: { id: true, username: true, platform: true, masteryRank: true, reputation: true },
        },
        participants: {
          include: {
            user: {
              select: { id: true, username: true, platform: true, masteryRank: true, reputation: true },
            },
          },
        },
      },
    });

    if (!updatedLobby) {
      return reply.status(500).send({ error: 'Failed to update lobby' });
    }

    const allConfirmed = updatedLobby.participants.every((p) => p.confirmed);
    const isFull = updatedLobby.participants.length >= updatedLobby.squadSize;

    if (allConfirmed && isFull) {
      // Todos confirmaron y el lobby está lleno → auto-transición a CONFIRMING
      await prisma.lobby.update({
        where: { id },
        data: { status: 'CONFIRMING' },
      });

      updatedLobby.status = 'CONFIRMING' as any;
      startReadyCheckTimeout(id);
    }

    const io = getIO();
    const formatted = formatLobby(updatedLobby);
    io.to(`lobby:${id}`).emit('lobby:updated', formatted);
    io.to(`lobby:${id}`).emit('lobby:participant-confirmed', {
      lobbyId: id,
      userId,
      allConfirmed: allConfirmed && isFull,
    });
    io.emit('lobby:participant-confirmed', {
      lobbyId: id,
      userId,
      allConfirmed: allConfirmed && isFull,
    });
    if (allConfirmed && isFull) {
      io.emit('lobby:status-changed', { lobbyId: id, status: 'CONFIRMING' });
    }
    io.emit('lobby:updated', formatted);

    return reply.send(formatted);
  });

  // POST /api/lobbies/:id/ready - Marcar como listo (ready check)
  app.post('/api/lobbies/:id/ready', async (request, reply) => {
    const { id } = request.params as { id: string };
    const { userId } = request.body as { userId: string };

    const lobby = await prisma.lobby.findUnique({
      where: { id },
      include: { participants: true },
    });

    if (!lobby) {
      return reply.status(404).send({ error: 'Lobby not found' });
    }

    if (lobby.status !== 'CONFIRMING') {
      return reply.status(400).send({ error: 'Lobby is not in confirming state' });
    }

    const participant = lobby.participants.find((p) => p.userId === userId);
    if (!participant) {
      return reply.status(400).send({ error: 'Not a participant' });
    }

    await prisma.lobbyParticipant.update({
      where: { id: participant.id },
      data: { ready: true },
    });

    // Verificar si todos están listos
    const updatedLobby = await prisma.lobby.findUnique({
      where: { id },
      include: {
        host: {
          select: { id: true, username: true, platform: true, masteryRank: true, reputation: true },
        },
        participants: {
          include: {
            user: {
              select: { id: true, username: true, platform: true, masteryRank: true, reputation: true },
            },
          },
        },
      },
    });

    if (!updatedLobby) {
      return reply.status(500).send({ error: 'Failed to update lobby' });
    }

    const isFull = updatedLobby.participants.length >= updatedLobby.squadSize;
    const allReady = isFull && updatedLobby.participants.every((p) => p.ready);

    if (allReady) {
      // Todos listos → auto-transición a IN_PROGRESS
      cancelReadyCheckTimeout(id);
      await prisma.lobby.update({
        where: { id },
        data: { status: 'IN_PROGRESS' },
      });
      updatedLobby.status = 'IN_PROGRESS' as any;
    }

    const io = getIO();
    const formatted = formatLobby(updatedLobby);
    io.to(`lobby:${id}`).emit('lobby:updated', formatted);
    io.to(`lobby:${id}`).emit('lobby:participant-ready', {
      lobbyId: id,
      userId,
      allReady,
    });
    io.emit('lobby:participant-ready', {
      lobbyId: id,
      userId,
      allReady,
    });
    if (allReady) {
      io.emit('lobby:status-changed', { lobbyId: id, status: 'IN_PROGRESS' });
    }
    io.emit('lobby:updated', formatted);

    return reply.send(formatted);
  });

  // POST /api/lobbies/:id/kick - Host expulsa un jugador
  app.post('/api/lobbies/:id/kick', async (request, reply) => {
    const { id } = request.params as { id: string };
    const { userId, targetUserId } = request.body as { userId: string; targetUserId: string };

    const lobby = await prisma.lobby.findUnique({
      where: { id },
      include: { participants: true },
    });

    if (!lobby) return reply.status(404).send({ error: 'Lobby not found' });

    // Solo el host puede expulsar
    if (lobby.hostId !== userId) {
      return reply.status(403).send({ error: 'Only the host can kick players' });
    }

    // No se puede expulsar al host
    if (targetUserId === lobby.hostId) {
      return reply.status(400).send({ error: 'Cannot kick the host' });
    }

    // Solo se puede expulsar en OPEN o CONFIRMING
    if (lobby.status !== 'OPEN' && lobby.status !== 'CONFIRMING') {
      return reply.status(400).send({ error: 'Can only kick players in OPEN or CONFIRMING state' });
    }

    const participant = lobby.participants.find((p) => p.userId === targetUserId);
    if (!participant) {
      return reply.status(404).send({ error: 'Target user is not a participant' });
    }

    await prisma.lobbyParticipant.delete({
      where: { id: participant.id },
    });

    const io = getIO();
    io.to(`lobby:${id}`).emit('lobby:participant-left', { lobbyId: id, userId: targetUserId });
    io.emit('lobby:participant-left', { lobbyId: id, userId: targetUserId }); // global para notificaciones

    const updatedLobby = await prisma.lobby.findUnique({
      where: { id },
      include: {
        host: {
          select: { id: true, username: true, platform: true, masteryRank: true, reputation: true },
        },
        participants: {
          include: {
            user: {
              select: { id: true, username: true, platform: true, masteryRank: true, reputation: true },
            },
          },
        },
      },
    });

    if (updatedLobby) {
      const formatted = formatLobby(updatedLobby);
      io.emit('lobby:updated', formatted);
    }

    return reply.send({ success: true, message: 'Player kicked' });
  });

  // POST /api/lobbies/:id/unready - Desmarcar listo
  app.post('/api/lobbies/:id/unready', async (request, reply) => {
    const { id } = request.params as { id: string };
    const { userId } = request.body as { userId: string };

    const lobby = await prisma.lobby.findUnique({
      where: { id },
      include: { participants: true },
    });

    if (!lobby) return reply.status(404).send({ error: 'Lobby not found' });
    if (lobby.status !== 'CONFIRMING') {
      return reply.status(400).send({ error: 'Lobby is not in confirming state' });
    }

    const participant = lobby.participants.find((p) => p.userId === userId);
    if (!participant) return reply.status(400).send({ error: 'Not a participant' });

    await prisma.lobbyParticipant.update({
      where: { id: participant.id },
      data: { ready: false },
    });

    const updatedLobby = await prisma.lobby.findUnique({
      where: { id },
      include: {
        host: { select: { id: true, username: true, platform: true, masteryRank: true, reputation: true } },
        participants: {
          include: {
            user: { select: { id: true, username: true, platform: true, masteryRank: true, reputation: true } },
          },
        },
      },
    });

    if (updatedLobby) {
      const io = getIO();
      io.to(`lobby:${id}`).emit('lobby:updated', formatLobby(updatedLobby));
      io.emit('lobby:updated', formatLobby(updatedLobby));
    }

    return reply.send({ success: true });
  });

  // ----------------------------------------------------------------
  // DELETE /api/lobbies/:id - El host borra su lobby (o admin cualquier lobby)
  // ----------------------------------------------------------------
  app.delete('/api/lobbies/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const { userId } = request.body as { userId: string };

    const lobby = await prisma.lobby.findUnique({
      where: { id },
      include: { participants: true },
    });

    if (!lobby) return reply.status(404).send({ error: 'Lobby not found' });

    // Verificar si el usuario es admin
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });

    const isAdmin = user?.role === 'ADMIN';
    const isHost = lobby.hostId === userId;

    if (!isHost && !isAdmin) {
      return reply.status(403).send({ error: 'Only the host or an admin can delete this lobby' });
    }

    // El host solo puede borrar en OPEN o CONFIRMING; admin puede siempre
    if (!isAdmin && lobby.status !== 'OPEN' && lobby.status !== 'CONFIRMING') {
      return reply.status(400).send({ error: 'Can only delete lobby in OPEN or CONFIRMING state' });
    }

    // Notificar a los participantes antes de borrar
    const io = getIO();
    io.to(`lobby:${id}`).emit('lobby:deleted', { lobbyId: id, deletedBy: isAdmin ? 'admin' : 'host' });
    io.emit('lobby:deleted', { lobbyId: id, deletedBy: isAdmin ? 'admin' : 'host' });

    // Borrar participantes primero (FK constraint)
    await prisma.lobbyParticipant.deleteMany({
      where: { lobbyId: id },
    });

    // Borrar el lobby
    await prisma.lobby.delete({
      where: { id },
    });

    return reply.send({ success: true, message: 'Lobby deleted' });
  });
}

// Helpers
export function formatLobby(lobby: any) {
  return {
    ...lobby,
    participantCount: lobby.participants?.length ?? 0,
  };
}
