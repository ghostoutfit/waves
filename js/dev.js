// ── Developer tools ──────────────────────────────────────────
//  • Type "dev" to toggle a hidden panel with live sliders for values dialed
//    against the visuals (keeps the UI clean).
//  • Run wavesPerf() in the console to measure live fps + stroke calls/frame.
import { activeView } from './state.js';
import { SLINKY_SP } from './config.js';
import { sN, SLINKY_SUB, setSlinkySub, COIL_PITCH } from './slinky.js';

(function devPanel() {
  let buf = '';
  let panel = null;

  function build() {
    panel = document.createElement('div');
    panel.style.cssText =
      'position:fixed;top:8px;left:8px;z-index:9999;background:rgba(20,22,28,0.92);' +
      'color:#eee;font:12px/1.4 monospace;padding:10px 12px;border-radius:8px;' +
      'box-shadow:0 2px 12px rgba(0,0,0,0.4);user-select:none;';
    const label = document.createElement('div');
    const slider = document.createElement('input');
    slider.type = 'range'; slider.min = '2'; slider.max = '40'; slider.step = '1';
    slider.value = String(SLINKY_SUB);
    slider.style.width = '160px';
    const sync = () => { label.textContent = 'SLINKY_SUB = ' + SLINKY_SUB +
      '  (~' + Math.round(((sN - 1) * SLINKY_SP) / (COIL_PITCH / 4 / SLINKY_SUB)) + ' verts/frame)'; };
    slider.addEventListener('input', () => { setSlinkySub(Number(slider.value)); sync(); });
    sync();
    panel.appendChild(label);
    panel.appendChild(slider);
    document.body.appendChild(panel);
  }

  window.addEventListener('keydown', e => {
    if (e.target && /^(INPUT|TEXTAREA)$/.test(e.target.tagName)) return;
    buf = (buf + e.key).slice(-3).toLowerCase();
    if (buf === 'dev') {
      if (panel) { panel.remove(); panel = null; }
      else build();
    }
  });
})();

// Console diagnostic: measures live fps + stroke calls/frame over ~1s.
window.wavesPerf = async function () {
  const proto = CanvasRenderingContext2D.prototype;
  const orig = proto.stroke;
  let strokes = 0, frames = 0, running = true;
  proto.stroke = function (...a) { strokes++; return orig.apply(this, a); };
  const t0 = performance.now();
  (function cnt() { if (running) { frames++; requestAnimationFrame(cnt); } })();
  await new Promise(r => setTimeout(r, 1000));
  running = false; proto.stroke = orig;
  const dt = (performance.now() - t0) / 1000;
  const r = { view: activeView, SLINKY_SUB, fps: +(frames / dt).toFixed(1),
    strokesPerFrame: Math.round(strokes / frames) };
  console.table(r);
  return r;
};
