# Digital Catapult — DOE Student Workbook

**A hands-on course in Design of Experiments, using a simulated catapult.**

Over five labs you will screen five factors down to the vital few, discover an
interaction, prove that the response surface is curved, fit a quadratic model,
and use it to hit a target distance — twice: once any way that works, and once
in the way that is *most repeatable*. The difference between those two answers
is the point of the whole course.

---

## What you need

- **The simulator.** Easiest: open `digital-catapult.html` — a single file that
  runs in any current browser with nothing to install. (If you have Node
  installed you can instead run `npm run dev` and open the local URL.)
  Alternatively, use the pre-generated data sets in `course/data/` and skip
  firing shots altogether.
- Software to fit models: Minitab, JMP, Excel with Analysis ToolPak, R, or
  Python (`statsmodels`). The repository also ships a small analysis toolkit
  (see Appendix B) if you have none of those.
- This workbook, and somewhere to record answers.

### Reproducibility

Every lab specifies a **seed**. Enter it in the *Seed* box before firing. With
the same design, the same replicate count, the same seed **and the noise level
set to `1x — Normal`**, you will get exactly the data in `course/data/` — so
your numbers will match this workbook, your classmates', and the instructor's
answer key.

Leave the seed blank for genuinely fresh random data. Your conclusions should
survive that; your third decimal place will not.

> **Leave the *Noise* control at `1x — Normal` for Labs 0 to 5.** It changes how
> badly the machine misbehaves, and every number in those labs assumes the
> default. Lab 6 is where you turn it up on purpose.

---

## The machine

Five things you can set (the **factors**, or *X*s):

| | Factor | Range | What it does |
|---|---|---|---|
| **A** | Pull-back angle | 90–200° | How far back the arm is drawn. 90° is straight up, 180° is horizontal. More pull-back stretches the band further and stores more energy. |
| **B** | Stop angle | 90–120° | Where the arm hits the stop and releases the ball. Sets the launch angle. |
| **C** | Bungee position | 1.0–5.0 | Band stiffness, 88 N/m to 200 N/m. |
| **D** | Arm hole | 1.0–5.0 | Cup position along the arm, 0.6 m to 1.0 m from the pivot. Trades release radius against rotational inertia. |
| **E** | Pin elevation | 1.0–5.0 | Raises the stop pin, adding 1.5° per unit to the effective stop angle. |

Two things you measure (the **responses**, or *Y*s):

- **Distance (m)** — where the ball lands, measured from the pivot along the
  ground ruler.
- **Variation (m)** — the standard deviation of repeated shots at the same
  settings. This is *not* printed for you. You must **measure** it, by firing
  replicates and computing *s* yourself.

> The machine has slop in it: band stiffness drifts, the arm rebounds off the
> stop slightly differently each time, the operator cannot hold the pull-back
> angle perfectly, and the tape gets misread. Two shots at identical settings
> will not land in the same place. That is the whole reason this is a
> statistics course and not an algebra exercise.

### The Noise control

The **Noise** menu multiplies every one of those random effects at once. It is
*not* a sixth factor — it is how well maintained the machine is today.

| Setting | What it means |
|---|---|
| `0x` | Perfectly repeatable. Every shot lands in exactly the same place. |
| `0.5x` | A well-behaved process. |
| `1x` | The machine as specified. **Use this for Labs 0–5.** |
| `2x`–`3x` | A machine in poor condition. Small effects start to disappear. |
| `5x` | Barely usable without heavy replication. |

The physics never changes — only the scatter around it. A factor that is real
at `1x` is still real at `5x`; the question is whether your design can *see* it.
That question has a name, **power**, and Lab 6 is about it.

### Coded units

Throughout, factors are reported in **coded** units: **−1** is the low setting,
**+1** the high, **0** the midpoint. Coding makes effects comparable across
factors measured in different units.

```
coded  =  (actual − centre) / half-range
actual =  centre + coded × half-range
```

An **effect** is the change in response going from −1 to +1 — twice the
regression coefficient in coded units.

---

## Lab 0 — How noisy is this process? (30 min)

Before designing anything, find out how much of what you see is real.

**Setup.** Clear the table, add one configuration: A=160, B=105, C=3, D=3,
E=2.25. Replicates **20**, seed **500**.

1. Fire. Export the results.
2. Compute the mean and standard deviation *s* of the 20 distances.
3. Repeat at A=190, B=105, C=4.5, D=3, E=2.25 (seed 501, 20 replicates).

| | Setting 1 | Setting 2 |
|---|---|---|
| Mean distance (m) | | |
| Standard deviation *s* (m) | | |
| Coefficient of variation *s*/mean (%) | | |

