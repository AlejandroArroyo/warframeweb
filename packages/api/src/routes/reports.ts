import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';

const createReportSchema = z.object({
  reportedUsername: z.string().min(1),
  reason: z.enum(['LEECHING', 'ABANDON', 'TOXICITY', 'SCAM', 'MULTI_ACCOUNT', 'OTHER']),
  description: z.string().max(500).optional(),
  lobbyId: z.string().optional(),
  runId: z.string().optional(),
});

export async function reportRoutes(app: FastifyInstance): Promise<void> {
  // ----------------------------------------------------------------
  // POST /api/reports - Crear un reporte contra un jugador
  // Requiere: token de autenticación (reporter)
  // ----------------------------------------------------------------
  app.post('/api/reports', async (request, reply) => {
    // Verificar auth
    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return reply.status(401).send({ error: 'Authentication required' });
    }

    let reporterId: string;
    try {
      const { verifyToken } = await import('../lib/jwt.js');
      const payload = verifyToken(authHeader.slice(7));
      reporterId = payload.userId;
    } catch {
      return reply.status(401).send({ error: 'Invalid or expired token' });
    }

    const parsed = createReportSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'Validation Error',
        message: parsed.error.errors.map((e) => e.message).join(', '),
      });
    }

    const data = parsed.data;

    // Buscar al reportado por username
    const reported = await prisma.user.findUnique({
      where: { username: data.reportedUsername },
    });

    if (!reported) {
      return reply.status(404).send({ error: 'Reported user not found' });
    }

    if (reported.id === reporterId) {
      return reply.status(400).send({ error: 'You cannot report yourself' });
    }

    // Verificar lobby si se proporciona
    if (data.lobbyId) {
      const lobby = await prisma.lobby.findUnique({ where: { id: data.lobbyId } });
      if (!lobby) {
        return reply.status(404).send({ error: 'Lobby not found' });
      }
    }

    // Verificar run si se proporciona
    if (data.runId) {
      const run = await prisma.run.findUnique({ where: { id: data.runId } });
      if (!run) {
        return reply.status(404).send({ error: 'Run not found' });
      }
    }

    const report = await prisma.report.create({
      data: {
        reason: data.reason as any,
        description: data.description ?? null,
        reporterId,
        reportedId: reported.id,
        lobbyId: data.lobbyId ?? null,
        runId: data.runId ?? null,
      },
      include: {
        reporter: { select: { id: true, username: true } },
        reportedUser: { select: { id: true, username: true } },
      },
    });

    return reply.status(201).send({
      id: report.id,
      reason: report.reason,
      description: report.description,
      status: report.status,
      createdAt: report.createdAt,
      reporter: report.reporter,
      reportedUser: report.reportedUser,
    });
  });

  // ----------------------------------------------------------------
  // GET /api/reports - Listar reportes (solo admin)
  // ----------------------------------------------------------------
  app.get('/api/reports', { preHandler: [app.requireAdmin] }, async (request, reply) => {
    const query = request.query as { status?: string; page?: string };
    const page = Math.max(1, parseInt(query.page || '1', 10));
    const take = 50;
    const skip = (page - 1) * take;

    const where: Record<string, unknown> = {};
    if (query.status && ['PENDING', 'DISMISSED', 'ACTION_TAKEN'].includes(query.status)) {
      where.status = query.status;
    }

    const reports = await prisma.report.findMany({
      where,
      include: {
        reporter: { select: { id: true, username: true, masteryRank: true } },
        reportedUser: { select: { id: true, username: true, masteryRank: true } },
        lobby: { select: { id: true, title: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return reply.send(reports.map((r) => ({
      id: r.id,
      reason: r.reason,
      description: r.description,
      status: r.status,
      createdAt: r.createdAt,
      reporter: r.reporter,
      reportedUser: r.reportedUser,
      lobby: r.lobby,
    })));
  });

  // ----------------------------------------------------------------
  // PATCH /api/reports/:id - Resolver un reporte (admin action)
  // ----------------------------------------------------------------
  app.patch('/api/reports/:id', { preHandler: [app.requireAdmin] }, async (request, reply) => {
    const adminId = request.user!.userId;

    const { id } = request.params as { id: string };
    const { status, banUserId, banReason, banDurationDays } = request.body as {
      status: 'DISMISSED' | 'ACTION_TAKEN';
      banUserId?: string;
      banReason?: string;
      banDurationDays?: number;
    };

    if (!status || !['DISMISSED', 'ACTION_TAKEN'].includes(status)) {
      return reply.status(400).send({ error: 'Valid status required: DISMISSED or ACTION_TAKEN' });
    }

    const report = await prisma.report.findUnique({ where: { id } });
    if (!report) {
      return reply.status(404).send({ error: 'Report not found' });
    }

    // Actualizar reporte
    const updated = await prisma.report.update({
      where: { id },
      data: {
        status: status as any,
        resolvedAt: new Date(),
      },
    });

    // Si se tomó acción y se solicita ban, crearlo
    if (status === 'ACTION_TAKEN' && banUserId) {
      const targetUser = await prisma.user.findUnique({ where: { id: banUserId } });
      if (!targetUser) {
        return reply.status(404).send({ error: 'Target user for ban not found' });
      }

      const expiresAt = banDurationDays
        ? new Date(Date.now() + banDurationDays * 86400000)
        : null;

      await prisma.ban.create({
        data: {
          userId: banUserId,
          bannedById: adminId,
          reason: banReason || 'Action taken on report',
          isPermanent: !banDurationDays,
          expiresAt,
          reportId: id,
        },
      });

      // Banear al usuario
      await prisma.user.update({
        where: { id: banUserId },
        data: {
          isBanned: true,
          banReason: banReason || 'Action taken on report',
          bannedUntil: expiresAt,
        },
      });

      // Restar reputación al baneado
      await prisma.user.update({
        where: { id: banUserId },
        data: { reputation: { decrement: 1 } },
      });
    }

    return reply.send(updated);
  });
}
