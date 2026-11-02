# Rainbow Wave

A single-page canvas demo of two wave types, sharing one `<canvas>`. No build
step, no dependencies — just `index.html`, `style.css`, and `main.js`.

- **`'wave'`** — a **transverse** wave on a string (particles move up/down).
- **`'slinky'`** — a **longitudinal** wave on a slinky (particles move left/right).

`activeView` is the master switch between them; nearly every simulation, render,
and input path branches on it. Both views run the same finite-difference wave
equation over three `Float32Array`s (`prev` / `cur` / `next`) with a Mur
absorbing boundary on the right edge.

## Code map — `main.js`

Line numbers are approximate; the section banners (`// ── … ──`) in the file are
the source of truth.

| Lines | Section | Key pieces |
|------:|---------|------------|
| 1–34 | **Architecture map** | File-header overview + reading order |
| 36–99 | **Core shared state & physics** | `activeView` (74), amplitude/freq (`AMP_VALUES` 41, `FREQ_VALUES` 43), physics constants (`OFFSET` 77, `GRID_W` 83, `CFL` 90), string arrays (`N`/`cur`/`prev`/`next` 95) |
| 101–125 | **Slinky sim state** | Slinky physics constants (`SLINKY_CFL` 110), slinky arrays (`sN`/`sCur` 114) |
| 127–191 | **Interactive prop state** | `cup` (string, 127), `toy` (slinky, 142), twist `ties` (153), freehand `drawings` (164), grid-snap helpers (181) |
| 193–237 | **Helpers** | Audio squeak (`playSqueak` 202), particle `particleColor` (233) |
| 239–415 | **Prop motion & sprites** | `updateCup`/`updateToy` (247/268), `drawCup` (283), hit-tests, tie rendering |
| 417–489 | **Drawing tool** | `drawDrawings` (418), endpoint/midpoint hit-tests |
| 491–524 | **Resize** | `resize` (496) — the only place the sim arrays are allocated |
| 526–596 | **Sim step — string** | `step()` (531) — transverse wave equation + cup collision |
| 598–646 | **Sim step — slinky** | `slinkyStep()` (602) — longitudinal wave equation + cup collision |
| 648–688 | **Grid** | `drawGrid` (651) — shared by both views |
| 690–845 | **Slinky view (render)** | `drawSlinky` (705) — coil wire + rainbow batching |
| 847–896 | **String view (render)** | `drawWave` (851); `draw()` dispatcher (893) |
| 898–916 | **Main loop** | `loop()` (904) — sub-steps physics, interpolates frames |
| 918–1046 | **Control wiring** | `setupTrack` (922) + slider/button/tab listeners |
| 1048–1309 | **Pointer / drag handling** | `canvasMouse` (1053), mousedown/move/up for props |
| 1311–1370 | **Init + dev tools** | `resize()`/`loop()` boot (1314/1370), hidden dev panel (1317, type "dev"), `window.wavesPerf()` (1354) |

## Dev tools

- Type **`dev`** anywhere to toggle a hidden panel with a live slider for
  `SLINKY_SUB` (slinky wire smoothness vs. per-frame cost).
- Run **`wavesPerf()`** in the console to measure live fps and stroke calls/frame.
