// ── Wave on a String ─────────────────────────────────────────
const canvas = document.getElementById('canvas');
const ctx    = canvas.getContext('2d');

// Slider options
const AMP_VALUES  = [0, 20, 50, 100];      // px (0 = off)
const AMP_LABELS  = ['0', '2', '5', '10'];
const FREQ_VALUES = [0.25, 0.5, 1.0, 2.0]; // Hz
const FREQ_LABELS = [
  '<span class="frac"><span class="num">1</span><span class="den">4</span></span>',
  '<span class="frac"><span class="num">1</span><span class="den">2</span></span>',
  '1',
  '2',
];

let amplitude       = AMP_VALUES[0];
let targetAmplitude = AMP_VALUES[0];
let frequency       = FREQ_VALUES[0];

// Phase accumulator — keeps driver position continuous across freq/amp changes
let phase = 0;

// Slow-mo: speedFactor 0.25 (turtle) → 1.0 (rabbit) steps per display frame
// Interpolation between prev and cur keeps rendering smooth below 1 step/frame
let speedFactor = 1.0;
let simAccum    = 0;
let paused      = false;
let darkMode    = false;

// Physics — CFL fixed; wave speed set here, never by the speed slider
const OFFSET  = 110;    // px from left edge before first particle
const SPACING = 11;     // px between particle centres
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

// ── Cup ──────────────────────────────────────────────────────
const CUP_TW      = 14;   // half top-width (px)
const CUP_BW      = 9;    // half bottom-width (px)
const CUP_H       = 34;   // height (px)
const CUP_FRICTION = 0.9675; // velocity multiplier per frame (floor friction)

let cup = {
  x: 0, y: 0,
  vx: 0, vy: 0,
  resting: true,
  inPalette: true,
  dragging: false,
  dragOffX: 0, dragOffY: 0,
};

// ── Twist ties ────────────────────────────────────────────────
const TIE_W = 5;   // half-width (px)
const TIE_H = 18;  // half-height (px)

let ties = []; // { x, y, particleIndex (-1=unattached), dragging, dragOffX, dragOffY }
let paletteCupCtx = null;
let paletteTieCtx = null;

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

  const offScreen = cup.x < -CUP_TW || cup.x > canvas.width + CUP_TW
                 || cup.y < -CUP_H  || cup.y > canvas.height + CUP_H;

  const cr = document.getElementById('controls').getBoundingClientRect();
  const canvasR = canvas.getBoundingClientRect();
  const cx1 = (cr.left   - canvasR.left) * (canvas.width  / canvasR.width);
  const cy1 = (cr.top    - canvasR.top)  * (canvas.height / canvasR.height);
  const cx2 = cx1 + cr.width  * (canvas.width  / canvasR.width);
  const cy2 = cy1 + cr.height * (canvas.height / canvasR.height);
  const underToolbar = cup.x + CUP_TW > cx1 && cup.x - CUP_TW < cx2
                    && cup.y          > cy1 && cup.y - CUP_H   < cy2;

  if (offScreen || underToolbar) {
    cup.inPalette = true;
    cup.vx = cup.vy = 0;
    cup.resting = true;
  }
}

