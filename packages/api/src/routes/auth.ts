import type { FastifyInstance } from 'fastify';
import { signToken } from '../lib/jwt.js';
import { prisma } from '../lib/prisma.js';
import { config } from '../config.js';

const DISCORD_API = 'https://discord.com/api/v10';

export async function authRoutes(app: FastifyInstance): Promise<void> {
  // ------------------------------------------------------------------
  // DEV MODE: Login sin Discord (solo en desarrollo)
  // POST /api/auth/dev-login { username }
  // Busca o crea el usuario y devuelve un JWT.
  // ------------------------------------------------------------------
  app.post('/api/auth/dev-login', async (request, reply) => {
    if (config.NODE_ENV === 'production') {
      return reply.status(404).send({ error: 'Not available in production' });
    }
    const { username } = request.body as { username?: string };

    if (!username || typeof username !== 'string' || username.trim().length === 0) {
      return reply.status(400).send({ error: 'Username is required' });
    }

    const trimmed = username.trim();

    // Buscar o crear usuario
    let user = await prisma.user.findUnique({ where: { username: trimmed } });
    if (!user) {
      // Crear usuario nuevo en dev mode
      user = await prisma.user.create({
        data: {
          username: trimmed,
          platform: 'PC' as any,
        },
      });
    }

    if (user.isBanned) {
      return reply.status(403).send({ error: 'User is banned' });
    }

    const token = signToken({
      userId: user.id,
      username: user.username,
      isAdmin: user.isAdmin,
    });

    return reply.send({
      token,
      user: {
        id: user.id,
        username: user.username,
        platform: user.platform,
        masteryRank: user.masteryRank,
        reputation: user.reputation,
        isAdmin: user.isAdmin,
      },
    });
  });

  // ------------------------------------------------------------------
  // DISCORD OAUTH: Iniciar login
  // GET /api/auth/discord
  // Redirige al usuario a Discord OAuth consent screen.
  // ------------------------------------------------------------------
  app.get('/api/auth/discord', async (_request, reply) => {
    if (!config.DISCORD_CLIENT_ID) {
      return reply.status(501).send({
        error: 'Discord OAuth not configured',
        message: 'Set DISCORD_CLIENT_ID and DISCORD_CLIENT_SECRET environment variables',
      });
    }

    const params = new URLSearchParams({
      client_id: config.DISCORD_CLIENT_ID,
      redirect_uri: config.DISCORD_REDIRECT_URI,
      response_type: 'code',
      scope: 'identify',
    });

    return reply.redirect(`${DISCORD_API}/oauth2/authorize?${params.toString()}`);
  });

  // ------------------------------------------------------------------
  // DISCORD OAUTH: Callback
  // GET /api/auth/discord/callback?code=...
  // Intercambia el code por un token de Discord, obtiene el user,
  // lo crea/actualiza en DB, y devuelve JWT vía redirect con token en URL.
  // ------------------------------------------------------------------
  app.get('/api/auth/discord/callback', async (request, reply) => {
    const { code, error: oauthError } = request.query as { code?: string; error?: string };

    if (oauthError) {
      return reply.status(400).send({ error: 'OAuth error', message: oauthError });
    }

    if (!code) {
      return reply.status(400).send({ error: 'Missing authorization code' });
    }

    if (!config.DISCORD_CLIENT_ID || !config.DISCORD_CLIENT_SECRET) {
      return reply.status(501).send({ error: 'Discord OAuth not configured' });
    }

    try {
      // 1. Exchange code for access token
      const tokenResponse = await fetch(`${DISCORD_API}/oauth2/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: config.DISCORD_CLIENT_ID,
          client_secret: config.DISCORD_CLIENT_SECRET,
          grant_type: 'authorization_code',
          code,
          redirect_uri: config.DISCORD_REDIRECT_URI,
        }),
      });

      if (!tokenResponse.ok) {
        const errBody = await tokenResponse.text();
        return reply.status(400).send({ error: 'Failed to exchange code', message: errBody });
      }

      const tokenData = await tokenResponse.json() as { access_token: string };

      // 2. Get Discord user info
      const userResponse = await fetch(`${DISCORD_API}/users/@me`, {
        headers: {
          Authorization: `Bearer ${tokenData.access_token}`,
        },
      });

      if (!userResponse.ok) {
        return reply.status(400).send({ error: 'Failed to fetch Discord user' });
      }

      const discordUser = await userResponse.json() as {
        id: string;
        username: string;
        discriminator?: string;
        global_name?: string;
      };

      // 3. Find or create user in our DB
      const displayName = discordUser.global_name || discordUser.username;

      let user = await prisma.user.findUnique({
        where: { discordId: discordUser.id },
      });

      if (user) {
        // Update username if changed
        if (user.username !== displayName) {
          user = await prisma.user.update({
            where: { id: user.id },
            data: { username: displayName },
          });
        }
      } else {
        // Check if username is taken
        const existingName = await prisma.user.findUnique({
          where: { username: displayName },
        });

        const finalUsername = existingName
          ? `${displayName}#${discordUser.discriminator || discordUser.id.slice(-4)}`
          : displayName;

        user = await prisma.user.create({
          data: {
            discordId: discordUser.id,
            username: finalUsername,
          },
        });
      }

      if (user.isBanned) {
        return reply.status(403).send({ error: 'User is banned' });
      }

      // 4. Sign JWT and redirect to frontend
      const token = signToken({
        userId: user.id,
        username: user.username,
        isAdmin: user.isAdmin,
        discordId: discordUser.id,
      });

      return reply.redirect(`${config.FRONTEND_URL}/auth/callback?token=${token}`);
    } catch (err) {
      return reply.status(500).send({
        error: 'Internal error during Discord authentication',
        message: (err as Error).message,
      });
    }
  });

  // ------------------------------------------------------------------
  // GET /api/auth/me - Obtener usuario actual desde el token
  // ------------------------------------------------------------------
  app.get('/api/auth/me', async (request, reply) => {
    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return reply.status(401).send({ error: 'Not authenticated' });
    }

    const token = authHeader.slice(7);
    let payload: { userId: string; username: string };
    try {
      const { verifyToken } = await import('../lib/jwt.js');
      payload = verifyToken(token);
    } catch {
      return reply.status(401).send({ error: 'Invalid or expired token' });
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: {
        id: true,
        username: true,
        platform: true,
        masteryRank: true,
        reputation: true,
        isAdmin: true,
        discordId: true,
        createdAt: true,
      },
    });

    if (!user) {
      return reply.status(404).send({ error: 'User not found' });
    }

    return reply.send(user);
  });
}
