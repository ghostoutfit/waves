// ── Grid (shared by both views) ──────────────────────────────
// Minor + major gridlines plus the equilibrium line, drawn under everything.
// `cy` is the vertical centre; the slinky passes its own, the string defaults it.
import { canvas, ctx, darkMode } from './state.js';
import { OFFSET, GRID_W, GRID_MINOR, CY_OFFSET } from './config.js';

export function drawGrid(cy) {
  const W = canvas.width, H = canvas.height;
  if (cy === undefined) cy = H / 2 + CY_OFFSET;
  ctx.save();

  // Minor lines (every GRID_MINOR = 30 px) — skip positions that fall on major lines
  ctx.strokeStyle = darkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = OFFSET % GRID_MINOR; x <= W; x += GRID_MINOR) {
    if (Math.round(x - OFFSET) % GRID_W === 0) continue;
    ctx.moveTo(x, 0); ctx.lineTo(x, H);
  }
  for (let y = cy % GRID_MINOR; y <= H; y += GRID_MINOR) {
    if (Math.round(cy - y) % GRID_W === 0) continue;
    ctx.moveTo(0, y); ctx.lineTo(W, y);
  }
  ctx.stroke();

  // Major lines (every GRID_W = 120 px) — thicker
  ctx.strokeStyle = darkMode ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  for (let x = OFFSET; x <= W; x += GRID_W) { ctx.moveTo(x, 0); ctx.lineTo(x, H); }
  for (let x = OFFSET - GRID_W; x >= 0; x -= GRID_W) { ctx.moveTo(x, 0); ctx.lineTo(x, H); }
  for (let y = cy; y >= 0; y -= GRID_W) { ctx.moveTo(0, y); ctx.lineTo(W, y); }
  for (let y = cy + GRID_W; y <= H; y += GRID_W) { ctx.moveTo(0, y); ctx.lineTo(W, y); }
  ctx.stroke();

  // Equilibrium line — most prominent
  ctx.strokeStyle = darkMode ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.14)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(0, cy); ctx.lineTo(W, cy);
  ctx.stroke();

  ctx.restore();
}
