# Rainbow Wave

A single-page canvas demo of two wave types, sharing one `<canvas>`. No build
step, no dependencies — just `index.html`, `style.css`, and `main.js`.

- **`'wave'`** — a **transverse** wave on a string (dots move up/down).
- **`'slinky'`** — a **longitudinal** wave on a slinky (dots move left/right).

`activeView` is the master switch between them; nearly every piece of the code
checks it to decide which wave to run and draw. Both views use the same physics
recipe (explained in the glossary below).

## Jargon, in plain English

- **Simulation (sim):** the running physics calculation — the math that figures
  out where every dot on the wave should be, frame by frame.
- **Sim state:** the numbers the simulation needs to remember between frames
  (where each dot is now, where it was a moment ago, how big and fast the wave is).
- **Prop:** a movable object the user drags onto the canvas — the cup, the green
  twist ties, or the freehand measurement lines.
- **Prop state:** the numbers describing each prop right now (its position,
  speed, whether it's being dragged).
- **Sprite:** the little drawn picture of a prop (for example, the cup graphic
  that gets painted on the canvas).
- **Render / draw:** painting the current numbers onto the screen as pixels.
- **Particle:** one dot of the wave. The wave is just a long row of dots, and
  the "wave" is the pattern you see when they all move.
- **Finite-difference wave equation:** the physics rule used here — each dot's
  next position is worked out from its own and its neighbors' recent positions.
  Do that for every dot, every frame, and a wave ripples down the row.
- **Mur absorbing boundary:** a trick at the right edge that lets the wave run
  off the screen quietly instead of bouncing back like an echo.
- **CFL:** a safety-limit number for the physics math; keep it in range and the
  simulation stays stable instead of blowing up into noise.
- **Buffer / array:** a long list of numbers. Here, three lists hold each dot's
  past, present, and next position.

## Code map — `main.js`

Line numbers are approximate (they drift as the file is edited); the banner
comments (`// ── … ──`) in the file are the real landmarks.

**1–34 · Architecture map.** A big comment at the top of the file that explains
the whole design and the order things appear in — the written tour of the code.

**36–99 · Core shared state & physics constants.** Sets up the drawing surface
and the main dials everyone uses: which view is active (`activeView`, 74), the
wave's size and speed options (`AMP_VALUES` 41, `FREQ_VALUES` 43), the fixed
physics numbers (`OFFSET` 77, `GRID_W` 83, `CFL` 90), and the three number-lists
that hold the string's dots (`N`/`cur`/`prev`/`next`, 95).

**101–125 · Slinky sim state.** The same kind of setup, but for the slinky wave:
its own speed settings (`SLINKY_CFL`, 110) and its own number-lists of dots
(`sN`/`sCur`, 114). The slinky is kept separate because its wave moves sideways,
not up and down.

**127–191 · Interactive prop state.** Remembers the draggable objects: the cup in
string mode (127) and in slinky mode (`toy`, 142), the green twist ties (153),
and the freehand lines (164), plus helpers that snap things neatly to the grid
(181).

**193–237 · Helpers (audio & color).** Small shared utilities: the squeak sound
the cup makes when the wave hits it (`playSqueak`, 202) and the rainbow color
picked for each dot (`particleColor`, 233).

**239–415 · Prop motion & sprites.** Moves the props and draws their pictures:
the cup/toy coast and slow down after being hit (`updateCup`/`updateToy`,
247/268), the cup graphic is painted (`drawCup`, 283), and the code checks
whether the mouse is touching a prop.

**417–489 · Drawing tool.** Everything for the freehand measurement lines —
drawing them (`drawDrawings`, 418) and detecting when you grab an end or the
middle to move them.

**491–524 · Resize.** Runs whenever the window changes size. It re-measures the
canvas and rebuilds the dot-lists to fit — the one and only place those lists
get created (`resize`, 496).

**526–596 · Simulation step — string.** The heartbeat of the string wave:
`step()` (531) nudges every dot one tick forward using the wave rule, pushes the
left end up and down to make the wave, lets it exit at the right edge, and checks
if the wave knocked the cup.

**598–646 · Simulation step — slinky.** The same heartbeat for the slinky wave
(`slinkyStep()`, 602), but the dots get pushed left and right instead of up and
down, and the bunching-up of coils is what shows the wave.

**648–688 · Grid.** Draws the faint background graph-paper lines and the center
line, shared by both views (`drawGrid`, 651).

**690–845 · Slinky view (rendering).** Paints the slinky: the coiled wire, the
pusher plate on the left that drives it, and the rainbow coloring
(`drawSlinky`, 705).

**847–896 · String view (rendering).** Paints the string: the driver stick on the
left and the row of colored dots (`drawWave`, 851). `draw()` (893) is the single
switch that calls whichever view is active.

**898–916 · Main loop.** The engine that runs forever: once per frame it advances
the physics and then redraws everything (`loop`, 904). It also handles slow-motion
smoothly.

**918–1046 · Control wiring.** Connects the on-screen buttons and sliders
(amplitude, frequency, speed, pause, theme, view tabs) to the numbers that drive
the simulation (`setupTrack`, 922).

**1048–1309 · Pointer / drag handling.** All the mouse behavior: picking up props,
dragging them around, dropping them, and snapping ties onto a dot
(`canvasMouse`, 1053).

**1311–1370 · Init + dev tools.** Starts the whole thing running (`resize()` and
`loop()`, 1314/1370), plus two developer-only extras: a hidden tuning panel (type
"dev", 1317) and a speed-measuring command (`wavesPerf()`, 1354).

## Dev tools

- Type **`dev`** anywhere to toggle a hidden panel with a live slider for
  `SLINKY_SUB` (slinky wire smoothness vs. per-frame cost).
- Run **`wavesPerf()`** in the console to measure live fps and stroke calls/frame.
