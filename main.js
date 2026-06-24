// ── Wave on a String ─────────────────────────────────────────
const canvas = document.getElementById('canvas');
const ctx    = canvas.getContext('2d');

// Slider options
const AMP_VALUES  = [22, 45, 90];           // px — 1/2/4 grid boxes (no 0; ON/OFF handles that)
const AMP_LABELS  = ['1', '2', '4'];
const FREQ_VALUES = [0.25, 0.5, 1.0, 2.0]; // Hz
const FREQ_LABELS = [
  '<span class="frac"><span class="num">1</span><span class="den">4</span></span>',
  '<span class="frac"><span class="num">1</span><span class="den">2</span></span>',
  '1',
  '2',
];

let selectedAmpValue = AMP_VALUES[0]; // currently-chosen amplitude (22 px)
let driverOn         = false;         // whether continuous driver is running
let amplitude        = 0;            // smoothed amplitude (tracks targetAmplitude)
let targetAmplitude  = 0;            // 0 when driver off, selectedAmpValue when on
let frequency        = FREQ_VALUES[0];

// Phase accumulator — keeps driver position continuous across freq/amp changes
let phase = 0;

// Pulse: one half-cycle fired on demand; -1 = inactive
let pulsePhase  = -1;
let sPulsePhase = -1;

// Slow-mo: speedFactor 0.25 (turtle) → 1.0 (rabbit) steps per display frame
// Interpolation between prev and cur keeps rendering smooth below 1 step/frame
let speedFactor = 1.0;
let simAccum    = 0;
let paused      = false;
let darkMode    = false;

// Physics — CFL fixed; wave speed set here, never by the speed slider
const OFFSET  = 110;    // px from left edge before first particle
const SPACING = 10;     // px between particle centres (was 11; wave speed 264→240 px/s)
// Grid — wave speed = CFL*SPACING*FPS = 0.4*10*60 = 240 px/s
// GRID_W = λ at 2 Hz = 240/2 = 120 = 12*SPACING
// GRID_H = 30 px → minor box = 30×30 (square); divides AMP_VALUES as 1/2/4 boxes
// Major line every 4 minor boxes (120 px wide × 120 px tall)
const GRID_W    = 120;
const GRID_H    = 30;
const GRID_MINOR = GRID_W / 4;  // 30 px — minor grid subdivision
const CY_OFFSET = 2 * GRID_H;  // shift equilibrium line down 2 boxes
const RADIUS  = 5;
const FPS     = 60;
const DT      = 1 / FPS;
const CFL     = 0.4;
const CFL2    = CFL * CFL;
const MUR     = (CFL - 1) / (CFL + 1); // Mur ABC coefficient, fixed

// Simulation state (initialised in resize())
let N    = 0;
let cur  = null;
let prev = null;
let next = null;
let particleColors = null;

// ── Slinky (vertical) simulation ─────────────────────────────
const SLINKY_OFF = 80;    // px — left margin, equilibrium x of first particle
const SLINKY_SP  = 8;     // px — horizontal equilibrium spacing between particles
let sN = 0;
let sCur = null, sPrev = null, sNext = null;
let sPhase = 0;
let sAmp   = AMP_VALUES[0]; // tracks targetAmplitude with smooth lag

// ── Cup (string mode) ────────────────────────────────────────
const CUP_TW      = 14;
const CUP_BW      = 9;
const CUP_H       = 34;
const CUP_FRICTION = 0.9675;

let cup = {
  x: 0, y: 0,
  vx: 0, vy: 0,
  resting: true,
  inPalette: true,
  dragging: false,
  dragOffX: 0, dragOffY: 0,
};

// ── Toy (slinky mode) — bone sprite, bounces between coils ──
const TOY_HW = 14;  // half-width for collision (px)
const TOY_HH = 7;   // shaft half-height for collision (px)
const TOY_KR = 11;  // knob radius for hit-test (px)
const TOY_FRICTION = 0.965;

// Bone sprite — loaded once, drawn rotated 90° so it sits horizontally
const boneImg = new Image();
boneImg.src = 'images/Bone.png';

let toy = {
  x: 0, vx: 0,
  inPalette: true,
  dragging: false,
  dragOffX: 0,
  iL: -1, iR: -1,  // flanking particle indices, fixed at drop time
};


