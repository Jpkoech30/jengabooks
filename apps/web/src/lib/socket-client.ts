import { io, Socket } from 'socket.io-client';

const SOCKET_URL = ''; // Same origin, uses Vite proxy

interface ServerToClientEvents {
  'sync:status': (data: { status: 'live' | 'syncing' | 'offline'; timestamp: string }) => void;
  'ai:activity': (data: { agent: string; action: string; status: 'pending' | 'success' | 'error' }) => void;
  'hitl:new-task': (data: { taskId: string; title: string; priority: string }) => void;
  'hitl:task-update': (data: { taskId: string; status: string }) => void;
  'notification': (data: { title: string; message: string; variant: string }) => void;
  'etims:sync-complete': (data: { success: boolean; count: number }) => void;
}

interface ClientToServerEvents {
  'tenant:register': (tenantId: string) => void;
  'hitl:claim-task': (taskId: string) => void;
  'hitl:resolve-task': (taskId: string) => void;
}

export type TypedSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

let socket: TypedSocket | null = null;

export function getSocket(): TypedSocket {
  if (!socket) {
    socket = io(SOCKET_URL, {
      autoConnect: false,
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10000,
    });
  }
  return socket;
}

export function connectSocket(tenantId?: string): TypedSocket {
  const s = getSocket();

  if (!s.connected) {
    s.connect();
  }

  // Register with tenant for scoped events
  if (tenantId) {
    s.emit('tenant:register', tenantId);
  }

  return s;
}

export function disconnectSocket(): void {
  if (socket?.connected) {
    socket.disconnect();
  }
}
