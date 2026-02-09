import { themeManager, type Theme } from '@/utils/ThemeManager';
import { settingsManager, type FontFamily } from '@/utils/SettingsManager';

export interface SettingsModalCallbacks {
  onDefaultStrokeColorChange?: (color: string) => void;
  onDefaultStrokeWidthChange?: (width: number) => void;
  onDefaultFontChange?: (font: FontFamily) => void;
}

export class SettingsModal {
  private overlay: HTMLElement;
  private modal: HTMLElement;
  private isOpen: boolean = false;
  private unsubscribe: (() => void) | null = null;
  private callbacks: SettingsModalCallbacks = {};

  constructor(parent: HTMLElement) {
    // Create overlay
    this.overlay = document.createElement('div');
    this.overlay.className = 'fixed inset-0 bg-black/50 z-modal hidden items-center justify-center';
    this.overlay.addEventListener('click', (e) => {
      if (e.target === this.overlay) this.close();
    });

    // Create modal
    this.modal = document.createElement('div');
    this.modal.className = 'bg-surface rounded-lg shadow-xl w-full max-w-md mx-4 overflow-hidden';
    this.modal.innerHTML = this.renderContent();

    this.overlay.appendChild(this.modal);
    parent.appendChild(this.overlay);

    this.setupEventListeners();
  }