// ── Twist ties ────────────────────────────────────────────────
const TIE_W = 10;  // half-width (px)
const TIE_H = 36;  // half-height (px)

// Ties — per view. Slinky ties track slinkyParticleIndex + xEq for coil following.
const stringTies = [];  // { x, y, particleIndex, dragging, dragOffX, dragOffY }
const slinkyTies = [];  // { x, y, slinkyParticleIndex, xEq, dragging, dragOffX, dragOffY }
function curTies() { return activeView === 'slinky' ? slinkyTies : stringTies; }
let paletteCupCtx = null;
let paletteTieCtx = null;

// ── Drawings — per view ───────────────────────────────────────
const drawingsByView = { wave: [], slinky: [] };
function curDrawings() { return drawingsByView[activeView]; }

let drawMode        = false;
let activeDraw      = null;  // { x1, y1, x2, y2 } — line being drawn
let draggedLine     = null;  // { index, offX, offY } — line being moved by midpoint
let draggedEndpoint = null;  // { index, which: 1|2 } — endpoint being adjusted

const DRAW_DOT_R   = 4;
const DRAW_MID_R   = 5;   // midpoint handle radius (drawn)
const DRAW_MID_HIT = 12;  // px grab radius for midpoint
const DRAW_DOT_HIT = 10;  // px grab radius for endpoint dots

const SNAP = GRID_MINOR / 2; // 15 px — half a grid box
// Snap aligned to the actual grid origin, not global 0.
// Vertical lines start at OFFSET; horizontal lines center on cy.
function snapX(v) { return Math.round((v - OFFSET) / SNAP) * SNAP + OFFSET; }
function snapY(v) {
  let cy;
  if (activeView === 'slinky') {
    const cb = document.getElementById('controls').getBoundingClientRect().bottom;
    cy = (cb + canvas.height) / 2;
  } else {
    cy = canvas.height / 2 + CY_OFFSET;
  }
  return Math.round((v - cy) / SNAP) * SNAP + cy;
}

// ── Audio ─────────────────────────────────────────────────────
let soundEnabled = true;
let audioCtx = null;

function getAudioCtx() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return audioCtx;
}

function playSqueak(intensity) {
  // intensity: wave velocity magnitude at impact (px/step), typically 1–15
  if (!soundEnabled) return;
  const ac  = getAudioCtx();
  const vol = Math.min(1.0, intensity / 8);

  // Two oscillators: fundamental + harmonic, both sweep up then down (squeak shape)
  const dur   = 0.12 + vol * 0.08;
  const fBase = 700 + 900 * vol;

  function makeChirp(freq, gain) {
    const osc = ac.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq * 0.7, ac.currentTime);
    osc.frequency.exponentialRampToValueAtTime(freq * 1.35, ac.currentTime + dur * 0.35);
    osc.frequency.exponentialRampToValueAtTime(freq * 0.5,  ac.currentTime + dur);

    const g = ac.createGain();
    g.gain.setValueAtTime(gain, ac.currentTime);
    g.gain.setValueAtTime(gain, ac.currentTime + dur * 0.15);
    g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + dur);

    osc.connect(g); g.connect(ac.destination);
    osc.start(); osc.stop(ac.currentTime + dur);
  }

  makeChirp(fBase,        vol * 0.45);
  makeChirp(fBase * 1.85, vol * 0.18); // harmonic
}

// ── Colour ───────────────────────────────────────────────────
function particleColor(i) {
  if (i % 20 === 0) return darkMode ? '#eeeeee' : '#111111';
  const hue = Math.round((i % 20) / 20 * 360);
  return `hsl(${hue},100%,${darkMode ? 65 : 45}%)`;
}

// ── Cup logic ────────────────────────────────────────────────
function cupIndex() {
  return Math.max(1, Math.min(N - 2, Math.round((cup.x - OFFSET) / SPACING)));
}

function updateCup() {
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
   || cup.y < -CUP_H - 4  || cup.y > canvas.height + 4) {
    cup.inPalette = true;
    cup.vx = cup.vy = 0;
    cup.resting = true;
  }
}

