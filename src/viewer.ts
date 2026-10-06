import { Display } from './render/display';
import { parseFragment } from './state/fragment';
import { resolveSettings, type Settings } from './state/params';

/** Fullscreen viewer: renders the fragment with zero UI chrome. */
export function mountViewer(app: HTMLElement): { update(): void; destroy(): void } {
  document.body.className = 'page-viewer';
  const stage = document.createElement('div');
  stage.className = 'viewer-stage';
  app.replaceChildren(stage);
  const display = new Display(stage);

  let settings: Settings;
  let refreshTimer = 0;
  let lock: WakeLockSentinel | null = null;

  const acquireLock = async () => {
    if (!settings?.wake || lock || document.visibilityState !== 'visible') return;
    try {
      lock = (await navigator.wakeLock?.request('screen')) ?? null;
      lock?.addEventListener('release', () => {
        lock = null;
      });
    } catch {
      // Unsupported or denied: fall back silently.
    }
  };
  const releaseLock = () => {
    void lock?.release().catch(() => undefined);
    lock = null;
  };
  const onVisibility = () => void acquireLock();
  document.addEventListener('visibilitychange', onVisibility);

  const update = () => {
    settings = resolveSettings(parseFragment(location.hash));
    display.update(settings);
    clearTimeout(refreshTimer);
    if (settings.refresh) {
      refreshTimer = window.setTimeout(() => location.reload(), settings.refresh * 1000);
    }
    if (settings.wake) void acquireLock();
    else releaseLock();
  };
  update();

  return {
    update,
    destroy() {
      clearTimeout(refreshTimer);
      document.removeEventListener('visibilitychange', onVisibility);
      releaseLock();
      display.destroy();
    },
  };
}
