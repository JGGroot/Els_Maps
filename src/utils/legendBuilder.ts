import { Group, Rect, Text, type FabricObject } from 'fabric';
import type { LegendConfig } from '@/components/controls/LegendModal';

const LEGEND_PADDING = 12;
const SWATCH_SIZE = 16;
const SWATCH_GAP = 10;
const ITEM_GAP = 6;
const TITLE_GAP = 10;

export interface LegendGroupData {
  __elsLegend: true;
  __elsLegendConfig: LegendConfig;
}

/**
 * Creates a Fabric.js Group object representing the legend
 */
export function createLegendGroup(config: LegendConfig): Group {
  const objects: FabricObject[] = [];

  // Calculate dimensions
  let maxTextWidth = 0;
  const tempText = new Text('', {
    fontSize: config.fontSize,
    fontFamily: config.fontFamily
  });

  // Measure title width if shown
  if (config.showTitle && config.title) {
    tempText.set({ text: config.title, fontWeight: 'bold' });
    maxTextWidth = Math.max(maxTextWidth, tempText.width ?? 0);
  }

  // Measure item label widths
  config.items.forEach(item => {
    tempText.set({ text: item.label, fontWeight: 'normal' });
    maxTextWidth = Math.max(maxTextWidth, tempText.width ?? 0);
  });

  const contentWidth = SWATCH_SIZE + SWATCH_GAP + maxTextWidth;
  const totalWidth = contentWidth + LEGEND_PADDING * 2;

  // Calculate height
  let totalHeight = LEGEND_PADDING * 2;
  if (config.showTitle && config.title) {
    totalHeight += config.fontSize + TITLE_GAP;
  }
  totalHeight += config.items.length * (SWATCH_SIZE + ITEM_GAP) - ITEM_GAP;

  // Background with opacity
  const bgOpacity = config.backgroundOpacity / 100;
  const background = new Rect({
    left: 0,
    top: 0,
    width: totalWidth,
    height: totalHeight,
    fill: `rgba(0, 0, 0, ${bgOpacity})`,
    stroke: config.borderColor,
    strokeWidth: config.borderWidth,
    selectable: false,
    evented: false
  });
  objects.push(background);

  let yOffset = LEGEND_PADDING;

  // Title
  if (config.showTitle && config.title) {
    const titleText = new Text(config.title, {
      left: LEGEND_PADDING,
      top: yOffset,
      fontSize: config.fontSize,
      fontFamily: config.fontFamily,
      fontWeight: 'bold',
      fill: config.borderColor,
      selectable: false,
      evented: false
    });
    objects.push(titleText);
    yOffset += config.fontSize + TITLE_GAP;
  }

  // Color items
  config.items.forEach(item => {
    // Swatch
    const swatch = new Rect({
      left: LEGEND_PADDING,
      top: yOffset,
      width: SWATCH_SIZE,
      height: SWATCH_SIZE,
      fill: item.color,
      selectable: false,
      evented: false
    });
    objects.push(swatch);

    // Label
    const label = new Text(item.label, {
      left: LEGEND_PADDING + SWATCH_SIZE + SWATCH_GAP,
      top: yOffset + (SWATCH_SIZE - config.fontSize) / 2,
      fontSize: config.fontSize,
      fontFamily: config.fontFamily,
      fill: config.borderColor,
      selectable: false,
      evented: false
    });
    objects.push(label);

    yOffset += SWATCH_SIZE + ITEM_GAP;
  });

  // Create the group
  const group = new Group(objects, {
    selectable: true,
    evented: true,
    hasControls: true,
    hasBorders: true,
    lockRotation: false,
    cornerStyle: 'circle',
    cornerColor: '#4a9eff',
    cornerStrokeColor: '#ffffff',
    cornerSize: 10,
    transparentCorners: false,
    originX: 'center',
    originY: 'center'
  });

  // Add custom properties to identify as legend
  (group as any).__elsLegend = true;
  (group as any).__elsLegendConfig = JSON.parse(JSON.stringify(config));

  return group;
}

/**
 * Checks if a Fabric object is a legend group
 */
export function isLegendGroup(obj: FabricObject): boolean {
  return (obj as any).__elsLegend === true;
}

/**
 * Gets the legend config from a legend group
 */
export function getLegendConfig(obj: FabricObject): LegendConfig | null {
  if (!isLegendGroup(obj)) return null;
  return (obj as any).__elsLegendConfig ?? null;
}
