# Instructor guide — the unreplicated revision (n = 1)

A companion to [instructor-guide.md](instructor-guide.md), not a replacement.
Every design in the course is run here with **one shot per design point**. The
factor windows, the seeds, the generators and the order of the labs are all
unchanged; only the replicate count moves.

Regenerate everything in this file with:

```bash
node doe/run-study.mjs --reps=1 --out=course/data-n1 --write
```

Data sets live in [data-n1/](data-n1/), including
`full-factorial-2^5-plus-4cp.csv` for Exercise 2b. The replicated course is
untouched and still regenerates with a bare `node doe/run-study.mjs --write`.

## Why this revision exists

It is not a cheaper course. It is the same course with the replicates taken
out, so that a class can see exactly which conclusions were being paid for by
them. Three things disappear, and they are not the three most people predict:

| What survives | What degrades | What ceases to exist |
|---|---|---|
| Every factor effect estimate | Screening power, badly | Lab 0 — there is no *s* to measure |
| The quadratic surface | Screening *p*-values | The variation response, entirely |
| Curvature detection, where centre points exist | Lack-of-fit, into false reassurance | Replicated runs, and the σ model built on them |

The estimates are all still there and still unbiased. What goes is most of the
ability to say anything about them.

**One important qualification**, and it is the constructive result of the whole
revision: wherever a design carries **replicated centre points**, a real pure
error survives. Lab 2's four centre runs give 3 df of genuine noise, and that
turns out to be worth more than any amount of pooling (see Lab 2, Route 2).
Lab 4's three centre runs give 2 df, which is enough to run a lack-of-fit test
and not enough for it to mean anything. The practical rule to take away:
**if you must run unreplicated, replicate the centre.**

---

## Lab 0 — the lab that cannot be run

Fire seed 500 and seed 501 once each:

| | Setting 1 | Setting 2 |
|---|---|---|
| The shot | 8.930 m | 15.468 m |
| *s* | — | — |
| CV | — | — |
| True σ (instructor) | 0.1933 m | 0.3774 m |

**Q0.1** is unanswerable. The question asks how large a difference you would
need to see before believing it, and the answer is derived from *s*, which does
not exist here. Students will reach for the difference between the two numbers
(6.538 m) and call it an effect. It is an effect plus two draws of noise, and
nothing in the data says how much of each.

**Q0.2** is unanswerable in the same way, and this is the expensive one. σ
nearly doubles between these two settings — 0.1933 to 0.3774 — and the
unreplicated experiment cannot see that it moved at all. Everything Exercise 3
eventually does with variation rests on noticing this in the first ten minutes
of the course.

**Q0.3** is the one question that still works, and it is now the whole lab. With
60 shots you can fire 60 settings once, or 20 settings three times, or 3
settings twenty times. Run the argument here, then tell them the rest of the
course will be run at one shot per setting and ask them to predict what breaks.
Write the predictions on the board. Most rooms predict "the answers get less
accurate". That is the one thing that does *not* happen.

> **Teaching note.** If you have time for only one thing from this revision,
> make it this: fire Lab 0 both ways, 1 shot and 20, in the first half hour.

---

## Lab 1 — screening

### 1a · 2⁵⁻² resolution III, 8 runs × 1 = **8 shots** (seed 1001)

| Term | Effect | % contrib | *p* |
|---|---|---|---|
| A | 7.966 | 53.96 | 0.0116 |
| D | 5.203 | 23.01 | 0.0265 |
| B | 3.939 | 13.19 | 0.0450 |
| C | 2.612 | 5.80 | 0.0944 |
| E | 1.804 | 2.77 | 0.1723 |

R² = 0.9873, adjusted R² = 0.9555, **residual df = 2**, MSE = 1.4960.

The ranking is identical to the replicated run and the effect estimates are
close to it. The *p*-values are not: at 24 shots C came out at 5 × 10⁻⁸ and E
at 1 × 10⁻⁵, and both were significant. Here C misses at 0.094.

**C is real** — 2.1 m of true effect, the third largest thing on the machine —
and this design just failed to find it. A team following the usual rule would
carry A, D and B forward and drop bungee position. Note what that costs later:
C turns out to be the *dominant factor in variation*.