  private renderContent(): string {
    const currentTheme = themeManager.getTheme();
    const settings = settingsManager.getSettings();

    return `
      <div class="flex items-center justify-between p-4 border-b border-border">
        <h2 class="text-lg font-semibold text-foreground">Settings</h2>
        <button class="close-btn text-muted hover:text-foreground transition-colors p-1" aria-label="Close">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 6L6 18M6 6l12 12"/>
          </svg>
        </button>
      </div>
      <div class="p-4 space-y-4 max-h-[70vh] overflow-y-auto">
        <div class="flex items-center justify-between">
          <div>
            <h3 class="text-sm font-medium text-foreground">Theme</h3>
            <p class="text-xs text-muted">Choose your preferred appearance</p>
          </div>
          <div class="flex items-center gap-2 bg-charcoal rounded-lg p-1">
            <button
              class="theme-btn px-3 py-1.5 rounded text-sm transition-colors ${currentTheme === 'light' ? 'bg-surface text-foreground' : 'text-muted hover:text-foreground'}"
              data-theme="light"
            >
              <span class="flex items-center gap-1.5">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="5"/>
                  <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
                </svg>
                Light
              </span>
            </button>
            <button
              class="theme-btn px-3 py-1.5 rounded text-sm transition-colors ${currentTheme === 'dark' ? 'bg-surface text-foreground' : 'text-muted hover:text-foreground'}"
              data-theme="dark"
            >
              <span class="flex items-center gap-1.5">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
                </svg>
                Dark
              </span>
            </button>
          </div>
        </div>

        <div class="pt-4 border-t border-border space-y-4">
          <h3 class="text-sm font-medium text-foreground">Drawing Defaults</h3>

          <div class="space-y-2">
            <label class="block text-xs text-muted">Default Stroke Color</label>
            <div class="flex items-center gap-3">
              <input
                type="color"
                id="default-stroke-color"
                value="${settings.defaultStrokeColor}"
                class="w-10 h-10 rounded cursor-pointer bg-charcoal border border-border"
              />
              <span class="text-sm text-foreground" id="stroke-color-value">${settings.defaultStrokeColor}</span>
            </div>
          </div>

          <div class="space-y-2">
            <label class="block text-xs text-muted">Default Stroke Width</label>
            <div class="flex items-center gap-3">
              <input
                type="range"
                id="default-stroke-width"
                min="1"
                max="20"
                value="${settings.defaultStrokeWidth}"
                class="flex-1"
              />
              <span class="text-sm text-foreground min-w-[3rem] text-right" id="stroke-width-value">${settings.defaultStrokeWidth}px</span>
            </div>
          </div>

          <div class="space-y-2">
            <label class="block text-xs text-muted">Default Font</label>
            <select
              id="default-font"
              class="w-full bg-charcoal border border-border rounded px-3 py-2 text-foreground text-sm"
            >
              <option value="IBM Plex Sans" ${settings.defaultFont === 'IBM Plex Sans' ? 'selected' : ''} style="font-family: 'IBM Plex Sans', sans-serif">IBM Plex Sans</option>
              <option value="Comic Sans MS" ${settings.defaultFont === 'Comic Sans MS' ? 'selected' : ''} style="font-family: 'Comic Sans MS', cursive">Comic Sans</option>
              <option value="Arial" ${settings.defaultFont === 'Arial' ? 'selected' : ''} style="font-family: Arial, sans-serif">Arial</option>
              <option value="Times New Roman" ${settings.defaultFont === 'Times New Roman' ? 'selected' : ''} style="font-family: 'Times New Roman', serif">Times New Roman</option>
            </select>
          </div>
        </div>

        <div class="pt-4 border-t border-border">
          <h3 class="text-sm font-medium text-foreground mb-2">Keyboard Shortcuts</h3>
          <div class="space-y-1.5 text-xs">
            <div class="flex justify-between text-muted">
              <span>Undo</span>
              <kbd class="bg-charcoal px-1.5 py-0.5 rounded">Ctrl+Z</kbd>
            </div>
            <div class="flex justify-between text-muted">
              <span>Redo</span>
              <kbd class="bg-charcoal px-1.5 py-0.5 rounded">Ctrl+Shift+Z</kbd>
            </div>
            <div class="flex justify-between text-muted">
              <span>Paste Image</span>
              <kbd class="bg-charcoal px-1.5 py-0.5 rounded">Ctrl+V</kbd>
            </div>
            <div class="flex justify-between text-muted">
              <span>Pan Canvas</span>
              <kbd class="bg-charcoal px-1.5 py-0.5 rounded">Space + Drag</kbd>
            </div>
            <div class="flex justify-between text-muted">
              <span>Zoom</span>
              <kbd class="bg-charcoal px-1.5 py-0.5 rounded">Scroll Wheel</kbd>
            </div>
            <div class="flex justify-between text-muted">
              <span>Delete Selection</span>
              <kbd class="bg-charcoal px-1.5 py-0.5 rounded">Delete</kbd>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  setCallbacks(callbacks: SettingsModalCallbacks): void {
    this.callbacks = callbacks;
  }

  private setupEventListeners(): void {
    // Close button
    this.modal.querySelector('.close-btn')?.addEventListener('click', () => this.close());

    // Theme buttons
    this.modal.querySelectorAll('.theme-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const theme = (btn as HTMLElement).dataset.theme as Theme;
        themeManager.setTheme(theme);
      });
    });

    // Default stroke color
    const strokeColorInput = this.modal.querySelector('#default-stroke-color') as HTMLInputElement;
    const strokeColorValue = this.modal.querySelector('#stroke-color-value') as HTMLElement;
    strokeColorInput?.addEventListener('input', (e) => {
      const color = (e.target as HTMLInputElement).value;
      settingsManager.setDefaultStrokeColor(color);
      if (strokeColorValue) strokeColorValue.textContent = color;
      this.callbacks.onDefaultStrokeColorChange?.(color);
    });

    // Default stroke width
    const strokeWidthInput = this.modal.querySelector('#default-stroke-width') as HTMLInputElement;
    const strokeWidthValue = this.modal.querySelector('#stroke-width-value') as HTMLElement;
    strokeWidthInput?.addEventListener('input', (e) => {
      const width = Number((e.target as HTMLInputElement).value);
      settingsManager.setDefaultStrokeWidth(width);
      if (strokeWidthValue) strokeWidthValue.textContent = `${width}px`;
      this.callbacks.onDefaultStrokeWidthChange?.(width);
    });

    // Default font
    const fontSelect = this.modal.querySelector('#default-font') as HTMLSelectElement;
    fontSelect?.addEventListener('change', (e) => {
      const font = (e.target as HTMLSelectElement).value as FontFamily;
      settingsManager.setDefaultFont(font);
      this.callbacks.onDefaultFontChange?.(font);
    });

    // Subscribe to theme changes
    this.unsubscribe = themeManager.subscribe(() => {
      this.updateThemeButtons();
    });

    // Close on Escape
    document.addEventListener('keydown', this.handleKeyDown);
  }

  private handleKeyDown = (e: KeyboardEvent): void => {
    if (e.key === 'Escape' && this.isOpen) {
      this.close();
    }
  };

  private updateThemeButtons(): void {
    const currentTheme = themeManager.getTheme();

    this.modal.querySelectorAll('.theme-btn').forEach(btn => {
      const btnTheme = (btn as HTMLElement).dataset.theme;
      if (btnTheme === currentTheme) {
        btn.classList.add('bg-surface', 'text-foreground');
        btn.classList.remove('text-muted', 'hover:text-foreground');
      } else {
        btn.classList.remove('bg-surface', 'text-foreground');
        btn.classList.add('text-muted', 'hover:text-foreground');
      }
    });
  }

  open(): void {
    this.isOpen = true;
    this.overlay.classList.remove('hidden');
    this.overlay.classList.add('flex');
  }

  close(): void {
    this.isOpen = false;
    this.overlay.classList.add('hidden');
    this.overlay.classList.remove('flex');
  }

  destroy(): void {
    document.removeEventListener('keydown', this.handleKeyDown);
    this.unsubscribe?.();
    this.overlay.remove();
  }
}