**Q0.1** How large a difference in mean distance would you need to see between
two settings before you would believe it is real rather than noise? (Hint: the
standard error of a mean of *n* shots is *s*/√*n*.)

**Q0.2** Is the standard deviation the same at both settings? What does that
imply about treating "variation" as a response in its own right?

**Q0.3** You have a budget of 60 shots. Fired at one setting, how precisely can
you estimate its mean? Spread over 20 settings at 3 shots each, how much do you
learn instead? Write down the trade-off in your own words.

---

## Lab 1 — Screening: which factors matter? (60 min)

Five factors, two levels each, would be 32 runs for a full factorial. We will
spend **8**.

**The design.** A 2<sup>5−2</sup> fractional factorial, built with the
generators **D = AB** and **E = AC**.

**Setup.** *Load DOE design* → *Screening — 2^(5-2) resolution III (8 runs)*.
Replicates **3**, seed **1001**. Fire. Export.

This design uses these low/high settings:

| Factor | Low (−1) | High (+1) |
|---|---|---|
| A Pull-back angle | 130° | 190° |
| B Stop angle | 95° | 110° |
| C Bungee position | 2.0 | 4.0 |
| D Arm hole | 2.0 | 4.0 |
| E Pin elevation | 1.5 | 3.0 |

### 1.1 Work out the alias structure — before you look at the data

D = AB means the D column is the product of the A and B columns. Multiply both
sides by D: **ABD = I**. Do the same for E = AC.

**Q1.1** Write the complete defining relation. (There are three words: the two
generators, and their product.)

```
I  =  ________  =  ________  =  ________
```

**Q1.2** Fill in what each main effect is confounded with. Multiply the effect
by each word in the defining relation and cancel repeated letters.

| Effect | Aliased with (two-factor interactions only) |
|---|---|
| A | |
| B | |
| C | |
| D | |
| E | |

**Q1.3** What is the **resolution** of this design (the length of the shortest
word in the defining relation)? State in one sentence what that resolution
means for how much you can trust the results.

### 1.2 Analyse

4. Fit a **main-effects-only** model to the 24 individual shots.
5. Record each effect, its *p*-value, and its percent contribution to the total
   sum of squares.

| Effect | Estimate | *p* | % contribution | Rank |
|---|---|---|---|---|
| A | | | | |
| B | | | | |
| C | | | | |
| D | | | | |
| E | | | | |

**Q1.4** Rank the factors. Which one is a clear candidate to drop?

**Q1.5** Factor D looks large. Given your alias table, name one other
explanation for that apparent effect that this design cannot rule out.

**Q1.6** You have 8 runs and 5 factors, so no degrees of freedom are left for
interactions. Why does replication give you an error estimate anyway?

---

## Lab 2 — De-aliasing and testing for curvature (75 min)

The screening design ranked the factors but confounded every one of them with
an interaction. Now spend 16 runs to separate them, plus 4 centre points to ask
a question a two-level design cannot answer on its own.

**Setup.** *Load DOE design* → *2^(5-1) resolution V + 4 centre points (20
runs)*. Replicates **3**, seed **2002**. Fire. Export.

The generator is **E = ABCD**, so the defining relation is **I = ABCDE**.

**Q2.1** What is the resolution? What is each main effect aliased with now?
What is each two-factor interaction aliased with?

**Q2.2** Explain why this design costs twice as many runs as Lab 1, and what
you bought with them.

### 2.1 Main effects and interactions

3. Fit a model with **all main effects and all two-factor interactions**, using
   only the 16 factorial runs (the centre points carry no interaction
   information — they are reserved for the curvature test).

| Term | Effect | *p* | % contribution |
|---|---|---|---|
| A | | | |
| B | | | |
| C | | | |
| D | | | |
| E | | | |
| AB | | | |
| AC | | | |
| AD | | | |
| … | | | |

**Q2.3** Which term is the *second largest* in the whole model? Is it a main
effect or an interaction?

**Q2.4** Compare your Lab 1 estimate of the D effect with your Lab 2 estimate.
Did it change? Look at your Lab 1 alias table and explain why.

**Q2.5** With 48 shots, almost every term comes out "statistically
significant", including some contributing less than 0.2%. Which would you keep
in an engineering model, and on what basis? Write down the distinction between
statistical and practical significance in one sentence.

**Q2.6** Interpret the AB interaction physically. Plot mean distance against A
at B low and at B high on the same axes. Why do the lines not stay parallel?
(Think about what the stop angle does to the launch angle, and what happens to
a fast shot fired flat versus lofted.)

### 2.2 The curvature test

