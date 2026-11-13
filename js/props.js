// ── Props: the cup and the twist ties ─────────────────────────
// Objects the user drags onto the canvas. Each view keeps its own: `cup` and
// `stringTies` belong to the string, `toy` (the same cup sprite) and `slinkyTies`
// to the slinky. Here: their state, how the cup coasts after the wave hits it,
// hit tests, and the cup / tie sprites (also drawn in the palette below the controls).
// The wave modules (string.js, slinky.js) decide when the wave hits the cup and
// where ties ride; pointer.js does the dragging.
import { canvas, activeView, darkMode } from './state.js';
import { CUP_TW, CUP_BW, CUP_H, CUP_FRICTION, TIE_W, TIE_H } from './config.js';

// ── Cup (string mode) ────────────────────────────────────────
export const cup = {
  x: 0, y: 0,
  vx: 0, vy: 0,
  resting: true,
  inPalette: true,
  dragging: false,
  dragOffX: 0, dragOffY: 0,
};

// ── Cup (slinky mode) — same cup sprite as wave mode ─────────
export const toy = {
  x: 0, y: 0,
  vx: 0,
  inPalette: true,
  resting: true,
  dragging: false,
  dragOffX: 0, dragOffY: 0,
};

// ── Twist ties — per view ─────────────────────────────────────
// Slinky ties track slinkyParticleIndex + xEq for coil following.
export const stringTies = [];  // { x, y, particleIndex, dragging, dragOffX, dragOffY }
export const slinkyTies = [];  // { x, y, slinkyParticleIndex, xEq, dragging, dragOffX, dragOffY }
export function curTies() { return activeView === 'slinky' ? slinkyTies : stringTies; }

// Is a cup at (x, y) — y is its base — tucked behind the control panel? A cup there
// can't be seen, so it's treated like one that went off screen: back to the palette.
export function behindControls(x, y) {
  const cr  = canvas.getBoundingClientRect();
  const ctr = document.getElementById('controls').getBoundingClientRect();
  const scaleX = canvas.width  / cr.width;
  const scaleY = canvas.height / cr.height;
  const ctrlL = (ctr.left   - cr.left) * scaleX;
  const ctrlR = (ctr.right  - cr.left) * scaleX;
  const ctrlT = (ctr.top    - cr.top)  * scaleY;
  const ctrlB = (ctr.bottom - cr.top)  * scaleY;
  return x > ctrlL && x < ctrlR && y - CUP_H < ctrlB && y > ctrlT;
}

// ── Motion: coast with friction after a hit ───────────────────
// A cup that coasts off screen or behind the control panel returns to the palette.
export function updateCup() {
  if (cup.dragging || cup.resting) return;

  cup.vx *= CUP_FRICTION;
  cup.vy *= CUP_FRICTION;
  cup.x  += cup.vx;
  cup.y  += cup.vy;

  if (Math.hypot(cup.vx, cup.vy) < 0.05) {
    cup.vx = cup.vy = 0;
    cup.resting = true;
  }

  if (cup.x < -CUP_TW - 4 || cup.x > canvas.width + CUP_TW + 4
   || cup.y < -CUP_H - 4  || cup.y > canvas.height + 4 || behindControls(cup.x, cup.y)) {
    cup.inPalette = true;
    cup.vx = cup.vy = 0;
    cup.resting = true;
  }
}

export function updateToy() {
  if (toy.dragging || toy.resting || toy.inPalette) return;
  toy.vx *= CUP_FRICTION;
  toy.x  += toy.vx;
  if (Math.abs(toy.vx) < 0.05) {
    toy.vx = 0;
    toy.resting = true;
  }
  if (toy.x < -CUP_TW - 4 || toy.x > canvas.width + CUP_TW + 4 || behindControls(toy.x, toy.y)) {
    toy.inPalette = true;
    toy.vx = 0;
    toy.resting = true;
  }
}

// ── Hit tests ────────────────────────────────────────────────
export function cupHitTest(mx, my) {
  const dx = mx - cup.x, dy = my - cup.y;
  return dx > -(CUP_TW + 6) && dx < (CUP_TW + 6) && dy > -(CUP_H + 6) && dy < 6;
}

export function slinkyToyHitTest(mx, my) {
  const dx = mx - toy.x, dy = my - toy.y;
  return dx > -(CUP_TW + 6) && dx < (CUP_TW + 6) && dy > -(CUP_H + 6) && dy < 6;
}

