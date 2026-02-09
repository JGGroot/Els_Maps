export type FontFamily = 'IBM Plex Sans' | 'Comic Sans MS' | 'Arial' | 'Times New Roman';

export interface AppSettings {
  defaultStrokeColor: string;
  defaultStrokeWidth: number;
  defaultFont: FontFamily;
}

type SettingsChangeCallback = (settings: AppSettings) => void;

const DEFAULT_SETTINGS: AppSettings = {
  defaultStrokeColor: '#ffffff',
  defaultStrokeWidth: 2,
  defaultFont: 'IBM Plex Sans'
};

class SettingsManager {
  private settings: AppSettings = { ...DEFAULT_SETTINGS };
  private listeners: Set<SettingsChangeCallback> = new Set();
  private readonly STORAGE_KEY = 'els-maps-settings';

  constructor() {
    this.loadSettings();
  }

  private loadSettings(): void {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        this.settings = { ...DEFAULT_SETTINGS, ...parsed };
      }
    } catch (e) {
      console.warn('Failed to load settings:', e);
    }
  }

  private saveSettings(): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.settings));
    } catch (e) {
      console.warn('Failed to save settings:', e);
    }
  }

  getSettings(): AppSettings {
    return { ...this.settings };
  }

  getDefaultStrokeColor(): string {
    return this.settings.defaultStrokeColor;
  }

  setDefaultStrokeColor(color: string): void {
    if (this.settings.defaultStrokeColor === color) return;
    this.settings.defaultStrokeColor = color;
    this.saveSettings();
    this.notifyListeners();
  }

  getDefaultStrokeWidth(): number {
    return this.settings.defaultStrokeWidth;
  }

  setDefaultStrokeWidth(width: number): void {
    const clamped = Math.max(1, Math.min(20, width));
    if (this.settings.defaultStrokeWidth === clamped) return;
    this.settings.defaultStrokeWidth = clamped;
    this.saveSettings();
    this.notifyListeners();
  }

  getDefaultFont(): FontFamily {
    return this.settings.defaultFont;
  }

  setDefaultFont(font: FontFamily): void {
    if (this.settings.defaultFont === font) return;
    this.settings.defaultFont = font;
    this.saveSettings();
    this.notifyListeners();
  }

  private notifyListeners(): void {
    this.listeners.forEach(callback => callback(this.getSettings()));
  }

  subscribe(callback: SettingsChangeCallback): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }
}

export const settingsManager = new SettingsManager();
