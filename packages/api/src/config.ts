import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url().optional(),
  PORT: z.coerce.number().default(3001),
  HOST: z.string().default('0.0.0.0'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  // Comma-separated. Soporta wildcard * para subdominios (ej: https://*.warframeweb.pages.dev)
  CORS_ORIGIN: z.string().default('http://localhost:5173,https://*.warframeweb.pages.dev'),

  // JWT
  JWT_SECRET: z.string().optional(),

  // Discord OAuth (opcional para dev)
  DISCORD_CLIENT_ID: z.string().optional(),
  DISCORD_CLIENT_SECRET: z.string().optional(),
  DISCORD_REDIRECT_URI: z.string().default('http://localhost:3001/api/auth/discord/callback'),

  // URL del frontend para redirects OAuth
  FRONTEND_URL: z.string().default('http://localhost:5173'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const config = parsed.data;
