// ═══ Slinky view: the LONGITUDINAL wave ('slinky') ══════════════════════════
// A horizontal coil whose particles move left/right (x); compressions travel
// left → right. Here: its simulation state, slinkyStep() (one physics tick), and
// drawSlinky() (one frame: pusher plate, rainbow coil, cup, ties, lines).
import { canvas, ctx, activeView, darkMode, frequency, targetAmplitude, selectedAmpValue,
         controlsBottom } from './state.js';
import { AMP_VALUES, FREQ_VALUES, FPS, DT, GRID_W, GRID_MINOR, SLINKY_OFF, SLINKY_SP,
         SLINKY_CFL, SLINKY_CFL2, SLINKY_MUR, CUP_TW, CUP_FRICTION } from './config.js';
import { toy, slinkyTies, drawCup, drawTieAt } from './props.js';
import { drawGrid } from './grid.js';
import { drawLines } from './lines.js';
import { playSmack, waveEnergy } from './audio.js';

// ── Visual constants ─────────────────────────────────────────
// Side view of a horizontal slinky driven by a pusher plate on the left that
// slides left-right along a fixed rail. Coil loops are drawn with a fixed
// vertical extent, so the bunching/spreading of loops reveals the wave.
export const COIL_PITCH  = 60;  // px — one coil turn (equilibrium horizontal space)
export const COIL_R      = 132; // px — coil half-height (vertical extent per turn)

// Pusher-on-rail
const RAIL_X      = 24;  // px — x of the fixed vertical guide rail
const PUSHER_W    = 5;   // px — half-width of the pusher plate
const PUSHER_H    = COIL_R + 10;  // px — half-height of pusher plate

// Sub-vertices per quarter coil-pitch when drawing the slinky wire. Higher =
// smoother curve but more per-frame vertex allocation (each vertex is an object
// built every frame). 14 is visually indistinguishable from the old 100 with
// round line joins. Tunable live via the hidden dev panel (type "dev").
export let SLINKY_SUB = 14;

// The longest wavelength (lowest frequency), in particles — how far upstream of the
// cup to measure the wave's energy when it hits (clipped to the slinky's length).
const MAX_WAVELENGTH = Math.ceil(SLINKY_CFL * FPS / Math.min(...FREQ_VALUES));
export function setSlinkySub(v) { SLINKY_SUB = v; }

// ── Simulation state (sized by resizeSlinky()) ───────────────
// Each particle's value is its x displacement.
export let sN = 0;
export let sCur = null, sPrev = null;
let sNext = null;
let sPhase = 0;
let sAmp   = AMP_VALUES[0]; // tracks targetAmplitude with smooth lag
let sPulsePhase = -1;       // pulse: one half-cycle fired on demand; -1 = inactive

export function startSlinkyPulse() { sPulsePhase = 0; }

// ── Resize — (re)allocates the arrays ────────────────────────
// Fixed length: 8 big squares minus 4 small (1500 px), extending off-screen if needed.
export function resizeSlinky() {
  const newSN = Math.floor((8 * GRID_W - 4 * GRID_MINOR) / SLINKY_SP) + 1;
  if (newSN !== sN) {
    sN   = newSN;
    sCur  = new Float32Array(sN);
    sPrev = new Float32Array(sN);
    sNext = new Float32Array(sN);
  }
}

