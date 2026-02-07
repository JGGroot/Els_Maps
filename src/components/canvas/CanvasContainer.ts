import { CanvasEngine } from '@/canvas';

export class CanvasContainer {
  private element: HTMLElement;
  private engine: CanvasEngine;

  constructor(parent: HTMLElement) {
    this.element = document.createElement('div');
    this.element.className = 'canvas-container absolute inset-0 z-canvas no-select';
    this.element.style.cssText = `
      touch-action: none;
      -webkit-touch-callout: none;
      -webkit-user-select: none;
      user-select: none;
    `;

    parent.appendChild(this.element);
    this.engine = CanvasEngine.getInstance();
  }

  async init(): Promise<CanvasEngine> {
    await this.engine.initialize(this.element);
    return this.engine;
  }

  getElement(): HTMLElement {
    return this.element;
  }

  getEngine(): CanvasEngine {
    return this.engine;
  }

  destroy(): void {
    this.engine.dispose();
    this.element.remove();
  }
}
