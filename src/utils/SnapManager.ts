import { Path, Polyline, Line, Point, type Canvas, type FabricObject } from 'fabric';

export interface SnapPoint {
  x: number;
  y: number;
  objectId: string;
  type: 'start' | 'end';
  object?: FabricObject;
}

export interface SnapResult {
  snapped: boolean;
  point: Point;
  snapPoint?: SnapPoint;
}

export class SnapManager {
  private canvas: Canvas | null = null;
  private snapThreshold: number = 25;
  private enabled: boolean = true;
  private indicator: { x: number; y: number; visible: boolean } = {
    x: 0,
    y: 0,
    visible: false
  };
  private indicatorEl: HTMLDivElement | null = null;
  private indicatorHost: HTMLElement | null = null;
  private afterRenderHandler: (() => void) | null = null;

  setCanvas(canvas: Canvas): void {
    if (this.canvas && this.canvas !== canvas) {
      this.detachIndicator();
    }
    this.canvas = canvas;
    this.ensureIndicatorHost();
    this.attachAfterRender();
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  setThreshold(threshold: number): void {
    this.snapThreshold = threshold;
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  getAdjustedThreshold(): number {
    const zoom = this.canvas?.getZoom() ?? 1;
    return this.snapThreshold / zoom;
  }

  findNearestEndpoint(point: Point, excludeObject?: FabricObject): SnapResult {
    if (!this.enabled || !this.canvas) {
      return { snapped: false, point };
    }

    // Adjust threshold for zoom level so snapping feels consistent on screen
    const zoom = this.canvas.getZoom();
    const adjustedThreshold = this.snapThreshold / zoom;

    const endpoints = this.collectEndpoints(excludeObject);
    let nearestPoint: SnapPoint | null = null;
    let nearestDistance = Infinity;

    for (const ep of endpoints) {
      const dist = Math.hypot(point.x - ep.x, point.y - ep.y);
      if (dist < nearestDistance && dist <= adjustedThreshold) {
        nearestDistance = dist;
        nearestPoint = ep;
      }
    }

    if (nearestPoint) {
      return {
        snapped: true,
        point: new Point(nearestPoint.x, nearestPoint.y),
        snapPoint: nearestPoint
      };
    }

    return { snapped: false, point };
  }

  private collectEndpoints(excludeObject?: FabricObject): SnapPoint[] {
    if (!this.canvas) return [];

    const endpoints: SnapPoint[] = [];
    const objects = this.canvas.getObjects();

    for (const obj of objects) {
      if (excludeObject && obj === excludeObject) continue;
      if ((obj as any).isHelper) continue;
      // Include all objects, not just selectable ones (tools disable selectability)
      
      const id = (obj as any).id || String(objects.indexOf(obj));
      const pathOffset = (obj as any).pathOffset ?? { x: 0, y: 0 };

      if (obj instanceof Polyline && obj.points && obj.points.length > 0) {
        const points = obj.points;
        const matrix = obj.calcTransformMatrix();

        // Start point
        const startLocal = points[0];
        const start = this.transformPoint(
          startLocal.x - pathOffset.x,
          startLocal.y - pathOffset.y,
          matrix
        );
        endpoints.push({ x: start.x, y: start.y, objectId: id, type: 'start', object: obj });

        // End point
        if (points.length > 1) {
          const endLocal = points[points.length - 1];
          const end = this.transformPoint(
            endLocal.x - pathOffset.x,
            endLocal.y - pathOffset.y,
            matrix
          );
          endpoints.push({ x: end.x, y: end.y, objectId: id, type: 'end', object: obj });
        }
      } else if (obj instanceof Path && obj.path && obj.path.length > 0) {
        const pathData = obj.path;
        const matrix = obj.calcTransformMatrix();

        // Get start point (first M command)
        const firstCmd = pathData[0];
        if (firstCmd[0] === 'M') {
          const start = this.transformPoint(
            (firstCmd[1] as number) - pathOffset.x,
            (firstCmd[2] as number) - pathOffset.y,
            matrix
          );
          endpoints.push({ x: start.x, y: start.y, objectId: id, type: 'start', object: obj });
        }

        // Get end point (last command's end point)
        const lastCmd = pathData[pathData.length - 1];
        const endPoint = this.getEndPointFromPathCommand(lastCmd);
        if (endPoint) {
          const end = this.transformPoint(
            endPoint.x - pathOffset.x,
            endPoint.y - pathOffset.y,
            matrix
          );
          endpoints.push({ x: end.x, y: end.y, objectId: id, type: 'end', object: obj });
        }
      } else if (obj instanceof Line) {
        const matrix = obj.calcTransformMatrix();
        const x1 = obj.x1 ?? 0;
        const y1 = obj.y1 ?? 0;
        const x2 = obj.x2 ?? 0;
        const y2 = obj.y2 ?? 0;

        const start = this.transformPoint(x1, y1, matrix);
        const end = this.transformPoint(x2, y2, matrix);

        endpoints.push({ x: start.x, y: start.y, objectId: id, type: 'start', object: obj });
        endpoints.push({ x: end.x, y: end.y, objectId: id, type: 'end', object: obj });
      }
    }

    return endpoints;
  }

  private getEndPointFromPathCommand(cmd: any[]): { x: number; y: number } | null {
    const type = cmd[0];
    switch (type) {
      case 'M':
      case 'L':
        return { x: cmd[1], y: cmd[2] };
      case 'C':
        return { x: cmd[5], y: cmd[6] };
      case 'Q':
        return { x: cmd[3], y: cmd[4] };
      case 'S':
        return { x: cmd[3], y: cmd[4] };
      case 'T':
        return { x: cmd[1], y: cmd[2] };
      case 'A':
        return { x: cmd[6], y: cmd[7] };
      case 'Z':
      case 'z':
        return null; // Closed path, would need first point
      default:
        return null;
    }
  }

  private transformPoint(x: number, y: number, matrix: number[]): { x: number; y: number } {
    return {
      x: matrix[0] * x + matrix[2] * y + matrix[4],
      y: matrix[1] * x + matrix[3] * y + matrix[5]
    };
  }

  getVisualSnapIndicator(snapPoint: SnapPoint): { x: number; y: number; radius: number } {
    return {
      x: snapPoint.x,
      y: snapPoint.y,
      radius: this.snapThreshold
    };
  }

  getSnapIndicatorStyle(): { radius: number; strokeWidth: number } {
    const zoom = this.canvas?.getZoom() ?? 1;
    const zoomBoost = Math.min(10, Math.max(0, Math.log2(zoom) * 3));
    const screenRadius = Math.max(12, 12 + zoomBoost);
    const screenStroke = Math.max(2.5, 2.5 + Math.min(2, Math.max(0, Math.log2(zoom) * 0.6)));

    return {
      radius: screenRadius / zoom,
      strokeWidth: screenStroke / zoom
    };
  }

  showSnapIndicator(x: number, y: number): void {
    this.indicator = { x, y, visible: true };
    this.renderSnapIndicator();
  }

  hideSnapIndicator(): void {
    this.indicator.visible = false;
    this.renderSnapIndicator();
  }

  private attachAfterRender(): void {
    if (!this.canvas || this.afterRenderHandler) return;
    this.afterRenderHandler = () => this.renderSnapIndicator();
    this.canvas.on('after:render', this.afterRenderHandler);
  }

  private detachIndicator(): void {
    if (this.canvas && this.afterRenderHandler) {
      this.canvas.off('after:render', this.afterRenderHandler);
    }
    this.afterRenderHandler = null;
    this.indicatorEl?.remove();
    this.indicatorEl = null;
    this.indicatorHost = null;
  }

  private ensureIndicatorHost(): void {
    if (!this.canvas) return;
    const wrapper = (this.canvas as any).wrapperEl as HTMLElement | undefined;
    const host = wrapper ?? (this.canvas as any).upperCanvasEl?.parentElement ?? null;
    if (!host) return;
    this.indicatorHost = host;

    if (!this.indicatorEl) {
      if (!host.style.position) {
        host.style.position = 'relative';
      }
      const el = document.createElement('div');
      el.style.position = 'absolute';
      el.style.left = '0';
      el.style.top = '0';
      el.style.width = '0';
      el.style.height = '0';
      el.style.borderRadius = '50%';
      el.style.border = '2px solid #4a9eff';
      el.style.background = 'rgba(74, 158, 255, 0.15)';
      el.style.transform = 'translate(-50%, -50%)';
      el.style.pointerEvents = 'none';
      el.style.zIndex = '50';
      el.style.display = 'none';
      this.indicatorEl = el;
      host.appendChild(el);
    }
  }

  private renderSnapIndicator(): void {
    if (!this.canvas || !this.indicatorEl) return;
    if (!this.indicator.visible) {
      this.indicatorEl.style.display = 'none';
      return;
    }

    const vt = this.canvas.viewportTransform ?? [1, 0, 0, 1, 0, 0];
    const screenX = vt[0] * this.indicator.x + vt[2] * this.indicator.y + vt[4];
    const screenY = vt[1] * this.indicator.x + vt[3] * this.indicator.y + vt[5];

    const zoom = this.canvas.getZoom() ?? 1;
    const { radius, strokeWidth } = this.getSnapIndicatorStyle();
    const radiusPx = radius * zoom;
    const strokePx = strokeWidth * zoom;

    this.indicatorEl.style.display = 'block';
    this.indicatorEl.style.left = `${screenX}px`;
    this.indicatorEl.style.top = `${screenY}px`;
    this.indicatorEl.style.width = `${radiusPx * 2}px`;
    this.indicatorEl.style.height = `${radiusPx * 2}px`;
    this.indicatorEl.style.borderWidth = `${strokePx}px`;
  }
}

// Singleton instance
export const snapManager = new SnapManager();
