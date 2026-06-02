import './assets/styles/main.css';
import { App } from './components/App';

document.addEventListener('DOMContentLoaded', async () => {
  const appContainer = document.getElementById('app');
  if (!appContainer) throw new Error('App container not found');

  const app = new App(appContainer);

  const minDisplay  = new Promise<void>(resolve => setTimeout(resolve, 3400));
  const hardTimeout = new Promise<void>(resolve => setTimeout(resolve, 10000));

  // Catch init errors inline so a rejection never blocks the loading-screen dismiss.
  // If init throws, the app will still attempt to render whatever it can.
  const initSafe = app.init().catch(e => console.error('[Els_Maps] init error:', e));

  // Wait for (init + minimum display time), hard-capped at 10 s.
  // On slow/broken storage or canvas init the hard cap ensures we always dismiss.
  await Promise.race([
    Promise.all([initSafe, minDisplay]),
    hardTimeout,
  ]);

  dismissLoadingScreen();
});

function dismissLoadingScreen(): void {
  const screen = document.getElementById('els-loading');
  if (!screen) return;
  screen.classList.add('fade-out');
  setTimeout(() => screen.remove(), 520);
}
