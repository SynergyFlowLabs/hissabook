'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { sounds } from '@/lib/sounds';

export type ClientNotification = {
  id: number;
  kind: 'transaction' | 'loan' | 'inventory' | 'salary' | 'member' | 'invitation' | 'reminder';
  title: string;
  body: string;
  href: string;
  createdAt: string;
  read: boolean;
  actorName: string | null;
};

const POLL_MS = 25_000;

/** Shared polling hook for the notification center. Visibility-aware; never throws. */
export function useNotifications() {
  const [items, setItems] = useState<ClientNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const unreadRef = useRef(0);
  const primedRef = useRef(false);
  const mountedRef = useRef(true);

  const load = useCallback(async () => {
    try {
      const response = await fetch('/api/notifications?limit=30', { cache: 'no-store' });
      if (!response.ok) throw new Error('notifications request failed');
      const json = (await response.json()) as { items: ClientNotification[]; unreadCount: number };
      if (!mountedRef.current) return;
      setItems(json.items);
      setUnreadCount(json.unreadCount);
      setError(false);
      if (primedRef.current && json.unreadCount > unreadRef.current) sounds.notify();
      unreadRef.current = json.unreadCount;
      primedRef.current = true;
    } catch {
      if (mountedRef.current) setError(true);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    void load();
    const interval = window.setInterval(() => {
      if (document.visibilityState === 'visible') void load();
    }, POLL_MS);
    const onWake = () => { if (document.visibilityState === 'visible') void load(); };
    window.addEventListener('focus', onWake);
    document.addEventListener('visibilitychange', onWake);
    return () => {
      mountedRef.current = false;
      window.clearInterval(interval);
      window.removeEventListener('focus', onWake);
      document.removeEventListener('visibilitychange', onWake);
    };
  }, [load]);

  const markRead = useCallback((id: number) => {
    setItems((prev) => {
      let decreased = 0;
      const next = prev.map((item) => {
        if (item.id === id && !item.read) { decreased = 1; return { ...item, read: true }; }
        return item;
      });
      if (decreased) {
        unreadRef.current = Math.max(0, unreadRef.current - decreased);
        setUnreadCount(unreadRef.current);
      }
      return next;
    });
    void fetch(`/api/notifications/${id}/read`, { method: 'POST' }).catch(() => { /* fail silent; next poll reconciles */ });
  }, []);

  const markAllRead = useCallback(() => {
    setItems((prev) => prev.map((item) => (item.read ? item : { ...item, read: true })));
    unreadRef.current = 0;
    setUnreadCount(0);
    void fetch('/api/notifications/read-all', { method: 'POST' }).catch(() => { /* fail silent */ });
  }, []);

  return { items, unreadCount, loading, error, refresh: load, markRead, markAllRead };
}

export function timeAgo(iso: string): string {
  const then = new Date(iso.includes('T') ? iso : `${iso.replace(' ', 'T')}Z`).getTime();
  if (Number.isNaN(then)) return '';
  const seconds = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (seconds < 45) return 'Just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(then).toLocaleDateString('en-PK', { day: 'numeric', month: 'short' });
}
