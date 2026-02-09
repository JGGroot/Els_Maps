export type UnsavedChoice = 'save' | 'discard' | 'cancel';

export class UnsavedChangesModal {
  private overlay: HTMLDivElement;
  private titleEl: HTMLElement;
  private messageEl: HTMLElement;
  private saveBtn: HTMLButtonElement;
  private discardBtn: HTMLButtonElement;
  private cancelBtn: HTMLButtonElement;
  private resolve: ((value: UnsavedChoice) => void) | null = null;

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
        <div class="app-modal-actions app-modal-actions-extended">
          <button class="app-modal-btn app-modal-btn-ghost" type="button"></button>
          <button class="app-modal-btn app-modal-btn-danger" type="button"></button>
          <button class="app-modal-btn app-modal-btn-primary" type="button"></button>
        </div>
      </div>
    `;

    parent.appendChild(this.overlay);

    this.titleEl = this.overlay.querySelector('.app-modal-title') as HTMLElement;
    this.messageEl = this.overlay.querySelector('.app-modal-body') as HTMLElement;
    const buttons = this.overlay.querySelectorAll('.app-modal-actions button');
    this.cancelBtn = buttons[0] as HTMLButtonElement;
    this.discardBtn = buttons[1] as HTMLButtonElement;
    this.saveBtn = buttons[2] as HTMLButtonElement;

    this.cancelBtn.addEventListener('click', () => this.close('cancel'));
    this.discardBtn.addEventListener('click', () => this.close('discard'));
    this.saveBtn.addEventListener('click', () => this.close('save'));
    this.overlay.addEventListener('click', (e) => {
      if (e.target === this.overlay) {
        this.close('cancel');
      }
    });
  }

  async open(): Promise<UnsavedChoice> {
    if (this.resolve) {
      this.close('cancel');
    }

    this.titleEl.textContent = 'Unsaved changes';
    this.messageEl.textContent = 'Save your work before opening another project?';
    this.saveBtn.textContent = 'Save & Continue';
    this.discardBtn.textContent = 'Discard';
    this.cancelBtn.textContent = 'Cancel';

    this.overlay.classList.add('is-open');
    this.overlay.setAttribute('aria-hidden', 'false');

    const result = await new Promise<UnsavedChoice>((resolve) => {
      this.resolve = resolve;
      window.addEventListener('keydown', this.handleKeydown);
      this.saveBtn.focus();
    });

    return result;
  }

  private handleKeydown = (e: KeyboardEvent): void => {
    if (!this.resolve) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      this.close('cancel');
    } else if (e.key === 'Enter') {
      e.preventDefault();
      this.close('save');
    }
  };

  private close(choice: UnsavedChoice): void {
    if (!this.resolve) return;
    const resolve = this.resolve;
    this.resolve = null;

    window.removeEventListener('keydown', this.handleKeydown);
    this.overlay.classList.remove('is-open');
    this.overlay.setAttribute('aria-hidden', 'true');
    resolve(choice);
  }
}
