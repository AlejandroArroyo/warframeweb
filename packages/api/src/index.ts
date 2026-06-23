import { execSync } from 'child_process';
import { buildApp } from './app.js';
import { createIO } from './plugins/socket.js';
import { getRedis } from './lib/redis.js';
import { config } from './config.js';

async function main() {
  // Run database migrations in production
  if (config.NODE_ENV === 'production') {
    try {
      console.log('📦 Running database migrations...');
      execSync('npx prisma migrate deploy --schema=packages/api/prisma/schema.prisma', {
        stdio: 'inherit',
        cwd: process.cwd(),
      });
      console.log('✅ Migrations applied successfully');
    } catch (err) {
      console.error('❌ Migration failed:', err);
      process.exit(1);
    }
  }

  const app = await buildApp();

  // Start listening
  const address = await app.listen({
    port: config.PORT,
    host: config.HOST,
  });

  console.log(`🚀 API server listening at ${address}`);

  // Attach Socket.io to the Fastify HTTP server
  createIO(app);

  // Verify Redis connection
  try {
    const redis = getRedis();
    await redis.ping();
    console.log('✅ Redis connection verified');
  } catch (err) {
    console.warn('⚠️  Redis not available, running without cache:', (err as Error).message);
  }
}

main().catch((err) => {
  console.error('❌ Failed to start server:', err);
  process.exit(1);
});
