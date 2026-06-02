type Theme = 'light' | 'dark';

type ThemeChangeCallback = (theme: Theme) => void;

class ThemeManager {
  private currentTheme: Theme = 'dark';
  private listeners: Set<ThemeChangeCallback> = new Set();
  private readonly STORAGE_KEY = 'els-maps-theme';

  constructor() {
    this.loadTheme();
    this.applyTheme();
  }

  private loadTheme(): void {
    const stored = localStorage.getItem(this.STORAGE_KEY);
    if (stored === 'light' || stored === 'dark') {
      this.currentTheme = stored;
    }
    // No OS-preference fallback — app is dark-only in the current design.
    // A light-mode OS must not override the canvas into a light palette while
    // the UI remains dark. Re-add matchMedia here if a full light theme ships.
  }

  private applyTheme(): void {
    document.documentElement.setAttribute('data-theme', this.currentTheme);

    // Update meta theme-color
    const metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme) {
      metaTheme.setAttribute('content', this.currentTheme === 'dark' ? '#1a1a1a' : '#f5f5f5');
    }
  }

  getTheme(): Theme {
    return this.currentTheme;
  }

  setTheme(theme: Theme): void {
    if (this.currentTheme === theme) return;

    this.currentTheme = theme;
    localStorage.setItem(this.STORAGE_KEY, theme);
    this.applyTheme();

    this.listeners.forEach(callback => callback(theme));
  }

  toggle(): void {
    this.setTheme(this.currentTheme === 'dark' ? 'light' : 'dark');
  }

  subscribe(callback: ThemeChangeCallback): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }
}

export const themeManager = new ThemeManager();
export type { Theme };