function drawCup(c, x, y, s) {
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

function cupHitTest(mx, my) {
  const dx = mx - cup.x, dy = my - cup.y;
  return dx > -(CUP_TW + 6) && dx < (CUP_TW + 6) && dy > -(CUP_H + 6) && dy < 6;
}

function drawToy(c, x, y, scale) {
  if (!boneImg.complete || !boneImg.naturalWidth) return;
  const s  = scale || 1;
  // Bone image is tall/portrait (241×500) — draw upright, preserve aspect ratio.
  // Display size: 30×62 px at scale=1.
  const dw = 30 * s, dh = 62 * s;
  c.save();
  c.translate(x, y);
  c.drawImage(boneImg, -dw / 2, -dh / 2, dw, dh);
  c.restore();
}

function toyHitTest(mx, my, slinkyCy) {
  return Math.abs(mx - toy.x) < TOY_HW + 8 && Math.abs(my - slinkyCy) < TOY_KR + 8;
}

function drawTieAt(c, x, y) {
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

function drawTies(alpha) {
  // Slinky ties are drawn inside drawSlinky after verts are computed.
  if (activeView === 'slinky') return;
  const cy = canvas.height / 2 + CY_OFFSET;
  for (const tie of stringTies) {
    let y = tie.y;
    if (!tie.dragging && tie.particleIndex >= 0) {
      y = cy + prev[tie.particleIndex] + (cur[tie.particleIndex] - prev[tie.particleIndex]) * alpha;
    }
    drawTieAt(ctx, tie.x, y);
  }
}

function drawPaletteItems() {
  if (!paletteCupCtx || !paletteTieCtx) return;

  // Toy palette — draw toy at palette-canvas centre
  const pc = paletteCupCtx;
  const pw = pc.canvas.width, ph = pc.canvas.height;
  pc.clearRect(0, 0, pw, ph);
  if (activeView === 'slinky') {
    pc.globalAlpha = toy.inPalette ? 1 : 0.25;
    drawToy(pc, pw / 2, ph / 2, 0.765);
  } else {
    pc.globalAlpha = cup.inPalette ? 1 : 0.2;
    drawCup(pc, pw / 2, ph - 8, 0.65);
  }
  pc.globalAlpha = 1;

  // Tie palette
  const tc = paletteTieCtx;
  tc.clearRect(0, 0, tc.canvas.width, tc.canvas.height);
  drawTieAt(tc, tc.canvas.width / 2, tc.canvas.height / 2 + 17);
}


// ── Drawing tool ──────────────────────────────────────────────
function drawDrawings() {
  const color = darkMode ? 'rgba(255,255,255,0.85)' : 'rgba(0,0,0,0.75)';
  const midColor = darkMode ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.3)';

  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle   = color;
  ctx.lineWidth   = 2;
  ctx.lineCap     = 'round';

  const drawings = curDrawings();
  const allLines = activeDraw ? [...drawings, activeDraw] : drawings;

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

function lineMidpoint(d) {
  return { x: (d.x1 + d.x2) / 2, y: (d.y1 + d.y2) / 2 };
}

function nearMidpoint(mx, my) {
  const drawings = curDrawings();
  for (let i = 0; i < drawings.length; i++) {
    const m = lineMidpoint(drawings[i]);
    if (Math.hypot(mx - m.x, my - m.y) < DRAW_MID_HIT) return i;
  }
  return -1;
}

// Returns { index, which: 1|2 } for the nearest endpoint, or null
function nearEndpoint(mx, my) {
  const drawings = curDrawings();
  for (let i = 0; i < drawings.length; i++) {
    const d = drawings[i];
    if (Math.hypot(mx - d.x1, my - d.y1) < DRAW_DOT_HIT) return { index: i, which: 1 };
    if (Math.hypot(mx - d.x2, my - d.y2) < DRAW_DOT_HIT) return { index: i, which: 2 };
  }
  return null;
}

// ── Resize ───────────────────────────────────────────────────
function resize() {
  canvas.width  = canvas.offsetWidth;
  canvas.height = canvas.offsetHeight;

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

  // Slinky sim: fixed 50 grid squares long (50 × GRID_MINOR = 1500 px), extending off-screen if needed
  const newSN = Math.max(4, Math.floor(50 * GRID_MINOR / SLINKY_SP) + 2);
  if (newSN !== sN) {
    sN   = newSN;
    sCur  = new Float32Array(sN);
    sPrev = new Float32Array(sN);
    sNext = new Float32Array(sN);
  }
}

// ── Simulation step ──────────────────────────────────────────
function step() {
  for (let i = 1; i < N - 1; i++) {
    next[i] = 2 * cur[i] - prev[i]
            + CFL2 * (cur[i + 1] - 2 * cur[i] + cur[i - 1]);
  }

  amplitude += (targetAmplitude - amplitude) * 0.05;
  phase += 2 * Math.PI * frequency * DT;

  if (pulsePhase >= 0) {
    next[0]    = selectedAmpValue * Math.sin(pulsePhase);
    pulsePhase += 2 * Math.PI * frequency * DT;
    if (pulsePhase >= Math.PI) { next[0] = 0; pulsePhase = -1; }
  } else {
    next[0] = amplitude * Math.sin(phase);
  }

  next[N - 1] = cur[N - 2] + MUR * (next[N - 2] - cur[N - 1]);

  // ── Toy collision (string mode) ───────────────────────────
  // Cup occupies the y-band [upperEdge, lowerEdge] in displacement coords.
  // Any particle whose y-displacement enters the circle triggers a bounce.
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
    }
  }

  // Kill residual jitter — only zero when both cur and next are tiny,
  // so we don't introduce a discontinuity that propagates as a new wave
  for (let i = 1; i < N - 1; i++) {
    if (Math.abs(next[i]) < 0.15 && Math.abs(cur[i]) < 0.15) next[i] = 0;
  }

  const tmp = prev;
  prev = cur;
  cur  = next;
  next = tmp;
}

