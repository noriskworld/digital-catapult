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

node doe/run-study.mjs                        # full sequential DOE study + answer key
node doe/run-study.mjs --target=14 --write    # other target; --write refreshes course/data/

npm run power                                 # design x noise power tables (Lab 6)
npm run build:standalone                      # -> standalone/digital-catapult.html
```

There is no linter and no `vite.config.*` — Vite runs zero-config with `index.html` as the entry point and `/main.js` as the only module script.

## Architecture

Vanilla ES modules, no framework. The simulator core:

- [constants.js](constants.js) — geometry, masses, noise magnitudes, factor bounds, and the shared coordinate convention. **Every physical constant belongs here**; the solver and the renderer both import from it.
- [physics.js](physics.js) — pure, no DOM: `machineState`/`solveLaunch`/`calculateLaunch`, `simulateShot`, `predictSigma`, `trajectoryAt`, `apexHeight`, `makeRng`, `randomNormal`.
- [animation.js](animation.js) — `CatapultRenderer`. Owns *all* metre→pixel conversion (`toPx`/`toPy`) and the auto-fit scale.
- [main.js](main.js) — DOM wiring, batching and replication, the frame loop, the design loader, CSV/TSV export.

And the DOE layer, which the course material depends on:

- [doe/designs.js](doe/designs.js) — design generators (full/fractional factorial, alias structure, Box-Behnken, centre points, randomisation, coded↔actual).
- [doe/analysis.js](doe/analysis.js) — OLS, ANOVA with exact *F* *p*-values, lack of fit, curvature test, target optimiser.
- [doe/catapult-doe.js](doe/catapult-doe.js) — the catapult's factor windows and design execution. Browser-safe (no `node:` imports), which is what lets [main.js](main.js) share it.
- [doe/run-study.mjs](doe/run-study.mjs) — CLI only; the one file that imports `node:fs`.
- [doe/power-study.mjs](doe/power-study.mjs) — CLI; repeats each design across noise levels and reports detection rates. Each design is fitted with the richest model it supports: fitting main-effects-only to this system dumps the large interactions into the residual and measures misspecification rather than power.

Data flow per batch: config rows → `readConfigs()` (clamps to `FACTOR_BOUNDS`) → `calculateLaunch()` once per config for the drawn arc → `simulateShot()` once per replicate for the recorded distance → result rows + `collectedShots` → `animateShots()` drives the renderer.

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

### The standalone build must stay file://-safe

`npm run build:standalone` emits one self-contained HTML file, committed at
[standalone/digital-catapult.html](standalone/digital-catapult.html), because most users have no
toolchain (see [DEPLOYMENT.md](DEPLOYMENT.md)). Two constraints keep it working, and
[scripts/build-standalone.mjs](scripts/build-standalone.mjs) fails the build rather than shipping a
page that silently does nothing:

- **It must not be an ES module.** [vite.config.js](vite.config.js) selects an IIFE bundle for
  `--mode standalone`; module scripts loaded over `file://` are treated as
  cross-origin and blocked.
- **Nothing may be referenced by URL.** No CDN, font, or image links. The
  security notes in DEPLOYMENT.md assert zero network calls and zero external
  URLs, and both are verifiable with grep — keep them true.

Browser storage is likewise unused, deliberately: it is one of the claims made
to IT reviewers.

### Renderer scaling

`fitToRange()` zooms *in* as well as out (clamped to `MIN_SCALE`/`MAX_SCALE`), because the canvas is fluid-width — a fixed px-per-metre leaves most of the arena empty. `syncBackingStore()` handles `devicePixelRatio`, so the canvas needs an explicit CSS size in [style.css](style.css); `height: auto` would fight the backing store.

The ground ruler steps over **integer tick indices**, never an accumulating float — summing 0.4 ten times produced labels like `6.000000000000001m` and dropped others entirely.

### Full-shape result contract

