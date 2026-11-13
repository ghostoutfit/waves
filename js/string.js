// ═══ String view: the TRANSVERSE wave ('wave') ══════════════════════════════
// A row of particles that move up/down (y); the wave travels left → right.
// Here: its simulation state, step() (one physics tick), and drawWave() (one frame).
import { canvas, ctx, activeView, darkMode, frequency, targetAmplitude, selectedAmpValue } from './state.js';
import { OFFSET, SPACING, CY_OFFSET, FPS, DT, CFL, CFL2, MUR, CUP_TW, CUP_H, FREQ_VALUES } from './config.js';
import { cup, stringTies, drawCup, drawTieAt } from './props.js';
import { drawGrid } from './grid.js';
import { drawLines } from './lines.js';
import { playSmack, waveEnergy } from './audio.js';

const RADIUS = 5;   // px — particle radius
// The longest wavelength (lowest frequency), in particles — how far upstream of the
// cup to measure the wave's energy when it hits.
const MAX_WAVELENGTH = Math.ceil(CFL * FPS / Math.min(...FREQ_VALUES));

// ── Simulation state (sized by resizeString()) ───────────────
// Each particle's value is its y displacement. prev / cur / next are the last,
// current and next tick; step() rolls them.
export let N    = 0;
export let cur  = null;
export let prev = null;
let next = null;
let particleColors = null;

let amplitude  = 0;   // smoothed amplitude (tracks targetAmplitude)
let phase      = 0;   // driver phase — keeps it continuous across freq/amp changes
let pulsePhase = -1;  // pulse: one half-cycle fired on demand; -1 = inactive

export function startStringPulse() { pulsePhase = 0; }

// ── Colour ───────────────────────────────────────────────────
// A rainbow every 20 particles, with a black (white in dark mode) marker particle.
function particleColor(i) {
  if (i % 20 === 0) return darkMode ? '#eeeeee' : '#111111';
  const hue = Math.round((i % 20) / 20 * 360);
  return `hsl(${hue},100%,${darkMode ? 65 : 45}%)`;
}
// Rebuild particle colours (after a theme change)
export function recolourString() {
  if (particleColors) {
    for (let i = 0; i < N; i++) particleColors[i] = particleColor(i);
  }
}

// ── Resize — (re)allocates the arrays to fit the canvas width ─
// The ONLY place the string's prev/cur/next Float32Arrays are created.
export function resizeString() {
  const newN = Math.floor((canvas.width - OFFSET) / SPACING) + 1;
  if (newN !== N) {
    N = newN;
    cur  = new Float32Array(N);
    prev = new Float32Array(N);
    next = new Float32Array(N);
    particleColors = Array.from({ length: N }, (_, i) => particleColor(i));
    if (cup.resting && !cup.dragging && !cup.inPalette) {
      cup.x = canvas.width - 80;
      cup.y = canvas.height / 2 + CY_OFFSET;
    }
  }
}