// ── Slinky step ──────────────────────────────────────────────
function slinkyStep() {
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

  // ── Toy motion (slinky mode) ────────────────────────────────
  // Bone is locked between particles iL and iR (set at drop time).
  // Each step it moves by exactly the average VELOCITY of those two particles —
  // tracking how much they moved, not where they are absolutely.
  // This avoids jumps from initial displacement and oscillation runaway.
  if (activeView === 'slinky' && !toy.inPalette && !toy.dragging && toy.iL >= 1 && toy.iR >= 1) {
    const velL = sNext[toy.iL] - sCur[toy.iL];
    const velR = sNext[toy.iR] - sCur[toy.iR];

    // Directly place bone at the midpoint of the two flanking particle positions.
    toy.x = SLINKY_OFF + (toy.iL + 0.5) * SLINKY_SP + (sNext[toy.iL] + sNext[toy.iR]) / 2;

    if (velL > 0 && velR < 0) {
      playSqueak((velL - velR) / 2);
    }

    const minX = SLINKY_OFF + 4;
    if (toy.x < minX) { toy.x = minX; }
    if (toy.x > canvas.width + 60) { toy.inPalette = true; toy.iL = toy.iR = -1; }
  }

  const t = sPrev; sPrev = sCur; sCur = sNext; sNext = t;
}

// ── Grid ─────────────────────────────────────────────────────
function drawGrid(cy) {
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

// ── Slinky view ──────────────────────────────────────────────
// Side view of a horizontal slinky driven by a vertical pusher plate on the left.
// Longitudinal wave: pusher oscillates left-right (parallel to slinky axis),
// creating compression/rarefaction that propagates to the right.
// Each particle's x-displacement is longitudinal; coil loops drawn in y
// so that bunching/spreading of loops reveals the compression wave.
const COIL_PITCH  = 60;  // px — one coil turn (equilibrium horizontal space)
const COIL_R      = 132; // px — coil half-height (vertical extent per turn)

// Pusher-on-rail visual constants
const RAIL_X      = 24;  // px — x of the fixed vertical guide rail
const PUSHER_W    = 5;   // px — half-width of the pusher plate
const PUSHER_H    = COIL_R + 10;  // px — half-height of pusher plate

// Slinky wave speed: double the main CFL so compressions travel faster
const SLINKY_CFL  = CFL * 2;              // = 0.8 (still CFL-stable)
const SLINKY_CFL2 = SLINKY_CFL * SLINKY_CFL;
const SLINKY_MUR  = (SLINKY_CFL - 1) / (SLINKY_CFL + 1); // Mur ABC for slinky

let activeView = 'slinky';

function drawSlinky(alpha) {
  if (!sCur) return;
  const W  = canvas.width;
  const H  = canvas.height;
  const controlsBottom = document.getElementById('controls').getBoundingClientRect().bottom;
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

  // In triangle mode: 1 vertex per quarter-pitch (3 pts per half-cycle).
  // In smooth mode:  10 sub-vertices per quarter-pitch for a curved path.
  const SUB      = 100;
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
    const sinA  = Math.sin(angle);
    // Triangle mode: perfect triangle wave.
    // Smooth mode: blend sine (rounded peaks) with triangle (steep sides).
    const yCoil = COIL_R * sinA;

    verts.push({ x, y: cy + yCoil, xEq });
  }

  // Pass 2: draw each sub-segment as its own flat-colour stroke.
  // Colour computed from equilibrium position — one rainbow per 20 grid squares.
  const lit = darkMode ? 65 : 50;

  ctx.lineWidth = SLINKY_LINE_W;
  ctx.lineCap   = 'round';
  ctx.lineJoin  = 'round';

  if (!toy.inPalette) drawToy(ctx, toy.x, cy, 1.2);
  drawPaletteItems();

  for (let i = 0; i + 1 < verts.length; i++) {
    const va  = verts[i];
    const vb  = verts[i + 1];
    // One full rainbow every 20 grid squares (20 * GRID_MINOR = 600 px)
    const hue = Math.round((va.xEq - SLINKY_OFF) / (20 * GRID_MINOR) * 360) % 360;
    ctx.strokeStyle = `hsl(${hue},90%,${lit}%)`;
    ctx.beginPath();
    ctx.moveTo(va.x, va.y);
    ctx.lineTo(vb.x, vb.y);
    ctx.stroke();
  }

  drawSlinkyTies(verts, step);
  drawDrawings();
}