Centre points let you check whether a plane can describe the surface at all.
If the response were linear, the centre runs should land at the average of the
factorial corners.

| | Value |
|---|---|
| Mean of the 16 factorial runs (m) | |
| Mean of the 4 centre runs (m) | |
| Difference (m) | |
| *F*, *p* | |

**Q2.7** Is the curvature significant? Which direction does the surface bend?

**Q2.8** You want to hit a *target* of 10 m, not simply throw as far as
possible. Explain why significant curvature means a two-level model cannot be
trusted to do that, no matter how high its R².

**Q2.9** Which factors will you carry into the next phase, and which will you
fix? Justify each decision from your numbers, not from intuition.

---

## Lab 3 — Response surface: fitting the curve (90 min)

Screening leaves three factors worth mapping in detail: **A** (pull-back),
**B** (stop angle) and **C** (bungee). D is fixed at 3.0 and E at 2.25.

A Box-Behnken design takes every *pair* of factors to its four corners while
holding the rest at centre: 12 edge points plus 3 centre runs. It needs three
levels per factor and never visits a corner of the cube — so it never asks for
a combination that pushes two factors to their extremes at once.

**Setup.** *Load DOE design* → *Response surface — Box-Behnken, 3 factors (15
runs)*. Replicates **15**, seed **3003**. Fire (225 shots). Export.

The window has been re-centred and re-scaled around the region of interest:

| Factor | Low (−1) | Centre (0) | High (+1) |
|---|---|---|---|
| A Pull-back angle | 150° | 170° | 190° |
| B Stop angle | 95° | 103.5° | 112° |
| C Bungee position | 1.5 | 3.0 | 4.5 |

**Q3.1** Why 15 replicates here when 3 sufficed in Labs 1 and 2? (You will need
both a mean and a standard deviation from each run. Which of the two is the
noisier statistic?)

**Q3.2** A central composite design would also fit a quadratic. Name one
practical reason to prefer Box-Behnken on this machine.

### 3.1 The mean model

3. For each of the 15 runs, compute the **mean** and the **standard deviation**
   of its 15 shots.
4. Fit a **full quadratic** model to distance: A, B, C, AB, AC, BC, A², B², C².

Write out your fitted equation in coded units:

```
Distance = ______ + ______·A + ______·B + ______·C
                  + ______·AB + ______·AC + ______·BC
                  + ______·A² + ______·B² + ______·C²
```

| | Value |
|---|---|
| R² | |
| Adjusted R² | |
| Which quadratic terms are significant? | |

**Q3.3** Which squared term is the largest? Relate it to the curvature you
detected in Lab 2.

**Q3.4** Run a **lack-of-fit** test. Report *F* and *p*. If it is significant,
compare the size of the lack-of-fit mean square with the residual standard
deviation, and decide whether the model is *practically* adequate. (A model can
fail a lack-of-fit test and still predict well enough to use — with 225 shots,
pure error is estimated so precisely that very small inadequacies become
detectable.)

**Q3.5** Check your model at the centre: predict at A=B=C=0 and compare with
your three observed centre-run means. How close?

### 3.2 Hitting the target

**Your target is 10.00 m.**

5. Using your fitted equation, find coded settings that predict exactly 10 m.

**Q3.6** How many solutions are there? Try to find at least three genuinely
different ones and record them.

| Solution | A | B | C | Pull-back | Stop | Bungee | Predicted |
|---|---|---|---|---|---|---|---|
| 1 | | | | | | | 10.00 |
| 2 | | | | | | | 10.00 |
| 3 | | | | | | | 10.00 |

**Q3.7** The target does not pin down a unique answer — it defines a surface of
them. What should you spend the leftover freedom on?

---

## Lab 4 — Robust settings: same target, less scatter (60 min)

All the settings in Lab 3 hit 10 m on average. They are not equally good.

### 4.1 Model the variation

1. Take the 15 within-run standard deviations from Lab 3.
2. Fit a model to **ln(s)**, with main effects and two-factor interactions.

> Why the logarithm? A standard deviation cannot go below zero and its effects
> tend to be multiplicative. Modelling ln(*s*) fixes both problems, and lets you
> back-transform with `s = exp(prediction)`.

```
ln(s) = ______ + ______·A + ______·B + ______·C + ______·AB + ______·AC + ______·BC
```

| | Value |
|---|---|
| R² | |
| Adjusted R² | |
| Significant terms | |

**Q4.1** Which factor drives variation hardest? Is it the same factor that
drives the mean hardest?

**Q4.2** Compare the R² of this model with the R² of your mean model. Why is
this one so much worse, given both came from the same 225 shots?

### 4.2 Optimise

