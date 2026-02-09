import { LAYOUT } from '@/constants';
export class MainLayout {
  private element: HTMLElement;
  private canvasArea: HTMLElement;

  constructor(container: HTMLElement) {
    this.element = document.createElement('div');
    this.element.className = 'main-layout w-full h-screen overflow-hidden bg-charcoal';

    this.canvasArea = document.createElement('main');
    this.canvasArea.className = 'canvas-area absolute bg-charcoal-dark';
    this.canvasArea.style.cssText = `
      top: 0;
      left: ${LAYOUT.sidebarWidth}px;
      right: ${LAYOUT.sidebarWidth}px;
      bottom: 0;
    `;

    this.element.appendChild(this.canvasArea);
    container.appendChild(this.element);
  }

  getElement(): HTMLElement {
    return this.element;
  }

  getCanvasArea(): HTMLElement {
    return this.canvasArea;
  }

  destroy(): void {
    this.element.remove();
  }
}