Two residual degrees of freedom is the whole story. Every *p* in the table is
computed against a denominator estimated from two numbers.

### 1b · Plackett–Burman, 12 runs × 1 = **12 shots** (seed 1201)

| Term | Effect | % contrib | *p* |
|---|---|---|---|
| A | 7.165 | 77.65 | 0.0007 |
| B | 1.788 | 4.83 | 0.1621 |
| D | 1.448 | 3.17 | 0.2442 |
| C | 1.253 | 2.37 | 0.3067 |
| E | −0.601 | 0.55 | 0.6112 |

R² = 0.8858, residual df = 6, residual SD = 1.943 m.

**Only A is significant.** Four of five factors, three of them genuinely large,
come back indistinguishable from nothing.

The spare columns tell the same story more honestly and for free:

```
spare column effects:  0.24  −1.07  −1.75  0.64  0.99  −1.37
largest |spare|:       1.75 m
```

B (1.79), D (1.45) and C (1.25) all sit at or below the level that columns
measuring nothing reach. The spare-column yardstick and the *p*-values agree
here — which they did **not** in the replicated course, where replication made
B, C and D significant while the spare columns said to trust only A. Worth
pointing out: at 36 shots the two diagnostics disagreed and the cheap one was
right; at 12 shots they agree, and both are right for the wrong reason.

Fitting all eleven columns saturates the design. Lenth's PSE = 1.742,
ME = 5.015, SME = 10.743 — only A clears either margin.

---

## Lab 2 — de-aliasing

### 2⁵⁻¹ resolution V + 4 centre points, 20 runs × 1 = **20 shots** (seed 2002)

**The design is saturated.** Sixteen factorial runs, and a model with the five
main effects and all ten two-factor interactions needs sixteen parameters.
OLS solves it exactly, with zero residual and zero degrees of freedom. There is
no F ratio and no *p*-value for any term — not small ones, none at all.

This is the single most important slide in the revision, and the most common
real-world version of the mistake: the design looks bigger and better than
Exercise 1's, and it has *less* inferential capacity.

There are **three** ways out, and comparing them is the lesson. Each is a
different answer to the same question: *what shall I use as the error term?*

#### Route 1 — the reduced model (pool the higher-order terms)

The usual first move, and the right one to try first: drop terms you are willing
to assume are inert, and let them fall into the residual. Every term you pool
buys one degree of freedom.

| Model | Resid df | Resid SD | Significant at 0.05 |
|---|---|---|---|
| main effects only | 10 | 2.384 | A B |
| + AB | 9 | **1.610** | A B C D AB |
| + AB AC AD | 7 | 1.308 | A B C D AB |
| + every A interaction | 6 | 1.264 | A B C D AB |

**Look at the second row.** Moving one term — AB — out of the residual and into
the model drops the error SD from 2.384 to 1.610 and changes *four*
conclusions: C, D and AB all become significant, and C is the factor Exercise 1
had already failed to find.

That is the whole argument about pooling in one table. Pooling is legitimate and
it works, but the error term you buy is **made of the terms you pooled**. Pool a
real effect and you have not estimated noise, you have estimated the thing you
decided to ignore — and it is the same misspecification failure the full
factorial demonstrates in Lab 3, arriving a lab early.

Two warnings worth stating to the room:

- **Choosing what to pool by looking at these same effects biases every test
  that follows.** The honest version pre-specifies the pooled set from
  subject-matter knowledge (here: effect heredity says interactions among
  inactive factors are negligible), not from the sorted effect list.
- Even the best of these rows has an error SD of 1.26 m against a true
  shot-to-shot SD near 0.16 m. The denominator is roughly eight times too big
  no matter which row you pick.

#### Route 2 — the centre points (an error term made of actual noise)

This design already carries four centre runs, and they are replicates *of each
other*. They give a pure-error estimate that owes nothing to any modelling
assumption:

```
4 centre shots  →  s = 0.1823 on 3 df      SE(effect) = 2s/√16 = 0.0912
```

