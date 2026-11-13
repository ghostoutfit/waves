# Rainbow Wave

A single-page canvas demo of two kinds of wave, sharing one `<canvas>`:

- **Wiggle wave** (`'wave'`) — a **transverse** wave on a string: the dots move
  up and down while the wave travels left to right.
- **Push-pull wave** (`'slinky'`) — a **longitudinal** wave on a slinky: the coils
  move left and right, and the bunching-up of coils is what travels.

Students switch between them, set the amplitude and frequency, slow time down,
and drop a cup (which the wave knocks), twist ties (which ride one point of the
wave) and measurement lines onto the screen.

No build step and no dependencies: HTML, CSS, and plain JavaScript modules.

## Contents

- [Run it](#run-it)
- [What's in the folder](#whats-in-the-folder)
- [How it works in one minute](#how-it-works-in-one-minute)
- [Where do I change…?](#where-do-i-change)
- [The modules, one by one](#the-modules-one-by-one)
- [House rules](#house-rules)
- [Dev tools](#dev-tools)
- [Checking a change](#checking-a-change)

## Run it

The JavaScript is split into **modules** (files that `import` from each other).
Browsers only load modules from a web server, so double-clicking `index.html`
shows a blank canvas. From this folder, run:

```
python3 -m http.server 8000
```

then open <http://localhost:8000>. Edit a file and reload the page to see the change.

Pushing to `main` publishes the site to GitHub Pages automatically
(`.github/workflows/deploy.yml`).

## What's in the folder

```
index.html        the page: the canvas and the control panel
style.css         all styling, including dark mode
favicon.svg
images/           turtle + rabbit icons for the speed slider
js/
  main.js         start-up: imports everything, sizes the canvas, starts the loop
  config.js       fixed settings: slider options, grid, physics, prop sizes
  state.js        the canvas + the settings the controls change
  string.js       the wiggle wave: its simulation and its drawing
  slinky.js       the push-pull wave: its simulation and its drawing
  grid.js         the graph-paper background (both views)
  props.js        the cup and twist ties: state, motion, pictures, palette
  lines.js        the LINE measurement tool
  loop.js         the animation loop
  controls.js     wires up the control panel
  pointer.js      the mouse: dragging props, drawing lines
  audio.js        the cup's snare hit
  dev.js          hidden developer tools
```

## How it works in one minute

**The one idea.** Each wave is a long row of **particles** (the dots, or points
along the coil). Each particle stores one number: how far it has moved from rest
— up/down for the string, left/right for the slinky. Three lists hold every
particle's number: `prev` (last tick), `cur` (now) and `next`. Each tick, every
particle's `next` value is worked out from its own and its two neighbours'
`prev`/`cur` values (the standard wave equation). Do that for every particle,
every tick, and a wave ripples down the row. The left end is moved by the
**driver** (a sine wave set by the amplitude and frequency controls); the right
end soaks the wave up so it doesn't bounce back.

**One switch.** `activeView` (in `state.js`) says which wave is showing. Only
that wave's simulation runs, and almost every module checks it.

**One frame** (`loop.js`, about 60 times a second):

```
loop()
 ├─ run 0, 1 or more physics ticks (fewer when the speed slider is toward the turtle)
 │    string:  step()        + updateCup()      slinky:  slinkyStep() + updateToy()
 └─ draw(fraction)    background, grid, the wave, cup, ties, lines
                      + the cup and tie pictures in the control panel
```

When time is slowed down, a tick doesn't happen every frame; the leftover
fraction is passed to `draw()`, which places each particle part-way between
`prev` and `cur`, so slow motion stays smooth.

**Clicks are matched by position.** The wave and props are drawings on the canvas,
not page elements, so `pointer.js` compares the mouse position with where each
thing was drawn (the "hit tests" in `props.js` and `lines.js`).

## Where do I change…?

| To change… | Open |
|---|---|
| The amplitude / frequency options, wave speed, grid size | `js/config.js` |
| How the wiggle wave moves or looks | `js/string.js` |
| How the push-pull wave moves or looks (coil size, pusher plate, rainbow) | `js/slinky.js` |
| How the cup or a tie looks, or how the cup coasts after a hit | `js/props.js` |
| How the wave hits the cup | `step()` in `js/string.js` / `slinkyStep()` in `js/slinky.js` |
| What a button or slider does | `js/controls.js` |
| Dragging, dropping, snapping ties, drawing lines | `js/pointer.js` |
| The control panel's layout or labels | `index.html` (+ `style.css`) |
| Colours, fonts, dark mode | `style.css` (canvas colours are in the drawing code) |

## The modules, one by one

- **`main.js`** — the entry point. Imports every module, defines `resize()` (fits the
  canvas to the window and asks each wave to resize its particle lists), and starts
  the loop.
- **`config.js`** — numbers that never change while the app runs: the slider
  options, the string's layout and grid (`OFFSET`, `SPACING`, `GRID_W`…), the physics
  constants for both waves (`CFL` is the stability limit that keeps the maths from
  blowing up; `MUR` is the right-edge absorber), and the cup and tie sizes.
- **`state.js`** — the canvas, and the settings the controls change: `activeView`,
  amplitude, frequency, driver on/off, playback speed, paused, dark mode, sound.
- **`string.js`** — everything about the wiggle wave: its particle lists (`N`,
  `prev`, `cur`), `step()` (one tick, including the driver, pulse, right-edge
  absorber and cup collisions), and `drawWave()` (driver stick, rainbow dots, ties
  riding their particle).
- **`slinky.js`** — everything about the push-pull wave: its particle lists (`sN`,
  `sPrev`, `sCur`), `slinkyStep()`, and `drawSlinky()` (rail, pusher plate, the coil
  built from many small segments and stroked in rainbow colour bands, ties on the coil).
- **`grid.js`** — `drawGrid()`: the minor and major lines and the rest line.
- **`props.js`** — the cup (`cup` on the string, `toy` on the slinky — the same
  picture) and the twist ties (`stringTies`, `slinkyTies`), how the cup coasts and
  slows, hit tests, and `drawCup()` / `drawTieAt()`, also used for the palette.
- **`lines.js`** — the measurement lines (kept per view), the LINE tool's state
  (`lineTool`), drawing them, and finding a grabbed end or midpoint.
- **`loop.js`** — `loop()` and `draw()`, described above.
- **`controls.js`** — connects each control in the panel to `state.js`: the notched
  amplitude and frequency sliders, ON/OFF, PULSE, speed, pause and step, theme, sound,
  the view tabs, LINE and CLEAR.
- **`pointer.js`** — mouse handling: drawing and moving lines, picking up ties and the
  cup, dragging new ones out of the palette, and dropping (a tie snaps to the nearest
  particle; a cup dropped off the canvas goes back to the palette).
- **`audio.js`** — `playSmack()`: a little snare hit (a burst of filtered noise) when
  the wave hits the cup, at most one every 0.15 s; silent when the 🔊 toggle is off.
  Its loudness follows the **energy of the wave** that hit: `waveEnergy()` measures it
  just upstream of the cup (each particle's motion plus its stretch, averaged over up to
  a wavelength), and the sound's power is set proportional to it — so doubling the
  amplitude or the frequency makes the hit 4× as energetic (+6 dB).
- **`dev.js`** — the hidden tuning panel and `wavesPerf()` (see Dev tools).

## House rules

**Each wave keeps to its own file.** Anything specific to the string goes in
`string.js` and anything specific to the slinky goes in `slinky.js`, so a change to
one can't break the other. Shared pieces (grid, props, lines) take `activeView` into
account themselves.

**Shared state.** In JavaScript modules, a variable can only be reassigned by the
file that declares it. So `state.js` has a setter for each setting
(`setActiveView()`, `setPaused()`…): read the value anywhere, change it only through
its setter. Objects and lists (`cup`, `slinkyTies`, `lineTool`…) are changed in place
and need no setter.

**Tuning values.** When a number is being tuned by eye, give it a slider in the dev
panel (`dev.js`) rather than guessing and reloading; once it looks right, write the
value into the code.

## Dev tools

- Type **`dev`** anywhere to toggle a hidden panel with a live slider for
  `SLINKY_SUB` (slinky wire smoothness vs. per-frame cost).
- Run **`wavesPerf()`** in the browser console to measure live fps and stroke
  calls per frame.

## Checking a change

There are no automated tests. After a change, run the server and check:

- the browser console (F12) shows no errors;
- both views, in both day and night themes;
- ON/OFF and PULSE at a couple of amplitudes and frequencies, slow motion, pause and step;
- the cup gets knocked (with a snare hit, unless 🔊 is off), a tie rides the wave, and a
  line can be drawn and moved;
- CLEAR empties the current view only.
