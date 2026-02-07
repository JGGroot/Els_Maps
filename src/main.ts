import './assets/styles/main.css';
import { App } from './components/App';

document.addEventListener('DOMContentLoaded', () => {
  const appContainer = document.getElementById('app');
  if (!appContainer) {
    throw new Error('App container not found');
  }

  const app = new App(appContainer);
  app.init();
});