// ── Draw ─────────────────────────────────────────────────────
// alpha: fraction through current step interval (0–1) for interpolation
function drawWave(alpha) {
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

  drawTies(alpha);
  if (!cup.inPalette) drawCup(ctx, cup.x, cup.y);
  drawDrawings();
  drawPaletteItems();
}

function draw(alpha) {
  if (activeView === 'slinky') drawSlinky(alpha);
  else                         drawWave(alpha);
}

// ── Loop ─────────────────────────────────────────────────────
function loop() {
  if (!paused) {
    simAccum += speedFactor;
    while (simAccum >= 1) {
      step();
      slinkyStep();
      simAccum -= 1;
    }
  }
  updateCup();
  draw(simAccum);
  requestAnimationFrame(loop);
}

// ── Controls ─────────────────────────────────────────────────
function setupTrack(trackId, valuesId, values, initial, onChange, labels) {
  const track   = document.getElementById(trackId);
  const notches = track.querySelectorAll('.notch');

  const valDiv = document.getElementById(valuesId);
  (labels || values).forEach(v => {
    const s = document.createElement('span');
    s.innerHTML = v;
    valDiv.appendChild(s);
  });

  notches.forEach((btn, i) => {
    btn.classList.toggle('active', i === initial);
    btn.addEventListener('click', () => {
      notches.forEach(n => n.classList.remove('active'));
      btn.classList.add('active');
      onChange(values[i]);
    });
  });
}

setupTrack('amp-track', 'amp-values', AMP_VALUES, 0, v => {
  selectedAmpValue = v;
  if (driverOn) targetAmplitude = v;
}, AMP_LABELS);

// Driver ON/OFF toggle
const driverBtn = document.getElementById('driver-btn');
driverBtn.addEventListener('click', () => {
  driverOn = !driverOn;
  targetAmplitude = driverOn ? selectedAmpValue : 0;
  driverBtn.textContent = driverOn ? 'OFF' : 'ON';
  driverBtn.classList.toggle('active', driverOn);
});

// Pulse — one half-cycle at current amplitude
document.getElementById('pulse-btn').addEventListener('click', () => {
  if (activeView === 'wave') { pulsePhase  = 0; }
  else                       { sPulsePhase = 0; }
});

setupTrack('freq-track', 'freq-values', FREQ_VALUES, 0, v => {
  frequency = v;
}, FREQ_LABELS);

// Speed slider: turtle (1/8 speed) → rabbit (real time)
// Physics CFL is untouched — only playback rate changes
const speedSlider = document.getElementById('speed-slider');
speedSlider.addEventListener('input', () => {
  speedFactor = Number(speedSlider.value) / 8; // 1→0.125, 8→1.0
});

// Pause / step
const pauseBtn = document.getElementById('pause-btn');
const stepBtn  = document.getElementById('step-btn');

