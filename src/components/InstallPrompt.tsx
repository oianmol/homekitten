import { useEffect, useState } from 'react';
import { Button } from './ui';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISS_KEY = 'hk-install-dismissed';
const DISMISS_TTL_MS = 1000 * 60 * 60 * 24 * 14; // 14 days

function dismissed(): boolean {
  const v = localStorage.getItem(DISMISS_KEY);
  if (!v) return false;
  const ts = Number(v);
  if (!Number.isFinite(ts)) return false;
  return Date.now() - ts < DISMISS_TTL_MS;
}

function isIos(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !('MSStream' in window);
}

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    ('standalone' in window.navigator && (window.navigator as { standalone?: boolean }).standalone === true)
  );
}

export function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [iosHint, setIosHint] = useState(false);
  const [hidden, setHidden] = useState<boolean>(() => isStandalone() || dismissed());

  useEffect(() => {
    if (hidden) return;
    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => setHidden(true);
    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onInstalled);
    if (isIos() && !isStandalone()) setIosHint(true);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, [hidden]);

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setHidden(true);
  }

  async function install() {
    if (!deferred) return;
    await deferred.prompt();
    const choice = await deferred.userChoice;
    if (choice.outcome === 'dismissed') dismiss();
    setDeferred(null);
  }

  if (hidden) return null;
  if (!deferred && !iosHint) return null;

  return (
    <div className="fixed bottom-4 inset-x-4 sm:inset-x-auto sm:right-4 sm:max-w-sm z-40 bg-white border border-neutral-200 rounded-2xl shadow-lg p-4">
      <div className="flex items-start gap-3">
        <div className="text-2xl">📲</div>
        <div className="flex-1">
          <div className="font-medium text-sm">Install HomeKitten</div>
          {deferred ? (
            <p className="text-xs text-neutral-600 mt-1">
              Get a one-tap launcher and keep your data even if you close the browser.
            </p>
          ) : (
            <p className="text-xs text-neutral-600 mt-1">
              Tap the <span className="font-medium">Share</span> button below, then{' '}
              <span className="font-medium">Add to Home Screen</span>.
            </p>
          )}
          <div className="mt-3 flex gap-2">
            {deferred && <Button onClick={install}>Install</Button>}
            <Button variant="ghost" onClick={dismiss}>Not now</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
