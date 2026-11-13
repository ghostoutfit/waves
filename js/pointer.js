// ── Pointer / drag handling ──────────────────────────────────
// Mouse interaction for the canvas props. Priority order on mousedown:
// LINE-tool handles → ties → cup/toy. The palette canvases spawn new props;
// mousemove drags them; mouseup snaps ties to a particle or returns a prop
// to the palette if dropped off-canvas. All coords go through canvasMouse().
// A prop can also be CARRIED: click it (or its palette slot) to pick it up, move,
// and click again to drop it — see "Click to carry" below.
import { canvas, activeView, simAccum } from './state.js';
import { OFFSET, SPACING, CY_OFFSET, SLINKY_OFF, SLINKY_SP, CUP_TW, CUP_H, TIE_W, TIE_H } from './config.js';
import { N } from './string.js';
import { sN, sCur, sPrev, COIL_PITCH, COIL_R } from './slinky.js';
import { cup, toy, stringTies, slinkyTies, curTies, cupHitTest, slinkyToyHitTest, behindControls } from './props.js';
import { lineTool, curDrawings, lineMidpoint, nearMidpoint, nearEndpoint } from './lines.js';

function canvasMouse(e) {
  const r = canvas.getBoundingClientRect();
  return [
    (e.clientX - r.left) * (canvas.width  / r.width),
    (e.clientY - r.top)  * (canvas.height / r.height),
  ];
}

// ── Click to carry ───────────────────────────────────────────
// A click (press + release without moving) on a cup or tie — or its palette slot —
// leaves it held: it follows the mouse until the next click, which drops it there.
// Clicking the control panel instead puts it back (cup to its slot, tie discarded),
// and the click still works on whatever was clicked. Press-drag-release works as before.
const CLICK_SLOP = 5;     // px of movement that still counts as a click
let press    = null;      // where the current press started { x, y }
let carrying = false;     // a prop is following the mouse between clicks
let dropping = false;     // this press ends a carry; its mouseup drops the prop

function anyPropDragging() { return cup.dragging || toy.dragging || curTies().some(t => t.dragging); }

// Return a carried prop: the cup to the palette, a tie to nowhere.
function putBack() {
  for (const c of [cup, toy]) if (c.dragging) {
    c.dragging = false; c.inPalette = true; c.resting = true; c.vx = 0;
    if ('vy' in c) c.vy = 0;
  }
  const ties = curTies();
  for (let i = ties.length - 1; i >= 0; i--) if (ties[i].dragging) ties.splice(i, 1);
  canvas.style.cursor = 'default';
}

// Capture phase: runs before the canvas and palette handlers, so a drop click
// doesn't also pick something else up.
window.addEventListener('mousedown', e => {
  press = { x: e.clientX, y: e.clientY };
  if (!carrying) return;
  carrying = false;
  if (e.target.closest('#controls')) {
    putBack();
    if (e.target.closest('.palette-slot')) { e.preventDefault(); e.stopPropagation(); }  // don't pick up a new one
    return;
  }
  dropping = true;
  e.preventDefault(); e.stopPropagation();
}, true);

