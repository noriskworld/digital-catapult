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

1. **Distance Thrown ($m$):**
   - Horizontal distance traveled from the catapult pivot ($0\text{m}$) to ground impact ($y = 0$).
2. **Landing Variation ($\pm m$):**
   - Natural process noise standard deviation ($1\sigma$). Higher band tension and longer cup radii naturally generate greater dispersion.
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
$$x(t) = x_{\text{cup}} + (v_0 \cos\alpha) t$$
$$y(t) = y_{\text{cup}} + (v_0 \sin\alpha) t - \frac{1}{2} g t^2$$

---

## 🚀 Features

- **Live Ballistic Visualizer:** High-framerate HTML5 Canvas rendering featuring the catapult frame, swinging arm, stretching rubber band, graduated ground ruler (meter ticks), and animated projectile arcs.
- **Simultaneous Multi-Run Animation:** Run multiple configurations at once with synchronized firing, unique tracer colors, and numbered landing flags.
- **Excel / Google Sheets Copy-Paste:** Copy any 5-column trial table directly from a spreadsheet and paste into the configuration panel.
- **DOE Response Tracking:** View input factor settings and output responses side-by-side.
- **Export Capabilities:** Download your dataset as `.csv` or copy tab-separated values ready for Minitab, JMP, or Excel.
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
npm run build
npm run preview
```

---

## 📖 Recommended DOE Exercises

1. **Screening Experiment ($2^5$ or $2^{5-1}$ Fractional Factorial):**
   - Test low ($-1$) and high ($+1$) settings for each of the 5 factors.
   - Determine which factors are statistically significant for distance vs. variation.
2. **Target Matching:**
   - Find factor settings that consistently achieve exactly $10.0\text{ m}$ while minimizing variation.
3. **Response Surface Design (Central Composite Design):**
   - Explore non-linear curvature in Pull-Back Angle and Bungee Position to identify the global maximum throw.
