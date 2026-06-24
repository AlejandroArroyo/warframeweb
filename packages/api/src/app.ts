import Fastify from 'fastify';
import cors from '@fastify/cors';
import { config } from './config.js';
import { lobbyRoutes } from './routes/lobbies.js';
import { userRoutes } from './routes/users.js';
import { relicRoutes } from './routes/relics.js';
import { runRoutes } from './routes/runs.js';
import { reportRoutes } from './routes/reports.js';
import { banRoutes } from './routes/bans.js';
import { rotationRoutes } from './routes/rotations.js';
import { adminRoutes } from './routes/admin.js';
import { authRoutes } from './routes/auth.js';
import { authPlugin } from './plugins/auth.js';
import { getRedis, closeRedis } from './lib/redis.js';
import { prisma } from './lib/prisma.js';
import { createIO } from './plugins/socket.js';

export async function buildApp() {
  const app = Fastify({
    logger: config.NODE_ENV !== 'test',
  });

  // CORS: permitir todos los orígenes temporalmente (debug)
  await app.register(cors, {
    origin: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE'],
    credentials: true,
  });

  // Health check
  app.get('/api/health', async () => {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };
  });

  // Redis health check
  app.get('/api/health/redis', async () => {
    try {
      const redis = getRedis();
      const pong = await redis.ping();
      return { status: 'ok', redis: pong === 'PONG' };
    } catch (err) {
      return { status: 'error', message: (err as Error).message };
    }
  });

  // Auth plugin (decorador authenticate)
  await app.register(authPlugin);

  // Routes
  await app.register(authRoutes);
  await app.register(lobbyRoutes);
  await app.register(userRoutes);
  await app.register(relicRoutes);
  await app.register(runRoutes);
  await app.register(reportRoutes);
  await app.register(banRoutes);
  await app.register(rotationRoutes);
  await app.register(adminRoutes);

  // Graceful shutdown
  const shutdown = async () => {
    app.log.info('Shutting down gracefully...');
    await closeRedis();
    await prisma.$disconnect();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  return app;
}