// Grab canvas items
canvas.addEventListener('mousedown', e => {
  const [mx, my] = canvasMouse(e);

  // Draw mode takes priority
  if (lineTool.on) {
    const ep = nearEndpoint(mx, my);
    if (ep) {
      lineTool.draggedEndpoint = ep;
      e.preventDefault(); return;
    }
    const hitIdx = nearMidpoint(mx, my);
    if (hitIdx >= 0) {
      const m = lineMidpoint(curDrawings()[hitIdx]);
      lineTool.draggedLine = { index: hitIdx, offX: m.x - mx, offY: m.y - my };
      e.preventDefault(); return;
    }
    lineTool.active = { x1: mx, y1: my, x2: mx, y2: my };
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
    if (!toy.inPalette && slinkyToyHitTest(mx, my)) {
      toy.dragging = true;
      toy.vx       = 0;
      toy.resting  = true;
      toy.dragOffX = toy.x - mx;
      toy.dragOffY = toy.y - my;
      e.preventDefault();
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
    toy.y = my + CUP_H;
    toy.dragOffX = 0;
    toy.dragOffY = CUP_H;
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

  if (lineTool.on) {
    const drawings = curDrawings();
    if (lineTool.active) {
      lineTool.active.x2 = mx;
      lineTool.active.y2 = my;
    } else if (lineTool.draggedEndpoint !== null) {
      const d = drawings[lineTool.draggedEndpoint.index];
      if (lineTool.draggedEndpoint.which === 1) {
        drawings[lineTool.draggedEndpoint.index] = { ...d, x1: mx, y1: my };
      } else {
        drawings[lineTool.draggedEndpoint.index] = { ...d, x2: mx, y2: my };
      }
    } else if (lineTool.draggedLine !== null) {
      const d = drawings[lineTool.draggedLine.index];
      const newMidX = mx + lineTool.draggedLine.offX;
      const newMidY = my + lineTool.draggedLine.offY;
      const halfDx = (d.x2 - d.x1) / 2;
      const halfDy = (d.y2 - d.y1) / 2;
      drawings[lineTool.draggedLine.index] = {
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
  if (toy.dragging) { toy.x = mx + toy.dragOffX; toy.y = my + toy.dragOffY; }

  for (const tie of curTies()) {
    if (tie.dragging) { tie.x = mx + tie.dragOffX; tie.y = my + tie.dragOffY; }
  }

  const anyDrag = cup.dragging || toy.dragging || curTies().some(t => t.dragging);
  if (!anyDrag) {
    let overGrab = false;
    if (activeView === 'slinky' && !toy.inPalette) {
      overGrab = slinkyToyHitTest(mx, my);
    } else if (activeView === 'wave' && !cup.inPalette) {
      overGrab = cupHitTest(mx, my);
    }
    canvas.style.cursor = overGrab ? 'grab' : 'default';
  }
});

// Drop
window.addEventListener('mouseup', e => {
  if (lineTool.on) {
    if (lineTool.active) {
      // Only keep lines with meaningful length
      if (Math.hypot(lineTool.active.x2 - lineTool.active.x1, lineTool.active.y2 - lineTool.active.y1) > 4) {
        curDrawings().push({ ...lineTool.active });
      }
      lineTool.active = null;
    }
    lineTool.draggedLine     = null;
    lineTool.draggedEndpoint = null;
    return;
  }

  // A click on a prop (no movement) picks it up to carry instead of dropping it.
  const moved = press && Math.hypot(e.clientX - press.x, e.clientY - press.y) > CLICK_SLOP;
  if (!dropping && !moved && anyPropDragging()) { carrying = true; canvas.style.cursor = 'grabbing'; return; }
  if (dropping) canvas.style.cursor = 'default';
  dropping = false;

  if (cup.dragging) {
    cup.dragging = false;
    cup.resting  = true;
    canvas.style.cursor = 'default';
    // Return to palette if off-canvas or dropped behind the controls panel
    if (cup.x < -CUP_TW || cup.x > canvas.width + CUP_TW || behindControls(cup.x, cup.y)) {
      cup.inPalette = true;
      cup.vx = cup.vy = 0;
      cup.resting = true;
    }
  }

  if (toy.dragging) {
    toy.dragging = false;
    toy.resting  = true;
    canvas.style.cursor = 'default';
    if (toy.x < -CUP_TW || toy.x > canvas.width + CUP_TW
     || toy.y < -CUP_H  || toy.y > canvas.height + 4 || behindControls(toy.x, toy.y)) {
      toy.inPalette = true;
    }
  }

  if (activeView === 'slinky') {
    for (let i = slinkyTies.length - 1; i >= 0; i--) {
      const tie = slinkyTies[i];
      if (!tie.dragging) continue;
      tie.dragging = false;
      // Snap to nearest particle by actual displaced x (not equilibrium spacing),
      // so the tie lands on the coil the user can see, even mid-wave or when paused.
      let bestPi = -1, bestDist = Infinity;
      for (let pi = 1; pi <= sN - 2; pi++) {
        const disp    = sPrev[pi] + (sCur[pi] - sPrev[pi]) * simAccum;
        const actualX = SLINKY_OFF + pi * SLINKY_SP + disp;
        const dist    = Math.abs(tie.x - actualX);
        if (dist < bestDist) { bestDist = dist; bestPi = pi; }
      }
      if (bestPi >= 0 && tie.x >= 0 && tie.x <= canvas.width + 60) {
        tie.slinkyParticleIndex = bestPi;
        tie.xEq = SLINKY_OFF + bestPi * SLINKY_SP;
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