pauseBtn.addEventListener('click', () => {
  paused = !paused;
  simAccum = 0; // avoid burst of steps on resume
  pauseBtn.classList.toggle('active', paused);
  pauseBtn.textContent = paused ? '▶' : '⏸';
});

stepBtn.addEventListener('click', () => {
  if (activeView === 'slinky') slinkyStep();
  else                         step();
  draw(1);
});

// Theme toggle
document.getElementById('theme-btn').addEventListener('click', () => {
  darkMode = !darkMode;
  document.body.classList.toggle('dark', darkMode);
  // Rebuild particle colors for new theme
  if (particleColors) {
    for (let i = 0; i < N; i++) particleColors[i] = particleColor(i);
  }
});

// Sound toggle
document.getElementById('sound-cb').addEventListener('change', e => {
  soundEnabled = e.target.checked;
});

// View tabs
const toyLabel = document.getElementById('toy-label');
function updateToyLabel() { toyLabel.textContent = activeView === 'slinky' ? 'TOY' : 'CUP'; }

document.querySelectorAll('.view-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    activeView = btn.dataset.view;
    document.querySelectorAll('.view-btn').forEach(b => b.classList.toggle('active', b === btn));
    updateToyLabel();
    // Cancel any in-progress draw when switching views
    activeDraw = null; draggedLine = null; draggedEndpoint = null;
  });
});
updateToyLabel(); // set on init

// Draw mode toggle
document.getElementById('draw-btn').addEventListener('click', () => {
  drawMode = !drawMode;
  document.getElementById('draw-btn').classList.toggle('active', drawMode);
  canvas.style.cursor = drawMode ? 'crosshair' : 'default';
});

// Clear — clears the current view's ties and drawings
document.getElementById('clear-all-btn').addEventListener('click', () => {
  curDrawings().length = 0;
  curTies().length     = 0;
  activeDraw      = null;
  draggedLine     = null;
  draggedEndpoint = null;
  if (activeView === 'slinky') {
    toy.inPalette = true;
    toy.vx = 0;
  } else {
    cup.inPalette = true;
    cup.vx = cup.vy = 0;
    cup.resting = true;
  }
});

// ── Drag handling ─────────────────────────────────────────────
function canvasMouse(e) {
  const r = canvas.getBoundingClientRect();
  return [
    (e.clientX - r.left) * (canvas.width  / r.width),
    (e.clientY - r.top)  * (canvas.height / r.height),
  ];
}

// Grab canvas items
canvas.addEventListener('mousedown', e => {
  const [mx, my] = canvasMouse(e);

  // Draw mode takes priority
  if (drawMode) {
    const ep = nearEndpoint(mx, my);
    if (ep) {
      draggedEndpoint = ep;
      e.preventDefault(); return;
    }
    const hitIdx = nearMidpoint(mx, my);
    if (hitIdx >= 0) {
      const m = lineMidpoint(curDrawings()[hitIdx]);
      draggedLine = { index: hitIdx, offX: m.x - mx, offY: m.y - my };
      e.preventDefault(); return;
    }
    activeDraw = { x1: mx, y1: my, x2: mx, y2: my };
    e.preventDefault(); return;
  }

  // Ties take priority over cup
  if (activeView === 'slinky') {
    const cb = document.getElementById('controls').getBoundingClientRect().bottom;
    const cy = (cb + canvas.height) / 2;
    for (const tie of slinkyTies) {
      let tieX = tie.x, tieY = tie.y;
      if (!tie.dragging && tie.slinkyParticleIndex >= 0) {
        const pi  = tie.slinkyParticleIndex;
        tieX = tie.xEq + sCur[pi];
        const angle = (tie.xEq - SLINKY_OFF) / COIL_PITCH * Math.PI * 2 + Math.PI / 2;
        tieY = cy + COIL_R * Math.sin(angle);
      }
      if (Math.abs(mx - tieX) < TIE_W + 8 && Math.abs(my - tieY) < TIE_H + 8) {
        tie.dragging  = true;
        tie.dragOffX  = tieX - mx;
        tie.dragOffY  = tieY - my;
        tie.slinkyParticleIndex = -1; // detach while dragging
        tie.x = tieX; tie.y = tieY;
        e.preventDefault(); return;
      }
    }
  } else {
    const cy = canvas.height / 2 + CY_OFFSET;
    for (const tie of stringTies) {
      const tieY = tie.dragging ? tie.y : cy;
      if (Math.abs(mx - tie.x) < TIE_W + 5 && Math.abs(my - tieY) < TIE_H + 5) {
        tie.dragging  = true;
        tie.dragOffX  = tie.x - mx;
        tie.dragOffY  = tieY - my;
        e.preventDefault(); return;
      }
    }
  }

  if (activeView === 'slinky') {
    if (!toy.inPalette) {
      const cb = document.getElementById('controls').getBoundingClientRect().bottom;
      const slinkyCy = (cb + canvas.height) / 2;
      if (toyHitTest(mx, my, slinkyCy)) {
        toy.dragging = true;
        toy.dragOffX = toy.x - mx;
        toy.vx = 0;
        e.preventDefault();
      }
    }
  } else {
    if (!cup.inPalette && cupHitTest(mx, my)) {
      cup.dragging = true;
      cup.resting  = false;
      cup.vx = cup.vy = 0;
      cup.dragOffX = cup.x - mx;
      cup.dragOffY = cup.y - my;
      e.preventDefault();
    }
  }
});