3. Search the coded cube for the settings that (a) predict 10.00 m from your
   mean model, and (b) among those, give the **smallest** predicted `exp(ln s)`.
4. Then do it the other way round: find the on-target settings with the
   **largest** predicted spread.

| | A | B | C | Pull-back | Stop | Bungee | Predicted mean | Predicted *s* |
|---|---|---|---|---|---|---|---|---|
| Most repeatable | | | | | | | 10.00 | |
| Least repeatable | | | | | | | 10.00 | |

**Q4.3** Describe the difference between the two settings in plain mechanical
language. Which one fires flat and fast, and which lofts the ball more slowly?

**Q4.4** Explain the mechanism. Why should the harder-hitting configuration be
the less repeatable one, even though both land in the same place on average?

---

## Lab 5 — Confirmation (30 min)

A model is a hypothesis until you test it at a setting it has never seen.

1. Enter your **most repeatable** settings. Replicates **30**, seed **9001**.
   Fire.
2. Do the same for your **least repeatable** settings (seed 9002).

| | Predicted mean | Observed mean | Observed *s* | 95% CI on the mean |
|---|---|---|---|---|
| Most repeatable | 10.00 | | | |
| Least repeatable | 10.00 | | | |

**Q5.1** Does the observed mean fall within a 95% confidence interval of your
prediction? If not, by how much is the model off, and does it matter for a
10 m target?

**Q5.2** By what percentage did the robust settings reduce the standard
deviation, at the same mean distance?

**Q5.3** Your predicted *s* almost certainly disagrees with the observed *s*
more than your predicted mean disagreed with the observed mean. Why is that
expected rather than a failure?

**Q5.4** You are asked to cut variation by another 25%. You may either
(a) run more experiments in the same region, (b) widen the factor ranges and
re-map, or (c) reduce a source of machine noise directly. Recommend one, with
reasoning.

---

## Lab 6 — Noise and power: when a good design stops working (60 min)

Everything so far has run on a well-behaved machine. Now break it.

### 6.1 The same experiment, four machines

**Setup.** *Load DOE design* → *De-alias — 2^(5-1) resolution V (16 runs)*.
Replicates **2**, seed **6001**.

Run the same design four times, changing only the *Noise* setting. Fit main
effects plus two-factor interactions each time.

| Noise | Typical *s* of a shot | Effect estimate for E | *p* for E |
|---|---|---|---|
| 0.5x | | | |
| 1x | | | |
| 3x | | | |
| 5x | | | |

**Q6.1** What happened to the *estimate* of the E effect as the noise rose?
What happened to its *p*-value? One of those moved by a factor of a billion and
the other barely moved at all — explain why.

**Q6.2** Factor E is exactly as real at `5x` as at `0.5x`; the physics never
changed. So what is a *p*-value actually a statement about?

**Q6.3** Do the same for factor C, whose true effect is about six times larger
than E's. Why does C survive noise that nearly buries E?

### 6.2 Power: the same experiment, eight times

A single *p*-value from a single experiment tells you almost nothing about
whether a design is adequate — you saw one draw from a distribution. So take
eight.

**Setup.** Stay at **3x** noise. Run the resolution V design at replicates **2**
with each of these seeds in turn: **6101, 6102, 6103, 6104, 6105, 6106, 6107,
6108**. Record whether E comes out significant each time.

| Seed | 6101 | 6102 | 6103 | 6104 | 6105 | 6106 | 6107 | 6108 | **Detected** |
|---|---|---|---|---|---|---|---|---|---|
| E significant? | | | | | | | | | **__ / 8** |

That fraction is an estimate of this design's **power** for factor E at this
noise level.

**Q6.4** You ran one experiment in 6.1 and concluded something about E. Having
now run eight, how much confidence should you have had in that single answer?

Now spend more shots, two different ways, and repeat all eight seeds for each:

| Strategy | Shots per experiment | Detected |
|---|---|---|
| 16 runs × 2 replicates | 32 | __ / 8 |
| 16 runs × 6 replicates | 96 | __ / 8 |
| 32 runs (full factorial) × 2 replicates | 64 | __ / 8 |

**Q6.5** Which strategy fixed the problem? Which used more shots?

**Q6.6** The full factorial uses twice the shots of the half-fraction and does
no better. Compare, for each fit, the residual standard deviation against the
within-run standard deviation you actually measured. What is sitting in the full
factorial's error term that is not in the half-fraction's? (How many
interactions does a 2⁵ design contain, and how many did you put in the model?)

**Q6.7** Complete the sentence in your own words: *runs buy ______, replicates
buy ______.*

### 6.3 A machine with no noise at all

