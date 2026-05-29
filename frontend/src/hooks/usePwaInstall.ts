import { useCallback, useEffect, useMemo, useState } from 'react';
import type { BeforeInstallPromptEvent, InstallOutcome } from '@/lib/pwa';

function isIosDevice() {
  const userAgent = window.navigator.userAgent.toLowerCase();
  const isTouchMac = userAgent.includes('macintosh') && window.navigator.maxTouchPoints > 1;
  return /iphone|ipad|ipod/.test(userAgent) || isTouchMac;
}

function isAndroidDevice() {
  return /android/.test(window.navigator.userAgent.toLowerCase());
}

function isStandaloneDisplay() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: fullscreen)').matches ||
    Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone)
  );
}

export function usePwaInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(
    () => window.nexapayInstallPrompt ?? null,
  );
  const [isInstalled, setIsInstalled] = useState(() => isStandaloneDisplay());
  const [lastOutcome, setLastOutcome] = useState<InstallOutcome | null>(null);

  const platform = useMemo(() => ({
    isIos: isIosDevice(),
    isAndroid: isAndroidDevice(),
  }), []);

  useEffect(() => {
    const handlePromptReady = () => {
      setDeferredPrompt(window.nexapayInstallPrompt ?? null);
    };

    const handleInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
      setLastOutcome('accepted');
    };

    window.addEventListener('nexapay-install-prompt-ready', handlePromptReady);
    window.addEventListener('nexapay-app-installed', handleInstalled);

    return () => {
      window.removeEventListener('nexapay-install-prompt-ready', handlePromptReady);
      window.removeEventListener('nexapay-app-installed', handleInstalled);
    };
  }, []);

  const install = useCallback(async () => {
    if (!deferredPrompt) return false;

    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    setLastOutcome(choice.outcome);
    setDeferredPrompt(null);
    window.nexapayInstallPrompt = undefined;
    return choice.outcome === 'accepted';
  }, [deferredPrompt]);

  return {
    canInstall: Boolean(deferredPrompt) && !isInstalled,
    install,
    isInstalled,
    isIos: platform.isIos,
    isAndroid: platform.isAndroid,
    isMobile: platform.isIos || platform.isAndroid,
    lastOutcome,
    needsIosInstructions: platform.isIos && !isInstalled,
  };
}
