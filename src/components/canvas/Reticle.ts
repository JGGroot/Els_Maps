import { LAYOUT } from '@/constants';

export class Reticle {
  private element: HTMLElement;

  constructor(parent: HTMLElement) {
    this.element = document.createElement('div');
    this.element.className = 'reticle fixed pointer-events-none z-action opacity-0';
    this.element.innerHTML = `
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
        <circle cx="12" cy="12" r="8" stroke-dasharray="4 2"/>
        <line x1="12" y1="0" x2="12" y2="6"/>
        <line x1="12" y1="18" x2="12" y2="24"/>
        <line x1="0" y1="12" x2="6" y2="12"/>
        <line x1="18" y1="12" x2="24" y2="12"/>
      </svg>
    `;
    this.element.style.cssText = `
      transform: translate(-50%, -50%);
      filter: drop-shadow(0 0 2px rgba(0,0,0,0.8));
      transition: opacity 0.1s ease-out;
    `;

    parent.appendChild(this.element);
  }

  update(x: number, y: number, visible: boolean): void {
    if (visible) {
      this.element.style.left = `${x}px`;
      this.element.style.top = `${y}px`;
      this.element.style.opacity = '1';
    } else {
      this.element.style.opacity = '0';
    }
  }

  getOffset(): number {
    return LAYOUT.reticleOffset;
  }

  destroy(): void {
    this.element.remove();
  }
}
