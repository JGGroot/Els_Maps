export interface TextInputModalOptions {
  title: string;
  message?: string;
  placeholder?: string;
  initialValue?: string;
  confirmLabel?: string;
  cancelLabel?: string;
}

export class TextInputModal {
  private overlay: HTMLDivElement;
  private titleEl: HTMLElement;
  private messageEl: HTMLElement;
  private inputEl: HTMLInputElement;
  private confirmBtn: HTMLButtonElement;
  private cancelBtn: HTMLButtonElement;
  private resolve: ((value: string | null) => void) | null = null;

  constructor(parent: HTMLElement) {
    this.overlay = document.createElement('div');
    this.overlay.className = 'app-modal-overlay';
    this.overlay.setAttribute('aria-hidden', 'true');

    this.overlay.innerHTML = `
      <div class="app-modal-card" role="dialog" aria-modal="true">
        <div class="app-modal-header">
          <h3 class="app-modal-title"></h3>
        </div>
        <div class="app-modal-body">
          <p class="app-modal-message"></p>
          <input class="app-modal-input" type="text" />
        </div>
        <div class="app-modal-actions">
          <button class="app-modal-btn app-modal-btn-ghost" type="button"></button>
          <button class="app-modal-btn app-modal-btn-primary" type="button"></button>
        </div>
      </div>
    `;

    parent.appendChild(this.overlay);

    this.titleEl = this.overlay.querySelector('.app-modal-title') as HTMLElement;
    this.messageEl = this.overlay.querySelector('.app-modal-message') as HTMLElement;
    this.inputEl = this.overlay.querySelector('.app-modal-input') as HTMLInputElement;
    const buttons = this.overlay.querySelectorAll('.app-modal-actions button');
    this.cancelBtn = buttons[0] as HTMLButtonElement;
    this.confirmBtn = buttons[1] as HTMLButtonElement;

    this.cancelBtn.addEventListener('click', () => this.close(null));
    this.confirmBtn.addEventListener('click', () => this.close(this.inputEl.value));
    this.overlay.addEventListener('click', (e) => {
      if (e.target === this.overlay) {
        this.close(null);
      }
    });
  }

  async open(options: TextInputModalOptions): Promise<string | null> {
    if (this.resolve) {
      this.close(null);
    }

    this.titleEl.textContent = options.title;
    this.messageEl.textContent = options.message ?? '';
    this.messageEl.style.display = options.message ? 'block' : 'none';
    this.inputEl.placeholder = options.placeholder ?? '';
    this.inputEl.value = options.initialValue ?? '';
    this.confirmBtn.textContent = options.confirmLabel ?? 'Save';
    this.cancelBtn.textContent = options.cancelLabel ?? 'Cancel';

    this.overlay.classList.add('is-open');
    this.overlay.setAttribute('aria-hidden', 'false');

    const result = await new Promise<string | null>((resolve) => {
      this.resolve = resolve;
      window.addEventListener('keydown', this.handleKeydown);
      this.inputEl.focus();
      this.inputEl.select();
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
      this.close(this.inputEl.value);
    }
  };

  private close(value: string | null): void {
    if (!this.resolve) return;
    const resolve = this.resolve;
    this.resolve = null;

    window.removeEventListener('keydown', this.handleKeydown);
    this.overlay.classList.remove('is-open');
    this.overlay.setAttribute('aria-hidden', 'true');
    resolve(value);
  }
}