**Setup.** Any design, replicates **5**, noise **0x**.

**Q6.8** What is the standard deviation of each run? What does that do to the
pure-error term, and therefore to every *F* test in your ANOVA?

**Q6.9** With noise off, run the curvature test from Lab 2 again. What
*p*-value do you get, and why is it meaningless?

**Q6.10** If a real process had no measurable variation, how many replicates
would you run, and what would Design of Experiments be for?

### 6.4 The trap

**Setup.** *Screening — 2^(5-2) resolution III (8 runs)*, replicates **2**,
noise **3x**, seed 6004. Fit main effects only.

**Q6.11** Is factor E significant here? Compare with the 16-run design at the
same noise level, which used twice as many shots.

**Q6.12** The 8-run design appears to detect E more reliably than the 16-run
design does. Using your alias table from Lab 1, explain why that is not good
news. What is the E column in this design actually estimating?

**Q6.13** State the general lesson in one sentence, in a form you would be
willing to say to a manager who wants to cut your experiment in half.

---

## Final report

Two pages, plus figures:

1. **Objective** and how you moved from 5 factors to 3.
2. **Designs used**, with run counts and a one-line justification each.
3. **Alias structure** of the screening design and what it cost you.
4. **Evidence of curvature** and what you did about it.
5. **Final models**, mean and variation, in coded units.
6. **Recommended settings** for a 10 m target, with confirmation data.
7. **Total shots fired.** Then state what you would cut if the budget were
   halved, and what you would refuse to cut.
8. **Power.** At what noise level would your screening design have missed a real
   factor, and what would you have done about it?

---

## Appendix A — Coded ↔ actual conversion

Screening designs (Labs 1–2):

| Factor | −1 | 0 | +1 | Half-range |
|---|---|---|---|---|
| A Pull-back | 130 | 160 | 190 | 30 |
| B Stop angle | 95 | 102.5 | 110 | 7.5 |
| C Bungee | 2.0 | 3.0 | 4.0 | 1.0 |
| D Arm hole | 2.0 | 3.0 | 4.0 | 1.0 |
| E Pin | 1.5 | 2.25 | 3.0 | 0.75 |

Response surface (Labs 3–5) — **note the different window**:

| Factor | −1 | 0 | +1 | Half-range |
|---|---|---|---|---|
| A Pull-back | 150 | 170 | 190 | 20 |
| B Stop angle | 95 | 103.5 | 112 | 8.5 |
| C Bungee | 1.5 | 3.0 | 4.5 | 1.5 |

D is held at 3.0 and E at 2.25 throughout Labs 3–5.

---

## Appendix B — Analysis recipes

**Minitab.** *Stat → DOE → Factorial → Analyze Factorial Design* for Labs 1–2;
*Stat → DOE → Response Surface → Analyze Response Surface Design* for Lab 3.
Paste the CSV, then tell Minitab which columns are factors and which is the
response.

**Excel.** *Data → Data Analysis → Regression*. Build the interaction and
squared columns yourself by multiplying the coded columns.

**Python.**

```python
import pandas as pd, statsmodels.formula.api as smf
df = pd.read_csv('course/data/phase3-box-behnken.csv')
df = df.rename(columns={'A_coded': 'A', 'B_coded': 'B', 'C_coded': 'C'})
m = smf.ols('Distance_m ~ A + B + C + A:B + A:C + B:C + I(A**2) + I(B**2) + I(C**2)', df).fit()
print(m.summary())
```

**The repository toolkit.** `node doe/run-study.mjs` runs the whole study and
prints every table in this workbook. Use it to check your work *after* you have
done the analysis yourself — `doe/analysis.js` also exposes `fit`,
`lackOfFit`, `curvatureTest` and `optimiseToTarget` if you would rather script
it.

---

## Appendix C — Provided data sets

If you cannot run the simulator, these contain exactly what the seeds above
produce:

| File | Design | Shots |
|---|---|---|
| `course/data/phase1-screening-2^(5-2).csv` | 2<sup>5−2</sup> res III, 3 reps | 24 |
| `course/data/phase2-resolutionV-2^(5-1).csv` | 2<sup>5−1</sup> res V + 4 CP, 3 reps | 60 |
| `course/data/phase3-box-behnken.csv` | Box-Behnken 3-factor, 15 reps | 225 |
| `course/data/full-factorial-2^5.csv` | Full 2<sup>5</sup>, 3 reps | 96 |

All four were generated at the default noise level (`1x`). Lab 6 has no
pre-generated data — the point of it is to change the noise yourself and watch
the conclusions move.

Each row is one shot. `*_coded` columns are the coded levels; the named columns
are the actual machine settings.
