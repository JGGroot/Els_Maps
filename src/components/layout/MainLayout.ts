import { LAYOUT } from '@/constants';
import { getBreakpointState, onBreakpointChange } from '@/utils';
import type { BreakpointState } from '@/types';

export class MainLayout {
  private element: HTMLElement;
  private canvasArea: HTMLElement;
  private breakpointState: BreakpointState;
  private unsubscribeBreakpoint: (() => void) | null = null;

  constructor(container: HTMLElement) {
    this.breakpointState = getBreakpointState();

    this.element = document.createElement('div');
    this.element.className = 'main-layout w-full h-screen overflow-hidden bg-charcoal';

    this.canvasArea = document.createElement('main');
    this.canvasArea.className = 'canvas-area absolute bg-charcoal-dark';
    this.updateCanvasAreaPosition();

    this.element.appendChild(this.canvasArea);
    container.appendChild(this.element);

    this.unsubscribeBreakpoint = onBreakpointChange((state) => {
      this.breakpointState = state;
      this.updateCanvasAreaPosition();
    });
  }

  private updateCanvasAreaPosition(): void {
    if (this.breakpointState.isMobile) {
      this.canvasArea.style.cssText = `
        top: 0;
        left: 0;
        right: 0;
        bottom: ${LAYOUT.toolbarHeight}px;
      `;
    } else {
      this.canvasArea.style.cssText = `
        top: 0;
        left: ${LAYOUT.sidebarWidth}px;
        right: ${LAYOUT.sidebarWidth}px;
        bottom: 0;
      `;
    }
  }

  getElement(): HTMLElement {
    return this.element;
  }

  getCanvasArea(): HTMLElement {
    return this.canvasArea;
  }

  isMobile(): boolean {
    return this.breakpointState.isMobile;
  }

  destroy(): void {
    this.unsubscribeBreakpoint?.();
    this.element.remove();
  }
}
