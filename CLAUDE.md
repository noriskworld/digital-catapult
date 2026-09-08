# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm install
npm run dev      # Vite dev server, http://localhost:5173
npm run build    # -> dist/
npm run preview  # serve the built dist/

npm test                                      # node:test, no framework to install
node --test test/physics.test.mjs             # one file
node --test --test-name-pattern="pivot"       # one test
```

There is no linter and no `vite.config.*` — Vite runs zero-config with `index.html` as the entry point and `/main.js` as the only module script.

## Architecture

Vanilla ES modules, no framework, four source files with strictly separated roles:

- [constants.js](constants.js) — geometry, masses, factor bounds, and the shared coordinate convention. **Every physical constant belongs here**; both the solver and the renderer import from it.
- [physics.js](physics.js) — pure functions, no DOM: `calculateLaunch`, `trajectoryAt`, `apexHeight`, `randomNormal`. Covered by [test/physics.test.mjs](test/physics.test.mjs).
- [animation.js](animation.js) — `CatapultRenderer`. Owns *all* metre→pixel conversion (`toPx`/`toPy`) and the auto-fit scale.
- [main.js](main.js) — DOM wiring, batching and replication, the frame loop, CSV/TSV export.

Data flow per batch: config rows → `readConfigs()` (clamps to `FACTOR_BOUNDS`) → `calculateLaunch()` once per config → `randomNormal(distance, variation)` once per replicate → result rows + `collectedShots` → `animateShots()` drives the renderer.

### Coordinate convention

Defined once at the top of [constants.js](constants.js) and obeyed everywhere: origin at the arm pivot at ground level, +x downrange, +y up, metres. Angles are standard maths angles in degrees — 90° = arm straight up, 180° = horizontal pointing backwards, >180° = pulled below horizontal. Canvas y is inverted, so the renderer is the only place that negates: `toPy()` and `ctx.rotate(-angleRad)`.

`pinElevation` never reaches the renderer as its own quantity — `effectiveStopAngle()` folds it into the stop angle, and that combined value is what gets solved and drawn.

### Distance is measured from the pivot, not the release point

The cup sits *behind* the pivot at release whenever the effective stop angle exceeds 90° (up to ~0.5 m). `calculateLaunch()` returns `distance = releaseX + vx * flightTime`, so the reported response matches the ruler and the landing flag. Measuring from the release point instead — as an earlier version did — introduces a 2–4% error against the tool's own documentation.

The lumped drag term lives in `vx` rather than being applied to the finished number, which is what keeps `trajectoryAt(launch, flightTime).x === distance`. A test pins this; don't "simplify" the drag back onto `distance`.

### The animation is the physics

`animateShots()` samples `trajectoryAt()` in simulated seconds, merely slowed by `FLIGHT_TIME_SCALE` for viewing. A shot perturbed by process noise still follows a true parabola: `rangeScale` stretches the horizontal axis so it lands on its own mark. Don't reintroduce a fabricated arc — an earlier version drew a heuristic parabola while the solved kinematics went unused.

The arm swing itself is still a shared visual approximation (max pull-back → mean effective stop across the batch); only the projectiles are exact.

### The arena has exactly one redraw owner

`redrawArena()` in [main.js](main.js) paints either the last finished batch (`arenaBatch`) or the idle preview, and every path that touches the canvas goes through it. This exists because binding `resize` straight to the preview wiped a completed batch off screen whenever the window was resized.

`animateShots()` also arms a **watchdog** `setTimeout`. `requestAnimationFrame` is throttled to a standstill in background tabs and fires only ~2 frames in headless Chrome; without the watchdog the arena is left mid-flight and the Run button stays disabled forever. `finish()` is idempotent — the frame loop and the watchdog race, and either may win.

### Renderer scaling

`fitToRange()` zooms *in* as well as out (clamped to `MIN_SCALE`/`MAX_SCALE`), because the canvas is fluid-width — a fixed px-per-metre leaves most of the arena empty. `syncBackingStore()` handles `devicePixelRatio`, so the canvas needs an explicit CSS size in [style.css](style.css); `height: auto` would fight the backing store.

The ground ruler steps over **integer tick indices**, never an accumulating float — summing 0.4 ten times produced labels like `6.000000000000001m` and dropped others entirely.

### Full-shape result contract

`calculateLaunch()` has three dud paths (pull-back doesn't clear the stop, no usable band energy, not travelling downrange). All route through `nullLaunch()`, which spreads caller-supplied fields over a complete zeroed result, so callers never see `undefined`. Check `.valid` and read `.reason` rather than testing `distance > 0`. A test asserts every dud path carries the full field set.

## Domain context

A DOE / Six Sigma training tool: 5 input factors (X's) → responses (Y's). See [README.md](README.md) for the factor table, physics derivation, and suggested exercises; the in-app guide in [index.html](index.html) mirrors it and must be updated alongside.

**`variation` is the model's injected noise, not a measurement.** It is a deterministic function of the inputs, so regressing on it just recovers the generating formula. A genuine variation response comes from firing replicates and taking the standard deviation of observed distances — which is why results accumulate across batches until *Clear Results* and export is one row per shot.

Factor bounds live only in `FACTOR_BOUNDS`; input attributes, the paste importer and `readConfigs()` all read from it. The table headers and guide text in [index.html](index.html) are the one place that still restates them by hand.

Verifying UI changes: headless Chrome works well here. Serve the app, then drive it with an injected script that clicks `#launch-btn` and reports DOM state — but remember rAF barely runs, so exercise the watchdog path rather than expecting a smooth animation.