// ── Simulation step ──────────────────────────────────────────
// Same wave equation and buffer-roll as the string's step(), but with the faster
// slinky CFL. Drives the left end, absorbs on the right, and handles cup collisions.
export function slinkyStep() {
  if (!sCur) return;
  for (let i = 1; i < sN - 1; i++) {
    sNext[i] = 2 * sCur[i] - sPrev[i]
             + SLINKY_CFL2 * (sCur[i + 1] - 2 * sCur[i] + sCur[i - 1]);
  }
  sAmp += (targetAmplitude - sAmp) * 0.05;
  sPhase += 2 * Math.PI * frequency * DT;

  if (sPulsePhase >= 0) {
    sNext[0]    = selectedAmpValue * Math.sin(sPulsePhase);
    sPulsePhase += 2 * Math.PI * frequency * DT;
    if (sPulsePhase >= Math.PI) { sNext[0] = 0; sPulsePhase = -1; }
  } else {
    sNext[0] = sAmp * Math.sin(sPhase);
  }
  sNext[sN - 1] = sCur[sN - 2] + SLINKY_MUR * (sNext[sN - 2] - sCur[sN - 1]);
  for (let i = 1; i < sN - 1; i++) {
    if (Math.abs(sNext[i]) < 0.15 && Math.abs(sCur[i]) < 0.15) sNext[i] = 0;
  }

  // ── Cup collision ────────────────────────────────────────────
  // Watch the single particle just to the LEFT of the cup's left face.
  // When the compression front pushes it across that edge, kick the cup rightward.
  // Particles near the cup center are already inside the x-range at equilibrium,
  // so only the left-face crossing gives a clean one-shot trigger per wave front.
  if (activeView === 'slinky' && !toy.inPalette && !toy.dragging) {
    const slinkyEnd = SLINKY_OFF + (sN - 1) * SLINKY_SP;
    // Clamp trigger point to last interior particle so cup anywhere to the right gets hit
    const triggerX = Math.min(toy.x - CUP_TW, SLINKY_OFF + (sN - 2) * SLINKY_SP + 1);
    const iHit     = Math.min(sN - 2, Math.max(1, Math.floor((triggerX - SLINKY_OFF) / SLINKY_SP)));
    const curX     = SLINKY_OFF + iHit * SLINKY_SP + sCur[iHit];
    const nextX    = SLINKY_OFF + iHit * SLINKY_SP + sNext[iHit];
    const vel      = sNext[iHit] - sCur[iHit];
    if (curX < triggerX && nextX >= triggerX && vel > 0) {
      const energyVx  = selectedAmpValue * frequency * 0.8 * 4 / 27;
      const clearDist = Math.max(0, slinkyEnd + 4 - (toy.x - CUP_TW));
      const minVx     = clearDist * (1 - CUP_FRICTION);
      toy.vx      = Math.max(energyVx, minVx);
      toy.resting = false;
      playSmack(waveEnergy(sCur, sPrev, iHit - MAX_WAVELENGTH, iHit, SLINKY_CFL));
    }
  }

  const t = sPrev; sPrev = sCur; sCur = sNext; sNext = t;
}

// ── Rendering ────────────────────────────────────────────────
// Draws slinky ties using precomputed verts so position exactly matches the wire.
function drawSlinkyTies(verts, step) {
  for (const tie of slinkyTies) {
    if (tie.dragging) { drawTieAt(ctx, tie.x, tie.y); continue; }
    if (tie.slinkyParticleIndex < 0) continue;
    const idx = Math.max(0, Math.min(verts.length - 1,
      Math.round((tie.xEq - SLINKY_OFF) / step)));
    const v = verts[idx];
    drawTieAt(ctx, v.x, v.y);
  }
}

