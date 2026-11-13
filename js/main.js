// ═══════════════════════════════════════════════════════════════════════════
//  RAINBOW WAVE  —  two wave demos sharing one <canvas>
// ═══════════════════════════════════════════════════════════════════════════
//  The page loads this file; it imports the rest and starts the app.
//  Two independent wave simulations, only one shown at a time — `activeView`
//  (state.js) is the master switch:
//    • 'wave'   — TRANSVERSE wave on a string (string.js)
//    • 'slinky' — LONGITUDINAL wave on a slinky (slinky.js)
//  Both run the same finite-difference wave equation over three Float32Arrays
//  (prev / cur / next) and absorb waves at the right edge (Mur boundary), so
//  they leave the screen instead of reflecting back.
//
//  Modules (each imports only what it uses):
//    config.js    fixed settings: slider options, grid, physics, prop sizes
//    state.js     the canvas + settings the controls change (with setters)
//    string.js    string view: simulation + drawing
//    slinky.js    slinky view: simulation + drawing
//    grid.js      the background grid (both views)
//    props.js     cup + twist ties: state, motion, sprites, palette
//    lines.js     the LINE measurement tool
//    audio.js     the cup's snare hit when the wave hits it
//    loop.js      the animation loop + draw() dispatcher
//    controls.js  wires the control panel
//    pointer.js   mouse: dragging props, drawing lines
//    dev.js       hidden dev panel ("dev") + wavesPerf()
//
//  Modules set up their own listeners as they load; what must happen in order
//  at start-up happens here, after every module has loaded.
// ═══════════════════════════════════════════════════════════════════════════

import { canvas, setControlsBottom } from './state.js';
import { resizeString } from './string.js';
import { resizeSlinky } from './slinky.js';
import { loop } from './loop.js';
import './controls.js';
import './pointer.js';
import './dev.js';

// ── Resize — fits the canvas to its box and resizes both sims ─
// Also caches the controls panel's bottom edge so per-frame draws don't force a reflow.
function resize() {
  canvas.width  = canvas.offsetWidth;
  canvas.height = canvas.offsetHeight;
  resizeString();
  resizeSlinky();
  const ctrl = document.getElementById('controls');
  if (ctrl) setControlsBottom(ctrl.getBoundingClientRect().bottom);
}

resize();
window.addEventListener('resize', resize);
loop();
