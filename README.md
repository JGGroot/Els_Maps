<p align="center">
  <img src=".claude/ElsMapsLogo.png" alt="El's Maps" width="360" />
</p>

# El's Maps

El's Maps is a fast, browser-based drawing tool for tracing property lines on estate maps. I built it for my wife to draw boundaries rapidly and efficiently without the friction of heavyweight CAD tools.

## What It Does
- Import a map image or PDF and draw property boundaries on top.
- PDF import supports page selection and DPI scaling for clarity.
- Use line, spline, and shape tools with endpoint snapping for clean joins.
- Edit points and bezier handles to refine curves.
- Lock the canvas to a base image so exports crop exactly to the map.
- Export to PNG, JPG, or PDF, or copy the result straight to the clipboard.
- Autosave every 30 seconds and restore sessions on reload.
- Save, rename, and manage multiple projects locally with previews.
- Light and dark themes plus configurable default stroke and font settings.

## Typical Workflow
1. Import a scanned estate map or PDF.
2. Select the base map image and click Lock Canvas to Image for clean exports.
3. Trace property lines using Line, Pen, Autospline, or T-Spline.
4. Refine with the Edit tool and adjust stroke widths/colors.
5. Export to PNG/JPG/PDF or copy to clipboard.

## Tools
- Select: move, scale, rotate, and select objects.
- Edit: adjust nodes and control handles on lines and curves.
- Pan: drag the canvas without changing tools.
- Line: draw straight segments with snap-to-endpoints.
- Pen: place bezier anchors and drag handles for precise curves.
- Autospline: draw freehand or click points and auto-smooth the curve.
- T-Spline: click-drag control points for smooth, flowing lines.
- Rectangle and Ellipse: quick shape outlines.
- Text: add labels to the map.

## Keyboard Shortcuts
- Space + Drag: pan canvas.
- Scroll: zoom.
- Ctrl/Cmd+Z: undo.
- Ctrl/Cmd+Shift+Z or Ctrl/Cmd+Y: redo.
- Ctrl/Cmd+V: paste image from clipboard.
- Delete: delete selected objects.
- Escape: cancel current action or deselect.
- Enter or Right-click: finish drawing.

## Local Development
```bash
npm install
npm run dev
```

## Build And Preview
```bash
npm run build
npm run preview
```

## Deploy Notes
The Vite base path is set to `/Els_Maps/` in `vite.config.ts` for GitHub Pages. If you deploy at the domain root, change `base` to `/`.

## Data And Storage
Projects, autosaves, and settings are stored locally in your browser using IndexedDB and localStorage. Clearing site data in your browser removes them.

## Tech Stack
- Vite + TypeScript
- Fabric.js canvas engine
- Tailwind CSS
- pdfjs-dist for PDF import
- jsPDF for PDF export
- Vite PWA for installable, offline-capable builds
