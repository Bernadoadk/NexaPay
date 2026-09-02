import { useCallback, useEffect, useState } from 'react';
import { notificationsApi } from '@/lib/api';

/**
 * Activation des notifications système (Web Push).
 *
 * Volontairement déclenché par un geste explicite de l'utilisateur : demander
 * la permission au chargement fait refuser la plupart des gens, et le refus est
 * définitif. L'appel est aussi silencieusement désactivé si le serveur n'a pas
 * de clés VAPID.
 */
type PushStatus = 'unsupported' | 'unconfigured' | 'default' | 'granted' | 'denied';

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const normalized = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(normalized);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i);
  return output;
}

const supported =
  typeof window !== 'undefined' &&
  'serviceWorker' in navigator &&
  'PushManager' in window &&
  'Notification' in window;

export function usePushNotifications() {
  const [status, setStatus] = useState<PushStatus>(supported ? 'default' : 'unsupported');
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [publicKey, setPublicKey] = useState<string | null>(null);

  useEffect(() => {
    if (!supported) return;
    let cancelled = false;

    (async () => {
      try {
        const { data } = await notificationsApi.pushPublicKey();
        if (cancelled) return;

        if (!data?.enabled || !data?.publicKey) {
          setStatus('unconfigured');
          return;
        }
        setPublicKey(data.publicKey);
        setStatus(Notification.permission as PushStatus);

        const registration = await navigator.serviceWorker.ready;
        const existing = await registration.pushManager.getSubscription();
        if (!cancelled) setSubscribed(Boolean(existing));
      } catch {
        if (!cancelled) setStatus('unconfigured');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const enable = useCallback(async (): Promise<boolean> => {
    if (!supported || !publicKey) return false;
    setBusy(true);
    try {
      const permission = await Notification.requestPermission();
      setStatus(permission as PushStatus);
      if (permission !== 'granted') return false;

      const registration = await navigator.serviceWorker.ready;
      const subscription =
        (await registration.pushManager.getSubscription()) ??
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
        }));

      await notificationsApi.pushSubscribe(subscription.toJSON());
      setSubscribed(true);
      return true;
    } catch (err) {
      console.error('[Push] Activation échouée:', err);
      return false;
    } finally {
      setBusy(false);
    }
  }, [publicKey]);

  const disable = useCallback(async (): Promise<void> => {
    if (!supported) return;
    setBusy(true);
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await notificationsApi.pushUnsubscribe(subscription.endpoint).catch(() => {});
        await subscription.unsubscribe();
      }
      setSubscribed(false);
    } finally {
      setBusy(false);
    }
  }, []);

  return {
    /** `true` si l'appareil et le serveur permettent les notifications système. */
    available: status !== 'unsupported' && status !== 'unconfigured',
    status,
    subscribed,
    busy,
    enable,
    disable,
  };
}
