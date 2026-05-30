import './assets/styles/main.css';
import { App } from './components/App';

document.addEventListener('DOMContentLoaded', async () => {
  const appContainer = document.getElementById('app');
  if (!appContainer) throw new Error('App container not found');

  const app = new App(appContainer);

  // Minimum display time keeps the animation from being cut short
  const minDisplay = new Promise<void>(resolve => setTimeout(resolve, 3400));

  try {
    await Promise.all([app.init(), minDisplay]);
  } catch (e) {
    console.error('App init error:', e);
  } finally {
    dismissLoadingScreen();
  }
});

function dismissLoadingScreen(): void {
  const screen = document.getElementById('els-loading');
  if (!screen) return;
  screen.classList.add('fade-out');
  setTimeout(() => screen.remove(), 520);
}
