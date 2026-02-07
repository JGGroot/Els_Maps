# Revised Project Specification: "El's Maps" (Web & Mobile Web)

**Role:** Senior Frontend Architect  
**Target:** Claude Code (AI Implementation Agent)  
**Deployment:** GitHub Pages (Static SPA)  
**Context:** The application is a pure Web SPA optimized for mobile Safari/Chrome. It requires robust touch event handling and responsive design to replace native application behaviors.

---

## 1. High-Level Architecture (Web-First)

* **Hosting:** GitHub Pages.
* **Build Tool:** Vite (Vanilla TypeScript).
* **CI/CD:** GitHub Actions (Build `dist` -> Deploy to `gh-pages` branch).
* **Graphics Engine:** **Fabric.js (v6)**.
* **Mobile Optimization:** Explicit separation of "Drawing Gestures" (1 finger) from "Navigation Gestures" (2 fingers).
* **Styling:** Tailwind CSS.
* **Responsive Strategy:** Mobile-first breakpoints. The sidebar transitions to a Bottom Navigation Bar or Hamburger menu on small screens.
* **Storage:** LocalStorage / IndexedDB for autosaving drafts.

---

## 2. Touch & Gesture Strategy

The core challenge is translating mouse-centric interactions (Hover, Right-Click) to touch interfaces.

### A. The "Right-Click" Problem
* **Requirement:** Terminate line/action.
* **Desktop:** Right-click or `Esc`.
* **Mobile:** A floating **"Action/Cancel" Button** (bottom right) must appear dynamically during an active drawing state.

### B. The "Hover" Problem (Rubber-banding)
* **Requirement:** Visual preview of lines before committing the point.
* **Implementation:**
    * **Desktop:** `mousemove` updates the "ghost" line.
    * **Mobile:** The "ghost" line updates only during `touchmove`. If the user taps without dragging, the line commits to the tap coordinate.
    * **Visual Aid:** Implement an offset "Reticle" during drags to prevent the user's finger from obscuring the precise placement point.

### C. Navigation vs. Drawing
* **Gesture Manager:**
    * **1 Finger:** Active Tool execution (Draw, Select, Drag).
    * **2 Fingers:** Pan and Pinch-to-Zoom.
* **CSS:** Apply `touch-action: none;` to the canvas container to prevent default browser scrolling/refreshing during interaction.

---

## 3. Detailed Feature Specifications

### UI/UX & Responsive Layout
* **Theme:** Deep Charcoal (`#1a1a1a`), Minimalist.
* **Desktop (>768px):** Fixed Sidebar (Left) for tools, Fixed Sidebar (Right) for properties.
* **Mobile (<768px):** * **Toolbar:** Horizontal scrollable bottom bar.
    * **Properties:** Slide-up "Bottom Sheet" triggered by object selection.
    * **Canvas:** Edge-to-edge (minus 60px control offset).

### Tool Logic Updates
1.  **Polyline Tool (Hybrid Input):**
    * **Start:** `Click/Tap` sets $P_0$.
    * **Intermediate:** Line tip follows cursor (Desktop) or waits for next `Tap/Drag` (Mobile).
    * **Termination:** "Done" button (Mobile) or `Esc` (Desktop).
2.  **Auto Spline / T-Spline:**
    * **Interaction:** Click-and-drag creates the curve. 
    * **Refinement:** Spline handles should render with a vertical offset or enlarged hit area on mobile to ensure visibility under the fingertip.

### System Features
* **File Handling:**
    * **Import:** `<input type="file">` for local image/JSON data.
    * **Export:** Browser download trigger for Desktop; "Long Press to Save" modal for Mobile to bypass Clipboard API restrictions in iOS WebKit.
* **PWA:** Include `manifest.json` and a Service Worker to allow "Add to Home Screen," removing the Safari URL bar for a native feel.

---

## 4. Implementation Steps for Claude Code

1.  **Project Setup:** Initialize Vite + TS + Tailwind. Configure `gh-pages` deployment script.
2.  **Canvas Engine:** Initialize Fabric.js v6.
3.  **Gesture Logic:** * Add `touchstart`, `touchmove`, `touchend` listeners.
    * Implement logic to ignore single-touch tool input when `e.touches.length > 1`.
4.  **Responsive Shell:** Create the CSS Grid/Flexbox layout that swaps sidebars for bottom sheets.
5.  **Tools:** * Refactor `LineTool.ts` to handle hybrid input types.
    * Implement the dynamic "Finish Drawing" HTML overlay.
6.  **Export Engine:** Implement `jsPDF` and `canvas.toBlob()`.
7.  **CI/CD:** Create `.github/workflows/deploy.yml`.