// Drag from palette — toy (slinky) or cup (string)
document.getElementById('cup-palette').addEventListener('mousedown', e => {
  const [mx, my] = canvasMouse(e);
  if (activeView === 'slinky') {
    if (!toy.inPalette) return;
    toy.inPalette = false;
    toy.dragging  = true;
    toy.x = mx;
    toy.vx = 0;
    toy.dragOffX = 0;
    toy.iL = toy.iR = -1;
  } else {
    if (!cup.inPalette) return;
    cup.inPalette = false;
    cup.dragging  = true;
    cup.resting   = false;
    cup.vx = cup.vy = 0;
    cup.x = mx;
    cup.y = my + CUP_H;
    cup.dragOffX = 0;
    cup.dragOffY = CUP_H;
  }
  e.preventDefault();
});

// Drag from palette — tie (unlimited supply)
document.getElementById('tie-palette').addEventListener('mousedown', e => {
  const [mx, my] = canvasMouse(e);
  if (activeView === 'slinky') {
    slinkyTies.push({ x: mx, y: my, slinkyParticleIndex: -1, xEq: 0, dragging: true, dragOffX: 0, dragOffY: 0 });
  } else {
    stringTies.push({ x: mx, y: my, particleIndex: -1, dragging: true, dragOffX: 0, dragOffY: 0 });
  }
  e.preventDefault();
});

// Move
window.addEventListener('mousemove', e => {
  const [mx, my] = canvasMouse(e);

  if (drawMode) {
    const drawings = curDrawings();
    if (activeDraw) {
      activeDraw.x2 = mx;
      activeDraw.y2 = my;
    } else if (draggedEndpoint !== null) {
      const d = drawings[draggedEndpoint.index];
      if (draggedEndpoint.which === 1) {
        drawings[draggedEndpoint.index] = { ...d, x1: mx, y1: my };
      } else {
        drawings[draggedEndpoint.index] = { ...d, x2: mx, y2: my };
      }
    } else if (draggedLine !== null) {
      const d = drawings[draggedLine.index];
      const newMidX = mx + draggedLine.offX;
      const newMidY = my + draggedLine.offY;
      const halfDx = (d.x2 - d.x1) / 2;
      const halfDy = (d.y2 - d.y1) / 2;
      drawings[draggedLine.index] = {
        x1: newMidX - halfDx, y1: newMidY - halfDy,
        x2: newMidX + halfDx, y2: newMidY + halfDy,
      };
    } else {
      // Cursor hint: grab over endpoints or midpoints, crosshair elsewhere
      const overGrab = nearEndpoint(mx, my) !== null || nearMidpoint(mx, my) >= 0;
      canvas.style.cursor = overGrab ? 'grab' : 'crosshair';
    }
    return;
  }

  if (cup.dragging) { cup.x = mx + cup.dragOffX; cup.y = my + cup.dragOffY; }
  if (toy.dragging) { toy.x = mx + toy.dragOffX; }

  for (const tie of curTies()) {
    if (tie.dragging) { tie.x = mx + tie.dragOffX; tie.y = my + tie.dragOffY; }
  }

  const anyDrag = cup.dragging || toy.dragging || curTies().some(t => t.dragging);
  if (!anyDrag) {
    let overGrab = false;
    if (activeView === 'slinky' && !toy.inPalette) {
      const cb = document.getElementById('controls').getBoundingClientRect().bottom;
      overGrab = toyHitTest(mx, my, (cb + canvas.height) / 2);
    } else if (activeView === 'wave' && !cup.inPalette) {
      overGrab = cupHitTest(mx, my);
    }
    canvas.style.cursor = overGrab ? 'grab' : 'default';
  }
});