| Term | Effect | t | p |
|---|---|---|---|
| A | 7.539 | 82.69 | 3.9 × 10⁻⁶ |
| AB | 2.894 | 31.75 | 6.9 × 10⁻⁵ |
| B | 2.773 | 30.41 | 7.8 × 10⁻⁵ |
| D | 2.336 | 25.63 | 0.0001 |
| C | 2.285 | 25.06 | 0.0001 |
| AC | 1.260 | 13.82 | 0.0008 |
| AD | 1.120 | 12.28 | 0.0012 |
| BC | 0.840 | 9.22 | 0.0027 |
| DE | 0.781 | 8.56 | 0.0033 |
| AE | 0.774 | 8.49 | 0.0034 |
| BD | 0.731 | 8.01 | 0.0041 |
| CE | 0.682 | 7.48 | 0.0049 |
| E | 0.622 | 6.83 | 0.0064 |
| CD | 0.282 | 3.09 | 0.054 |
| BE | −0.053 | −0.58 | 0.603 |

**Thirteen of fifteen.** On three degrees of freedom. This route recovers more
than the replicated course's own resolution V analysis reported as interesting,
and it costs four runs that were already in the design for the curvature test.

The reason it works is worth saying slowly: *s* = 0.182 m is an estimate of
noise. Every pooled residual above is an estimate of noise **plus** the
interactions that were pooled, which is why they run 7 to 13 times larger.

This is also the practical recommendation. **If you must run unreplicated, put
replicated centre points in the design.** They cost a handful of runs and they
buy back pure error, the curvature test, and a denominator for every effect.

#### Route 3 — Lenth's pseudo standard error

The assumption-light option: build an error estimate out of the effects
themselves, on the assumption that most of them are inert.

| Term | Effect | % contrib | vs Lenth margins |
|---|---|---|---|
| A | 7.539 | 63.29 | **active (beyond SME)** |
| AB | 2.894 | 9.33 | — |
| B | 2.773 | 8.56 | — |
| D | 2.336 | 6.08 | — |
| C | 2.285 | 5.81 | — |
| AC | 1.260 | 1.77 | — |
| AD | 1.120 | 1.40 | — |
| BC | 0.840 | 0.79 | — |
| DE | 0.781 | 0.68 | — |
| AE | 0.774 | 0.67 | — |
| BD | 0.731 | 0.59 | — |
| CE | 0.682 | 0.52 | — |
| E | 0.622 | 0.43 | — |
| CD | 0.282 | 0.09 | — |
| BE | −0.053 | 0.00 | — |

Lenth's PSE = 1.2158 on 5.00 df, **ME = 3.125**, **SME = 6.345**.

Only A clears the margin. AB, B, D and C — every one of them confirmed real by
the 96-shot factorial — fall below it. Against a true shot-to-shot SD near
0.16 m, the PSE is about eight times too large.

#### Which route to teach

Run all three and put them side by side:

| Route | df | Error SD | Effects found |
|---|---|---|---|
| Reduced model, mains only | 10 | 2.384 | 2 of 15 |
| Reduced model, + AB | 9 | 1.610 | 5 of 15 |
| **Centre points** | **3** | **0.182** | **13 of 15** |
| Lenth's PSE | 5 (pseudo) | 1.216 | 1 of 15 |

The route with the *fewest* degrees of freedom wins by a distance, because
degrees of freedom were never the scarce resource. **An honest error estimate
was.**

**Q2.x — why Lenth fails here.** Push the class on this, because it is the
subtlest point in the revision. Lenth's method assumes effect sparsity: that
most contrasts estimate noise, so their median is a scale for noise. On this
machine seven of the fifteen contrasts are genuinely active. The median is
therefore taken over a set that is nearly half signal, the PSE comes out around
1.2 when the true shot-to-shot SD is about 0.16, and the margin it produces is
roughly twenty times too wide. **The method is not broken. Its assumption is,
and the method has no way to tell you so.**

**Q2.y — the unifying question.** Ask: "Routes 1 and 3 both estimate error from
the effects. Route 2 estimates it from repeated shots. Why does that matter more
than the degrees of freedom?" The answer is the sentence the whole revision is
built around: pooled residuals and pseudo standard errors are made of *signal
you chose to ignore*; only replication is made of noise. A student who reaches
that on their own has got the point of the course, not just of this lab.

### Curvature

