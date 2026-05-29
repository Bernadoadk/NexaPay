export type InstallOutcome = 'accepted' | 'dismissed';

export type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: InstallOutcome; platform: string }>;
};

declare global {
  interface Window {
    nexapayInstallPrompt?: BeforeInstallPromptEvent;
  }
}

export function registerPwaWorker() {
  registerInstallPromptCapture();

  if (!('serviceWorker' in navigator) || !import.meta.env.PROD) return;

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // The app remains fully usable if PWA registration fails.
    });
  });
}

function registerInstallPromptCapture() {
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    window.nexapayInstallPrompt = event as BeforeInstallPromptEvent;
    window.dispatchEvent(new Event('nexapay-install-prompt-ready'));
  });

  window.addEventListener('appinstalled', () => {
    window.nexapayInstallPrompt = undefined;
    window.dispatchEvent(new Event('nexapay-app-installed'));
  });
}