// Drop
window.addEventListener('mouseup', e => {
  if (drawMode) {
    if (activeDraw) {
      // Only keep lines with meaningful length
      if (Math.hypot(activeDraw.x2 - activeDraw.x1, activeDraw.y2 - activeDraw.y1) > 4) {
        curDrawings().push({ ...activeDraw });
      }
      activeDraw = null;
    }
    draggedLine     = null;
    draggedEndpoint = null;
    return;
  }

  if (cup.dragging) {
    cup.dragging = false;
    cup.resting  = true;
    canvas.style.cursor = 'default';
    // Return to palette if off-canvas or dropped behind the controls panel
    const cr  = canvas.getBoundingClientRect();
    const ctr = document.getElementById('controls').getBoundingClientRect();
    const scaleX = canvas.width  / cr.width;
    const scaleY = canvas.height / cr.height;
    const ctrlL = (ctr.left   - cr.left) * scaleX;
    const ctrlR = (ctr.right  - cr.left) * scaleX;
    const ctrlT = (ctr.top    - cr.top)  * scaleY;
    const ctrlB = (ctr.bottom - cr.top)  * scaleY;
    const cupTop = cup.y - CUP_H;
    const hidden = cup.x > ctrlL && cup.x < ctrlR && cupTop < ctrlB && cup.y > ctrlT;
    if (cup.x < -CUP_TW || cup.x > canvas.width + CUP_TW || hidden) {
      cup.inPalette = true;
      cup.vx = cup.vy = 0;
      cup.resting = true;
    }
  }

  if (toy.dragging) {
    toy.dragging = false;
    canvas.style.cursor = 'default';
    if (toy.x < SLINKY_OFF || toy.x > canvas.width + 60) {
      toy.inPalette = true;
      toy.vx = 0;
      toy.iL = toy.iR = -1;
    } else {
      // Lock flanking particle indices at drop position
      toy.iL = Math.max(1, Math.min(sN - 2, Math.floor((toy.x - SLINKY_OFF) / SLINKY_SP)));
      toy.iR = Math.min(sN - 2, toy.iL + 1);
      // Snap x to exact coil boundary so positional tracking starts without a jump
      toy.x = SLINKY_OFF + (toy.iL + 0.5) * SLINKY_SP + (sCur[toy.iL] + sCur[toy.iR]) / 2;
    }
  }

  if (activeView === 'slinky') {
    for (let i = slinkyTies.length - 1; i >= 0; i--) {
      const tie = slinkyTies[i];
      if (!tie.dragging) continue;
      tie.dragging = false;
      // Snap to nearest slinky particle by x
      const pi = Math.round((tie.x - SLINKY_OFF) / SLINKY_SP);
      if (pi >= 1 && pi <= sN - 2 && tie.x >= 0 && tie.x <= canvas.width + 60) {
        tie.slinkyParticleIndex = pi;
        tie.xEq = SLINKY_OFF + pi * SLINKY_SP;
      } else {
        slinkyTies.splice(i, 1); // off canvas — discard
      }
    }
  } else {
    for (let i = stringTies.length - 1; i >= 0; i--) {
      const tie = stringTies[i];
      if (!tie.dragging) continue;
      tie.dragging = false;
      const pi = Math.round((tie.x - OFFSET) / SPACING);
      if (pi >= 1 && pi <= N - 2) {
        tie.particleIndex = pi;
        tie.x = OFFSET + pi * SPACING;
      } else {
        stringTies.splice(i, 1); // dropped off string — discard
      }
    }
  }
});

// ── Init ─────────────────────────────────────────────────────
paletteCupCtx = document.getElementById('cup-palette').getContext('2d');
paletteTieCtx = document.getElementById('tie-palette').getContext('2d');
resize();
window.addEventListener('resize', resize);
loop();
