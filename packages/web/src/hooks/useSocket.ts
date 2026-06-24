import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import type { WSEvent, LobbyDTO } from '@warframe/shared';

// Runtime detection: misma lógica que client.ts y AuthContext
function resolveWsUrl(): string {
  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    if (host === 'localhost' || host === '127.0.0.1') {
      return ''; // mismo origen → Vite proxy maneja WebSocket
    }
  }
  return 'https://warframeweb-production.up.railway.app';
}
const SOCKET_URL = resolveWsUrl();

export function useSocket() {
  const [connected, setConnected] = useState(false);
  const [lobbies, setLobbies] = useState<LobbyDTO[]>([]);
  const [socket, setSocket] = useState<Socket | null>(null);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    const s = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      autoConnect: true,
    });

    socketRef.current = s;
    setSocket(s);

    s.on('connect', () => {
      console.log('Socket connected:', s.id);
      setConnected(true);
    });

    s.on('disconnect', (reason) => {
      console.log('Socket disconnected:', reason);
      setConnected(false);
    });

    // Escuchar eventos de lobby
    s.on('lobby:created', (lobby: LobbyDTO) => {
      setLobbies((prev) => [lobby, ...prev]);
    });

    s.on('lobby:updated', (lobby: LobbyDTO) => {
      setLobbies((prev) => prev.map((l) => (l.id === lobby.id ? lobby : l)));
    });

    s.on('lobby:deleted', ({ lobbyId }: { lobbyId: string }) => {
      setLobbies((prev) => prev.filter((l) => l.id !== lobbyId));
    });

    s.on('lobby:participant-joined', ({ lobbyId, participant }: any) => {
      setLobbies((prev) =>
        prev.map((l) =>
          l.id === lobbyId
            ? { ...l, participants: [...l.participants, participant], participantCount: l.participantCount + 1 }
            : l
        )
      );
    });

    s.on('lobby:participant-left', ({ lobbyId, userId }: { lobbyId: string; userId: string }) => {
      setLobbies((prev) =>
        prev.map((l) =>
          l.id === lobbyId
            ? {
                ...l,
                participants: l.participants.filter((p) => p.user.id !== userId),
                participantCount: l.participantCount - 1,
              }
            : l
        )
      );
    });

    s.on('lobby:status-changed', ({ lobbyId, status }: { lobbyId: string; status: string }) => {
      setLobbies((prev) =>
        prev.map((l) =>
          l.id === lobbyId ? { ...l, status: status as any } : l
        )
      );
    });

    return () => {
      s.disconnect();
    };
  }, []);

  const joinLobbyRoom = useCallback((lobbyId: string) => {
    socketRef.current?.emit('join:lobby', lobbyId);
  }, []);

  const leaveLobbyRoom = useCallback((lobbyId: string) => {
    socketRef.current?.emit('leave:lobby', lobbyId);
  }, []);

  const joinEraRoom = useCallback((era: string) => {
    socketRef.current?.emit('join:era', era);
  }, []);

  const leaveEraRoom = useCallback((era: string) => {
    socketRef.current?.emit('leave:era', era);
  }, []);

  return {
    connected,
    lobbies,
    setLobbies,
    socket,
    joinLobbyRoom,
    leaveLobbyRoom,
    joinEraRoom,
    leaveEraRoom,
  };
}
