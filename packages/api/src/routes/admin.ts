import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../lib/prisma.js';
import { canModerate, canManageUsers, canChangeRole, getReputationTier } from '@warframe/shared';
import { getIO } from '../plugins/socket.js';

// ------------------------------------------------------------------
// Middleware helpers
// ------------------------------------------------------------------

/** Requiere rol ADMIN para acceder */
async function requireAdmin(request: FastifyRequest, reply: FastifyReply) {
  const user = request.user;
  if (!user) return reply.status(401).send({ error: 'Not authenticated' });
  if (user.role !== 'ADMIN') {
    return reply.status(403).send({ error: 'Admin access required' });
  }
}

/** Requiere ADMIN, MODERATOR o Leyenda+ (rango de honor nivel 4) */
async function requireUserManagement(request: FastifyRequest, reply: FastifyReply) {
  const user = request.user;
  if (!user) return reply.status(401).send({ error: 'Not authenticated' });

  if (user.role === 'ADMIN' || user.role === 'MODERATOR') return;

  // Obtener reputación del usuario desde DB para calcular rango
  const dbUser = await prisma.user.findUnique({
    where: { id: user.userId },
    select: { reputation: true },
  });

  if (!dbUser) return reply.status(404).send({ error: 'User not found' });

  const tier = getReputationTier(dbUser.reputation);
  if (tier.level < 4) {
    return reply.status(403).send({ error: `Se requiere rango Leyenda (100+ reputación). Tu rango: ${tier.nameEs} (${dbUser.reputation} rep)` });
  }
}

// ------------------------------------------------------------------
// Routes
// ------------------------------------------------------------------

