import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';

const createBanAppealSchema = z.object({
  message: z.string().min(10).max(1000),
});

export async function banRoutes(app: FastifyInstance): Promise<void> {
  // ----------------------------------------------------------------
  // GET /api/bans - Listar baneos (admin)
  // ----------------------------------------------------------------
  app.get('/api/bans', { preHandler: [app.requireAdmin] }, async (request, reply) => {
    const bans = await prisma.ban.findMany({
      include: {
        user: { select: { id: true, username: true } },
        bannedBy: { select: { id: true, username: true } },
        report: { select: { id: true, reason: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return reply.send(bans);
  });

  // ----------------------------------------------------------------
  // POST /api/bans - Crear ban directo (admin)
  // ----------------------------------------------------------------
  app.post('/api/bans', { preHandler: [app.requireAdmin] }, async (request, reply) => {
    const adminId = request.user!.userId;

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
        bannedById: adminId,
        reason,
        isPermanent: !durationDays,
        expiresAt,
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
  // GET /api/bans/:userId - Ver bans de un usuario
  // ----------------------------------------------------------------
  app.get('/api/bans/:userId', async (request, reply) => {
    const { userId } = request.params as { userId: string };

    const bans = await prisma.ban.findMany({
      where: { userId },
      include: {
        bannedBy: { select: { id: true, username: true } },
        report: { select: { id: true, reason: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return reply.send(bans);
  });

  // ----------------------------------------------------------------
  // POST /api/ban-appeals - Apelar un ban
  // ----------------------------------------------------------------
  app.post('/api/ban-appeals', async (request, reply) => {
    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return reply.status(401).send({ error: 'Authentication required' });
    }

    let userId: string;
    try {
      const { verifyToken } = await import('../lib/jwt.js');
      const payload = verifyToken(authHeader.slice(7));
      userId = payload.userId;
    } catch {
      return reply.status(401).send({ error: 'Invalid or expired token' });
    }

    const parsed = createBanAppealSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'Validation Error',
        message: parsed.error.errors.map((e) => e.message).join(', '),
      });
    }

    const { message } = parsed.data;

    // Buscar el ban activo del usuario
    const activeBan = await prisma.ban.findFirst({
      where: { userId, isPermanent: true },
      orderBy: { createdAt: 'desc' },
    });

    if (!activeBan) {
      // También buscar bans temporales activos
      const tempBan = await prisma.ban.findFirst({
        where: {
          userId,
          expiresAt: { gt: new Date() },
        },
        orderBy: { createdAt: 'desc' },
      });

      if (!tempBan) {
        return reply.status(400).send({ error: 'No active ban found for this user' });
      }

      // Ya existe apelación para este ban?
      const existing = await prisma.banAppeal.findUnique({
        where: { userId_banId: { userId, banId: tempBan.id } },
      });
      if (existing) {
        return reply.status(400).send({ error: 'You already have an appeal for this ban' });
      }

      const appeal = await prisma.banAppeal.create({
        data: {
          userId,
          banId: tempBan.id,
          message,
        },
      });

      return reply.status(201).send(appeal);
    }

    // Ya existe apelación?
    const existing = await prisma.banAppeal.findUnique({
      where: { userId_banId: { userId, banId: activeBan.id } },
    });
    if (existing) {
      return reply.status(400).send({ error: 'You already have an appeal for this ban' });
    }

    const appeal = await prisma.banAppeal.create({
      data: {
        userId,
        banId: activeBan.id,
        message,
      },
    });

    return reply.status(201).send(appeal);
  });

  // ----------------------------------------------------------------
  // PATCH /api/ban-appeals/:id - Resolver apelación (admin)
  // ----------------------------------------------------------------
  app.patch('/api/ban-appeals/:id', { preHandler: [app.requireAdmin] }, async (request, reply) => {
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