function drawCup() {
  const { x, y } = cup;
  const EY = 0.28; // ellipse y-scale — controls how "top-down" it looks
  ctx.save();
  ctx.translate(x, y);

  const bodyFill     = darkMode ? 'rgba(210,225,240,0.92)' : 'rgba(235,245,255,0.97)';
  const sideStroke   = darkMode ? '#889' : '#99a';
  const interiorFill = darkMode ? 'rgba(15,25,40,0.82)'    : 'rgba(185,205,228,0.80)';
  const rimStroke    = darkMode ? '#aab' : '#88a';

  // Body (trapezoid between the two ellipses)
  ctx.beginPath();
  ctx.moveTo(-CUP_TW, -CUP_H);
  ctx.lineTo( CUP_TW, -CUP_H);
  ctx.lineTo( CUP_BW,  0);
  ctx.lineTo(-CUP_BW,  0);
  ctx.closePath();
  ctx.fillStyle = bodyFill;
  ctx.fill();

  // Side strokes only (no top/bottom edge lines — ellipses handle those)
  ctx.beginPath();
  ctx.moveTo(-CUP_TW, -CUP_H);
  ctx.lineTo(-CUP_BW,  0);
  ctx.moveTo( CUP_TW, -CUP_H);
  ctx.lineTo( CUP_BW,  0);
  ctx.strokeStyle = sideStroke;
  ctx.lineWidth   = 1.5;
  ctx.stroke();

  // Bottom ellipse
  ctx.beginPath();
  ctx.ellipse(0, 0, CUP_BW, CUP_BW * EY, 0, 0, Math.PI * 2);
  ctx.fillStyle   = darkMode ? 'rgba(170,195,222,0.9)' : 'rgba(215,230,245,0.9)';
  ctx.fill();
  ctx.strokeStyle = sideStroke;
  ctx.lineWidth   = 1;
  ctx.stroke();

  // Top opening interior
  ctx.beginPath();
  ctx.ellipse(0, -CUP_H, CUP_TW, CUP_TW * EY, 0, 0, Math.PI * 2);
  ctx.fillStyle = interiorFill;
  ctx.fill();

  // Rim
  ctx.beginPath();
  ctx.ellipse(0, -CUP_H, CUP_TW + 1.5, (CUP_TW + 1.5) * EY, 0, 0, Math.PI * 2);
  ctx.strokeStyle = rimStroke;
  ctx.lineWidth   = 2.5;
  ctx.stroke();

  ctx.restore();
}

