// ── Main animation loop ──────────────────────────────────────
// Runs once per display frame via requestAnimationFrame. `speedFactor`
// (set by the turtle↔rabbit slider) is how many physics steps to run per
// frame: at 1.0 we step once a frame; slower, we accumulate fractional steps
// and only advance when enough has built up. The leftover fraction (simAccum)
// is passed to draw() so rendering interpolates smoothly between steps.
import { activeView, paused, speedFactor, simAccum, setSimAccum } from './state.js';
import { step, drawWave } from './string.js';
import { slinkyStep, drawSlinky } from './slinky.js';
import { updateCup, updateToy, drawPaletteItems } from './props.js';

// Render dispatcher — draws the active view, then the palette sprites in the controls.
export function draw(alpha) {
  if (activeView === 'slinky') drawSlinky(alpha);
  else                         drawWave(alpha);
  drawPaletteItems();
}

export function loop() {
  if (!paused) {
    setSimAccum(simAccum + speedFactor);
    while (simAccum >= 1) {
      // Only step the active view's simulation; the other isn't drawn.
      if (activeView === 'slinky') { slinkyStep(); updateToy(); }
      else                         { step();       updateCup(); }
      setSimAccum(simAccum - 1);
    }
  }
  draw(simAccum);
  requestAnimationFrame(loop);
}
