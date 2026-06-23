import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';
import { verifyToken, type JWTPayload } from '../lib/jwt.js';

// Extendemos los tipos de Fastify
declare module 'fastify' {
  interface FastifyRequest {
    user?: JWTPayload;
  }
}

export interface AuthenticateOptions {
  /** Si es true, permite requests sin token (user quedará undefined) */
  optional?: boolean;
}

/**
 * Plugin de autenticación.
 * Agrega los decoradores `authenticate` y `requireAdmin`.
 * Parse el JWT del header Authorization y lo deja en `request.user`.
 */
export const authPlugin = fp(async function (app: FastifyInstance) {
  // Decorador: authenticate({ optional?: boolean })
  // Se usa como preHandler en rutas protegidas.
  app.decorate(
    'authenticate',
    function (options?: AuthenticateOptions) {
      return async (request: FastifyRequest, reply: FastifyReply) => {
        const authHeader = request.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
          if (options?.optional) return;
          return reply.status(401).send({ error: 'Missing or invalid authorization header' });
        }

        const token = authHeader.slice(7);
        try {
          const payload = verifyToken(token);
          request.user = payload;
        } catch {
          if (options?.optional) return;
          return reply.status(401).send({ error: 'Invalid or expired token' });
        }
      };
    }
  );

  // Decorador: requireAdmin
  // Verifica que el usuario autenticado tenga isAdmin: true
  app.decorate('requireAdmin', async (request: FastifyRequest, reply: FastifyReply) => {
    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return reply.status(401).send({ error: 'Authentication required' });
    }

    let payload: JWTPayload;
    try {
      payload = verifyToken(authHeader.slice(7));
    } catch {
      return reply.status(401).send({ error: 'Invalid or expired token' });
    }

    if (!payload.isAdmin) {
      return reply.status(403).send({ error: 'Admin access required' });
    }

    request.user = payload;
  });
});

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (options?: AuthenticateOptions) => (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    requireAdmin: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}
