import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';
import { buildApp } from './app.js';
import { createIO } from './plugins/socket.js';
import { getRedis } from './lib/redis.js';
import { config } from './config.js';
import { seedRelicsIfEmpty, refreshRelicsFromAPI } from './seed-relics.js';

// Ruta absoluta al schema, resuelta desde la ubicación de este archivo compilado.
// Así funciona sin importar el working directory (Render corre desde packages/api/).
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SCHEMA_PATH = path.resolve(__dirname, '../prisma/schema.prisma');

async function main() {
  // Log config on startup (sin secretos)
  console.log('🔧 Config:', {
    NODE_ENV: config.NODE_ENV,
    PORT: config.PORT,
    FRONTEND_URL: config.FRONTEND_URL,
    CORS_ORIGIN: config.CORS_ORIGIN,
    DISCORD_CLIENT_ID: config.DISCORD_CLIENT_ID ? '✅ set' : '❌ not set',
    DISCORD_CLIENT_SECRET: config.DISCORD_CLIENT_SECRET ? '✅ set' : '❌ not set',
    DISCORD_REDIRECT_URI: config.DISCORD_REDIRECT_URI,
    DATABASE_URL: config.DATABASE_URL ? '✅ set' : '❌ not set',
  });

  // Run database migrations in production
  if (config.NODE_ENV === 'production') {
    try {
      console.log('📦 Running database migrations...');
      execSync(`npx prisma migrate deploy --schema="${SCHEMA_PATH}"`, {
        stdio: 'inherit',
        cwd: process.cwd(),
      });
      console.log('✅ Migrations applied successfully');
    } catch (err) {
      console.error('❌ Migration failed:', err);
      process.exit(1);
    }
  }

  // Seed relics if table is empty (idempotent)
  try {
    await seedRelicsIfEmpty();
  } catch (err) {
    console.error('⚠️  Relic seed failed (non-fatal):', (err as Error).message);
  }

  // Refresh missing relics from API (agrega las que faltan)
  try {
    const result = await refreshRelicsFromAPI();
    if (result.added > 0) {
      console.log(`🔄 Added ${result.added} missing relics (total: ${result.total})`);
    }
  } catch (err) {
    console.error('⚠️  Relic refresh failed (non-fatal):', (err as Error).message);
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
