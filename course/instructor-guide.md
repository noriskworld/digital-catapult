# Digital Catapult — DOE Instructor Guide

Answer key, teaching notes and ground truth for the five-lab Design of
Experiments course built on the Digital Catapult simulator.

**Companion document:** `course/student-workbook.md`

---

## 1. Course at a glance

| Lab | Topic | Design | Shots | Time |
|---|---|---|---|---|
| 0 | Measurement and baseline noise | Repeated runs | 40 | 30 min |
| 1 | Screening, aliasing, resolution | 2<sup>5−2</sup> res III, 3 reps | 24 | 60 min |
| 2 | De-aliasing, interactions, curvature | 2<sup>5−1</sup> res V + 4 CP, 3 reps | 60 | 75 min |
| 3 | Response surface, target setting | Box-Behnken (3 factors), 15 reps | 225 | 90 min |
| 4 | Robust settings, variation response | (same data) | 0 | 60 min |
| 5 | Confirmation and reporting | 2 settings × 30 | 60 | 30 min |
| | | | **409** | **~5.75 h** |

Runs comfortably as a one-day workshop or four 90-minute sessions. Labs 3 and 4
share one data set — collect it once.

**Prerequisites.** Descriptive statistics, the normal distribution, and reading
an ANOVA table. Regression is helpful but is re-taught in context. No calculus.

**What the course is really teaching.** Not "how to run a factorial" — software
does that. The arc is: *cheap experiments buy you rankings and nothing more;
resolution has a price; a target does not determine a unique answer; and the
leftover freedom is where robustness lives.*

---

## 2. Setup and reproducibility

Every lab specifies a **seed**. With the same design, the same replicate count
and the same seed, the simulator produces the same data — in the browser app and
in the offline toolkit alike. This has been verified shot-for-shot.

Students can therefore either generate their own data or use
`course/data/*.csv`; both routes give the numbers in this key.

**Regenerating everything:**

```bash
npm install
node doe/run-study.mjs --write      # prints the full study, rewrites course/data/
node doe/run-study.mjs --target=14  # any other target distance
npm test                            # 23 physics tests
```

**A caution worth passing on.** If a student edits the configuration table by
hand rather than using *Load DOE design*, the run order changes and so do the
random draws. Their conclusions will match; their third decimal will not. This
is a good thing to let happen once, then discuss.

---

## 3. Ground truth (instructors only)

Students never see this. The simulator perturbs the *physical state* of the
machine on every shot and re-solves the mechanics, so the scatter in distance is
an emergent consequence of the settings rather than an assumed formula.

Noise sources, from `constants.js`:

| Source | Magnitude (1σ) |
|---|---|
| Band stiffness | 2.0% relative |
| Stop-angle rebound | 0.28° **× (1 + 0.055 × release velocity)** |
| Cup radius play | 0.004 m |
| Operator pull-back error | 0.60° |
| Ball mass | 1.5% relative |
| Tape measurement | 0.040 m |

**The mechanism that makes Lab 4 work** is the bolded term: the arm rebounds off
the stop less repeatably the harder it arrives. Two settings can travel the same
distance — one lofted and slow, one flat and fast — and the fast one scatters
noticeably more. Nothing in the students' data reveals this directly; they must
infer it from the fitted variation model. Hold it back until the Lab 4 debrief.

`physics.js` exposes `predictSigma(factors)`, a delta-method estimate of the
true σ at any settings, agreeing with Monte Carlo to within 0.3%. Use it to
check student answers instantly.

---

## 4. Answer key

Values below come from the specified seeds. Accept anything within sampling
error; students using their own random data should match the *pattern*, and
effect estimates within roughly ±10%.

### Lab 0 — Baseline noise

| | Setting 1 (160, 105, 3, 3, 2.25) | Setting 2 (190, 105, 4.5, 3, 2.25) |
|---|---|---|
| Mean (m) | 8.558 | 15.059 |
| *s* (m) | 0.2195 | 0.3646 |
| CV | 2.57% | 2.42% |
| SE of mean (n=20) | 0.049 | 0.082 |
| True σ | 0.1933 | 0.3774 |

