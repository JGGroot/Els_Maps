import { ToolType } from '@/types';
import type { ITool } from '@/types';
import { LAYOUT } from '@/constants';
import { ToolButton } from '../controls/ToolButton';
import { createColorPalettePicker } from '../controls/ColorPalettePicker';
import type { ColorPalettePickerInstance } from '../controls/ColorPalettePicker';

export interface FileActionCallbacks {
  onImport: () => void;
  onExportPNG: () => void;
  onExportJPG: () => void;
  onExportPDF: () => void;
  onCopyToClipboard: () => void;
}

export interface EditActionCallbacks {
  onUndo: () => void;
  onRedo: () => void;
  onClearAll: () => void;
}

export interface StrokeColorCallbacks {
  onStrokeColorChange: (color: string) => void;
  onStrokeWidthChange: (width: number) => void;
  onStrokeDashChange: (dashed: boolean) => void;
}

export interface SnapCallbacks {
  onSnapToggle: (enabled: boolean) => void;
}

export interface CanvasLockCallbacks {
  onUnlockCanvas: () => void;
}

export interface SettingsCallbacks {
  onSettingsOpen: () => void;
}

export interface LegendCallbacks {
  onCreateLegend: () => void;
}

export interface NorthPointerCallbacks {
  onAddNorthPointer: () => void;
}

export class DesktopSidebar {
  private element: HTMLElement;
  private toolButtons: Map<ToolType, ToolButton> = new Map();
  private onToolSelect: (type: ToolType) => void;
  private fileCallbacks: FileActionCallbacks | null = null;
  private editCallbacks: EditActionCallbacks | null = null;
  private strokeCallbacks: StrokeColorCallbacks | null = null;
  private snapCallbacks: SnapCallbacks | null = null;
  private canvasLockCallbacks: CanvasLockCallbacks | null = null;
  private settingsCallbacks: SettingsCallbacks | null = null;
  private legendCallbacks: LegendCallbacks | null = null;
  private northPointerCallbacks: NorthPointerCallbacks | null = null;
  private snapEnabled: boolean = true;
  private strokeDashed: boolean = false;
  private undoBtn: HTMLButtonElement | null = null;
  private redoBtn: HTMLButtonElement | null = null;
  private strokeColorPicker: ColorPalettePickerInstance | null = null;
  private lockStatusEl: HTMLElement | null = null;

