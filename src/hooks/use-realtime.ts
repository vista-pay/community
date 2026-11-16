'use client';

import { useEffect, useRef } from 'react';
import { io, type Socket } from 'socket.io-client';
import { post } from '@/lib/api';

/**
 * Where the WebSocket actually lives.
 *
 * Not the Next proxy the REST calls go through: that proxy speaks HTTP, and a
 * socket needs the API's own origin. Which is also why the connection carries
 * a ticket rather than the session cookie — the cookie belongs to this app's
 * origin and would never travel here.
 */
const API_ORIGIN =
  process.env.NEXT_PUBLIC_API_ORIGIN ??
  (typeof window !== 'undefined' ? window.location.origin.replace(/:\d+$/, ':9100') : '');

let shared: Socket | null = null;
let connecting: Promise<Socket | null> | null = null;

/**
 * One socket per tab, shared by every hook that wants it.
 *
 * Opening a connection per component would mean a handshake — and a ticket —
 * for each screen, and a page with three live surfaces would hold three
 * sockets saying the same things.
 */
async function connect(): Promise<Socket | null> {
  if (shared?.connected) return shared;
  if (connecting) return connecting;

  connecting = (async () => {
    try {
      const { token } = await post<{ token: string; expiresIn: number }>('/realtime/ticket');
      const socket = io(API_ORIGIN, {
        auth: { token },
        transports: ['websocket'],
        reconnectionAttempts: 5,
      });
      shared = socket;
      return socket;
    } catch {
      // Live updates are an improvement, never a requirement: a page whose
      // socket cannot open still works, it just waits for the next fetch.
      return null;
    } finally {
      connecting = null;
    }
  })();

  return connecting;
}

/**
 * Run `onEvent` whenever the server says the named thing changed.
 *
 * The payload is a hint. What changed is fetched over REST, where
 * authorization lives — a socket message is not an authenticated read.
 */
export function useRealtimeEvent(
  event: string,
  onEvent: (payload: { communityId?: string; at?: string }) => void,
  enabled = true,
) {
  // Held in a ref so a caller passing an inline function does not tear the
  // subscription down and build it up on every render.
  const handler = useRef(onEvent);
  handler.current = onEvent;

  useEffect(() => {
    if (!enabled) return;
    let socket: Socket | null = null;
    let cancelled = false;

    const listener = (payload: { communityId?: string; at?: string }) => handler.current(payload);

    void connect().then((connected) => {
      if (cancelled || !connected) return;
      socket = connected;
      socket.on(event, listener);
    });

    return () => {
      cancelled = true;
      socket?.off(event, listener);
    };
  }, [event, enabled]);
}
