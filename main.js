// ── Wave on a String ─────────────────────────────────────────
const canvas = document.getElementById('canvas');
const ctx    = canvas.getContext('2d');

// Slider options
const AMP_VALUES  = [20, 50, 85, 130];   // px
const FREQ_VALUES = [0.5, 1.0, 2.0, 3.5]; // Hz

let amplitude = AMP_VALUES[0];
let frequency = FREQ_VALUES[0];

// Physics
const SPACING = 5;      // px between particles
const FPS     = 60;
const DT      = 1 / FPS;
const CFL     = 0.5;    // Courant number — stable, moderate wave speed
const CFL2    = CFL * CFL;
const SPONGE  = 50;     // absorbing layer width (particles)

// Simulation state (initialised in resize())
let N    = 0;
let cur  = null;
let prev = null;
let next = null;
let particleColors = null;
let time = 0;

// ── Colour ───────────────────────────────────────────────────
function particleColor(i) {
  if (i % 20 === 0) return '#111111';
  const hue = Math.round((i % 20) / 20 * 360);
  return `hsl(${hue},100%,45%)`;
}

// ── Resize ───────────────────────────────────────────────────
function resize() {
  canvas.width  = canvas.offsetWidth;
  canvas.height = canvas.offsetHeight;

  const newN = Math.floor(canvas.width / SPACING) + 1;
  if (newN === N) return;
  N = newN;

  cur  = new Float32Array(N);
  prev = new Float32Array(N);
  next = new Float32Array(N);
  particleColors = Array.from({ length: N }, (_, i) => particleColor(i));
}

// ── Simulation step ──────────────────────────────────────────
function step() {
  // Interior wave equation
  for (let i = 1; i < N - 1; i++) {
    next[i] = 2 * cur[i] - prev[i]
            + CFL2 * (cur[i + 1] - 2 * cur[i] + cur[i - 1]);
  }

  // Forced driver at left edge
  next[0] = amplitude * Math.sin(2 * Math.PI * frequency * time);

  // Sponge layer: gradually damp towards the right edge
  for (let i = N - SPONGE; i < N; i++) {
    const t    = (i - (N - SPONGE)) / SPONGE; // 0 → 1
    const damp = 1 - t * t * 0.35;
    next[i] *= damp;
  }

  // Swap buffers
  const tmp = prev;
  prev = cur;
  cur  = next;
  next = tmp;

  time += DT;
}

// ── Draw ─────────────────────────────────────────────────────
function draw() {
  const W  = canvas.width;
  const H  = canvas.height;
  const cy = H / 2;

  ctx.clearRect(0, 0, W, H);

  // Background
  ctx.fillStyle = '#f7f6f0';
  ctx.fillRect(0, 0, W, H);

  // Faint equilibrium line
  ctx.strokeStyle = 'rgba(0,0,0,0.08)';
  ctx.lineWidth   = 1;
  ctx.beginPath();
  ctx.moveTo(0, cy);
  ctx.lineTo(W, cy);
  ctx.stroke();

  // Particles
  const R = 4;
  for (let i = 0; i < N; i++) {
    const x = i * SPACING;
    const y = cy + cur[i];
    ctx.beginPath();
    ctx.arc(x, y, R, 0, Math.PI * 2);
    ctx.fillStyle = particleColors[i];
    ctx.fill();
  }
}

// ── Loop ─────────────────────────────────────────────────────
function loop() {
  step();
  draw();
  requestAnimationFrame(loop);
}

// ── Controls ─────────────────────────────────────────────────
function setupTrack(trackId, valuesId, values, initial, onChange) {
  const track   = document.getElementById(trackId);
  const notches = track.querySelectorAll('.notch');

  // Populate value labels
  const valDiv = document.getElementById(valuesId);
  values.forEach(v => {
    const s = document.createElement('span');
    s.textContent = v;
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

setupTrack('amp-track',  'amp-values',  AMP_VALUES,  0, v => { amplitude = v; });
setupTrack('freq-track', 'freq-values', FREQ_VALUES, 0, v => { frequency = v; });

// ── Init ─────────────────────────────────────────────────────
resize();
window.addEventListener('resize', resize);
loop();
