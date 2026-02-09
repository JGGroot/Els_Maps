import { Path, Polyline, Point } from 'fabric';
import type { FabricObject, TMat2D } from 'fabric';

export interface PathSegment {
  cp1: Point;
  cp2: Point;
  end: Point;
}

export interface PathShape {
  start: Point;
  segments: PathSegment[];
}

export interface MergeTarget {
  object: FabricObject;
  type: 'start' | 'end';
}

function getPathOffset(obj: FabricObject): Point {
  const offset = (obj as any).pathOffset;
  if (!offset) return new Point(0, 0);
  return offset instanceof Point ? offset : new Point(offset.x ?? 0, offset.y ?? 0);
}

function transformPoint(x: number, y: number, matrix: TMat2D, offset: Point): Point {
  const localX = x - offset.x;
  const localY = y - offset.y;
  return new Point(
    matrix[0] * localX + matrix[2] * localY + matrix[4],
    matrix[1] * localX + matrix[3] * localY + matrix[5]
  );
}

function lineSegment(end: Point): PathSegment {
  return { cp1: end, cp2: end, end };
}

function getPathShapeFromPath(path: Path): PathShape | null {
  if (!path.path || path.path.length === 0) return null;

  const matrix = path.calcTransformMatrix();
  const offset = getPathOffset(path);
  let start: Point | null = null;
  let current: Point | null = null;
  const segments: PathSegment[] = [];

  for (const segment of path.path) {
    const cmd = segment[0];

    if (cmd === 'M') {
      const p = transformPoint(segment[1] as number, segment[2] as number, matrix, offset);
      if (!start) {
        start = p;
      }
      current = p;
      continue;
    }

    if (!current) continue;

    if (cmd === 'L') {
      const end = transformPoint(segment[1] as number, segment[2] as number, matrix, offset);
      segments.push(lineSegment(end));
      current = end;
      continue;
    }

    if (cmd === 'C') {
      const cp1 = transformPoint(segment[1] as number, segment[2] as number, matrix, offset);
      const cp2 = transformPoint(segment[3] as number, segment[4] as number, matrix, offset);
      const end = transformPoint(segment[5] as number, segment[6] as number, matrix, offset);
      segments.push({ cp1, cp2, end });
      current = end;
      continue;
    }

    if (cmd === 'Q') {
      const ctrl = transformPoint(segment[1] as number, segment[2] as number, matrix, offset);
      const end = transformPoint(segment[3] as number, segment[4] as number, matrix, offset);
      const cp1 = new Point(
        current.x + (2 / 3) * (ctrl.x - current.x),
        current.y + (2 / 3) * (ctrl.y - current.y)
      );
      const cp2 = new Point(
        end.x + (2 / 3) * (ctrl.x - end.x),
        end.y + (2 / 3) * (ctrl.y - end.y)
      );
      segments.push({ cp1, cp2, end });
      current = end;
      continue;
    }

    if (cmd === 'Z' || cmd === 'z') {
      if (start) {
        segments.push(lineSegment(start));
        current = start;
      }
      continue;
    }
  }

  if (!start) return null;
  return { start, segments };
}

function getPathShapeFromPolyline(polyline: Polyline): PathShape | null {
  const points = polyline.points ?? [];
  if (points.length === 0) return null;

  const matrix = polyline.calcTransformMatrix();
  const offset = getPathOffset(polyline);
  const canvasPoints = points.map((pt) =>
    transformPoint(pt.x as number, pt.y as number, matrix, offset)
  );

  const start = canvasPoints[0];
  const segments = canvasPoints.slice(1).map((pt) => lineSegment(pt));
  return { start, segments };
}

export function getPathShapeFromObject(obj: FabricObject): PathShape | null {
  if (obj instanceof Path) {
    return getPathShapeFromPath(obj);
  }
  if (obj instanceof Polyline) {
    return getPathShapeFromPolyline(obj);
  }
  return null;
}

export function buildPathString(shape: PathShape): string {
  if (shape.segments.length === 0) {
    return `M ${shape.start.x} ${shape.start.y}`;
  }

  let path = `M ${shape.start.x} ${shape.start.y}`;
  for (const seg of shape.segments) {
    path += ` C ${seg.cp1.x} ${seg.cp1.y}, ${seg.cp2.x} ${seg.cp2.y}, ${seg.end.x} ${seg.end.y}`;
  }
  return path;
}

export function getPathEnd(shape: PathShape): Point {
  if (shape.segments.length === 0) {
    return shape.start;
  }
  return shape.segments[shape.segments.length - 1].end;
}

export function isSamePoint(a: Point, b: Point, epsilon: number = 0.001): boolean {
  return Math.hypot(a.x - b.x, a.y - b.y) <= epsilon;
}

export function reversePathShape(shape: PathShape): PathShape {
  if (shape.segments.length === 0) {
    return { start: shape.start, segments: [] };
  }

  const starts: Point[] = [shape.start];
  for (const seg of shape.segments) {
    starts.push(seg.end);
  }

  const reversedSegments: PathSegment[] = [];
  for (let i = shape.segments.length - 1; i >= 0; i -= 1) {
    const seg = shape.segments[i];
    const start = starts[i];
    reversedSegments.push({
      cp1: seg.cp2,
      cp2: seg.cp1,
      end: start
    });
  }

  const newStart = shape.segments[shape.segments.length - 1].end;
  return { start: newStart, segments: reversedSegments };
}

export function mergePathShapeWithTargets(
  newShape: PathShape,
  startTarget?: MergeTarget | null,
  endTarget?: MergeTarget | null
): { shape: PathShape; remove: FabricObject[] } | null {
  const startShape = startTarget ? getPathShapeFromObject(startTarget.object) : null;
  const endShape = endTarget ? getPathShapeFromObject(endTarget.object) : null;

  if (!startShape && !endShape) {
    return null;
  }

  const remove: FabricObject[] = [];

  if (startTarget && endTarget && startTarget.object === endTarget.object && startShape) {
    let existing = startShape;

    if (startTarget.type === 'start') {
      existing = reversePathShape(existing);
    }

    let orientedNew = newShape;
    if (!isSamePoint(getPathEnd(existing), orientedNew.start)) {
      const reversed = reversePathShape(orientedNew);
      if (isSamePoint(getPathEnd(existing), reversed.start)) {
        orientedNew = reversed;
      }
    }

    remove.push(startTarget.object);
    return {
      shape: {
        start: existing.start,
        segments: [...existing.segments, ...orientedNew.segments]
      },
      remove
    };
  }

  let merged = newShape;

  if (startTarget && startShape) {
    let oriented = startShape;
    if (startTarget.type === 'start') {
      oriented = reversePathShape(oriented);
    }

    merged = {
      start: oriented.start,
      segments: [...oriented.segments, ...merged.segments]
    };

    remove.push(startTarget.object);
  }

  if (endTarget && endShape) {
    let oriented = endShape;
    if (endTarget.type === 'end') {
      oriented = reversePathShape(oriented);
    }

    merged = {
      start: merged.start,
      segments: [...merged.segments, ...oriented.segments]
    };

    remove.push(endTarget.object);
  }

  return { shape: merged, remove };
}
