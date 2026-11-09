'use client';

import { useEffect, useState } from 'react';
import { BellRing, BellOff, Share, PlusSquare, LogIn, Loader2, CheckCircle2 } from 'lucide-react';
import {
  pushSupported, isIOS, isStandalone, subscribeThisDevice, unsubscribeThisDevice,
} from '@/lib/push-client';
import { sounds } from '@/lib/sounds';

type EnrollState = 'checking' | 'hidden' | 'ios' | 'denied' | 'off' | 'on' | 'working';

/** Panel-footer web-push enrollment. Renders nothing when push is unsupported/unconfigured. */
export default function PushEnroll() {
  const [state, setState] = useState<EnrollState>('checking');

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!pushSupported()) { if (mounted) setState('hidden'); return; }
      if (isIOS() && !isStandalone()) { if (mounted) setState('ios'); return; }
      if (Notification.permission === 'denied') { if (mounted) setState('denied'); return; }
      try {
        const config = await fetch('/api/push/config', { cache: 'no-store' }).then((res) => res.json());
        if (!config?.configured) { if (mounted) setState('hidden'); return; }
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();
        if (mounted) setState(subscription ? 'on' : 'off');
      } catch {
        if (mounted) setState('off');
      }
    })();
    return () => { mounted = false; };
  }, []);

  const enable = async () => {
    setState('working');
    const result = await subscribeThisDevice();
    if (result.ok) {
      sounds.shimmer();
      setState('on');
    } else {
      setState(result.reason === 'denied' ? 'denied' : result.reason === 'unsupported' || result.reason === 'unconfigured' ? 'hidden' : 'off');
    }
  };

  const disable = async () => {
    setState('working');
    sounds.undo();
    await unsubscribeThisDevice();
    setState('off');
  };

  if (state === 'checking' || state === 'hidden') return null;

  if (state === 'ios') {
    return (
      <div className="push-ios">
        <p className="push-ios-title"><BellRing size={13} /> Alerts on iPhone &amp; iPad</p>
        <p className="push-ios-copy">Install Hisaabook to your home screen (iOS 16.4+), then alerts will be available right here:</p>
        <ol className="push-ios-steps">
          <li><Share size={12} /> Tap <strong>Share</strong> in Safari</li>
          <li><PlusSquare size={12} /> Choose <strong>Add to Home Screen</strong></li>
          <li><LogIn size={12} /> Open the new icon — alerts unlock there</li>
        </ol>
      </div>
    );
  }

  if (state === 'denied') {
    return (
      <div className="push-row">
        <span className="push-copy"><BellOff size={13} className="push-icon-muted" /> <span>Notifications are blocked in your browser settings — allow them for Hisaabook to receive alerts.</span></span>
      </div>
    );
  }

  return (
    <div className="push-row">
      <span className="push-copy">
        {state === 'on'
          ? <><CheckCircle2 size={14} className="push-icon-on" /> <span><strong>Device alerts on</strong> — this device hears new ledger activity.</span></>
          : <><BellRing size={14} className="push-icon" /> <span>Get pinged for ledger activity, salaries and reminders.</span></>}
      </span>
      {state === 'working' ? (
        <span className="push-working" aria-live="polite"><Loader2 size={14} className="push-spin" /> Working…</span>
      ) : state === 'on' ? (
        <button type="button" className="push-toggle off" onClick={disable}>Disable</button>
      ) : (
        <button type="button" className="push-toggle" onClick={enable}>Enable</button>
      )}
    </div>
  );
}
