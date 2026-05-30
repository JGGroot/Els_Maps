const PRESET_COLORS = [
  '#000000', '#ffffff', '#ff0000', '#00ff00', '#0000ff',
  '#ffff00', '#00ffff', '#ff00ff', '#c0c0c0', '#808080',
  '#800000', '#808000', '#008000', '#008080', '#000080'
];

const HUES = [0, 20, 35, 50, 60, 80, 120, 150, 180, 200, 220, 240, 270, 300];
const LIGHTNESS_ROWS = [93, 80, 66, 50, 40, 30, 20, 10];
const GRAYSCALE = ['#ffffff', '#d8d8d8', '#aaaaaa', '#808080', '#555555', '#333333', '#1a1a1a', '#000000'];

function hslToHex(h: number, s: number, l: number): string {
  s /= 100; l /= 100;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const c = l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(255 * c).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

export interface ColorPalettePickerInstance {
  element: HTMLElement;
  setColor: (color: string) => void;
}

export function createColorPalettePicker(
  initialColor: string,
  onChange: (color: string) => void
): ColorPalettePickerInstance {
  const wrapper = document.createElement('div');

  // Current color swatch
  const swatch = document.createElement('div');
  swatch.className = 'rounded border border-border flex-shrink-0 mb-2';
  swatch.style.cssText = `background-color: ${initialColor}; width: 24px; height: 24px;`;
  wrapper.appendChild(swatch);

  const applyColor = (color: string) => {
    swatch.style.backgroundColor = color;
    onChange(color);
  };

  // Preset circles row
  const presetsRow = document.createElement('div');
  presetsRow.className = 'flex flex-wrap mb-1';
  presetsRow.style.gap = '2px';

  PRESET_COLORS.forEach(color => {
    const circle = document.createElement('button');
    circle.className = 'rounded-full border border-white/20 cursor-pointer flex-shrink-0 hover:ring-1 hover:ring-white/60 transition-all';
    circle.style.cssText = `background-color: ${color}; width: 14px; height: 14px;`;
    circle.title = color;
    circle.addEventListener('click', () => applyColor(color));
    presetsRow.appendChild(circle);
  });
  wrapper.appendChild(presetsRow);

  // Color grid
  const grid = document.createElement('div');
  grid.style.cssText = 'display: grid; grid-template-columns: repeat(15, minmax(0, 1fr)); gap: 1px;';

  LIGHTNESS_ROWS.forEach((lightness, rowIdx) => {
    HUES.forEach(hue => {
      const color = hslToHex(hue, 100, lightness);
      const cell = document.createElement('button');
      cell.style.cssText = `background-color: ${color}; aspect-ratio: 1; width: 100%; cursor: pointer; border: none; padding: 0; display: block;`;
      cell.title = color;
      cell.addEventListener('click', () => applyColor(color));
      grid.appendChild(cell);
    });

    const grayColor = GRAYSCALE[rowIdx];
    const grayCell = document.createElement('button');
    grayCell.style.cssText = `background-color: ${grayColor}; aspect-ratio: 1; width: 100%; cursor: pointer; border: none; padding: 0; display: block;`;
    grayCell.title = grayColor;
    grayCell.addEventListener('click', () => applyColor(grayColor));
    grid.appendChild(grayCell);
  });

  wrapper.appendChild(grid);

  return {
    element: wrapper,
    setColor: (color: string) => {
      swatch.style.backgroundColor = color;
    }
  };
}