| | Value |
|---|---|
| Mean of 16 factorial runs | 7.433 m |
| Mean of 4 centre runs | 8.282 m |
| Difference | −0.849 m |
| *F* (1, 3) | 69.33 |
| *p* | 3.6 × 10⁻³ |

Curvature **survives at n = 1**, and it is the only inferential test in Lab 2
that does. The reason is worth stating aloud: the four centre runs are four
replicates *of each other*, so this one test brought its own pure error along.
Four centre runs fired once each is 3 df — which is what the arithmetic
4 − 1 = 3 actually describes. (In the replicated course those same four runs are
fired three times each, giving 12 observations and 11 df. Same design, different
denominator, and the difference is entirely replication.)

---

## Lab 3 — the full factorial, run twice

The deck splits this into **Exercise 2a** (bare) and **Exercise 2b** (the same
design plus four centre runs). They share seed 4004, and because the centre runs
are appended *after* the factorial block, 2b's 32 corner shots are the identical
numbers from 2a. The only difference between the two exercises is four shots.

### 2a · 2⁵, 32 runs × 1 = **32 shots** (seed 4004)

| Term | Effect | % contrib | *p* |
|---|---|---|---|
| A | 7.531 | 65.61 | 8.8 × 10⁻¹⁸ |
| AB | 2.685 | 8.34 | 8.2 × 10⁻¹¹ |
| B | 2.619 | 7.94 | 1.2 × 10⁻¹⁰ |
| D | 2.447 | 6.93 | 3.3 × 10⁻¹⁰ |
| C | 2.261 | 5.91 | 1.0 × 10⁻⁹ |
| AD | 1.252 | 1.81 | 3.2 × 10⁻⁶ |
| AC | 1.198 | 1.66 | 5.4 × 10⁻⁶ |
| E | 0.483 | 0.27 | 0.0163 |

R² = 0.9940, adjusted R² = 0.9884, residual df = 16, residual SD = 0.509 m.

**This one works**, and students should be told why before they conclude that
replication was never needed: 32 runs against 16 parameters leaves 16 residual
degrees of freedom, bought with *runs* rather than replicates.

Then take it away again. Ask what that residual is made of. It is every three-,
four- and five-factor interaction the model dropped — real, structural signal —
plus noise, with no way to separate them:

**Lack of fit: not computable.** No design point was visited twice, so there is
no pure error, so the residual cannot be split. The replicated course got
*F*(16, 64) = 20.47, *p* = 3 × 10⁻¹⁹ here, and concluded that a 0.456 m residual
against a 0.206 m pure error meant the model was missing something real. At
n = 1 that diagnosis is unavailable. The residual is 0.509 m and the honest
answer to "how much of that is the machine and how much is my model?" is that
this experiment cannot say.

**Do not let the E result pass unexamined.** E comes out at *p* = 0.016 and
looks detected. Run the same 32-shot design over 200 different seeds and E is
significant **18% of the time**. Seed 4004 was a lucky draw. This is the
reproducibility lesson arriving a lab early.

### 2b · the same design + 4 centre runs = **36 shots** (seed 4004)

Four runs at coded zero — 160°, 102.5°, 3.0, 3.0, 2.25 — which makes them four
replicates of each other, and the only repeated setting in the exercise.

Centre shots: **7.827, 7.944, 7.990, 8.534**

| | 2a · 32 shots | 2b · 36 shots |
|---|---|---|
| Pure error | — | **0.314 m on 3 df** |
| Residual SD (15 terms) | 0.509 m | 0.509 m |
| Lack of fit | not computable | *F*(16, 3) = 2.62, *p* = 0.23 |
| Curvature | not computable | *F*(1, 3) = 18.19, *p* = 0.024 |
| Effects significant | 11 of 15 | 11 of 15 |

**The last row is where to start.** 2b found nothing new. Students expect the
augmented design to detect more effects and it does not — which is precisely
what makes the value of the four runs visible: they did not change the answer,
they established whether the answer could be trusted.

**Lack of fit — the assumption, checked.** 2a had to *assume* its 0.509 m
residual was mostly noise. 2b measures noise at 0.314 m, so the residual is
1.6× pure error and the dropped three-, four- and five-factor interactions
really are small. Same conclusion as 2a, now held for a reason rather than by
default. (Note this is the opposite verdict to the replicated course, where 96
shots pin pure error tightly enough to reject the same model at
*p* = 3 × 10⁻¹⁹. Precision in the yardstick, not error in the model.)

