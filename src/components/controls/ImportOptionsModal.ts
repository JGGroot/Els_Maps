export type ColorMode = 'color' | 'grayscale';

export interface ImportOptionsResult {
  colorMode: ColorMode;
}

export class ImportOptionsModal {
  private overlay: HTMLDivElement;
  private colorBtn: HTMLButtonElement;
  private bwBtn: HTMLButtonElement;
  private cancelBtn: HTMLButtonElement;
  private resolve: ((value: ImportOptionsResult | null) => void) | null = null;

  constructor(parent: HTMLElement) {
    this.overlay = document.createElement('div');
    this.overlay.className = 'app-modal-overlay';
    this.overlay.setAttribute('aria-hidden', 'true');

    this.overlay.innerHTML = `
      <div class="app-modal-card" role="dialog" aria-modal="true" style="max-width: 320px;">
        <div class="app-modal-header">
          <h3 class="app-modal-title">Import Options</h3>
        </div>
        <div class="app-modal-body">
          <p style="margin-bottom: 16px; color: var(--text-muted);">How would you like to import this image?</p>
          <div class="import-options-buttons" style="display: flex; flex-direction: column; gap: 8px;">
            <button class="app-modal-btn import-option-color" type="button" style="display: flex; align-items: center; gap: 12px; padding: 12px 16px; justify-content: flex-start;">
              <span class="color-preview" style="width: 24px; height: 24px; border-radius: 4px; background: linear-gradient(135deg, #ff6b6b, #4ecdc4, #45b7d1); border: 1px solid var(--border);"></span>
              <span>Color</span>
            </button>
            <button class="app-modal-btn import-option-bw" type="button" style="display: flex; align-items: center; gap: 12px; padding: 12px 16px; justify-content: flex-start;">
              <span class="bw-preview" style="width: 24px; height: 24px; border-radius: 4px; background: linear-gradient(135deg, #333, #999, #fff); border: 1px solid var(--border);"></span>
              <span>Black & White</span>
            </button>
          </div>
        </div>
        <div class="app-modal-actions" style="margin-top: 16px;">
          <button class="app-modal-btn app-modal-btn-ghost import-option-cancel" type="button">Cancel</button>
        </div>
      </div>
    `;

    parent.appendChild(this.overlay);

    this.colorBtn = this.overlay.querySelector('.import-option-color') as HTMLButtonElement;
    this.bwBtn = this.overlay.querySelector('.import-option-bw') as HTMLButtonElement;
    this.cancelBtn = this.overlay.querySelector('.import-option-cancel') as HTMLButtonElement;

    this.colorBtn.addEventListener('click', () => this.close({ colorMode: 'color' }));
    this.bwBtn.addEventListener('click', () => this.close({ colorMode: 'grayscale' }));
    this.cancelBtn.addEventListener('click', () => this.close(null));
    this.overlay.addEventListener('click', (e) => {
      if (e.target === this.overlay) {
        this.close(null);
      }
    });
  }

  async open(): Promise<ImportOptionsResult | null> {
    if (this.resolve) {
      this.close(null);
    }

    this.overlay.classList.add('is-open');
    this.overlay.setAttribute('aria-hidden', 'false');

    const result = await new Promise<ImportOptionsResult | null>((resolve) => {
      this.resolve = resolve;
      window.addEventListener('keydown', this.handleKeydown);
      this.colorBtn.focus();
    });

    return result;
  }

  private handleKeydown = (e: KeyboardEvent): void => {
    if (!this.resolve) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      this.close(null);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      // Default to color on Enter
      this.close({ colorMode: 'color' });
    }
  };

  private close(result: ImportOptionsResult | null): void {
    if (!this.resolve) return;
    const resolve = this.resolve;
    this.resolve = null;

    window.removeEventListener('keydown', this.handleKeydown);
    this.overlay.classList.remove('is-open');
    this.overlay.setAttribute('aria-hidden', 'true');
    resolve(result);
  }
}
