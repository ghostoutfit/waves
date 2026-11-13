// ── Measurement lines (the LINE tool) ─────────────────────────
// Freehand lines the user draws to measure the wave; each view keeps its own.
// Here: the lines, the tool's state, drawing them, and finding a grabbed end or
// midpoint. pointer.js does the drawing/dragging with the mouse.
import { ctx, activeView, darkMode } from './state.js';

const DRAW_DOT_R   = 4;
const DRAW_MID_R   = 5;   // midpoint handle radius (drawn)
const DRAW_MID_HIT = 12;  // px grab radius for midpoint
const DRAW_DOT_HIT = 10;  // px grab radius for endpoint dots

const drawingsByView = { wave: [], slinky: [] };
export function curDrawings() { return drawingsByView[activeView]; }

// The tool's state. on: LINE mode is on; active: the line being drawn { x1, y1, x2, y2 };
// draggedLine: { index, offX, offY } a line moved by its midpoint;
// draggedEndpoint: { index, which: 1|2 } an end being adjusted.
export const lineTool = { on: false, active: null, draggedLine: null, draggedEndpoint: null };

// Drop whatever line is being drawn or dragged (view switch, Clear).
export function cancelLineEdit() {
  lineTool.active = null; lineTool.draggedLine = null; lineTool.draggedEndpoint = null;
}

export function drawLines() {
  const color = darkMode ? 'rgba(255,255,255,0.85)' : 'rgba(0,0,0,0.75)';
  const midColor = darkMode ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.3)';

  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle   = color;
  ctx.lineWidth   = 2;
  ctx.lineCap     = 'round';

  const drawings = curDrawings();
  const allLines = lineTool.active ? [...drawings, lineTool.active] : drawings;

  for (let i = 0; i < allLines.length; i++) {
    const d = allLines[i];

    // Line
    ctx.beginPath();
    ctx.moveTo(d.x1, d.y1);
    ctx.lineTo(d.x2, d.y2);
    ctx.stroke();

    // Start dot
    ctx.beginPath();
    ctx.arc(d.x1, d.y1, DRAW_DOT_R, 0, Math.PI * 2);
    ctx.fill();

    // End dot
    ctx.beginPath();
    ctx.arc(d.x2, d.y2, DRAW_DOT_R, 0, Math.PI * 2);
    ctx.fill();

    // Midpoint grab handle (hollow) — only for completed lines
    if (i < drawings.length) {
      const mx = (d.x1 + d.x2) / 2;
      const my = (d.y1 + d.y2) / 2;
      ctx.beginPath();
      ctx.arc(mx, my, DRAW_MID_R, 0, Math.PI * 2);
      ctx.strokeStyle = midColor;
      ctx.lineWidth   = 1.5;
      ctx.stroke();
      ctx.strokeStyle = color;
      ctx.lineWidth   = 2;
    }
  }

  ctx.restore();
}

export function lineMidpoint(d) {
  return { x: (d.x1 + d.x2) / 2, y: (d.y1 + d.y2) / 2 };
}

// Index of the line whose midpoint handle is under (mx, my), or -1
export function nearMidpoint(mx, my) {
  const drawings = curDrawings();
  for (let i = 0; i < drawings.length; i++) {
    const m = lineMidpoint(drawings[i]);
    if (Math.hypot(mx - m.x, my - m.y) < DRAW_MID_HIT) return i;
  }
  return -1;
}

// Returns { index, which: 1|2 } for the nearest endpoint, or null
export function nearEndpoint(mx, my) {
  const drawings = curDrawings();
  for (let i = 0; i < drawings.length; i++) {
    const d = drawings[i];
    if (Math.hypot(mx - d.x1, my - d.y1) < DRAW_DOT_HIT) return { index: i, which: 1 };
    if (Math.hypot(mx - d.x2, my - d.y2) < DRAW_DOT_HIT) return { index: i, which: 2 };
  }
  return null;
}