`calculateLaunch()` has three dud paths (pull-back doesn't clear the stop, no usable band energy, not travelling downrange). All route through `nullLaunch()`, which spreads caller-supplied fields over a complete zeroed result, so callers never see `undefined`. Check `.valid` and read `.reason` rather than testing `distance > 0`. A test asserts every dud path carries the full field set.

### Noise is emergent, not assumed

`simulateShot()` perturbs the *physical state* (band stiffness, stop angle, cup radius, pull-back, mass) and re-solves, then adds measurement error. The spread in distance therefore depends on the settings rather than following a formula. The key term is `NOISE.stopAngleVelocityCoupling`: release scatter grows with impact severity, so a flat fast shot is less repeatable than a lofted slow one that lands in the same place. **That coupling is the entire basis of the course's robust-optimisation lab** — remove it and the variation response collapses to a constant multiple of the mean.

`predictSigma()` is a delta-method (first-order error propagation) estimate of that spread, deterministic and agreeing with Monte Carlo to within 0.3%. A test pins that agreement.

**The noise scale** (`simulateShot(factors, rng, noiseScale)`, `predictSigma(factors, noiseScale)`, `runDesign({noiseScale})`) multiplies every magnitude in `NOISE` — except `stopAngleVelocityCoupling`, deliberately, because that sets the *shape* of the variance structure rather than its size. Scaling it too would flatten the lofted-versus-flat difference and destroy the robustness lab. Tests assert both the linearity and the surviving ordering.

At `noiseScale: 0` the process is exactly deterministic, which makes pure error zero, every *F* ratio infinite and every *p*-value 0. That is a legitimate teaching state, not a bug — `fPValue` maps `Infinity` to 0 (most significant, not least), and `run-study.mjs` reports the degeneracy rather than dressing it up as a finding. Within-run spreads at zero noise are ~1e-15 floating-point residue, not exact zeros; assert with a tolerance.

### Seeded reproducibility is a contract

`makeRng(seed)` drives shot noise, and the app **restarts the generator at the top of every batch** when a seed is present. Combined with loading designs in standard order, this makes the browser reproduce `course/data/*.csv` shot for shot — verified, and relied on by the workbook. Two things preserve it, both easy to break:

- Every shot must consume the same number of draws. `simulateShot` is called even for a dud configuration (it returns zero itself) rather than being skipped.
- `doe/run-study.mjs` and `runBatch()` must iterate configurations and replicates in the same nesting order.

`optimiseToTarget` also defaults to a seeded generator for its multi-start, so a recommendation does not change between runs.

## Domain context

A DOE / Six Sigma training tool: 5 input factors (X's) → responses (Y's). See [README.md](README.md) for the factor table, physics derivation, and suggested exercises; the in-app guide in [index.html](index.html) mirrors it and must be updated alongside.

**The UI's "Predicted σ" column is `predictSigma`, a model output, not a measurement.** A genuine variation response comes from firing replicates and taking the standard deviation of the observed distances — which is why results accumulate across batches until *Clear Results*, and why export is one row per shot.

Two factor windows are in play and they are *different*: `FACTORS` (screening, Labs 1–2) and `RSM_FACTORS` (response surface, Labs 3–5), both in [doe/catapult-doe.js](doe/catapult-doe.js). `settingsFor()` holds any factor outside the active subset at its `FACTORS` centre. Mixing the two windows up silently produces wrong coded values.

The course material in [course/](course/) quotes specific numbers from specific seeds. If you change the physics, the noise constants, the factor windows, or the shot-draw order, **regenerate it**: `node doe/run-study.mjs --write`, then update the answer key in [course/instructor-guide.md](course/instructor-guide.md).

Factor bounds live only in `FACTOR_BOUNDS`; input attributes, the paste importer and `readConfigs()` all read from it. The table headers and guide text in [index.html](index.html) are the one place that still restates them by hand.

Verifying UI changes: headless Chrome works well here. Serve the app, then drive it with an injected script that clicks `#launch-btn` and reports DOM state — but remember rAF barely runs, so exercise the watchdog path rather than expecting a smooth animation.
