// ── Audio: the cup's snare hit ────────────────────────────────
// A short burst of band-pass-filtered noise — a little snare "smack" — played when
// the wave hits the cup (string.js / slinky.js), unless the sound toggle (🔊) is off.
//
// Its loudness is proportional to the ENERGY of the wave that hit: the sound's power
// (gain²) is the wave's energy as a fraction of the most energetic wave the controls
// can make. Wave energy goes as amplitude² × frequency², so doubling either one
// makes the hit 4× as energetic (+6 dB); top vs bottom settings span 30 dB.
import { soundEnabled } from './state.js';
import { AMP_VALUES, FREQ_VALUES, DT } from './config.js';

// Energy per particle of the strongest wave the controls make (top amplitude and
// frequency): a sine of amplitude A and angular speed ω (per step) carries A²ω².
const E_MAX = (Math.max(...AMP_VALUES) * 2 * Math.PI * Math.max(...FREQ_VALUES) * DT) ** 2;

// Mean wave energy per particle over particles [from, to): motion (v²) plus
// stretch (c² × slope²), where c is the wave speed in particles per step.
// Averaged over a wavelength or more, a steady wave gives A²ω² wherever you look.
export function waveEnergy(cur, prev, from, to, c) {
  let sum = 0, n = 0;
  for (let i = Math.max(0, from); i < to && i + 1 < cur.length; i++) {
    const v     = cur[i] - prev[i];
    const slope = cur[i + 1] - cur[i];
    sum += v * v + c * c * slope * slope;
    n++;
  }
  return n ? sum / n : 0;
}

let audioCtx = null;
let lastSmack = -Infinity;
const SMACK_GAP_MS = 150;   // a hit can last several ticks; one smack per hit, not per tick

function getAudioCtx() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return audioCtx;
}

// energy: waveEnergy() of the wave just upstream of the cup when it hit
export function playSmack(energy) {
  const vol = Math.sqrt(Math.min(1, energy / E_MAX)); // gain: sound power ∝ wave energy
  if (!soundEnabled || vol < 0.003) return;           // (below 0.003 ≈ −50 dB: inaudible)
  const now = performance.now();
  if (now - lastSmack < SMACK_GAP_MS) return;
  lastSmack = now;
  const ac = getAudioCtx();
  if (ac.state === 'suspended') ac.resume();   // browsers start audio paused until a click

  const duration = 0.09; // seconds
  const bufLen   = Math.ceil(ac.sampleRate * duration);
  const buffer   = ac.createBuffer(1, bufLen, ac.sampleRate);
  const data     = buffer.getChannelData(0);
  for (let i = 0; i < bufLen; i++) data[i] = Math.random() * 2 - 1;

  const source = ac.createBufferSource();
  source.buffer = buffer;

  const filter = ac.createBiquadFilter();
  filter.type            = 'bandpass';
  filter.frequency.value = 900;
  filter.Q.value         = 0.6;

  const gain = ac.createGain();
  gain.gain.setValueAtTime(vol, ac.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + duration);

  source.connect(filter);
  filter.connect(gain);
  gain.connect(ac.destination);
  source.start();
}