function drawTieAt(c, x, y) {
  const arm    = TIE_H;
  const hw     = TIE_W;
  const spread = 0.38;
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

function drawTies(alpha) {
  const cy = canvas.height / 2;
  for (const tie of ties) {
    let y;
    if (tie.dragging) {
      y = tie.y;
    } else {
      const i = tie.particleIndex;
      y = cy + prev[i] + (cur[i] - prev[i]) * alpha;
    }
    drawTieAt(ctx, tie.x, y);
  }
}

function drawPaletteItems() {
  if (!paletteCupCtx || !paletteTieCtx) return;

  // Cup palette
  const pc = paletteCupCtx;
  const pw = pc.canvas.width, ph = pc.canvas.height;
  pc.clearRect(0, 0, pw, ph);
  pc.globalAlpha = cup.inPalette ? 1 : 0.2;
  const s = 0.65, EY = 0.28;
  const tw = CUP_TW * s, bw = CUP_BW * s, h = CUP_H * s;
  pc.save();
  pc.translate(pw / 2, ph - 8);
  pc.beginPath();
  pc.moveTo(-tw,-h); pc.lineTo(tw,-h); pc.lineTo(bw,0); pc.lineTo(-bw,0);
  pc.closePath();
  pc.fillStyle = darkMode ? 'rgba(210,225,240,0.92)' : 'rgba(235,245,255,0.97)';
  pc.fill();
  pc.beginPath();
  pc.moveTo(-tw,-h); pc.lineTo(-bw,0);
  pc.moveTo( tw,-h); pc.lineTo( bw,0);
  pc.strokeStyle = darkMode ? '#889' : '#99a'; pc.lineWidth = 1.5; pc.stroke();
  pc.beginPath(); pc.ellipse(0,0,bw,Math.max(1,bw*EY),0,0,Math.PI*2);
  pc.fillStyle = darkMode ? 'rgba(170,195,222,0.9)' : 'rgba(215,230,245,0.9)';
  pc.fill(); pc.strokeStyle = darkMode ? '#889' : '#99a'; pc.lineWidth = 1; pc.stroke();
  pc.beginPath(); pc.ellipse(0,-h,tw,Math.max(1,tw*EY),0,0,Math.PI*2);
  pc.fillStyle = darkMode ? 'rgba(15,25,40,0.82)' : 'rgba(185,205,228,0.80)'; pc.fill();
  pc.beginPath(); pc.ellipse(0,-h,tw+1,Math.max(1,(tw+1)*EY),0,0,Math.PI*2);
  pc.strokeStyle = darkMode ? '#aab' : '#88a'; pc.lineWidth = 2; pc.stroke();
  pc.restore();
  pc.globalAlpha = 1;

  // Tie palette
  const tc = paletteTieCtx;
  tc.clearRect(0, 0, tc.canvas.width, tc.canvas.height);
  drawTieAt(tc, tc.canvas.width / 2, tc.canvas.height / 2);
}

function cupHitTest(mx, my) {
  const dx = mx - cup.x, dy = my - cup.y;
  return dx > -(CUP_TW + 6) && dx < (CUP_TW + 6) && dy > -(CUP_H + 6) && dy < 6;
}

// ── Resize ───────────────────────────────────────────────────
function resize() {
  canvas.width  = canvas.offsetWidth;
  canvas.height = canvas.offsetHeight;

  const newN = Math.floor((canvas.width - OFFSET) / SPACING) + 1;
  if (newN === N) return;
  N = newN;

  cur  = new Float32Array(N);
  prev = new Float32Array(N);
  next = new Float32Array(N);
  particleColors = Array.from({ length: N }, (_, i) => particleColor(i));

  if (cup.resting && !cup.dragging && !cup.inPalette) {
    cup.x = canvas.width - 80;
    cup.y = canvas.height / 2;
  }
}

// ── Simulation step ──────────────────────────────────────────
function step() {
  for (let i = 1; i < N - 1; i++) {
    next[i] = 2 * cur[i] - prev[i]
            + CFL2 * (cur[i + 1] - 2 * cur[i] + cur[i - 1]);
  }

  // Smoothly track target amplitude to avoid shock discontinuities
  amplitude += (targetAmplitude - amplitude) * 0.05;

  phase += 2 * Math.PI * frequency * DT;
  next[0] = amplitude * Math.sin(phase);

  next[N - 1] = cur[N - 2] + MUR * (next[N - 2] - cur[N - 1]);

  // ── Cup collision ─────────────────────────────────────────
  // Cup occupies y-band [upperEdge, lowerEdge] in displacement coords.
  // Any particle entering that band is reflected; its velocity becomes the cup's.
  if (!cup.dragging) {
    const cy         = canvas.height / 2;
    const lowerEdge  = cup.y - cy;           // cup base (larger y on screen)
    const upperEdge  = cup.y - CUP_H - cy;  // cup rim  (smaller y on screen)
    const iLeft  = Math.max(1, Math.floor((cup.x - CUP_TW - OFFSET) / SPACING));
    const iRight = Math.min(N - 2, Math.ceil((cup.x + CUP_TW - OFFSET) / SPACING));

    let velSum = 0, hits = 0;

    for (let i = iLeft; i <= iRight; i++) {
      const outside = cur[i] < upperEdge || cur[i] > lowerEdge;
      const enters  = next[i] >= upperEdge && next[i] <= lowerEdge;

      if (outside && enters) {
        const vel = next[i] - cur[i]; // px/step; sign = direction of motion
        velSum += vel;
        hits++;
      }
    }

    if (hits > 0) {
      cup.vy      = velSum / hits;              // cup matches particle velocity
      cup.vx      = Math.abs(cup.vy) * 0.3;    // small push in wave-travel direction
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

// ── Draw ─────────────────────────────────────────────────────
// alpha: fraction through current step interval (0–1) for interpolation
function draw(alpha) {
  const W  = canvas.width;
  const H  = canvas.height;
  const cy = H / 2;

  ctx.clearRect(0, 0, W, H);

  ctx.fillStyle = darkMode ? '#111' : '#f7f6f0';
  ctx.fillRect(0, 0, W, H);

  ctx.strokeStyle = darkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)';
  ctx.lineWidth   = 1;
  ctx.beginPath();
  ctx.moveTo(0, cy);
  ctx.lineTo(W, cy);
  ctx.stroke();

  // Interpolated position of first particle for stick
  const y0 = cy + (prev[0] + (cur[0] - prev[0]) * alpha);

  // Tilting stick
  ctx.strokeStyle = targetAmplitude > 0
    ? (darkMode ? '#bbb' : '#444')
    : (darkMode ? '#444' : '#bbb');
  ctx.lineWidth   = 3;
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
  if (!cup.inPalette) drawCup();
  drawPaletteItems();
}

// ── Loop ─────────────────────────────────────────────────────
function loop() {
  if (!paused) {
    simAccum += speedFactor;
    while (simAccum >= 1) {
      step();
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
  targetAmplitude = v;
}, AMP_LABELS);

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
  step();
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

  // Ties take priority
  const cy = canvas.height / 2;
  for (const tie of ties) {
    if (Math.abs(mx - tie.x) < TIE_W + 5 && Math.abs(my - cy) < TIE_H + 5) {
      tie.dragging  = true;
      tie.dragOffX  = tie.x - mx;
      tie.dragOffY  = cy - my;
      e.preventDefault(); return;
    }
  }

  if (!cup.inPalette && cupHitTest(mx, my)) {
    cup.dragging = true;
    cup.resting  = false;
    cup.vx = cup.vy = 0;
    cup.dragOffX = cup.x - mx;
    cup.dragOffY = cup.y - my;
    e.preventDefault();
  }
});

// Drag from palette — cup
document.getElementById('cup-palette').addEventListener('mousedown', e => {
  if (!cup.inPalette) return;
  const [mx, my] = canvasMouse(e);
  cup.inPalette = false;
  cup.dragging  = true;
  cup.resting   = false;
  cup.vx = cup.vy = 0;
  cup.x = mx; cup.y = my;
  cup.dragOffX = cup.dragOffY = 0;
  e.preventDefault();
});

// Drag from palette — tie (unlimited supply)
document.getElementById('tie-palette').addEventListener('mousedown', e => {
  const [mx, my] = canvasMouse(e);
  ties.push({ x: mx, y: my, particleIndex: -1, dragging: true, dragOffX: 0, dragOffY: 0 });
  e.preventDefault();
});

// Move
window.addEventListener('mousemove', e => {
  const [mx, my] = canvasMouse(e);

  if (cup.dragging) { cup.x = mx + cup.dragOffX; cup.y = my + cup.dragOffY; }

  for (const tie of ties) {
    if (tie.dragging) { tie.x = mx + tie.dragOffX; tie.y = my + tie.dragOffY; }
  }

  const anyDrag = cup.dragging || ties.some(t => t.dragging);
  if (!anyDrag) {
    const cy = canvas.height / 2;
    const overCup = !cup.inPalette && cupHitTest(mx, my);
    const overTie = ties.some(t => Math.abs(mx - t.x) < TIE_W + 5 && Math.abs(my - cy) < TIE_H + 5);
    canvas.style.cursor = (overCup || overTie) ? 'grab' : 'default';
  }
});

// Drop
window.addEventListener('mouseup', e => {
  if (cup.dragging) {
    cup.dragging = false;
    cup.resting  = true;
    canvas.style.cursor = 'default';
  }

  const [mx] = canvasMouse(e);
  for (let i = ties.length - 1; i >= 0; i--) {
    const tie = ties[i];
    if (!tie.dragging) continue;
    tie.dragging = false;
    const pi = Math.round((tie.x - OFFSET) / SPACING);
    if (pi >= 1 && pi <= N - 2) {
      tie.particleIndex = pi;
      tie.x = OFFSET + pi * SPACING;
    } else {
      ties.splice(i, 1); // dropped off string — discard
    }
  }
});

// ── Init ─────────────────────────────────────────────────────
paletteCupCtx = document.getElementById('cup-palette').getContext('2d');
paletteTieCtx = document.getElementById('tie-palette').getContext('2d');
resize();
window.addEventListener('resize', resize);
loop();