**Q0.1** With *s* ≈ 0.22 and *n* = 20, SE ≈ 0.05 m, so a difference below about
0.14 m (≈ 2·√2·SE) is not distinguishable. Students who say "any difference I
can see on the ruler" have missed the point.

**Q0.2** σ is clearly *not* constant — it nearly doubles. So variation is a
response in its own right, and any analysis assuming constant variance is on
thin ice. This foreshadows Lab 4 and justifies the log transform there.

**Q0.3** The intended realisation: 60 shots at one setting estimate that mean to
±0.06 m but tell you nothing about *any other* setting. Spread over 20 settings
they estimate each mean only to ±0.13 m but map the whole space. Experiments buy
**contrast**, not precision. This is the single most important idea in the
course; spend time here.

### Lab 1 — Screening (seed 1001)

**Q1.1** I = ABD = ACE = BCDE. (Common error: stopping at two words. ABD × ACE =
BCDE — every product of generators is also a defining word.)

**Q1.2 / Q1.3** Resolution **III**: shortest word has three letters, so main
effects are aliased with two-factor interactions.

| Effect | Aliased with |
|---|---|
| A | BD, CE |
| B | AD |
| C | AE |
| D | AB |
| E | AC |

**Effects table** (main effects on 24 shots):

| Effect | Estimate | *p* | % contribution | Rank |
|---|---|---|---|---|
| A | 8.091 | 1.4e-16 | 55.0 | 1 |
| D | 5.181 | 3.3e-13 | 22.6 | 2 |
| B | 4.002 | 2.6e-11 | 13.5 | 3 |
| C | 2.516 | 4.1e-8 | 5.3 | 4 |
| E | 1.723 | 7.7e-6 | 2.5 | 5 |

R² = 0.9883.

**Q1.4** A dominates; E is the clear drop candidate at 2.5%.

**Q1.5** The apparent D effect is inseparable from AB. In Lab 2 it turns out
that AB is genuinely large (9.2%), so part of what looked like "D" here was the
AB interaction. Students who spot this before seeing Lab 2 deserve credit.

**Q1.6** Replication estimates *pure error* — repeat shots at identical settings
differ only by noise. That is what supplies the denominator of the *F* tests
even when the design itself is saturated.

### Lab 2 — De-aliasing (seed 2002)

**Q2.1** I = ABCDE, resolution **V**. Main effects aliased with four-factor
interactions; two-factor interactions aliased with three-factor interactions.
Both are negligible in practice, so everything of interest is clean.

**Q2.2** Sixteen runs instead of eight buys the ability to *separate* main
effects from two-factor interactions — the thing Lab 1 could not do.

**Effects** (16 factorial runs × 3 shots):

| Term | Effect | % contribution |
|---|---|---|
| A | 7.533 | 65.28 |
| **AB** | **2.823** | **9.17** |
| B | 2.735 | 8.61 |
| D | 2.302 | 6.10 |
| C | 2.191 | 5.52 |
| AC | 1.162 | 1.55 |
| AD | 1.104 | 1.40 |
| BC, BD, CE, DE, AE | 0.5–0.65 | 0.29–0.48 |
| E | 0.432 | 0.21 |
| CD | 0.324 | 0.12 |
| BE | −0.027 | 0.00 (*p* = 0.61) |

R² = 0.9990.

**Q2.3** AB — an *interaction* is the second-largest term in the model. Students
who ran only main effects would have missed it entirely.

**Q2.4** D fell from 5.181 to 2.302. In Lab 1, D was aliased with AB, so its
estimate was inflated by roughly half the AB effect. Checking: 2.302 + 2.823/2 ≈
3.7 — the right direction, and the residual gap is because the two designs use
different runs. Full marks for identifying the alias as the cause.

**Q2.5** With 48 shots even a 0.12% term reaches significance. Practical
significance is the filter: keep A, B, C, D and AB (and arguably AC, AD), drop
everything under about 1%. The teaching line: *statistical significance answers
"is it real?"; percent contribution answers "do I care?"*

