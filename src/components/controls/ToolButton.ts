import type { ToolType } from '@/types';
import { LAYOUT } from '@/constants';

export interface ToolButtonConfig {
  type: ToolType;
  name: string;
  icon: string;
}

export class ToolButton {
  private element: HTMLButtonElement;
  private type: ToolType;
  private onClick: (type: ToolType) => void;

  constructor(
    config: ToolButtonConfig,
    onClick: (type: ToolType) => void,
    isActive: boolean = false
  ) {
    this.type = config.type;
    this.onClick = onClick;

    this.element = document.createElement('button');
    this.element.className = `
      flex items-center justify-center rounded-lg transition-colors
      hover:bg-charcoal-light
      ${isActive ? 'bg-accent text-white' : 'bg-transparent text-white'}
    `;
    this.element.style.cssText = `
      width: ${LAYOUT.minTouchTarget}px;
      height: ${LAYOUT.minTouchTarget}px;
    `;
    this.element.innerHTML = this.getIcon(config.icon);
    this.element.setAttribute('aria-label', config.name);
    this.element.setAttribute('title', config.name);

    this.element.addEventListener('click', this.handleClick);
  }

  private getIcon(iconName: string): string {
    const icons: Record<string, string> = {
      cursor: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z"/>
        <path d="M13 13l6 6"/>
      </svg>`,
      hand: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M18 11V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v0"/>
        <path d="M14 10V4a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v2"/>
        <path d="M10 10.5V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v8"/>
        <path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15"/>
      </svg>`,
      line: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <line x1="4" y1="20" x2="20" y2="4"/>
        <circle cx="4" cy="20" r="2" fill="currentColor"/>
        <circle cx="20" cy="4" r="2" fill="currentColor"/>
      </svg>`,
      bezier: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M2 20 C 8 6, 16 6, 22 20"/>
        <line x1="2" y1="20" x2="8" y2="6" stroke-dasharray="2 2"/>
        <line x1="22" y1="20" x2="16" y2="6" stroke-dasharray="2 2"/>
        <circle cx="2" cy="20" r="2" fill="currentColor"/>
        <circle cx="22" cy="20" r="2" fill="currentColor"/>
        <circle cx="8" cy="6" r="2"/>
        <circle cx="16" cy="6" r="2"/>
      </svg>`,
      autospline: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M2 18 Q 7 4, 12 12 T 22 6"/>
        <circle cx="2" cy="18" r="2" fill="currentColor"/>
        <circle cx="12" cy="12" r="2" fill="currentColor"/>
        <circle cx="22" cy="6" r="2" fill="currentColor"/>
      </svg>`,
      tspline: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M3 17c3.333-3.333 6.667-10 10-10s6.667 6.667 10 10"/>
        <circle cx="3" cy="17" r="2" fill="currentColor"/>
        <circle cx="13" cy="7" r="2" fill="currentColor"/>
        <circle cx="21" cy="17" r="2" fill="currentColor"/>
      </svg>`,
      rectangle: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <rect x="3" y="5" width="18" height="14" rx="2"/>
      </svg>`,
      ellipse: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <ellipse cx="12" cy="12" rx="10" ry="7"/>
      </svg>`,
      abc: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <text x="2" y="16" font-family="sans-serif" font-size="12" font-weight="bold" fill="currentColor" stroke="none">Abc</text>
      </svg>`,
      edit: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
      </svg>`,
      'edit-nodes': `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M4 18 Q 12 6, 20 18"/>
        <rect x="2" y="16" width="4" height="4" fill="currentColor" stroke="currentColor"/>
        <rect x="18" y="16" width="4" height="4" fill="currentColor" stroke="currentColor"/>
        <circle cx="12" cy="10" r="3" fill="none" stroke="currentColor"/>
      </svg>`
    };

    return icons[iconName] || icons.cursor;
  }

  private handleClick = (): void => {
    this.onClick(this.type);
  };

  setActive(active: boolean): void {
    if (active) {
      this.element.classList.remove('bg-transparent');
      this.element.classList.add('bg-accent');
    } else {
      this.element.classList.remove('bg-accent');
      this.element.classList.add('bg-transparent');
    }
  }

  getElement(): HTMLButtonElement {
    return this.element;
  }

  destroy(): void {
    this.element.removeEventListener('click', this.handleClick);
    this.element.remove();
  }
}
