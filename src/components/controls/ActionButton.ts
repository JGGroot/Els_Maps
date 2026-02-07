import { LAYOUT } from '@/constants';
import type { ActionButtonMode } from '@/types';

export interface ActionButtonCallbacks {
  onConfirm: () => void;
  onCancel: () => void;
}

export class ActionButton {
  private element: HTMLElement;
  private confirmBtn: HTMLButtonElement;
  private cancelBtn: HTMLButtonElement;
  private callbacks: ActionButtonCallbacks;

  constructor(parent: HTMLElement, callbacks: ActionButtonCallbacks) {
    this.callbacks = callbacks;

    this.element = document.createElement('div');
    this.element.className = 'fixed z-action flex gap-3 opacity-0 pointer-events-none transition-opacity duration-200';
    this.element.style.cssText = `
      right: ${LAYOUT.actionButtonMargin}px;
      bottom: ${LAYOUT.toolbarHeight + LAYOUT.actionButtonMargin}px;
    `;

    this.cancelBtn = this.createButton('cancel', 'Cancel', this.onCancelClick);
    this.confirmBtn = this.createButton('confirm', 'Done', this.onConfirmClick);

    this.element.appendChild(this.cancelBtn);
    this.element.appendChild(this.confirmBtn);
    parent.appendChild(this.element);
  }

  private createButton(
    type: 'confirm' | 'cancel',
    label: string,
    onClick: () => void
  ): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.className = `
      flex items-center justify-center rounded-full shadow-lg
      ${type === 'confirm' ? 'bg-accent text-white' : 'bg-surface text-white border border-border'}
    `;
    btn.style.cssText = `
      width: ${LAYOUT.actionButtonSize}px;
      height: ${LAYOUT.actionButtonSize}px;
      min-width: ${LAYOUT.minTouchTarget}px;
      min-height: ${LAYOUT.minTouchTarget}px;
    `;

    const icon = type === 'confirm' ? this.getCheckIcon() : this.getXIcon();
    btn.innerHTML = icon;
    btn.setAttribute('aria-label', label);
    btn.addEventListener('click', onClick);

    return btn;
  }

  private getCheckIcon(): string {
    return `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <polyline points="20 6 9 17 4 12"></polyline>
    </svg>`;
  }

  private getXIcon(): string {
    return `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <line x1="18" y1="6" x2="6" y2="18"></line>
      <line x1="6" y1="6" x2="18" y2="18"></line>
    </svg>`;
  }

  private onConfirmClick = (): void => {
    this.callbacks.onConfirm();
  };

  private onCancelClick = (): void => {
    this.callbacks.onCancel();
  };

  show(mode: ActionButtonMode): void {
    this.element.style.opacity = '1';
    this.element.style.pointerEvents = 'auto';

    this.confirmBtn.style.display = mode === 'cancel' ? 'none' : 'flex';
    this.cancelBtn.style.display = mode === 'confirm' ? 'none' : 'flex';
  }

  hide(): void {
    this.element.style.opacity = '0';
    this.element.style.pointerEvents = 'none';
  }

  destroy(): void {
    this.confirmBtn.removeEventListener('click', this.onConfirmClick);
    this.cancelBtn.removeEventListener('click', this.onCancelClick);
    this.element.remove();
  }
}