**Q2.6** At B low the A effect is smaller; at B high it is larger — the lines
diverge. Mechanically, a higher stop angle both lofts the shot and gives the
extra energy from a bigger pull-back more distance to work with. Look for
students who describe the interaction *physically* rather than just naming it.

**Q2.7 curvature**

| | Value |
|---|---|
| Mean of 16 factorial runs | 7.428 m |
| Mean of 4 centre runs | 8.175 m |
| Difference | −0.748 m |
| *F* (1, 3) | 141.35 |
| *p* | 1.3 × 10⁻⁷ |

Highly significant. The centre sits *above* the corner average, so the surface
is domed — a two-level model would systematically under-predict the middle.

**Q2.8** A plane fitted to the corners misses the centre by three-quarters of a
metre. Aiming at 10 m with it would land you consistently off target. R² is
computed only at the points you visited and says nothing about the middle.

**Q2.9** Carry A, B, C; drop E (0.21%); fix D at its centre. Accept dropping C
instead of D if argued from the numbers — they are within 0.6% of each other.
Reward students who note that D and C are nearly tied and that fixing one is a
judgement call, not a result.

### Lab 3 — Response surface (seed 3003, 15 replicates)

**Q3.1** A mean over *n* shots has standard error σ/√n; a standard deviation is
far noisier and needs far more data. The mean model would be fine on 3 reps —
the variation model in Lab 4 is the reason for 15. See §5 for the evidence.

**Q3.2** Box-Behnken never sets two factors to their extremes simultaneously and
uses only three levels. A central composite design's axial points would sit
outside the declared window — at pull-back angles the machine may not reach.

**Fitted mean model** (coded units):

```
Distance = 9.6332 + 2.4544·A + 2.0665·B + 2.0531·C
                  + 1.0496·AB + 0.5789·AC + 0.6759·BC
                  − 0.2371·A² − 0.5072·B² − 0.0684·C²
```

| | Value |
|---|---|
| R² | 0.9937 |
| Adjusted R² | 0.9935 |
| Residual df | 215 |
| MSE | 0.0549 |

Contributions: A 38.4%, B 27.2%, C 26.9%, AB 3.5%, BC 1.5%, AC 1.1%,
B² 0.76%, A² 0.17%, C² 0.01% (*p* = 0.031).

**Q3.3** B² is the largest quadratic term (−0.507). It is the stop angle that
bends the surface — launch angle has an optimum, while pull-back and band
tension are close to monotonic over this window. This matches the Lab 2
curvature finding.

**Q3.4 lack of fit:** *F* = 4.87 on (3, 212), *p* = 0.0027 — **significant**.
This is deliberate and is the best discussion in the course. With 225 shots pure
error is pinned down so tightly that a practically irrelevant inadequacy becomes
detectable. Residual SD is √0.0549 = 0.234 m, and confirmation runs land within
0.12 m of prediction. The model is statistically inadequate and practically
excellent. Students should conclude: *report it, understand it, then use the
model anyway* — and know why.

**Q3.5** Predicted at centre 9.633 m; observed centre means 9.628, 9.694, 9.578.
Excellent agreement.

**Q3.6** Infinitely many solutions — a two-dimensional surface within the cube.
Three representatives, all predicting 10.00 m:

| C fixed | A | B | Pull-back | Stop | Bungee | True σ |
|---|---|---|---|---|---|---|
| −0.8 | 0.360 | 0.967 | 177.2° | 111.7° | 1.80 | 0.2075 |
| 0.0 | −0.237 | 0.646 | 165.3° | 109.0° | 3.00 | 0.2193 |
| +0.8 | −0.028 | −0.412 | 169.4° | 100.0° | 4.20 | 0.2662 |

**Q3.7** On the second response. The target constrains the mean and leaves a
whole ridge free; spend that freedom on minimising variation.

### Lab 4 — Robust settings

**Fitted ln(s) model:**

```
ln(s) = −1.6214 + 0.2504·A + 0.2093·B + 0.3611·C
                − 0.0038·AB + 0.1355·AC − 0.1260·BC
```