**Curvature — the decision, changed.** The centre sits 0.711 m *above* the
corner average. A plane through the corners under-predicts the middle by about
7%, and 10 m is in the middle. **This is the finding that sends the course to
Exercise 3, and 2a cannot produce it at all.** Ask what would have happened to
a team that finished at 2a, took the plane, and solved it for 10 m.

**Be honest about the 3 df**, because a sharp student will raise it. Lab 2's
four centre runs gave *s* = 0.182 m at these same settings; these four gave
0.314 m. The true value is **0.187 m**. Two samples of four, one nearly exact
and one 68% high — that is what a standard deviation on three degrees of
freedom looks like, and it is the argument for six or eight centre runs rather
than four when they are carrying this much weight.

**Q — the closing question for this lab.** "You have 36 shots. Would you rather
have spent the last four on four more corners, or at the centre?" Four more
corners buy a marginally better estimate of effects already measured well. The
centre buys two diagnostics that cannot otherwise exist.

> **The rule to take back to work:** if you must run unreplicated, **replicate
> the centre**.

---

## Lab 4 — response surface

### Box-Behnken, 15 runs × 1 = **15 shots** (seed 3003)

| Term | Coefficient | % contrib | *p* |
|---|---|---|---|
| A | 2.4633 | 37.96 | 8.1 × 10⁻⁷ |
| B | 2.1655 | 29.34 | 1.5 × 10⁻⁶ |
| C | 2.0765 | 26.98 | 1.9 × 10⁻⁶ |
| AB | 1.0009 | 3.13 | 0.0004 |
| BC | 0.6373 | 1.27 | 0.0029 |
| AC | 0.5032 | 0.79 | 0.0078 |
| B² | −0.3226 | 0.30 | 0.0459 |
| A² | −0.0775 | 0.02 | 0.5538 |
| C² | 0.0010 | 0.00 | 0.9940 |

Intercept 9.4107. R² = 0.9978, adjusted R² = 0.9940, residual df = 5,
residual SD = 0.235 m.

The mean model is in good shape — the same three main effects, the same
ordering, the same AB interaction, and B² still the largest quadratic term at
*p* = 0.046. **Fifteen shots buy the entire response surface.** Say so plainly;
it is the strongest argument in the course for spending runs rather than
replicates when the mean is all you want.

**Lack of fit: *F* = 0.52 on 3 and 2 df, *p* = 0.711 — "no significant lack of
fit".** This is a trap, and it should be sprung deliberately. The replicated
course, on the identical design, found *significant* lack of fit
(*F* = 4.87, *p* = 0.0027). Nothing about the surface changed. What changed is
that pure error is now estimated from three centre runs — 2 degrees of freedom —
and a test with 2 df in the denominator cannot detect anything. **The
unreplicated design did not tell you the model was adequate. It told you
nothing, in the grammar of a test that says everything is fine.**

Ask the room which is more dangerous: Lab 2's saturated design, which refuses to
produce a *p*-value at all, or this one, which produces a reassuring one.

### The variation response: gone

There is no second model. Each design point was fired once, so there is no
within-run standard deviation — not a small one, not a noisy estimate of one,
no observation of it at all.

Every shot still scatters exactly as much as it did before. What has gone is
any way to see it.

So Q4.1 (the two responses have different leaders), Q4.2 (why ln *s* needs 15
shots when the mean needed 3), Q4.3, Q4.4 and the whole robust-settings
discussion have no data behind them in this revision. Do not paper over it.
**The hole where the second response used to be is the deliverable.**

---

## Lab 5 — optimisation

Solve the mean model for 10.00 m and you do not get an answer. You get a ridge:
**397 points** of the coded cube sit within 2 cm of 10 m, and this experiment
cannot tell them apart, because telling them apart was the other response's job.

Across that ridge, true σ runs from **0.2001 m to 0.3397 m**.

| | Coded | Settings | Confirmed mean | Confirmed *s* |
|---|---|---|---|---|
| Best point on the ridge | A 0.500, B 1.000, C −1.000 | 180.0°, 112.0°, 1.50 | 9.696 m | 0.192 m |
| Worst point on the ridge | A 0.800, B −0.950, C 0.950 | 186.0°, 95.4°, 4.43 | 9.710 m | 0.322 m |

