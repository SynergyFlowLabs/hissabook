'use client';

/** Client-side Web Push helpers. No React — usable from toast callbacks and components. */

export function pushSupported(): boolean {
  return typeof window !== 'undefined'
    && 'serviceWorker' in navigator
    && 'PushManager' in window
    && 'Notification' in window;
}

export function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(display-mode: standalone)').matches
    || Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
}

export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i += 1) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

export type SubscribeResult =
  | { ok: true; alreadySubscribed: boolean }
  | { ok: false; reason: 'unsupported' | 'unconfigured' | 'denied' | 'unavailable' | 'server' };

export async function subscribeThisDevice(): Promise<SubscribeResult> {
  if (!pushSupported()) return { ok: false, reason: 'unsupported' };
  const keyResponse = await fetch('/api/push/config', { cache: 'no-store' }).then((res) => res.json()).catch(() => null) as { configured?: boolean; publicKey?: string | null } | null;
  if (!keyResponse?.configured || !keyResponse.publicKey) return { ok: false, reason: 'unconfigured' };
  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return { ok: false, reason: 'denied' };
    const registration = await navigator.serviceWorker.ready;
    const existing = await registration.pushManager.getSubscription();
    const subscription = existing ?? await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(keyResponse.publicKey) as unknown as BufferSource,
    });
    const response = await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(subscription.toJSON()),
    });
    if (!response.ok) return { ok: false, reason: 'server' };
    // self-confirmation push (best effort)
    void fetch('/api/push/test', { method: 'POST' }).catch(() => {});
    return { ok: true, alreadySubscribed: Boolean(existing) };
  } catch (error) {
    console.error('subscribeThisDevice failed', error);
    return { ok: false, reason: 'unavailable' };
  }
}

export async function unsubscribeThisDevice(): Promise<boolean> {
  if (!pushSupported()) return false;
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (subscription) {
      const endpoint = subscription.endpoint;
      await subscription.unsubscribe().catch(() => {});
      await fetch('/api/push/unsubscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint }),
      }).catch(() => {});
    }
    return true;
  } catch {
    return false;
  }
}

/** One-time priming after the first successful ledger save of the session. */
export function maybePrimePushAfterLedgerSave(onEnable: () => void): boolean {
  if (typeof window === 'undefined') return false;
  if (!pushSupported() || Notification.permission !== 'default') return false;
  if (isIOS() && !isStandalone()) return false; // iOS needs home-screen install first
  try {
    if (window.localStorage.getItem('hissabook:push-primed')) return false;
    window.localStorage.setItem('hissabook:push-primed', '1');
  } catch {
    return false;
  }
  onEnable();
  return true;
}