| Term | % contribution | *p* |
|---|---|---|
| C | 42.7 | 0.0020 |
| A | 20.5 | 0.0141 |
| B | 14.3 | 0.0310 |
| AC | 3.0 | 0.266 |
| BC | 2.6 | 0.299 |
| AB | 0.0 | 0.974 |

R² = 0.8318, adjusted R² = 0.7057. Observed *s* ranged 0.094 to 0.347 m.

**Q4.1** C (bungee) drives variation hardest at 42.7%, but A drives the *mean*
hardest at 38.4%. The two responses have different leaders — which is precisely
what makes robust optimisation possible.

**Q4.2** Adjusted R² of 0.71 against 0.99. The mean model was fitted to 225
individual shots; the variation model to 15 standard deviations, each estimated
from only 15 shots. A standard deviation is an intrinsically noisy statistic.

**Optimisation results:**

| | A | B | C | Pull-back | Stop | Bungee | Predicted *s* | True σ |
|---|---|---|---|---|---|---|---|---|
| Most repeatable | 0.989 | 0.388 | −1.000 | 189.8° | 106.8° | 1.50 | 0.176 | 0.211 |
| Least repeatable | 0.987 | −0.811 | 0.501 | 189.7° | 96.6° | 3.75 | 0.289 | 0.320 |

**Q4.3** The robust setting draws the arm far back against a *soft* band and
releases late, lofting the ball. The fragile one uses a stiffer band and
releases early, firing flat and fast. Both land at 10 m.

**Q4.4** The good answer: the flat shot needs more speed to cover the same
ground, the arm arrives at the stop harder, and a harder impact means a less
repeatable release angle. Students cannot derive this from the data alone —
accept any answer that reasons from "faster arrival ⇒ less consistent release".
This is the moment to reveal the velocity-coupled noise term from §3.

Note the robust optimum sits at **C = −1**, the edge of the region. Honest
reading: the data says "go softer than we tested". A good next experiment
extends the window downward. Reward students who say so rather than reporting
the boundary as if it were an interior optimum.

### Lab 5 — Confirmation (seeds 9001 / 9002, 30 shots)

| | Predicted | Observed mean | Observed *s* | 95% CI on mean |
|---|---|---|---|---|
| Most repeatable | 10.00 | 9.894 | 0.198 | ±0.071 |
| Least repeatable | 10.00 | 9.859 | 0.372 | ±0.133 |

**Q5.1** Both fall about 0.11–0.14 m short — just outside the confidence
interval for the robust setting. The model is very slightly optimistic near the
region boundary, where A ≈ +1 and C = −1. For a 10 m target a 1% bias is
usually acceptable; say so, and say why you know it.

**Q5.2** 46.7% reduction in observed *s* (true reduction 34.0%; the difference
is sampling error in *s* at *n* = 30 — worth pointing out).

**Q5.3** Because *s* is a much noisier statistic than the mean. With *n* = 30
the sampling error of *s* is roughly 13%, so a predicted-versus-observed gap of
that size is expected, not evidence of a bad model.

**Q5.4** All three are defensible; grade the reasoning:
- (a) more runs in the same region — lowest value, the ridge is already mapped;
- (b) widen the ranges — well supported, since the optimum is pinned at C = −1;
- (c) attack the machine noise — the highest-leverage answer, and the honest one:
  DOE found the best settings *for this machine*, and further gains require
  changing the machine, not the settings.

---

## 5. The replication economics table

Worth showing at the Lab 4 debrief. The Box-Behnken design was re-run at
different replicate counts; each time the variation model was fitted and used to
choose robust settings, then scored against the true best achievable σ (0.2054 m
at a 10 m target):

| Replicates | Shots | ln(*s*) adj R² | True σ achieved | Above best |
|---|---|---|---|---|
| 6 | 90 | 0.598 | 0.2305 | 12.2% |
| 10 | 150 | 0.490 | 0.2105 | 2.5% |
| 15 | 225 | 0.706 | 0.2109 | 2.7% |
| 20 | 300 | 0.644 | 0.2106 | 2.5% |
| 30 | 450 | 0.888 | 0.2118 | 3.1% |