export function drawSlinky(alpha) {
  if (!sCur) return;
  const W  = canvas.width;
  const H  = canvas.height;
  const cy = (controlsBottom + H) / 2;

  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = darkMode ? '#111' : '#f7f6f0';
  ctx.fillRect(0, 0, W, H);

  drawGrid(cy);

  const fg  = darkMode ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.15)';
  const fg2 = darkMode ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.40)';

  // ── Vertical guide rail (fixed on left) ─────────────────────
  ctx.strokeStyle = fg2;
  ctx.lineWidth   = 2;
  ctx.beginPath();
  ctx.moveTo(RAIL_X, cy - PUSHER_H - 10);
  ctx.lineTo(RAIL_X, cy + PUSHER_H + 10);
  ctx.stroke();

  // ── Pusher plate (slides left-right along the rail) ──────────
  // Longitudinal driver: displacement is along the wave axis (x).
  const plateDisp = sPrev[0] + (sCur[0] - sPrev[0]) * alpha;
  const pusherX   = SLINKY_OFF + plateDisp;

  ctx.fillStyle = fg2;
  ctx.fillRect(pusherX - PUSHER_W, cy - PUSHER_H, PUSHER_W * 2, PUSHER_H * 2);

  // Horizontal arm connecting rail to pusher plate
  ctx.strokeStyle = fg;
  ctx.lineWidth   = 2;
  ctx.beginPath();
  ctx.moveTo(RAIL_X, cy);
  ctx.lineTo(pusherX - PUSHER_W, cy);
  ctx.stroke();

  // ── Slinky wire ──────────────────────────────────────────────
  const slinkyEnd    = SLINKY_OFF + (sN - 1) * SLINKY_SP;
  const quarterPitch = COIL_PITCH / 4;
  const SLINKY_LINE_W = 8; // must match ctx.lineWidth below

  // SLINKY_SUB sub-vertices per quarter-pitch give a smooth curved path.
  const SUB      = SLINKY_SUB;
  const step     = quarterPitch / SUB;   // equilibrium spacing between vertices
  const hcStride = 2 * SUB;             // vertex count per half-cycle

  let zeroCrossX    = pusherX + PUSHER_W;
  let sectionStartX = zeroCrossX;

  // Pass 1: generate vertices with no-crossing clamping.
  // Section boundaries occur at every quarter-pitch (both zero crossings AND peaks).
  //   • Zero crossings (k % hcStride === 0): enforce SLINKY_LINE_W gap so adjacent
  //     half-cycles don't overdraw each other.
  //   • Peaks (k % SUB === 0 but not a zero crossing): no gap — they're the shared
  //     tip of the up and down sections — but sectionStartX advances to peak x so the
  //     down-slope sub-vertices can't slide back left through the up-stroke.
  //   • Sub-vertices within a quarter-section: clamp to that section's start x only.
  const verts = [];
  for (let k = 0; ; k++) {
    const xEq = SLINKY_OFF + k * step;
    if (xEq > slinkyEnd) break;

    const fi   = (xEq - SLINKY_OFF) / SLINKY_SP;
    const i0   = Math.max(0, Math.min(sN - 2, Math.floor(fi)));
    const frac = fi - i0;
    const d0   = sPrev[i0]     + (sCur[i0]     - sPrev[i0])     * alpha;
    const d1   = sPrev[i0 + 1] + (sCur[i0 + 1] - sPrev[i0 + 1]) * alpha;
    const disp = d0 + (d1 - d0) * frac;

    let x;
    if (k % hcStride === 0) {
      // Zero crossing: enforce minimum gap from previous zero crossing
      x = Math.max(zeroCrossX + (k === 0 ? 0 : SLINKY_LINE_W), xEq + disp);
      zeroCrossX    = x;
      sectionStartX = x;
    } else if (k % SUB === 0) {
      // Peak/trough: shared tip — no gap, but lock sectionStartX so down-slope
      // sub-vertices can't go left of the peak.
      x = Math.max(sectionStartX, xEq + disp);
      sectionStartX = x;
    } else {
      // Sub-vertex: clamp to current section's start only
      x = Math.max(sectionStartX, xEq + disp);
    }

    const angle = ((xEq - SLINKY_OFF) / COIL_PITCH) * Math.PI * 2 + Math.PI / 2;
    const yCoil = COIL_R * Math.sin(angle);

    verts.push({ x, y: cy + yCoil, xEq });
  }

  // Pass 2: draw the wire. Colour comes from equilibrium position — one rainbow
  // per 20 grid squares.
  const lit = darkMode ? 65 : 50;

  ctx.lineWidth = SLINKY_LINE_W;
  ctx.lineCap   = 'round';
  ctx.lineJoin  = 'round';

  const clipX = !toy.inPalette ? toy.x - CUP_TW : Infinity;
  // Perf: the rainbow is the only reason to split the coil into sub-segments.
  // Stroking all ~5600 of them individually is the bottleneck on slow machines.
  // Consecutive segments share almost the same hue, so batch each run of
  // near-equal hue into ONE polyline and stroke once per colour band.
  const HUE_BAND = 4; // deg — band width; 4° is imperceptible on an 8px line
  const hueOf = (xEq) => Math.round((xEq - SLINKY_OFF) / (20 * GRID_MINOR) * 360);
  let curBand = null, open = false;
  const flush = () => { if (open) { ctx.stroke(); open = false; } };
  for (let i = 0; i + 1 < verts.length; i++) {
    const va  = verts[i];
    if (va.x >= clipX) break;
    const vb  = verts[i + 1];
    // Clip the endpoint at the cup's left face
    const bx = Math.min(vb.x, clipX);
    const by = bx < vb.x ? va.y + (vb.y - va.y) * (bx - va.x) / (vb.x - va.x) : vb.y;
    const band = Math.round(hueOf(va.xEq) / HUE_BAND) * HUE_BAND;
    if (band !== curBand) {
      flush();
      curBand = band;
      ctx.strokeStyle = `hsl(${((band % 360) + 360) % 360},90%,${lit}%)`;
      ctx.beginPath();
      ctx.moveTo(va.x, va.y);
      open = true;
    }
    ctx.lineTo(bx, by);
  }
  flush();

  if (!toy.inPalette) drawCup(ctx, toy.x, toy.y);
  drawSlinkyTies(verts, step);
  drawLines();
}
