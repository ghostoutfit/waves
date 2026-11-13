// ── Control wiring (sliders, buttons, tabs) ──────────────────
// Connects each control in the panel (index.html #controls) to the shared state.
// setupTrack() builds a reusable notched slider (used for amplitude + frequency);
// the rest are one-off button/toggle listeners.
import { canvas, activeView, driverOn, selectedAmpValue, paused, darkMode,
         setActiveView, setSelectedAmpValue, setDriverOn, setTargetAmplitude, setFrequency,
         setSpeedFactor, setSimAccum, setPaused, setDarkMode, setSoundEnabled } from './state.js';
import { AMP_VALUES, AMP_LABELS, FREQ_VALUES, FREQ_LABELS } from './config.js';
import { step, startStringPulse, recolourString } from './string.js';
import { slinkyStep, startSlinkyPulse } from './slinky.js';
import { cup, toy, curTies, updateCup, updateToy } from './props.js';
import { lineTool, curDrawings, cancelLineEdit } from './lines.js';
import { draw } from './loop.js';

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

// ── Amplitude, driver, pulse ──
setupTrack('amp-track', 'amp-values', AMP_VALUES, 0, v => {
  setSelectedAmpValue(v);
  if (driverOn) setTargetAmplitude(v);
}, AMP_LABELS);

// Driver ON/OFF toggle
const driverBtn = document.getElementById('driver-btn');
driverBtn.addEventListener('click', () => {
  setDriverOn(!driverOn);
  setTargetAmplitude(driverOn ? selectedAmpValue : 0);
  driverBtn.textContent = driverOn ? 'OFF' : 'ON';
  driverBtn.classList.toggle('active', driverOn);
});

// Pulse — one half-cycle at current amplitude
document.getElementById('pulse-btn').addEventListener('click', () => {
  if (activeView === 'wave') startStringPulse();
  else                       startSlinkyPulse();
});

// ── Frequency ──
setupTrack('freq-track', 'freq-values', FREQ_VALUES, 0, v => {
  setFrequency(v);
}, FREQ_LABELS);

// ── Playback ──
// Speed slider: turtle (1/8 speed) → rabbit (real time)
// Physics CFL is untouched — only playback rate changes
const speedSlider = document.getElementById('speed-slider');
speedSlider.addEventListener('input', () => {
  setSpeedFactor(Number(speedSlider.value) / 8); // 1→0.125, 8→1.0
});

// Pause / step
const pauseBtn = document.getElementById('pause-btn');
const stepBtn  = document.getElementById('step-btn');

pauseBtn.addEventListener('click', () => {
  setPaused(!paused);
  setSimAccum(0); // avoid burst of steps on resume
  pauseBtn.classList.toggle('active', paused);
  pauseBtn.textContent = paused ? '▶' : '⏸';
});

stepBtn.addEventListener('click', () => {
  if (activeView === 'slinky') slinkyStep();
  else                         step();
  updateCup();
  updateToy();
  draw(1);
});

// Theme toggle
document.getElementById('theme-btn').addEventListener('click', () => {
  setDarkMode(!darkMode);
  document.body.classList.toggle('dark', darkMode);
  recolourString(); // particle colours depend on the theme
});

// Sound toggle
document.getElementById('sound-cb').addEventListener('change', e => {
  setSoundEnabled(e.target.checked);
});

// ── View tabs ──
const toyLabel = document.getElementById('toy-label');
function updateToyLabel() { toyLabel.textContent = 'CUP'; }

document.querySelectorAll('.view-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    setActiveView(btn.dataset.view);
    document.querySelectorAll('.view-btn').forEach(b => b.classList.toggle('active', b === btn));
    updateToyLabel();
    cancelLineEdit(); // cancel any in-progress draw when switching views
  });
});
updateToyLabel(); // set on init

// ── Objects: LINE tool and CLEAR ──
// Draw mode toggle
document.getElementById('draw-btn').addEventListener('click', () => {
  lineTool.on = !lineTool.on;
  document.getElementById('draw-btn').classList.toggle('active', lineTool.on);
  canvas.style.cursor = lineTool.on ? 'crosshair' : 'default';
});

// Clear — clears the current view's ties and drawings, and returns its cup to the palette
document.getElementById('clear-all-btn').addEventListener('click', () => {
  curDrawings().length = 0;
  curTies().length     = 0;
  cancelLineEdit();
  if (activeView === 'slinky') {
    toy.inPalette = true;
    toy.vx = 0;
    toy.resting = true;
  } else {
    cup.inPalette = true;
    cup.vx = cup.vy = 0;
    cup.resting = true;
  }
});