// ── Sprites ──────────────────────────────────────────────────
export function drawCup(c, x, y, s) {
  // c = context, s = uniform scale factor (1 for canvas, ~0.65 for palette)
  s = s || 1;
  const tw = CUP_TW * s, bw = CUP_BW * s, h = CUP_H * s;
  const EY = 0.28;
  const bodyFill     = darkMode ? 'rgba(210,225,240,0.92)' : 'rgba(235,245,255,0.97)';
  const sideStroke   = darkMode ? '#889' : '#99a';
  const interiorFill = darkMode ? 'rgba(15,25,40,0.82)'    : 'rgba(185,205,228,0.80)';
  const rimStroke    = darkMode ? '#aab' : '#88a';

  c.save();
  c.translate(x, y);

  c.beginPath();
  c.moveTo(-tw, -h); c.lineTo(tw, -h); c.lineTo(bw, 0); c.lineTo(-bw, 0);
  c.closePath();
  c.fillStyle = bodyFill; c.fill();

  c.beginPath();
  c.moveTo(-tw, -h); c.lineTo(-bw, 0);
  c.moveTo( tw, -h); c.lineTo( bw, 0);
  c.strokeStyle = sideStroke; c.lineWidth = 1.5 * s; c.stroke();

  c.beginPath();
  c.ellipse(0, 0, bw, Math.max(1, bw * EY), 0, 0, Math.PI * 2);
  c.fillStyle = darkMode ? 'rgba(170,195,222,0.9)' : 'rgba(215,230,245,0.9)';
  c.fill(); c.strokeStyle = sideStroke; c.lineWidth = s; c.stroke();

  c.beginPath();
  c.ellipse(0, -h, tw, Math.max(1, tw * EY), 0, 0, Math.PI * 2);
  c.fillStyle = interiorFill; c.fill();

  c.beginPath();
  c.ellipse(0, -h, tw + 1.5 * s, Math.max(1, (tw + 1.5 * s) * EY), 0, 0, Math.PI * 2);
  c.strokeStyle = rimStroke; c.lineWidth = 2.5 * s; c.stroke();

  c.restore();
}

export function drawTieAt(c, x, y) {
  const arm    = TIE_H;
  const hw     = TIE_W;
  const spread = 0.29;
  const fill   = darkMode ? '#2d9962' : '#40c07a';
  const mid    = darkMode ? '#1a5535' : '#257840'; // darker centre line
  const knot   = darkMode ? '#144428' : '#1b5c30';

  c.save();
  c.translate(x, y);

  // Left wing — splays up-left from the knot at bottom
  c.save();
  c.rotate(-spread);
  c.beginPath();
  c.rect(-hw, -arm, hw * 2, arm);
  c.fillStyle = fill; c.fill();
  c.beginPath();
  c.moveTo(0, 0); c.lineTo(0, -arm);
  c.strokeStyle = mid; c.lineWidth = 1.5; c.stroke();
  c.restore();

  // Right wing — splays up-right
  c.save();
  c.rotate(spread);
  c.beginPath();
  c.rect(-hw, -arm, hw * 2, arm);
  c.fillStyle = fill; c.fill();
  c.beginPath();
  c.moveTo(0, 0); c.lineTo(0, -arm);
  c.strokeStyle = mid; c.lineWidth = 1.5; c.stroke();
  c.restore();

  // Knot at bottom
  c.beginPath();
  c.rect(-hw, -3, hw * 2, 6);
  c.fillStyle = knot; c.fill();

  c.restore();
}

// ── Palette (the CUP and TIE slots in the control panel) ──────
const paletteCupCtx = document.getElementById('cup-palette').getContext('2d');
const paletteTieCtx = document.getElementById('tie-palette').getContext('2d');

export function drawPaletteItems() {
  // Cup palette — draw the cup at the palette-canvas centre; faded while it's out on the canvas
  const pc = paletteCupCtx;
  const pw = pc.canvas.width, ph = pc.canvas.height;
  pc.clearRect(0, 0, pw, ph);
  pc.globalAlpha = (activeView === 'slinky' ? toy.inPalette : cup.inPalette) ? 1 : 0.2;
  drawCup(pc, pw / 2, ph - 8, 0.65);
  pc.globalAlpha = 1;

  // Tie palette
  const tc = paletteTieCtx;
  tc.clearRect(0, 0, tc.canvas.width, tc.canvas.height);
  drawTieAt(tc, tc.canvas.width / 2, tc.canvas.height / 2 + 17);
}
