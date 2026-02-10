import { Pattern } from 'fabric';
import type { Canvas, FabricImage } from 'fabric';
import { canvasLockManager } from '@/canvas';
import type { LockedCanvasState } from '@/types';
import { themeManager } from '@/utils/ThemeManager';

export const CANVAS_OBJECT_PROPS = ['__elsImageId', '__elsLocked', '__elsLegend', '__elsLegendConfig'] as const;

const GRID_SIZE = 40;

function getThemeBackgroundColor(): string {
  return themeManager.getTheme() === 'dark' ? '#1a1a1a' : '#f5f5f5';
}

function getThemeGridColor(): string {
  return themeManager.getTheme() === 'dark'
    ? 'rgba(255, 255, 255, 0.06)'
    : 'rgba(0, 0, 0, 0.08)';
}

export function getThemeCanvasBackground(): Pattern {
  const size = GRID_SIZE;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;

  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = getThemeBackgroundColor();
    ctx.fillRect(0, 0, size, size);

    ctx.strokeStyle = getThemeGridColor();
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0.5, 0);
    ctx.lineTo(0.5, size);
    ctx.moveTo(0, 0.5);
    ctx.lineTo(size, 0.5);
    ctx.stroke();
  }

  return new Pattern({ source: canvas, repeat: 'repeat' });
}

export function applyThemeBackground(canvas: Canvas): void {
  canvas.backgroundColor = getThemeCanvasBackground();
}

export function ensureCanvasImageIds(canvas: Canvas): void {
  canvas.getObjects().forEach((obj) => {
    if (obj.type !== 'image') return;
    canvasLockManager.ensureImageId(obj as FabricImage);
  });
}

export function applyImageLockState(canvas: Canvas): void {
  canvas.getObjects().forEach((obj) => {
    if (obj.type !== 'image') return;
    const image = obj as FabricImage & { __elsLocked?: boolean };
    const locked =
      typeof image.__elsLocked === 'boolean'
        ? image.__elsLocked
        : Boolean(
            image.lockMovementX ||
              image.lockMovementY ||
              image.lockScalingX ||
              image.lockScalingY ||
              image.lockRotation
          );

    if (!locked) return;

    image.set({
      __elsLocked: true,
      lockMovementX: true,
      lockMovementY: true,
      lockScalingX: true,
      lockScalingY: true,
      lockRotation: true,
      hasControls: false
    });
  });
}

export function applyPostLoadVisualState(canvas: Canvas): void {
  ensureCanvasImageIds(canvas);
  applyImageLockState(canvas);
  applyThemeBackground(canvas);
  canvas.requestRenderAll();
}

export function findImageById(canvas: Canvas, imageId: string | null | undefined): FabricImage | null {
  if (!imageId) return null;
  const match = canvas.getObjects().find((obj) => {
    if (obj.type !== 'image') return false;
    return (obj as FabricImage & { __elsImageId?: string }).__elsImageId === imageId;
  });
  return (match as FabricImage) ?? null;
}

export function restoreCanvasLockState(
  canvas: Canvas,
  lockState?: LockedCanvasState | null
): void {
  if (!lockState?.locked || !lockState.imageId) {
    canvasLockManager.unlock();
    return;
  }

  const image = findImageById(canvas, lockState.imageId);
  if (image) {
    canvasLockManager.lockToImage(image);
  } else {
    canvasLockManager.unlock();
  }
}