  constructor(parent: HTMLElement, tools: ITool[], onToolSelect: (type: ToolType) => void) {
    this.onToolSelect = onToolSelect;

    this.element = document.createElement('aside');
    this.element.className = 'sidebar fixed left-0 top-0 h-full z-sidebar flex flex-col border-r border-border';
    this.element.style.width = `${LAYOUT.sidebarWidth}px`;

    // Header
    const header = document.createElement('div');
    header.className = 'sidebar-header border-b border-border';

    header.appendChild(this.createLogoSvg());

    // Right-side header actions: undo, redo, settings
    const headerActions = document.createElement('div');
    headerActions.style.cssText = 'display: flex; align-items: center; gap: 2px;';

    this.undoBtn = document.createElement('button');
    this.undoBtn.className = 'icon-btn';
    this.undoBtn.setAttribute('aria-label', 'Undo');
    this.undoBtn.title = 'Undo (Ctrl+Z)';
    this.undoBtn.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/></svg>`;
    this.undoBtn.addEventListener('click', () => this.editCallbacks?.onUndo());
    headerActions.appendChild(this.undoBtn);

    this.redoBtn = document.createElement('button');
    this.redoBtn.className = 'icon-btn';
    this.redoBtn.setAttribute('aria-label', 'Redo');
    this.redoBtn.title = 'Redo (Ctrl+Shift+Z)';
    this.redoBtn.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 7v6h-6"/><path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3L21 13"/></svg>`;
    this.redoBtn.addEventListener('click', () => this.editCallbacks?.onRedo());
    headerActions.appendChild(this.redoBtn);

    const settingsBtn = document.createElement('button');
    settingsBtn.className = 'icon-btn';
    settingsBtn.setAttribute('aria-label', 'Settings');
    settingsBtn.title = 'Settings';
    settingsBtn.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`;
    settingsBtn.addEventListener('click', () => this.settingsCallbacks?.onSettingsOpen());
    headerActions.appendChild(settingsBtn);

    header.appendChild(headerActions);

    this.element.appendChild(header);

    // Scrollable content
    const scrollContainer = document.createElement('div');
    scrollContainer.className = 'flex-1 overflow-y-auto flex flex-col min-h-0';

    scrollContainer.appendChild(this.createStrokeSection());
    scrollContainer.appendChild(this.createToolsSection(tools));
    scrollContainer.appendChild(this.createEditSection());
    scrollContainer.appendChild(this.createFileSection());

    this.element.appendChild(scrollContainer);
    parent.appendChild(this.element);
  }

  private createLogoSvg(): SVGSVGElement {
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', '0 0 148 34');
    svg.setAttribute('height', '34');
    svg.setAttribute('aria-label', "El's Maps");
    svg.style.cssText = 'display: block; width: auto; flex-shrink: 0;';

    const A  = 'var(--accent)';
    const AD = 'rgba(196,124,40,0.22)';
    const BG = 'var(--surface)';
    const T  = 'var(--text)';
    const TM = 'var(--text-muted)';

    // Icon: original paths scaled via transform so they fit in ~24×30px
    // Original bounding box ≈ x65–300, y62–360 → scale 0.1 → ~23×30px
    const g = document.createElementNS(ns, 'g');
    g.setAttribute('transform', 'translate(2, 2) scale(0.1) translate(-65, -62)');

    const el = (tag: string, attrs: Record<string, string>) => {
      const n = document.createElementNS(ns, tag);
      for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
      return n;
    };

    g.appendChild(el('path', { d: 'M 180 200 A 60 60 0 1 1 300 200 C 300 245, 260 290, 240 330 C 220 290, 180 245, 180 200 Z', style: `stroke:${AD};stroke-width:18;fill:none;stroke-linejoin:round;` }));
    g.appendChild(el('path', { d: 'M 155 360 L 115 360 A 30 30 0 0 1 85 330 L 85 110 A 30 30 0 0 1 115 80 L 260 80', style: `stroke:${A};stroke-width:14;fill:none;stroke-linecap:round;` }));
    g.appendChild(el('path', { d: 'M 125 185 C 145 185, 145 200, 165 200 L 195 200', style: `stroke:${A};stroke-width:14;fill:none;stroke-linecap:round;` }));
    g.appendChild(el('path', { d: 'M 125 215 L 195 215',                              style: `stroke:${A};stroke-width:14;fill:none;stroke-linecap:round;` }));
    g.appendChild(el('path', { d: 'M 125 245 C 145 245, 145 230, 165 230 L 195 230', style: `stroke:${A};stroke-width:14;fill:none;stroke-linecap:round;` }));
    g.appendChild(el('path', { d: 'M 218 190 L 262 190 L 240 225 Z',                 style: `fill:${A};stroke:${A};stroke-width:2;stroke-linejoin:round;` }));
    // Ring 1 (top-right)
    g.appendChild(el('circle', { cx:'260', cy:'80',  r:'20', style:`fill:${BG};` }));
    g.appendChild(el('circle', { cx:'260', cy:'80',  r:'18', style:`stroke:${A};stroke-width:10;fill:none;` }));
    g.appendChild(el('circle', { cx:'260', cy:'80',  r:'7',  style:`fill:${A};` }));
    // Ring 2 (left-middle)
    g.appendChild(el('circle', { cx:'85',  cy:'215', r:'22', style:`fill:${BG};` }));
    g.appendChild(el('circle', { cx:'85',  cy:'215', r:'20', style:`stroke:${A};stroke-width:10;fill:none;` }));
    g.appendChild(el('circle', { cx:'85',  cy:'215', r:'8',  style:`fill:${A};` }));
    // Diamonds
    g.appendChild(el('path', { d: 'M 185 315 L 212 360 L 185 345 L 158 360 Z', style:`fill:${A};stroke:${A};stroke-width:2;stroke-linejoin:round;` }));
    g.appendChild(el('path', { d: 'M 185 355 L 198 378 L 185 400 L 172 378 Z', style:`fill:${A};stroke:${A};stroke-width:2;stroke-linejoin:round;` }));

    svg.appendChild(g);

    // Text wordmark
    const t1 = document.createElementNS(ns, 'text');
    t1.setAttribute('x', '30'); t1.setAttribute('y', '21');
    t1.setAttribute('style', `font-family:'Syne',sans-serif;font-weight:700;font-size:17px;fill:${T};letter-spacing:-0.4px;`);
    t1.textContent = "El's";
    svg.appendChild(t1);

    const t2 = document.createElementNS(ns, 'text');
    t2.setAttribute('x', '31'); t2.setAttribute('y', '32');
    t2.setAttribute('style', `font-family:'DM Sans',sans-serif;font-weight:500;font-size:9.5px;fill:${TM};letter-spacing:2.5px;`);
    t2.textContent = 'MAPS';
    svg.appendChild(t2);

    return svg;
  }

  private createToolsSection(tools: ITool[]): HTMLElement {
    const wrap = document.createElement('div');

    const divider = document.createElement('div');
    divider.className = 'section-divider';
    wrap.appendChild(divider);

    const section = document.createElement('div');
    section.className = 'sidebar-section';

    const label = document.createElement('div');
    label.className = 'section-label';
    label.textContent = 'Tools';
    section.appendChild(label);

    const grid = document.createElement('div');
    grid.style.cssText = 'display: grid; grid-template-columns: repeat(4, 1fr); gap: 4px;';

    tools.forEach((tool) => {
      const button = new ToolButton(
        { type: tool.type, name: tool.name, icon: tool.icon },
        this.handleToolClick,
        false
      );
      this.toolButtons.set(tool.type, button);
      grid.appendChild(button.getElement());
    });

    section.appendChild(grid);
    wrap.appendChild(section);
    return wrap;
  }

  private createEditSection(): HTMLElement {
    const wrap = document.createElement('div');

    const divider = document.createElement('div');
    divider.className = 'section-divider';
    wrap.appendChild(divider);

    const section = document.createElement('div');
    section.className = 'sidebar-section';

    const label = document.createElement('div');
    label.className = 'section-label';
    label.textContent = 'Edit';
    section.appendChild(label);

    const col = document.createElement('div');
    col.style.cssText = 'display: flex; flex-direction: column; gap: 2px;';

    const clearBtn = this.createActionBtn('Clear All', trashIcon(), 'is-danger');
    clearBtn.addEventListener('click', () => this.editCallbacks?.onClearAll());
    col.appendChild(clearBtn);

    const legendBtn = this.createActionBtn('Create Legend', legendIcon());
    legendBtn.addEventListener('click', () => this.legendCallbacks?.onCreateLegend());
    col.appendChild(legendBtn);

    const northBtn = this.createActionBtn('Add North Pointer', compassIcon());
    northBtn.addEventListener('click', () => this.northPointerCallbacks?.onAddNorthPointer());
    col.appendChild(northBtn);

    section.appendChild(col);
    wrap.appendChild(section);
    return wrap;
  }

  private createStrokeSection(): HTMLElement {
    const section = document.createElement('div');
    section.className = 'sidebar-section';

    const label = document.createElement('div');
    label.className = 'section-label';
    label.textContent = 'Drawing Style';
    section.appendChild(label);

    const colorLabel = document.createElement('div');
    colorLabel.className = 'prop-label';
    colorLabel.textContent = 'Stroke Color';
    section.appendChild(colorLabel);

    this.strokeColorPicker = createColorPalettePicker('#ffffff', (color) => {
      this.strokeCallbacks?.onStrokeColorChange(color);
    });
    section.appendChild(this.strokeColorPicker.element);

    const widthLabel = document.createElement('div');
    widthLabel.className = 'prop-label';
    widthLabel.style.marginTop = '12px';
    widthLabel.textContent = 'Stroke Width';
    section.appendChild(widthLabel);

    const widthRow = document.createElement('div');
    widthRow.style.cssText = 'display: flex; align-items: center; gap: 8px;';

    const widthInput = document.createElement('input');
    widthInput.type = 'range';
    widthInput.id = 'global-stroke-width';
    widthInput.min = '1';
    widthInput.max = '20';
    widthInput.value = '2';
    widthInput.style.flex = '1';

    const widthValue = document.createElement('span');
    widthValue.id = 'global-stroke-width-value';
    widthValue.className = 'mono-val';
    widthValue.textContent = '2px';

    widthInput.addEventListener('input', (e) => {
      const val = (e.target as HTMLInputElement).value;
      this.strokeCallbacks?.onStrokeWidthChange(Number(val));
      widthValue.textContent = val + 'px';
    });

    widthRow.appendChild(widthInput);
    widthRow.appendChild(widthValue);
    section.appendChild(widthRow);

    // Dashed + Snap toggles
    const toggleRow = document.createElement('div');
    toggleRow.style.cssText = 'display: flex; align-items: center; gap: 16px; margin-top: 10px;';

    const dashedInput = document.createElement('input');
    dashedInput.type = 'checkbox';
    dashedInput.id = 'global-dash-toggle';
    dashedInput.checked = this.strokeDashed;
    dashedInput.className = 'modern-checkbox';
    dashedInput.addEventListener('change', (e) => {
      const dashed = (e.target as HTMLInputElement).checked;
      this.strokeDashed = dashed;
      this.strokeCallbacks?.onStrokeDashChange(dashed);
    });
    const dashedLabel = document.createElement('label');
    dashedLabel.className = 'toggle-label';
    dashedLabel.htmlFor = 'global-dash-toggle';
    dashedLabel.appendChild(dashedInput);
    dashedLabel.appendChild(document.createTextNode('Dashed'));
    toggleRow.appendChild(dashedLabel);

    const snapInput = document.createElement('input');
    snapInput.type = 'checkbox';
    snapInput.id = 'global-snap-toggle';
    snapInput.checked = this.snapEnabled;
    snapInput.className = 'modern-checkbox';
    snapInput.addEventListener('change', (e) => {
      const enabled = (e.target as HTMLInputElement).checked;
      this.snapEnabled = enabled;
      this.snapCallbacks?.onSnapToggle(enabled);
    });
    const snapLabel = document.createElement('label');
    snapLabel.className = 'toggle-label';
    snapLabel.htmlFor = 'global-snap-toggle';
    snapLabel.appendChild(snapInput);
    snapLabel.appendChild(document.createTextNode('Snap'));
    toggleRow.appendChild(snapLabel);

    section.appendChild(toggleRow);
    return section;
  }

  private createFileSection(): HTMLElement {
    const wrap = document.createElement('div');
    wrap.style.marginTop = 'auto';

    const divider = document.createElement('div');
    divider.className = 'section-divider';
    wrap.appendChild(divider);

    const section = document.createElement('div');
    section.className = 'sidebar-section';

    const label = document.createElement('div');
    label.className = 'section-label';
    label.textContent = 'File';
    section.appendChild(label);

    const col = document.createElement('div');
    col.style.cssText = 'display: flex; flex-direction: column; gap: 2px;';

    const importBtn = this.createActionBtn('Import Image', importIcon());
    importBtn.addEventListener('click', () => this.fileCallbacks?.onImport());
    col.appendChild(importBtn);

    this.lockStatusEl = document.createElement('div');
    this.lockStatusEl.style.cssText = 'display: none; align-items: center; gap: 6px; padding: 4px 10px; font-size: 11px;';
    this.lockStatusEl.style.color = 'var(--accent)';
    this.lockStatusEl.innerHTML = `
      <span>Canvas locked</span>
      <button class="unlock-btn" style="margin-left:auto;color:var(--text-muted);font-size:11px;cursor:pointer;">[Unlock]</button>
    `;
    this.lockStatusEl.querySelector('.unlock-btn')?.addEventListener('click', () => {
      this.canvasLockCallbacks?.onUnlockCanvas();
    });
    col.appendChild(this.lockStatusEl);

    const exportRow = document.createElement('div');
    exportRow.className = 'btn-row';

    const exportPngBtn = this.createActionBtn('PNG', exportIcon());
    exportPngBtn.addEventListener('click', () => this.fileCallbacks?.onExportPNG());
    exportRow.appendChild(exportPngBtn);

    const exportJpgBtn = this.createActionBtn('JPG', exportIcon());
    exportJpgBtn.addEventListener('click', () => this.fileCallbacks?.onExportJPG());
    exportRow.appendChild(exportJpgBtn);

    const exportPdfBtn = this.createActionBtn('PDF', exportIcon());
    exportPdfBtn.addEventListener('click', () => this.fileCallbacks?.onExportPDF());
    exportRow.appendChild(exportPdfBtn);

    col.appendChild(exportRow);

    const copyBtn = this.createActionBtn('Copy to Clipboard', copyIcon());
    copyBtn.addEventListener('click', () => this.fileCallbacks?.onCopyToClipboard());
    col.appendChild(copyBtn);

    section.appendChild(col);
    wrap.appendChild(section);
    return wrap;
  }

  private createActionBtn(label: string, iconSvg: string, extraClass = ''): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.className = `action-btn${extraClass ? ' ' + extraClass : ''}`;
    btn.innerHTML = `
      <span class="action-btn-icon">${iconSvg}</span>
      <span>${label}</span>
    `;
    return btn;
  }

  // ── public setters ────────────────────────────────────────────────

  setFileCallbacks(callbacks: FileActionCallbacks): void {
    this.fileCallbacks = callbacks;
  }

  setEditCallbacks(callbacks: EditActionCallbacks): void {
    this.editCallbacks = callbacks;
  }

  setStrokeCallbacks(callbacks: StrokeColorCallbacks): void {
    this.strokeCallbacks = callbacks;
  }

  setSnapCallbacks(callbacks: SnapCallbacks): void {
    this.snapCallbacks = callbacks;
  }

  setCanvasLockCallbacks(callbacks: CanvasLockCallbacks): void {
    this.canvasLockCallbacks = callbacks;
  }

  setSettingsCallbacks(callbacks: SettingsCallbacks): void {
    this.settingsCallbacks = callbacks;
  }

  setLegendCallbacks(callbacks: LegendCallbacks): void {
    this.legendCallbacks = callbacks;
  }

  setNorthPointerCallbacks(callbacks: NorthPointerCallbacks): void {
    this.northPointerCallbacks = callbacks;
  }

  setSnapEnabled(enabled: boolean): void {
    this.snapEnabled = enabled;
    const input = this.element.querySelector('#global-snap-toggle') as HTMLInputElement | null;
    if (input) input.checked = enabled;
  }

  setStrokeColor(color: string): void {
    this.strokeColorPicker?.setColor(color);
  }

  setStrokeDashed(dashed: boolean): void {
    this.strokeDashed = dashed;
    const input = this.element.querySelector('#global-dash-toggle') as HTMLInputElement | null;
    if (input) input.checked = dashed;
  }

  setStrokeWidth(width: number): void {
    const widthInput = this.element.querySelector('#global-stroke-width') as HTMLInputElement | null;
    const widthValue = this.element.querySelector('#global-stroke-width-value') as HTMLElement | null;
    if (widthInput) widthInput.value = String(width);
    if (widthValue) widthValue.textContent = width + 'px';
  }

  updateCanvasLockStatus(isLocked: boolean): void {
    if (this.lockStatusEl) {
      this.lockStatusEl.style.display = isLocked ? 'flex' : 'none';
    }
  }

  updateUndoRedoButtons(canUndo: boolean, canRedo: boolean): void {
    if (this.undoBtn) {
      this.undoBtn.disabled = !canUndo;
    }
    if (this.redoBtn) {
      this.redoBtn.disabled = !canRedo;
    }
  }

  private handleToolClick = (type: ToolType): void => {
    this.onToolSelect(type);
  };

  setActiveTool(type: ToolType): void {
    this.toolButtons.forEach((button, toolType) => {
      button.setActive(toolType === type);
    });
  }

  getElement(): HTMLElement {
    return this.element;
  }

  destroy(): void {
    this.toolButtons.forEach((button) => button.destroy());
    this.toolButtons.clear();
    this.element.remove();
  }
}

// ── Inline SVG icons ──────────────────────────────────────────────────────────


function trashIcon() {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>`;
}

function legendIcon() {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="6" height="6" rx="1"/><line x1="13" y1="6" x2="21" y2="6"/><rect x="3" y="10" width="6" height="6" rx="1"/><line x1="13" y1="13" x2="21" y2="13"/><rect x="3" y="17" width="6" height="6" rx="1"/><line x1="13" y1="20" x2="21" y2="20"/></svg>`;
}

function compassIcon() {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/></svg>`;
}

function importIcon() {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>`;
}

function exportIcon() {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>`;
}

function copyIcon() {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`;
}
