import type { TouchPoint } from '@/types';
import { distance, midpoint } from '@/utils';

export class PointerTracker {
  private activePoints: Map<number, TouchPoint> = new Map();

  addPoint(touch: Touch): TouchPoint {
    const point: TouchPoint = {
      id: touch.identifier,
      x: touch.clientX,
      y: touch.clientY,
      timestamp: Date.now()
    };
    this.activePoints.set(touch.identifier, point);
    return point;
  }

  updatePoint(touch: Touch): TouchPoint | null {
    const existing = this.activePoints.get(touch.identifier);
    if (!existing) return null;

    const updated: TouchPoint = {
      id: touch.identifier,
      x: touch.clientX,
      y: touch.clientY,
      timestamp: Date.now()
    };
    this.activePoints.set(touch.identifier, updated);
    return updated;
  }

  removePoint(touchId: number): TouchPoint | null {
    const point = this.activePoints.get(touchId);
    this.activePoints.delete(touchId);
    return point ?? null;
  }

  getPoint(touchId: number): TouchPoint | null {
    return this.activePoints.get(touchId) ?? null;
  }

  getAllPoints(): TouchPoint[] {
    return Array.from(this.activePoints.values());
  }

  getPointCount(): number {
    return this.activePoints.size;
  }

  clear(): void {
    this.activePoints.clear();
  }

  getDistance(): number {
    const points = this.getAllPoints();
    if (points.length < 2) return 0;
    return distance(points[0].x, points[0].y, points[1].x, points[1].y);
  }

  getCenter(): { x: number; y: number } {
    const points = this.getAllPoints();
    if (points.length === 0) return { x: 0, y: 0 };
    if (points.length === 1) return { x: points[0].x, y: points[0].y };
    return midpoint(points[0].x, points[0].y, points[1].x, points[1].y);
  }

  getPrimaryPoint(): TouchPoint | null {
    const points = this.getAllPoints();
    return points[0] ?? null;
  }
}
