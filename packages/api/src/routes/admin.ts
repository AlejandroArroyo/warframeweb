import type { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma.js';

export async function adminRoutes(app: FastifyInstance): Promise<void> {
  // Todas las rutas admin requieren autenticación + isAdmin
  app.addHook('preHandler', app.requireAdmin);

  // ----------------------------------------------------------------
  // GET /api/admin/check - Verificar si el usuario es admin
  // ----------------------------------------------------------------
  app.get('/api/admin/check', async (request, reply) => {
    return reply.send({ isAdmin: request.user?.isAdmin ?? false });
  });

  // ----------------------------------------------------------------
  // GET /api/admin/reports - Lista completa de reportes
  // Soporta filtro por status: ?status=PENDING
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
        include: {
          reporter: { select: { id: true, username: true, masteryRank: true } },
          reportedUser: { select: { id: true, username: true, masteryRank: true } },
          lobby: { select: { id: true, title: true } },
          run: { select: { id: true, completed: true } },
          bans: { select: { id: true, reason: true, createdAt: true } },
        },
        orderBy: { createdAt: 'desc' },
        take,
        skip,
      }),
      prisma.report.count({ where }),
    ]);

    return reply.send({
      reports: reports.map((r) => ({
        id: r.id,
        reason: r.reason,
        description: r.description,
        status: r.status,
        createdAt: r.createdAt,
        resolvedAt: r.resolvedAt,
        reporter: r.reporter,
        reportedUser: r.reportedUser,
        lobby: r.lobby,
        run: r.run,
        bans: r.bans,
      })),
      total,
      page,
      hasMore: skip + take < total,
    });
  });

  // ----------------------------------------------------------------
  // GET /api/admin/bans - Lista completa de baneos
  // ----------------------------------------------------------------
  app.get('/api/admin/bans', async (request, reply) => {
    const query = request.query as { page?: string };
    const page = Math.max(1, parseInt(query.page || '1', 10));
    const take = 50;
    const skip = (page - 1) * take;

    const [bans, total] = await Promise.all([
      prisma.ban.findMany({
        include: {
          user: { select: { id: true, username: true, platform: true, masteryRank: true } },
          bannedBy: { select: { id: true, username: true } },
          report: { select: { id: true, reason: true } },
          appeals: { select: { id: true, status: true } },
        },
        orderBy: { createdAt: 'desc' },
        take,
        skip,
      }),
      prisma.ban.count(),
    ]);

    return reply.send({
      bans,
      total,
      page,
      hasMore: skip + take < total,
    });
  });

  // ----------------------------------------------------------------
  // POST /api/admin/bans - Crear ban directo
  // Ya existe en bans.ts, pero lo exponemos también acá con paginación
  // ----------------------------------------------------------------
  app.post('/api/admin/bans', async (request, reply) => {
    const { username, reason, durationDays } = request.body as {
      username: string;
      reason: string;
      durationDays?: number;
    };

    if (!username || !reason) {
      return reply.status(400).send({ error: 'username and reason are required' });
    }

    const target = await prisma.user.findUnique({ where: { username } });
    if (!target) {
      return reply.status(404).send({ error: 'User not found' });
    }

    const expiresAt = durationDays
      ? new Date(Date.now() + durationDays * 86400000)
      : null;

    const ban = await prisma.ban.create({
      data: {
        userId: target.id,
        bannedById: request.user!.userId,
        reason,
        isPermanent: !durationDays,
        expiresAt,
      },
      include: {
        user: { select: { id: true, username: true } },
        bannedBy: { select: { id: true, username: true } },
      },
    });

    await prisma.user.update({
      where: { id: target.id },
      data: {
        isBanned: true,
        banReason: reason,
        bannedUntil: expiresAt,
      },
    });

    return reply.status(201).send(ban);
  });

  // ----------------------------------------------------------------
  // PATCH /api/admin/bans/:id/unban - Desbanear usuario
  // ----------------------------------------------------------------
  app.patch('/api/admin/bans/:id/unban', async (request, reply) => {
    const { id } = request.params as { id: string };

    const ban = await prisma.ban.findUnique({ where: { id } });
    if (!ban) {
      return reply.status(404).send({ error: 'Ban not found' });
    }

    await prisma.user.update({
      where: { id: ban.userId },
      data: {
        isBanned: false,
        banReason: null,
        bannedUntil: null,
      },
    });

    return reply.send({ success: true, unbannedUserId: ban.userId });
  });

  // ----------------------------------------------------------------
  // GET /api/admin/ban-appeals - Listar todas las apelaciones
  // ----------------------------------------------------------------
  app.get('/api/admin/ban-appeals', async (request, reply) => {
    const query = request.query as { status?: string; page?: string };
    const page = Math.max(1, parseInt(query.page || '1', 10));
    const take = 50;
    const skip = (page - 1) * take;

    const where: Record<string, unknown> = {};
    if (query.status && ['PENDING', 'APPROVED', 'DENIED'].includes(query.status)) {
      where.status = query.status;
    }

    const [appeals, total] = await Promise.all([
      prisma.banAppeal.findMany({
        where,
        include: {
          user: { select: { id: true, username: true, platform: true, masteryRank: true } },
          ban: {
            select: {
              id: true,
              reason: true,
              isPermanent: true,
              expiresAt: true,
              createdAt: true,
              bannedBy: { select: { username: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take,
        skip,
      }),
      prisma.banAppeal.count({ where }),
    ]);

    return reply.send({
      appeals,
      total,
      page,
      hasMore: skip + take < total,
    });
  });

  // ----------------------------------------------------------------
  // PATCH /api/admin/ban-appeals/:id - Resolver apelación
  // ----------------------------------------------------------------
  app.patch('/api/admin/ban-appeals/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const { status } = request.body as { status: 'APPROVED' | 'DENIED' };

    if (!status || !['APPROVED', 'DENIED'].includes(status)) {
      return reply.status(400).send({ error: 'Valid status required: APPROVED or DENIED' });
    }

    const appeal = await prisma.banAppeal.findUnique({
      where: { id },
      include: { ban: true },
    });

    if (!appeal) {
      return reply.status(404).send({ error: 'Appeal not found' });
    }

    const updated = await prisma.banAppeal.update({
      where: { id },
      data: {
        status,
        resolvedAt: new Date(),
      },
    });

    // Si se aprueba, desbanear al usuario
    if (status === 'APPROVED') {
      await prisma.user.update({
        where: { id: appeal.userId },
        data: {
          isBanned: false,
          banReason: null,
          bannedUntil: null,
        },
      });
    }

    return reply.send(updated);
  });
}
