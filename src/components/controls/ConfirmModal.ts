export interface ConfirmModalOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'default' | 'danger';
}

export class ConfirmModal {
  private overlay: HTMLDivElement;
  private titleEl: HTMLElement;
  private messageEl: HTMLElement;
  private confirmBtn: HTMLButtonElement;
  private cancelBtn: HTMLButtonElement;
  private resolve: ((value: boolean) => void) | null = null;

  constructor(parent: HTMLElement) {
    this.overlay = document.createElement('div');
    this.overlay.className = 'app-modal-overlay';
    this.overlay.setAttribute('aria-hidden', 'true');

    this.overlay.innerHTML = `
      <div class="app-modal-card" role="dialog" aria-modal="true">
        <div class="app-modal-header">
          <h3 class="app-modal-title"></h3>
        </div>
        <div class="app-modal-body"></div>
        <div class="app-modal-actions">
          <button class="app-modal-btn app-modal-btn-ghost" type="button"></button>
          <button class="app-modal-btn app-modal-btn-primary" type="button"></button>
        </div>
      </div>
    `;

    parent.appendChild(this.overlay);

    this.titleEl = this.overlay.querySelector('.app-modal-title') as HTMLElement;
    this.messageEl = this.overlay.querySelector('.app-modal-body') as HTMLElement;
    const buttons = this.overlay.querySelectorAll('.app-modal-actions button');
    this.cancelBtn = buttons[0] as HTMLButtonElement;
    this.confirmBtn = buttons[1] as HTMLButtonElement;

    this.cancelBtn.addEventListener('click', () => this.close(false));
    this.confirmBtn.addEventListener('click', () => this.close(true));
    this.overlay.addEventListener('click', (e) => {
      if (e.target === this.overlay) {
        this.close(false);
      }
    });
  }

  async open(options: ConfirmModalOptions): Promise<boolean> {
    if (this.resolve) {
      this.close(false);
    }

    this.titleEl.textContent = options.title;
    this.messageEl.textContent = options.message;
    this.confirmBtn.textContent = options.confirmLabel ?? 'Confirm';
    this.cancelBtn.textContent = options.cancelLabel ?? 'Cancel';

    this.confirmBtn.classList.toggle('app-modal-btn-danger', options.tone === 'danger');
    this.confirmBtn.classList.toggle('app-modal-btn-primary', options.tone !== 'danger');

    this.overlay.classList.add('is-open');
    this.overlay.setAttribute('aria-hidden', 'false');

    const result = await new Promise<boolean>((resolve) => {
      this.resolve = resolve;
      window.addEventListener('keydown', this.handleKeydown);
      this.confirmBtn.focus();
    });

    return result;
  }

  private handleKeydown = (e: KeyboardEvent): void => {
    if (!this.resolve) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      this.close(false);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      this.close(true);
    }
  };

  private close(result: boolean): void {
    if (!this.resolve) return;
    const resolve = this.resolve;
    this.resolve = null;

    window.removeEventListener('keydown', this.handleKeydown);
    this.overlay.classList.remove('is-open');
    this.overlay.setAttribute('aria-hidden', 'true');
    resolve(result);
  }
}