The mean model is excellent at every one of these. The variation model needs
roughly ten replicates before its *recommendation* becomes trustworthy — and
note that adjusted R² is not monotone in replication, because each fit sees a
different noisy realisation. **The decision stabilises before the statistic
looks impressive.** That distinction is worth drawing out.

---

## 6. Common student errors

1. **Reading the effect straight off the coefficient.** In coded units the
   effect is *twice* the coefficient.
2. **Analysing run means instead of individual shots.** A saturated 16-run
   design has zero residual degrees of freedom on means. Fitting the 48 shots
   is what supplies pure error.
3. **Including centre points in the interaction fit.** They carry no interaction
   information; reserve them for the curvature test.
4. **Trusting a resolution III design.** The most common conceptual failure.
   Insist on the alias table *before* the analysis.
5. **Declaring victory on R².** R² of 0.99 in Lab 2 coexists with badly
   significant curvature. R² measures fit at the points you visited.
6. **Reporting a boundary optimum as an interior one.** See Lab 4.
7. **Chasing *p*-values in Lab 2.** With 48 shots nearly everything is
   significant. Redirect to percent contribution.
8. **Skipping the confirmation run.** A model is a hypothesis until tested at a
   setting it has never seen.
9. **Mixing up the two factor windows.** Labs 1–2 and Labs 3–5 use different
   low/high values for A, B and C. Appendix A of the workbook has both.

---

## 7. Assessment rubric

| Criterion | Weight |
|---|---|
| Alias structure derived correctly and its consequences stated | 15% |
| Screening conclusions justified by contribution, not *p*-values alone | 15% |
| Interaction identified and explained physically | 15% |
| Curvature detected, and the right conclusion drawn from it | 10% |
| Quadratic model fitted and diagnosed (including lack of fit) | 15% |
| Target settings derived, with the non-uniqueness recognised | 10% |
| Variation modelled and used to choose among on-target settings | 10% |
| Confirmation run performed and honestly reported | 10% |

Award full marks in the last row for a student whose confirmation *missed* and
who diagnosed why. Deduct from any report whose confirmation matches the
prediction suspiciously exactly.

---

## 8. Variants and extensions

- **Different target.** `node doe/run-study.mjs --target=14` regenerates the
  whole key. Targets from about 5 m to 16 m sit inside the response surface.
- **Full factorial comparison.** `course/data/full-factorial-2^5.csv` holds all
  32 runs × 3 shots. Have half the class analyse the full factorial and half the
  16-run half-fraction, then compare conclusions against cost. They will agree —
  which is the argument for fractionation, made empirically.
- **Noise as a factor.** Set the seed field to different values and treat it as
  a block. Good for teaching blocking and randomisation.
- **Sequential budget game.** Give teams 150 shots total and let them choose how
  to spend it across screening, RSM and confirmation. Score on confirmed
  distance-to-target and on σ. This is the best single exercise in the set.
- **Measurement systems analysis.** Lab 0 extends naturally into a gauge R&R
  discussion using the 0.040 m tape error.
- **Split-plot.** Ask which factors would be hard to change on a real catapult
  (band tension) versus easy (pull-back angle) and discuss the design
  implications.

---

## 9. Toolkit reference

| File | Purpose |
|---|---|
| `doe/designs.js` | Design generators: full and fractional factorials, alias structure, Box-Behnken, centre points, randomisation, coding |
| `doe/analysis.js` | OLS fitting, ANOVA with exact *F* *p*-values, lack of fit, curvature test, target optimiser |
| `doe/catapult-doe.js` | Factor definitions, both windows, design execution, confirmation runs, CSV export |
| `doe/run-study.mjs` | Runs all three phases and prints this answer key |

The *F*-distribution routine in `analysis.js` was verified against numerical
integration of the *F* density to about 1 part in 10¹³, and the design
generators reproduce standard run counts (Box-Behnken: 15 / 27 / 46 runs for
3 / 4 / 5 factors).
