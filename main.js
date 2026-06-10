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

// ── Colour ───────────────────────────────────────────────────
function particleColor(i) {
  if (i % 20 === 0) return darkMode ? '#eeeeee' : '#111111';
  const hue = Math.round((i % 20) / 20 * 360);
  return `hsl(${hue},100%,${darkMode ? 65 : 45}%)`;
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

// ── Init ─────────────────────────────────────────────────────
resize();
window.addEventListener('resize', resize);
loop();
