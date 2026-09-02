import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';

// Le temps réel est optionnel : les notifications sont déjà rafraîchies par le
// polling React Query (30 s). On n'ouvre une socket que si l'API tourne sur un
// hôte qui les supporte — ce qui n'est pas le cas des fonctions serverless
// Vercel. Définir VITE_WS_URL (ex. wss://nexapay-api.onrender.com) pour l'activer.
const WS_PROTOCOL = 'nexapay-jwt';
const MAX_RECONNECT_ATTEMPTS = 5;

function resolveSocketUrl(): string | null {
  const explicit = import.meta.env.VITE_WS_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, '');

  // Dev local : le backend Express sert aussi les WebSockets.
  if (import.meta.env.DEV) return 'ws://localhost:3001';

  return null;
}

export function useNotificationSocket() {
  const queryClient = useQueryClient();
  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<number>();
  const reconnectAttempts = useRef(0);

  useEffect(() => {
    let isMounted = true;
    const token = localStorage.getItem('token');
    const wsUrl = resolveSocketUrl();
    if (!token || !wsUrl) return;

    const connect = () => {
      if (!isMounted) return;

      let socket: WebSocket;
      try {
        // Le token voyage en sous-protocole, jamais en query string (une URL
        // finit dans les logs d'accès du serveur).
        socket = new WebSocket(wsUrl, [WS_PROTOCOL, token]);
      } catch {
        return; // URL invalide : on reste sur le polling.
      }
      socketRef.current = socket;

      socket.onopen = () => {
        reconnectAttempts.current = 0;
      };

      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'notification' || data.event === 'notification') {
            queryClient.invalidateQueries({ queryKey: ['notifications'] });
            queryClient.invalidateQueries({ queryKey: ['notifications-unread-count'] });
          }
        } catch (e) {
          console.error('WebSocket message parsing error:', e);
        }
      };

      socket.onclose = (event) => {
        if (!isMounted) return;
        // 4001 = token refusé : inutile de réessayer avec le même.
        if (event.code === 4001) return;
        if (reconnectAttempts.current >= MAX_RECONNECT_ATTEMPTS) return;
        const delay = Math.min(1000 * 2 ** reconnectAttempts.current, 30000);
        reconnectAttempts.current++;
        reconnectTimeoutRef.current = window.setTimeout(connect, delay);
      };
    };

    connect();

    return () => {
      isMounted = false;
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (socketRef.current) {
        socketRef.current.close();
      }
    };
  }, [queryClient]);
}