Confirmations are 600 shots at seed 99991.

Choosing well would cut scatter by **40.5%** at no cost in accuracy — and there
is nothing in the experiment to choose with. A team runs the optimiser, gets a
setting, and lands somewhere on that ridge by accident.

Note the mean error too: both points land about 0.30 m short of the 10 m the
model promised, against roughly 0.11 m in the replicated course. Some of that is
the model, some is where on the ridge you happen to be, and — one more time —
this experiment cannot separate the two.

---

## Lab 6 — noise and power

**The resolution V design cannot be used here at all.** At 16 runs × 1 it is
saturated for a model with two-factor interactions, so there is no *p*-value to
watch fade as the noise rises. Lab 6 runs on the 8-run resolution III design
instead.

### 6.1 — one seed, four noise levels (8 runs × 1, seed 6001, main effects)

| Noise | A *p* | C effect | C *p* | E effect | E *p* |
|---|---|---|---|---|---|
| 0.5× | 0.0090 | 2.473 | 0.0858 | 1.598 | 0.1753 |
| 1× | 0.0081 | 2.366 | 0.0857 | 1.571 | 0.1681 |
| 3× | 0.0050 | 1.921 | 0.0855 | 1.456 | 0.1364 |
| 5× | 0.0027 | 1.450 | 0.0862 | 1.329 | 0.1002 |

**Look at C's *p*-value column.** It is 0.0858, 0.0857, 0.0855, 0.0862 — flat,
across a tenfold change in machine noise. In the replicated course the same
column moved nine orders of magnitude.

This is the deepest result in the revision. At one shot per run the residual is
not made of noise; it is made of the interactions the resolution III design
cannot separate. That bias is fixed, it does not care how hard the machine is
shaking, and it is the denominator of every test. **The *p*-values have stopped
responding to noise because they stopped measuring noise.**

Ask: "if the *p*-value does not move when the process gets ten times noisier,
what is it a *p*-value for?"

### 6.2 — power, 500 repeated experiments, α = 0.05

| Design | Shots | Noise | A | B | C | D | E |
|---|---|---|---|---|---|---|---|
| 8 runs × 1 | 8 | 1× | 100% | 79% | **7%** | 99% | 0% |
| 8 runs × 2 | 16 | 1× | 100% | 100% | **100%** | 100% | 100% |
| 8 runs × 1 | 8 | 3× | 99% | 61% | 29% | 85% | 11% |
| 8 runs × 2 | 16 | 3× | 100% | 100% | 100% | 100% | 92% |

Eight more shots take C from **7% to 100%**. There is no other intervention in
this course with that return.

And note the perverse row: C is found 7% of the time at 1× noise and **29%** of
the time at 3×. More noise, more detections. Once the denominator is bias rather
than noise, adding noise just adds lottery tickets. Any student who can explain
that row understands what a *p*-value is.

### The full factorial at n = 1

32 shots, 16 residual df, E detected **18%** of the time at 1× noise and 11% at
3×. Compare the replicated course, where 16 runs × 6 held E at 90% even at 3×.
Runs bought the degrees of freedom; they did not buy the power.

---

## The closing argument

The replicated course ends on *runs buy resolution, replicates buy power*. This
revision is the second half of that sentence written out in full:

- Every **effect estimate** in this revision is fine.
- Every **model of the mean** in this revision is fine.
- Every statement about **whether an effect is real** is computed against a
  denominator made of something other than noise — *unless* the design carried
  replicated centre points, which is the one place real pure error survives.
- Every statement about **variation** is impossible, and the machine's variation
  did not change by one millimetre.

The second of those is the constructive finding. Degrees of freedom can be
manufactured — by pooling terms, or by Lenth's method — and an experiment that
manufactures them gets an error term made of its own discarded signal. Only
replication produces an error term made of noise, and four replicated centre
runs did more for Lab 2 than any reduced model could.

An unreplicated design does not give you a worse answer. It gives you the same
answer with no way to know whether to believe it — and, in the one place the
course cares about most, no answer at all.
