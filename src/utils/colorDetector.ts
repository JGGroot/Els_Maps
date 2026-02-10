import type { Canvas, FabricObject } from 'fabric';

export interface DetectedColor {
  color: string;
  label: string;
  count: number;
}

/**
 * Detects all unique colors used on the canvas
 * Returns colors sorted by usage count (most used first)
 */
export function detectCanvasColors(canvas: Canvas): DetectedColor[] {
  const colorMap = new Map<string, number>();

  canvas.forEachObject((obj: FabricObject) => {
    // Skip helper objects and legend groups
    if ((obj as any).isHelper || (obj as any).__elsLegend) return;

    // Get stroke color
    const stroke = obj.stroke;
    if (stroke && stroke !== 'transparent' && typeof stroke === 'string') {
      const normalized = normalizeColor(stroke);
      if (normalized) {
        colorMap.set(normalized, (colorMap.get(normalized) ?? 0) + 1);
      }
    }

    // Get fill color
    const fill = obj.fill;
    if (fill && fill !== 'transparent' && typeof fill === 'string') {
      const normalized = normalizeColor(fill);
      if (normalized) {
        colorMap.set(normalized, (colorMap.get(normalized) ?? 0) + 1);
      }
    }
  });

  // Convert to array and sort by count
  const colors: DetectedColor[] = Array.from(colorMap.entries())
    .map(([color, count]) => ({
      color,
      label: getDefaultLabel(color),
      count
    }))
    .sort((a, b) => b.count - a.count);

  return colors;
}

/**
 * Normalizes a color to uppercase hex format
 */
function normalizeColor(color: string): string | null {
  if (!color) return null;

  // Already hex
  if (color.startsWith('#')) {
    // Convert 3-char hex to 6-char
    if (color.length === 4) {
      const r = color[1];
      const g = color[2];
      const b = color[3];
      return `#${r}${r}${g}${g}${b}${b}`.toUpperCase();
    }
    return color.toUpperCase();
  }

  // RGB/RGBA
  const rgbMatch = color.match(/rgba?\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
  if (rgbMatch) {
    const r = parseInt(rgbMatch[1]).toString(16).padStart(2, '0');
    const g = parseInt(rgbMatch[2]).toString(16).padStart(2, '0');
    const b = parseInt(rgbMatch[3]).toString(16).padStart(2, '0');
    return `#${r}${g}${b}`.toUpperCase();
  }

  // Named colors - common ones
  const namedColors: Record<string, string> = {
    white: '#FFFFFF',
    black: '#000000',
    red: '#FF0000',
    green: '#00FF00',
    blue: '#0000FF',
    yellow: '#FFFF00',
    cyan: '#00FFFF',
    magenta: '#FF00FF',
    orange: '#FFA500',
    purple: '#800080',
    gray: '#808080',
    grey: '#808080'
  };

  return namedColors[color.toLowerCase()] ?? null;
}

/**
 * Generates a default label for a color
 */
function getDefaultLabel(color: string): string {
  const colorNames: Record<string, string> = {
    '#FFFFFF': 'White',
    '#000000': 'Black',
    '#FF0000': 'Red',
    '#00FF00': 'Green',
    '#0000FF': 'Blue',
    '#FFFF00': 'Yellow',
    '#FF00FF': 'Magenta',
    '#00FFFF': 'Cyan',
    '#FF8000': 'Orange',
    '#8000FF': 'Purple',
    '#00FF80': 'Mint',
    '#FF0080': 'Pink',
    '#808080': 'Gray',
    '#C0C0C0': 'Silver',
    '#800000': 'Maroon',
    '#008000': 'Dark Green',
    '#000080': 'Navy',
    '#808000': 'Olive'
  };

  return colorNames[color.toUpperCase()] ?? color;
}
