# Digital Catapult Process Simulator

A high-fidelity, interactive web application simulating the non-linear physics and stochastic variation of a mechanical catapult. Designed for **Design of Experiments (DOE)**, **Statistical Process Control (SPC)**, and **Six Sigma Black Belt / Green Belt** training.

![Digital Catapult Simulation Banner](https://img.shields.io/badge/Vite-Vanilla_JS-646cff.svg)
![Physics-Validated](https://img.shields.io/badge/Physics-Validated_Kinematics-10b981.svg)

---

## 🎯 Overview

In quality engineering and industrial statistics, physical catapults are widely used as hands-on learning devices to teach:
- Full and Fractional Factorial Designs ($2^k$, $2^{k-p}$)
- Main effects and two-factor interactions
- Response Surface Methodology (RSM)
- Process capability and noise/variation reduction

The **Digital Catapult Process Simulator** replaces physical desktop catapults with an accessible, deterministic-yet-stochastic browser environment that models real angular acceleration, rubber band strain energy, and ballistic trajectories.

---

## ⚙️ The 5 Input Factors ($X$'s)

| Factor | Name | Valid Range | Physical Effect |
|---|---|---|---|
| **$X_1$** | **Pull-back Angle** | $90^\circ - 200^\circ$ | Arm loading angle ($90^\circ$ = vertical, $180^\circ$ = horizontal, $>180^\circ$ = downward). Dictates initial band elongation and stored energy. |
| **$X_2$** | **Stop Angle** | $90^\circ - 120^\circ$ | Angle at which the arm strikes the mechanical stop post, governing initial launch angle. |
| **$X_3$** | **Bungee Position** | $1.0 - 5.0$ | Spring tension rating ($k \approx 88\text{ N/m}$ to $200\text{ N/m}$). Increases energy stored per unit stretch. |
| **$X_4$** | **Arm Hole** | $1.0 - 5.0$ | Radial cup position along the arm ($0.6\text{m}$ to $1.0\text{m}$). Increases release radius ($v = \omega r$) while also increasing rotational inertia ($I$). |
| **$X_5$** | **Pin Elevation** | $1.0 - 5.0$ | Raises the physical stop pin, fine-tuning the effective stop angle: $\theta_{\text{eff}} = \theta_{\text{stop}} + 1.5 \times \text{pin}$. |

---

## 📊 The Responses ($Y$'s)

1. **Distance from Pivot ($m$):**
   - Ground impact point measured along the arena ruler from the pivot at $0\text{m}$. This is the response to analyse. Note that the cup sits *behind* the pivot at release whenever the effective stop angle exceeds $90^\circ$; the reported distance accounts for that offset, so the number always matches the landing flag on the ruler.
2. **Predicted $\sigma$ ($\pm m$):**
   - The model's estimate of shot-to-shot spread at these settings. It is a model output, not a measurement. To obtain a genuine variation response, fire several **replicates** and take the standard deviation of the observed distances.
3. **Release Velocity ($m/s$):**
   - Tangential speed of the ball as it separates from the cup.

---

## 🔬 Physics Model

The physics engine implements rotational mechanics and Newtonian kinematics:

### 1. Elastic Strain Energy
The rubber band is anchored to the forward frame at $(0.25, 0.35)$ and attaches to the arm at $0.4L$. As the arm swings from $\theta_{\text{pull}}$ down to $\theta_{\text{stop}}$, the energy transferred is:
$$E = \frac{1}{2} k \left( x_{\text{pull}}^2 - x_{\text{stop}}^2 \right)$$
where $x = \max(0, d_{\text{band}} - L_{\text{rest}})$.

### 2. Rotational Inertia & Release Speed
Accounting for the uniform arm ($M_{\text{arm}} = 0.25\text{ kg}$) and projectile ($m = 0.045\text{ kg}$):
$$I = \frac{1}{3} M_{\text{arm}} L^2 + m r_{\text{cup}}^2$$
$$\omega = \sqrt{\frac{2E}{I}}$$
$$v_0 = \omega \cdot r_{\text{cup}}$$

### 3. Ballistic Trajectory
With launch angle $\alpha = \theta_{\text{eff}} - 90^\circ$ and release height $h_0 = r_{\text{cup}} \sin(\theta_{\text{eff}})$:
$$t_{\text{flight}} = \frac{v_0 \sin\alpha + \sqrt{(v_0 \sin\alpha)^2 + 2 g h_0}}{g}$$
$$x(t) = x_{\text{cup}} + v_x t, \qquad y(t) = y_{\text{cup}} + (v_0 \sin\alpha) t - \frac{1}{2} g t^2$$

### 4. Random Effects
The machine is never set up twice in exactly the same state. Every shot perturbs the *physical* quantities — band stiffness ($2\%$), stop-angle rebound, cup radius ($4\text{ mm}$), operator pull-back error ($0.6^\circ$), ball mass ($1.5\%$) — and re-solves the mechanics, before adding tape-measure error ($4\text{ cm}$). Scatter in distance is therefore *emergent*: it depends on the settings rather than following an assumed formula.

All of these magnitudes are multiplied by the **noise scale**, so the whole experiment's signal-to-noise ratio can be dialled from $0\times$ to $5\times$ without touching the physics.

Crucially, the release-angle scatter is multiplied by $(1 + 0.055\,v_0)$: the arm rebounds off the stop less repeatably the harder it arrives. A flat, fast shot and a lofted, slow one can travel the same distance while scattering by different amounts — which is what makes minimising variation a genuinely separate problem from hitting a target.

### 5. Aerodynamic Loss
A lumped drag term is applied to the horizontal component, $v_x = v_0\cos\alpha / (1 + 0.02\,v_0)$, so that faster shots bleed proportionally more range. Because the loss lives in $v_x$ rather than being applied to the finished number, $x(t_{\text{flight}})$ reproduces the reported distance exactly — the drawn arc and the recorded response are the same trajectory.

---

## 🚀 Features

- **Live Ballistic Visualizer:** HTML5 Canvas rendering of the frame, swinging arm, stretching band, a graduated ground ruler, and projectile arcs sampled directly from the solved kinematics — the animation is the physics, not a decorative approximation.
- **Auto-Scaling Arena:** The view fits itself to the longest shot and the highest arc in a batch, so results stay on screen from a 1 m dribble to a 30 m throw.
- **Replicates and seeding:** Fire 1–30 shots per configuration in a single batch. Results accumulate across batches until cleared. Set a seed to make a whole data set reproducible; leave it blank for fresh randomness.
- **Tunable noise:** A single control scales every random effect from `0x` (perfectly repeatable) to `5x` (barely usable). The physics is unchanged — only the scatter around it — so a design that comfortably detected a factor at `1x` will start missing it at `3x`. This turns statistical power into something a class can watch happen.
- **Built-in DOE designs:** Load a full factorial, a fractional factorial (resolution III or V), a 12-run Plackett-Burman screen, centre points, or a Box-Behnken response surface directly into the run table.
- **Simultaneous Multi-Run Animation:** Run every configuration at once with unique tracer colors and stacked, numbered landing flags.
- **Excel / Google Sheets Copy-Paste:** Copy any 5-column trial table directly from a spreadsheet and paste into the configuration panel.
- **DOE Response Tracking:** Input factor settings and output responses side-by-side, one row per shot.
- **Export Capabilities:** Download the raw shot data as `.csv` or copy tab-separated values ready for Minitab, JMP, or Excel.
- **Interactive In-App Guide:** Built-in collapsible guide detailing factors, bounds, and DOE procedures.

---

## 💻 Getting Started & Local Development

### Prerequisites
- Node.js (v18 or higher recommended)
- npm or pnpm

### Installation
```bash
# Clone or navigate to the repository
cd digital-catapult

# Install dependencies
npm install
```

### Running Locally
```bash
# Start Vite development server
npm run dev
```
Open your browser at the displayed local URL (typically `http://localhost:5173`).

### Production Build
```bash
npm run build       # multi-file build in dist/, for a web server
npm run preview     # serve the built dist/
```

### Sharing it with people who don't have npm

```bash
npm run build:standalone     # -> standalone/digital-catapult.html
```

This produces the **entire application as one self-contained 35 kB HTML file** —
no server, no install, no internet connection, no external references of any
kind. Double-click it, host it, email it, or drop it on a network share. A
current copy is committed to the repository, so most people can just download
that file and open it.

See **[DEPLOYMENT.md](DEPLOYMENT.md)** for hosting options, SharePoint and
Confluence specifics, browser requirements, and the notes an IT security review
will ask for.

### Design of Experiments course

The repository ships a complete DOE teaching package built on the simulator:

- **[course/student-workbook.md](course/student-workbook.md)** — five labs taking students from a 5-factor screening design to robust settings that hit a target distance.
- **[course/instructor-guide.md](course/instructor-guide.md)** — full answer key, ground truth on the noise model, timings, common errors and a marking rubric.
- **Lab 6 on power** — students raise the noise until a real factor stops being detectable, then buy it back with replication. `npm run power` produces the supporting tables.
- **[course/data/](course/data/)** — pre-generated data sets for every design.

```bash
node doe/run-study.mjs             # run the whole study and print the answer key
node doe/run-study.mjs --target=14 # optimise to a different target distance
node doe/run-study.mjs --noise=3   # the same study on a badly behaved machine
node doe/run-study.mjs --write     # also regenerate course/data/
npm run power                      # how often does each design detect each factor?
```

The study runs three designs in sequence — a 2^(5-2) resolution III screen, a 2^(5-1) resolution V de-aliasing design with centre points, and a Box-Behnken response surface — then fits a quadratic model, solves it for a target distance, and confirms the answer against the simulator. Designs can also be loaded straight into the app from the *Load DOE design* menu, and the *Seed* field makes any data set reproducible.

### Tests
The physics solver is pure and covered by `node:test` — no test framework to install.
```bash
npm test                                   # whole suite
node --test test/physics.test.mjs          # one file
node --test --test-name-pattern="pivot"    # one test
```

---

## 🗂️ Project Layout

| File | Responsibility |
|---|---|
| `constants.js` | Single source of truth for geometry, masses, factor bounds and the shared coordinate convention. |
| `physics.js` | Pure solver: `calculateLaunch`, `trajectoryAt`, `apexHeight`, `randomNormal`. No DOM. |
| `animation.js` | `CatapultRenderer` — all metre→pixel conversion, drawing and auto-scaling. |
| `main.js` | DOM wiring, run batching and replication, the frame loop, the DOE design loader, CSV/TSV export. |
| `doe/` | Design generators, OLS/ANOVA/optimisation, and the study runner behind the course material. |
| `course/` | Student workbook, instructor answer key, and pre-generated data sets. |

Because `physics.js` and `animation.js` both import their geometry from `constants.js`, the drawn machine cannot drift out of step with the solved one.

---

## 📖 Recommended DOE Exercises

1. **Screening Experiment ($2^5$ or $2^{5-1}$ Fractional Factorial):**
   - Test low ($-1$) and high ($+1$) settings for each of the 5 factors.
   - Determine which factors are statistically significant for distance vs. variation.
2. **Target Matching:**
   - Find factor settings that consistently achieve exactly $10.0\text{ m}$ while minimising variation. Use 5+ replicates so the observed standard deviation is a meaningful response.
3. **Response Surface Design (Central Composite Design):**
   - Explore non-linear curvature in Pull-Back Angle and Bungee Position to identify the global maximum throw.
