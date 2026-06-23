import { createContext, useContext, useState, useCallback, useEffect, useRef, useMemo, type ReactNode } from 'react';
import type { Socket } from 'socket.io-client';
import type { LobbyDTO, UserDTO } from '@warframe/shared';

export interface AppNotification {
  id: string;
  type: 'join' | 'leave' | 'confirm' | 'ready' | 'status' | 'rotation' | 'info';
  message: string;
  lobbyId?: string;
  relatedUsername?: string;
  timestamp: Date;
  read: boolean;
}

interface NotificationContextValue {
  notifications: AppNotification[];
  unreadCount: number;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  clearAll: () => void;
  removeNotification: (id: string) => void;
}

const NotificationContext = createContext<NotificationContextValue | null>(null);

let notifIdCounter = 0;

interface Props {
  children: ReactNode;
  socket: Socket | null;
  currentUser: UserDTO | null;
  lobbies: LobbyDTO[];
  onToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

export function NotificationProvider({ children, socket, currentUser, lobbies, onToast }: Props) {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const notifiedRef = useRef<Set<string>>(new Set());

  const addNotification = useCallback((notif: Omit<AppNotification, 'id' | 'timestamp' | 'read'>) => {
    const id = `notif_${Date.now()}_${notifIdCounter++}`;
    setNotifications((prev) => [{
      ...notif,
      id,
      timestamp: new Date(),
      read: false,
    }, ...prev]);
    onToast(notif.message, 'info');
  }, [onToast]);

  // Computar sets de lobbies del usuario con useMemo para evitar re-renders infinitos
  const userLobbyIds = useMemo(() => new Set(
    lobbies
      .filter((l) => l.participants.some((p) => p.user.id === currentUser?.id))
      .map((l) => l.id)
  ), [lobbies, currentUser]);

  const hostedLobbyIds = useMemo(() => new Set(
    lobbies
      .filter((l) => l.host.id === currentUser?.id)
      .map((l) => l.id)
  ), [lobbies, currentUser]);

  useEffect(() => {
    if (!socket || !currentUser) return;

    const handleJoin = ({ lobbyId, participant }: any) => {
      if (!hostedLobbyIds.has(lobbyId)) return;
      const key = `join_${lobbyId}_${participant?.user?.id}`;
      if (notifiedRef.current.has(key)) return;
      notifiedRef.current.add(key);
      addNotification({
        type: 'join',
        message: `${participant?.user?.username || 'Alguien'} se unió a tu grupo`,
        lobbyId,
        relatedUsername: participant?.user?.username,
      });
    };

    const handleLeave = ({ lobbyId, userId }: any) => {
      if (!hostedLobbyIds.has(lobbyId)) return;
      const lobby = lobbies.find((l) => l.id === lobbyId);
      const username = lobby?.participants.find((p) => p.user.id === userId)?.user.username || 'Alguien';
      const key = `leave_${lobbyId}_${userId}`;
      if (notifiedRef.current.has(key)) return;
      notifiedRef.current.add(key);
      addNotification({
        type: 'leave',
        message: `${username} salió del grupo`,
        lobbyId,
        relatedUsername: username,
      });
    };

    const handleConfirm = ({ lobbyId, userId }: any) => {
      if (!userLobbyIds.has(lobbyId)) return;
      const lobby = lobbies.find((l) => l.id === lobbyId);
      const username = lobby?.participants.find((p) => p.user.id === userId)?.user.username || 'Alguien';
      const key = `confirm_${lobbyId}_${userId}`;
      if (notifiedRef.current.has(key)) return;
      notifiedRef.current.add(key);
      addNotification({
        type: 'confirm',
        message: `${username} confirmó reliquia 💎`,
        lobbyId,
        relatedUsername: username,
      });
    };

    const handleReady = ({ lobbyId, userId }: any) => {
      if (!userLobbyIds.has(lobbyId)) return;
      const lobby = lobbies.find((l) => l.id === lobbyId);
      const username = lobby?.participants.find((p) => p.user.id === userId)?.user.username || 'Alguien';
      const key = `ready_${lobbyId}_${userId}`;
      if (notifiedRef.current.has(key)) return;
      notifiedRef.current.add(key);
      addNotification({
        type: 'ready',
        message: `${username} está listo ✅`,
        lobbyId,
        relatedUsername: username,
      });
    };

    const handleStatus = ({ lobbyId, status }: any) => {
      if (!userLobbyIds.has(lobbyId) && !hostedLobbyIds.has(lobbyId)) return;
      const lobby = lobbies.find((l) => l.id === lobbyId);
      const title = lobby?.title || 'Grupo';
      const statusMessages: Record<string, string> = {
        CONFIRMING: '¡Todos confirmaron! Ready check iniciado',
        IN_PROGRESS: 'La misión está en progreso',
        CLOSED: 'Misión completada ✅',
        CANCELLED: 'Grupo cancelado ❌',
      };
      const msg = statusMessages[status] || `Estado cambiado a ${status}`;
      const key = `status_${lobbyId}_${status}`;
      if (notifiedRef.current.has(key)) return;
      notifiedRef.current.add(key);
      addNotification({
        type: 'status',
        message: `${title}: ${msg}`,
        lobbyId,
      });
    };

    const handleRotation = ({ previousLobbyId, nextLobbyId, round, total }: any) => {
      if (!userLobbyIds.has(previousLobbyId)) return;
      const key = `rot_${previousLobbyId}_${round}`;
      if (notifiedRef.current.has(key)) return;
      notifiedRef.current.add(key);
      addNotification({
        type: 'rotation',
        message: `🔄 Ronda ${round}/${total} lista — cambiá de grupo`,
        lobbyId: nextLobbyId,
      });
    };

    socket.on('lobby:participant-joined', handleJoin);
    socket.on('lobby:participant-left', handleLeave);
    socket.on('lobby:participant-confirmed', handleConfirm);
    socket.on('lobby:participant-ready', handleReady);
    socket.on('lobby:status-changed', handleStatus);
    socket.on('lobby:rotation-advanced', handleRotation);

    return () => {
      socket.off('lobby:participant-joined', handleJoin);
      socket.off('lobby:participant-left', handleLeave);
      socket.off('lobby:participant-confirmed', handleConfirm);
      socket.off('lobby:participant-ready', handleReady);
      socket.off('lobby:status-changed', handleStatus);
      socket.off('lobby:rotation-advanced', handleRotation);
    };
  }, [socket, currentUser, userLobbyIds, hostedLobbyIds, addNotification, lobbies]);

  const markAsRead = useCallback((id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  }, []);

  const markAllAsRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }, []);

  const clearAll = useCallback(() => {
    setNotifications([]);
    notifiedRef.current.clear();
  }, []);

  const removeNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <NotificationContext.Provider value={{
      notifications,
      unreadCount,
      markAsRead,
      markAllAsRead,
      clearAll,
      removeNotification,
    }}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications(): NotificationContextValue {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error('useNotifications must be used within NotificationProvider');
  return ctx;
}