// ── Simulation step ──────────────────────────────────────────
// Advances the string one tick. Standard finite-difference wave equation:
// each particle's next position is derived from its own + its neighbours'
// current and previous positions. Then: drive the left end (particle 0),
// absorb at the right end, handle cup collisions, and roll the buffers.
export function step() {
  // Interior: next = 2·cur − prev + CFL²·(curvature of neighbours)
  for (let i = 1; i < N - 1; i++) {
    next[i] = 2 * cur[i] - prev[i]
            + CFL2 * (cur[i + 1] - 2 * cur[i] + cur[i - 1]);
  }

  // Left end (particle 0) is the driver. Ease amplitude toward its target so
  // turning the driver on/off ramps smoothly instead of snapping.
  amplitude += (targetAmplitude - amplitude) * 0.05;
  phase += 2 * Math.PI * frequency * DT;

  if (pulsePhase >= 0) {
    // Pulse mode: emit a single half-sine, then clamp back to rest.
    next[0]    = -selectedAmpValue * Math.sin(pulsePhase);
    pulsePhase += 2 * Math.PI * frequency * DT;
    if (pulsePhase >= Math.PI) { next[0] = 0; pulsePhase = -1; }
  } else {
    // Continuous driver: a plain sine at the chosen amplitude + frequency.
    next[0] = amplitude * Math.sin(phase);
  }

  // Right end: Mur absorbing boundary — waves exit cleanly, no reflection.
  next[N - 1] = cur[N - 2] + MUR * (next[N - 2] - cur[N - 1]);

  // ── Cup collision ─────────────────────────────────────────
  // Cup occupies the y-band [upperEdge, lowerEdge] in displacement coords.
  // Any particle whose y-displacement enters that band triggers a bounce.
  if (activeView === 'wave' && !cup.inPalette && !cup.dragging) {
    const cy        = canvas.height / 2 + CY_OFFSET;
    const lowerEdge = cup.y - cy;        // cup base in displacement coords
    const upperEdge = cup.y - CUP_H - cy; // cup rim
    const iLeft  = Math.max(1, Math.floor((cup.x - CUP_TW - OFFSET) / SPACING));
    const iRight = Math.min(N - 2, Math.ceil((cup.x + CUP_TW - OFFSET) / SPACING));

    let velSum = 0, hits = 0;

    for (let i = iLeft; i <= iRight; i++) {
      const outside = cur[i]  < upperEdge || cur[i]  > lowerEdge;
      const enters  = next[i] >= upperEdge && next[i] <= lowerEdge;
      if (outside && enters) {
        velSum += next[i] - cur[i];
        hits++;
      }
    }

    if (hits > 0) {
      const avgVel = velSum / hits;
      cup.vy      = avgVel;
      cup.vx      = Math.abs(cup.vy) * 0.3;
      cup.resting = false;
      playSmack(waveEnergy(cur, prev, iLeft - MAX_WAVELENGTH, iLeft, CFL));
    }
  }

  // Kill residual jitter — only zero when both cur and next are tiny,
  // so we don't introduce a discontinuity that propagates as a new wave
  for (let i = 1; i < N - 1; i++) {
    if (Math.abs(next[i]) < 0.15 && Math.abs(cur[i]) < 0.15) next[i] = 0;
  }

  // Roll the buffers: cur→prev, next→cur, and reuse the old prev as next.
  const tmp = prev;
  prev = cur;
  cur  = next;
  next = tmp;
}

// ── Rendering ────────────────────────────────────────────────
// Ties ride their particle's interpolated y.
function drawStringTies(alpha) {
  const cy = canvas.height / 2 + CY_OFFSET;
  for (const tie of stringTies) {
    let y = tie.y;
    if (!tie.dragging && tie.particleIndex >= 0) {
      y = cy + prev[tie.particleIndex] + (cur[tie.particleIndex] - prev[tie.particleIndex]) * alpha;
    }
    drawTieAt(ctx, tie.x, y);
  }
}

// Draws the transverse string: background, grid, driver stick, the row of
// coloured particles, then props. alpha = fraction through the current step
// interval (0–1), used to interpolate particle positions for smooth motion.
export function drawWave(alpha) {
  const W  = canvas.width;
  const H  = canvas.height;
  const cy = H / 2 + CY_OFFSET;

  ctx.clearRect(0, 0, W, H);

  ctx.fillStyle = darkMode ? '#111' : '#f7f6f0';
  ctx.fillRect(0, 0, W, H);

  drawGrid();

  // Interpolated position of first particle for stick
  const y0 = cy + (prev[0] + (cur[0] - prev[0]) * alpha);

  // Tilting stick — solid grey, same width as ball diameter
  ctx.strokeStyle = darkMode ? '#666' : '#999';
  ctx.lineWidth   = RADIUS * 2;
  ctx.lineCap     = 'round';
  ctx.beginPath();
  ctx.moveTo(-160, cy);
  ctx.lineTo(OFFSET, y0);
  ctx.stroke();

  // Particles — interpolated between prev and cur
  const R = RADIUS;
  for (let i = 0; i < N; i++) {
    const x = OFFSET + i * SPACING;
    const y = cy + prev[i] + (cur[i] - prev[i]) * alpha;
    ctx.beginPath();
    ctx.arc(x, y, R, 0, Math.PI * 2);
    ctx.fillStyle = particleColors[i];
    ctx.fill();
  }

  drawStringTies(alpha);
  if (!cup.inPalette) drawCup(ctx, cup.x, cup.y);
  drawLines();
}
