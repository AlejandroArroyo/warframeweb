import { Server as SocketIOServer } from 'socket.io';
import type { FastifyInstance } from 'fastify';
import { config } from '../config.js';

let io: SocketIOServer | null = null;

/**
 * Get the Socket.io server instance.
 * Throws if not initialized yet.
 */
export function getIO(): SocketIOServer {
  if (!io) {
    throw new Error('Socket.io not initialized. Call createIO() first.');
  }
  return io;
}

/**
 * Create and attach Socket.io to the Fastify HTTP server.
 * Must be called AFTER app.listen().
 */
export function createIO(fastify: FastifyInstance): SocketIOServer {
  if (io) return io;

  io = new SocketIOServer(fastify.server, {
    cors: {
      origin: config.CORS_ORIGIN.split(',').map((o) => o.trim()),
      methods: ['GET', 'POST'],
    },
    pingInterval: 25000,
    pingTimeout: 20000,
    transports: ['websocket', 'polling'],
  });

  io.on('connection', (socket) => {
    console.log(`🔌 Client connected: ${socket.id}`);

    // Unirse a un room específico de lobby
    socket.on('join:lobby', (lobbyId: string) => {
      socket.join(`lobby:${lobbyId}`);
    });

    // Salir de un room de lobby
    socket.on('leave:lobby', (lobbyId: string) => {
      socket.leave(`lobby:${lobbyId}`);
    });

    // Unirse a un room por era (para filtros)
    socket.on('join:era', (era: string) => {
      socket.join(`era:${era}`);
    });

    socket.on('leave:era', (era: string) => {
      socket.leave(`era:${era}`);
    });

    socket.on('disconnect', (reason) => {
      console.log(`🔌 Client disconnected: ${socket.id} (${reason})`);
    });
  });

  console.log('✅ Socket.io initialized');
  return io;
}