export async function adminRoutes(app: FastifyInstance): Promise<void> {
  // Autenticación requerida para todas las rutas de este archivo
  app.addHook('preHandler', app.authenticate());

  // ----------------------------------------------------------------
  // GET /api/admin/check - Verificar si el usuario es admin
  // ----------------------------------------------------------------
  app.get('/api/admin/check', async (request, reply) => {
    return reply.send({ isAdmin: request.user?.role === 'ADMIN', role: request.user?.role });
  });

  // ===================================================================
  // GESTIÓN DE USUARIOS (ADMIN, MODERATOR o Leyenda+)
  // ===================================================================

  // ----------------------------------------------------------------
  // GET /api/admin/users - Listar usuarios con búsqueda
  // Query: ?search=, ?role=, ?page=, ?limit=
  // ----------------------------------------------------------------
  app.get('/api/admin/users', { preHandler: requireUserManagement }, async (request, reply) => {
    const query = request.query as { search?: string; role?: string; page?: string; limit?: string };
    const page = Math.max(1, parseInt(query.page || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(query.limit || '20', 10)));
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};

    if (query.search) {
      where.OR = [
        { username: { contains: query.search, mode: 'insensitive' } },
        { discordId: query.search },
      ];
    }

    if (query.role && ['USER', 'MODERATOR', 'ADMIN'].includes(query.role)) {
      where.role = query.role;
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          username: true,
          platform: true,
          masteryRank: true,
          reputation: true,
          role: true,
          warns: true,
          isAdmin: true,
          isBanned: true,
          discordId: true,
          createdAt: true,
          _count: {
            select: {
              runsCompleted: true,
              reportsReceived: true,
            },
          },
        },
      }),
      prisma.user.count({ where }),
    ]);

    return reply.send({
      users: users.map((u) => ({
        id: u.id,
        username: u.username,
        platform: u.platform,
        masteryRank: u.masteryRank,
        reputation: u.reputation,
        role: u.role,
        warns: u.warns,
        isAdmin: u.isAdmin,
        isBanned: u.isBanned,
        discordId: u.discordId,
        createdAt: u.createdAt,
        tier: getReputationTier(u.reputation),
        totalRuns: u._count.runsCompleted,
        totalReports: u._count.reportsReceived,
      })),
      total,
      page,
      limit,
      hasMore: skip + users.length < total,
    });
  });

  // ----------------------------------------------------------------
  // GET /api/admin/users/:id - Detalle de un usuario
  // ----------------------------------------------------------------
  app.get('/api/admin/users/:id', { preHandler: requireUserManagement }, async (request, reply) => {
    const { id } = request.params as { id: string };

    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        username: true,
        platform: true,
        masteryRank: true,
        reputation: true,
        role: true,
        warns: true,
        isAdmin: true,
        isBanned: true,
        banReason: true,
        bannedUntil: true,
        discordId: true,
        createdAt: true,
        _count: {
          select: {
            runsCompleted: true,
            reportsMade: true,
            reportsReceived: true,
            bansGiven: true,
          },
        },
      },
    });

    if (!user) {
      return reply.status(404).send({ error: 'User not found' });
    }

    return reply.send({
      ...user,
      tier: getReputationTier(user.reputation),
      totalRuns: user._count.runsCompleted,
      totalReportsMade: user._count.reportsMade,
      totalReportsReceived: user._count.reportsReceived,
      totalBansGiven: user._count.bansGiven,
    });
  });

  // ----------------------------------------------------------------
  // PATCH /api/admin/users/:id/role - Cambiar rol (solo ADMIN)
  // Body: { role: "MODERATOR" | "USER" }
  // ----------------------------------------------------------------
  app.patch('/api/admin/users/:id/role', { preHandler: requireAdmin }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { role } = request.body as { role?: string };

    if (!role || !['USER', 'MODERATOR', 'ADMIN'].includes(role)) {
      return reply.status(400).send({ error: 'Invalid role. Must be USER, MODERATOR, or ADMIN' });
    }

    // No permitir cambiarse el rol a uno mismo
    if (id === request.user!.userId) {
      return reply.status(400).send({ error: 'Cannot change your own role' });
    }

    const user = await prisma.user.update({
      where: { id },
      data: {
        role: role as 'USER' | 'MODERATOR' | 'ADMIN',
        isAdmin: role === 'ADMIN',
      },
      select: {
        id: true,
        username: true,
        role: true,
        isAdmin: true,
      },
    });

    return reply.send(user);
  });

  // ----------------------------------------------------------------
  // POST /api/admin/users/:id/warn - Advertir a un usuario
  // Body: { reason: string }
  // Requiere: ADMIN, MODERATOR o Leyenda+
  // ----------------------------------------------------------------
  app.post('/api/admin/users/:id/warn', { preHandler: requireUserManagement }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { reason } = request.body as { reason?: string };

    if (!reason || typeof reason !== 'string' || reason.trim().length === 0) {
      return reply.status(400).send({ error: 'Reason is required' });
    }

    // No permitir warnearse a uno mismo
    if (id === request.user!.userId) {
      return reply.status(400).send({ error: 'Cannot warn yourself' });
    }

    const user = await prisma.user.update({
      where: { id },
      data: {
        warns: { increment: 1 },
      },
      select: {
        id: true,
        username: true,
        warns: true,
      },
    });

    // TODO: registrar el warn en una tabla de warns
    // Por ahora solo incrementamos el contador

    return reply.send({ message: `Warning issued to ${user.username}`, user });
  });

  // ===================================================================
  // REPORTES (ADMIN, MODERATOR o Maestro+)
  // ===================================================================

  // ----------------------------------------------------------------
  // GET /api/admin/reports - Lista completa de reportes
  // ----------------------------------------------------------------
  app.get('/api/admin/reports', async (request, reply) => {
    const query = request.query as { status?: string; page?: string };
    const page = Math.max(1, parseInt(query.page || '1', 10));
    const take = 50;
    const skip = (page - 1) * take;

    const where: Record<string, unknown> = {};
    if (query.status && ['PENDING', 'DISMISSED', 'ACTION_TAKEN'].includes(query.status)) {
      where.status = query.status;
    }

    const [reports, total] = await Promise.all([
      prisma.report.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          reporter: { select: { id: true, username: true } },
          reportedUser: { select: { id: true, username: true } },
          lobby: { select: { id: true, title: true } },
          run: { select: { id: true } },
        },
      }),
      prisma.report.count({ where }),
    ]);

    return reply.send({ reports, total, page, hasMore: skip + reports.length < total });
  });

  // ----------------------------------------------------------------
  // POST /api/admin/reports/:id/resolve - Resolver un reporte
  // Body: { action: "DISMISSED" | "ACTION_TAKEN" }
  // ----------------------------------------------------------------
  app.post('/api/admin/reports/:id/resolve', async (request, reply) => {
    const { id } = request.params as { id: string };
    const { action } = request.body as { action?: string };

    if (!action || !['DISMISSED', 'ACTION_TAKEN'].includes(action)) {
      return reply.status(400).send({ error: 'Invalid action. Must be DISMISSED or ACTION_TAKEN' });
    }

    const report = await prisma.report.update({
      where: { id },
      data: {
        status: action as 'DISMISSED' | 'ACTION_TAKEN',
        resolvedAt: new Date(),
      },
    });

    return reply.send(report);
  });

  // ----------------------------------------------------------------
  // POST /api/admin/reports/:id/ban - Banear al reportado
  // Body: { reason: string, durationDays?: number }
  // ----------------------------------------------------------------
  app.post('/api/admin/reports/:id/ban', async (request, reply) => {
    const { id } = request.params as { id: string };
    const { reason, durationDays } = request.body as { reason?: string; durationDays?: number };

    if (!reason || typeof reason !== 'string') {
      return reply.status(400).send({ error: 'Reason is required' });
    }

    const report = await prisma.report.findUnique({
      where: { id },
      select: { reportedId: true, status: true },
    });

    if (!report) return reply.status(404).send({ error: 'Report not found' });
    if (report.status !== 'PENDING') return reply.status(400).send({ error: 'Report already resolved' });

    const expiresAt = durationDays ? new Date(Date.now() + durationDays * 86400000) : null;

    await Promise.all([
      prisma.report.update({
        where: { id },
        data: { status: 'ACTION_TAKEN', resolvedAt: new Date() },
      }),
      prisma.user.update({
        where: { id: report.reportedId },
        data: {
          isBanned: true,
          banReason: reason,
          bannedUntil: expiresAt,
        },
      }),
      prisma.ban.create({
        data: {
          userId: report.reportedId,
          bannedById: request.user!.userId,
          reason,
          isPermanent: !expiresAt,
          expiresAt,
          reportId: id,
        },
      }),
    ]);

    return reply.send({ message: 'User banned successfully' });
  });

  // ===================================================================
  // BANS
  // ===================================================================

  // ----------------------------------------------------------------
  // GET /api/admin/bans - Lista de baneos
  // ----------------------------------------------------------------
  app.get('/api/admin/bans', async (request, reply) => {
    const query = request.query as { page?: string };
    const page = Math.max(1, parseInt(query.page || '1', 10));
    const take = 50;
    const skip = (page - 1) * take;

    const [bans, total] = await Promise.all([
      prisma.ban.findMany({
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { id: true, username: true } },
          bannedBy: { select: { id: true, username: true } },
        },
      }),
      prisma.ban.count(),
    ]);

    return reply.send({ bans, total, page, hasMore: skip + bans.length < total });
  });

  // ----------------------------------------------------------------
  // POST /api/admin/bans - Banear directamente (sin reporte)
  // Body: { userId: string, reason: string, durationDays?: number }
  // ----------------------------------------------------------------
  app.post('/api/admin/bans', async (request, reply) => {
    const { userId, reason, durationDays } = request.body as { userId?: string; reason?: string; durationDays?: number };

    if (!userId || !reason) {
      return reply.status(400).send({ error: 'userId and reason are required' });
    }

    const expiresAt = durationDays ? new Date(Date.now() + durationDays * 86400000) : null;

    await Promise.all([
      prisma.user.update({
        where: { id: userId },
        data: {
          isBanned: true,
          banReason: reason,
          bannedUntil: expiresAt,
        },
      }),
      prisma.ban.create({
        data: {
          userId,
          bannedById: request.user!.userId,
          reason,
          isPermanent: !expiresAt,
          expiresAt,
        },
      }),
    ]);

    return reply.send({ message: 'User banned successfully' });
  });

  // ----------------------------------------------------------------
  // POST /api/admin/bans/:id/unban - Desbanear
  // ----------------------------------------------------------------
  app.post('/api/admin/bans/:id/unban', async (request, reply) => {
    const { id } = request.params as { id: string };

    const ban = await prisma.ban.findUnique({ where: { id } });
    if (!ban) return reply.status(404).send({ error: 'Ban not found' });

    await Promise.all([
      prisma.user.update({
        where: { id: ban.userId },
        data: { isBanned: false, banReason: null, bannedUntil: null },
      }),
      prisma.ban.update({
        where: { id },
        data: { expiresAt: new Date() }, // Marcar como expirado
      }),
    ]);

    return reply.send({ message: 'User unbanned successfully' });
  });

  // ===================================================================
  // BAN APPEALS
  // ===================================================================

  // ----------------------------------------------------------------
  // GET /api/admin/appeals - Lista de apelaciones
  // ----------------------------------------------------------------
  app.get('/api/admin/appeals', async (request, reply) => {
    const query = request.query as { status?: string; page?: string };
    const page = Math.max(1, parseInt(query.page || '1', 10));
    const take = 50;
    const skip = (page - 1) * take;

    const where: Record<string, unknown> = {};
    if (query.status) where.status = query.status;

    const [appeals, total] = await Promise.all([
      prisma.banAppeal.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { id: true, username: true } },
          ban: { select: { id: true, reason: true } },
        },
      }),
      prisma.banAppeal.count({ where }),
    ]);

    return reply.send({ appeals, total, page, hasMore: skip + appeals.length < total });
  });

  // ----------------------------------------------------------------
  // POST /api/admin/appeals/:id/approve - Aprobar apelación (desbanea)
  // ----------------------------------------------------------------
  app.post('/api/admin/appeals/:id/approve', async (request, reply) => {
    const { id } = request.params as { id: string };

    const appeal = await prisma.banAppeal.findUnique({
      where: { id },
      include: { ban: true },
    });

    if (!appeal) return reply.status(404).send({ error: 'Appeal not found' });
    if (appeal.status !== 'PENDING') return reply.status(400).send({ error: 'Appeal already resolved' });

    await Promise.all([
      prisma.banAppeal.update({
        where: { id },
        data: { status: 'APPROVED', resolvedAt: new Date() },
      }),
      prisma.user.update({
        where: { id: appeal.userId },
        data: { isBanned: false, banReason: null, bannedUntil: null },
      }),
    ]);

    return reply.send({ message: 'Appeal approved, user unbanned' });
  });

  // ----------------------------------------------------------------
  // POST /api/admin/appeals/:id/deny - Denegar apelación
  // ----------------------------------------------------------------
  app.post('/api/admin/appeals/:id/deny', async (request, reply) => {
    const { id } = request.params as { id: string };

    const appeal = await prisma.banAppeal.findUnique({ where: { id } });
    if (!appeal) return reply.status(404).send({ error: 'Appeal not found' });
    if (appeal.status !== 'PENDING') return reply.status(400).send({ error: 'Appeal already resolved' });

    await prisma.banAppeal.update({
      where: { id },
      data: { status: 'DENIED', resolvedAt: new Date() },
    });

    return reply.send({ message: 'Appeal denied' });
  });

  // ----------------------------------------------------------------
  // POST /api/admin/clear-lobbies - Admin borra TODOS los lobbies
  // ----------------------------------------------------------------
  app.post('/api/admin/clear-lobbies', { preHandler: [requireAdmin] }, async (request, reply) => {
    const io = getIO();

    // Obtener todos los lobby IDs para notificar
    const lobbyIds = await prisma.lobby.findMany({ select: { id: true } });
    const ids = lobbyIds.map((l) => l.id);

    // Notificar a todos los clientes
    for (const lobbyId of ids) {
      io.to(`lobby:${lobbyId}`).emit('lobby:deleted', { lobbyId });
    }
    io.emit('lobby:deleted', { lobbyIds: ids, clearedBy: 'admin' });

    // Borrar participantes primero (FK constraint)
    const { count: deletedParticipants } = await prisma.lobbyParticipant.deleteMany();
    // Borrar runs asociados
    const { count: deletedRuns } = await prisma.run.deleteMany({
      where: { lobbyId: { not: null } },
    });
    // Borrar lobbies
    const { count: deletedLobbies } = await prisma.lobby.deleteMany();

    return reply.send({
      success: true,
      message: `Cleared ${deletedLobbies} lobbies, ${deletedParticipants} participants, ${deletedRuns} runs`,
      deletedLobbies,
      deletedParticipants,
      deletedRuns,
    });
  });
}
