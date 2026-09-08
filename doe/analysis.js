/**
 * Least-squares model fitting, ANOVA and response-surface optimisation.
 *
 * Everything here works in *coded* units (-1 low, +1 high), which is what makes
 * coefficients directly comparable as effect sizes. Nothing in this file knows
 * about catapults; it takes a design matrix and a response vector.
 */

/* --------------------------------------------------------- linear algebra */

/**
 * Solves A x = b by Gauss-Jordan elimination with partial pivoting, and returns
 * the inverse of A alongside - the diagonal of (X'X)^-1 is what standard errors
 * are built from.
 *
 * @param {number[][]} A - square, modified in place internally
 * @param {number[]} b
 * @returns {{solution: number[], inverse: number[][]}}
 */
function solveWithInverse(A, b) {
  const n = A.length;
  const m = A.map((row, i) => [...row, ...identityRow(n, i), b[i]]);

  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let r = col + 1; r < n; r++) {
      if (Math.abs(m[r][col]) > Math.abs(m[pivot][col])) pivot = r;
    }
    if (Math.abs(m[pivot][col]) < 1e-12) {
      throw new Error('Design is singular: a term is an exact combination of others (check aliasing).');
    }
    [m[col], m[pivot]] = [m[pivot], m[col]];

    const scale = m[col][col];
    for (let c = 0; c < m[col].length; c++) m[col][c] /= scale;

    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const factor = m[r][col];
      if (factor === 0) continue;
      for (let c = 0; c < m[r].length; c++) m[r][c] -= factor * m[col][c];
    }
  }

  return {
    solution: m.map(row => row[row.length - 1]),
    inverse: m.map(row => row.slice(n, 2 * n))
  };
}

function identityRow(n, i) {
  const row = new Array(n).fill(0);
  row[i] = 1;
  return row;
}

/* ------------------------------------------------- distribution functions */

/** Lanczos approximation to log Gamma. */
function logGamma(x) {
  const c = [
    76.18009172947146, -86.50532032941677, 24.01409824083091,
    -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5
  ];
  let y = x;
  let tmp = x + 5.5;
  tmp -= (x + 0.5) * Math.log(tmp);
  let ser = 1.000000000190015;
  for (let j = 0; j < 6; j++) ser += c[j] / ++y;
  return -tmp + Math.log((2.5066282746310005 * ser) / x);
}

/** Continued fraction for the incomplete beta function (Lentz's method). */
function betaContinuedFraction(a, b, x) {
  const FPMIN = 1e-300;
  const qab = a + b;
  const qap = a + 1;
  const qam = a - 1;
  let c = 1;
  let d = 1 - (qab * x) / qap;
  if (Math.abs(d) < FPMIN) d = FPMIN;
  d = 1 / d;
  let h = d;

  for (let m = 1; m <= 300; m++) {
    const m2 = 2 * m;
    let aa = (m * (b - m) * x) / ((qam + m2) * (a + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c;
    if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    h *= d * c;

    aa = (-(a + m) * (qab + m) * x) / ((a + m2) * (qap + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c;
    if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < 3e-12) break;
  }
  return h;
}

/** Regularised incomplete beta function I_x(a, b). */
function incompleteBeta(a, b, x) {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const front = Math.exp(
    logGamma(a + b) - logGamma(a) - logGamma(b) + a * Math.log(x) + b * Math.log(1 - x)
  );
  return x < (a + 1) / (a + b + 2)
    ? (front * betaContinuedFraction(a, b, x)) / a
    : 1 - (front * betaContinuedFraction(b, a, 1 - x)) / b;
}

/**
 * Upper-tail probability P(F > value) for the F distribution.
 *
 * @param {number} value
 * @param {number} df1
 * @param {number} df2
 * @returns {number}
 */
export function fPValue(value, df1, df2) {
  if (Number.isNaN(value) || df1 <= 0 || df2 <= 0) return 1;
  // An infinite F means zero error variance: the effect is as significant as it
  // is possible to be, not as insignificant. Returning 1 here would invert the
  // conclusion of any test whose replicates happen to agree exactly.
  if (value === Infinity) return 0;
  if (value <= 0) return 1;
  return incompleteBeta(df2 / 2, df1 / 2, df2 / (df2 + df1 * value));
}

/* ------------------------------------------------------------ model terms */

/**
 * Builds the list of model terms for a design.
 *
 * @param {number} k - number of factors
 * @param {'main'|'interaction'|'quadratic'} order
 * @returns {Array<{label: string, powers: number[]}>} excluding the intercept
 */
export function modelTerms(k, order) {
  const letters = 'ABCDEFGH';
  const terms = [];

  for (let i = 0; i < k; i++) {
    terms.push({ label: letters[i], powers: unit(k, i) });
  }
  if (order === 'interaction' || order === 'quadratic') {
    for (let i = 0; i < k; i++) {
      for (let j = i + 1; j < k; j++) {
        const powers = unit(k, i);
        powers[j] += 1;
        terms.push({ label: letters[i] + letters[j], powers });
      }
    }
  }
  if (order === 'quadratic') {
    for (let i = 0; i < k; i++) {
      const powers = unit(k, i);
      powers[i] = 2;
      terms.push({ label: `${letters[i]}^2`, powers });
    }
  }
  return terms;
}

function unit(k, i) {
  const p = new Array(k).fill(0);
  p[i] = 1;
  return p;
}

/** Evaluates one term at a coded point. */
function termValue(term, point) {
  let value = 1;
  for (let i = 0; i < point.length; i++) value *= point[i] ** term.powers[i];
  return value;
}

/* -------------------------------------------------------------- the fit */

/**
 * Fits an ordinary-least-squares model and produces the ANOVA that goes with it.
 *
 * Term sums of squares are partial (Type III): SS_j = b_j^2 / (X'X)^-1_jj. For
 * an orthogonal factorial every convention agrees; for a Box-Behnken design this
 * is the one that answers "what does this term add, given the rest?".
 *
 * @param {number[][]} design - coded rows, one per run
 * @param {number[]} response
 * @param {'main'|'interaction'|'quadratic'} order
 * @returns {FitResult}
 */
export function fit(design, response, order = 'interaction') {
  const k = design[0].length;
  const terms = modelTerms(k, order);
  const n = design.length;
  const p = terms.length + 1;

  if (n <= p) {
    throw new Error(`Not enough runs (${n}) to fit ${p} parameters. Use a smaller model or more runs.`);
  }

  const X = design.map(row => [1, ...terms.map(t => termValue(t, row))]);

  // Normal equations: (X'X) b = X'y
  const XtX = Array.from({ length: p }, (_, i) =>
    Array.from({ length: p }, (_, j) => X.reduce((s, row) => s + row[i] * row[j], 0))
  );
  const Xty = Array.from({ length: p }, (_, i) =>
    X.reduce((s, row, r) => s + row[i] * response[r], 0)
  );

  const { solution: coefficients, inverse } = solveWithInverse(XtX, Xty);

  const fitted = X.map(row => row.reduce((s, v, i) => s + v * coefficients[i], 0));
  const residuals = response.map((y, i) => y - fitted[i]);
  const mean = response.reduce((a, b) => a + b, 0) / n;

  const totalSS = response.reduce((s, y) => s + (y - mean) ** 2, 0);
  const residualSS = residuals.reduce((s, r) => s + r * r, 0);
  const modelSS = totalSS - residualSS;
  const residualDf = n - p;
  const meanSquareError = residualSS / residualDf;

  const entries = terms.map((term, index) => {
    const j = index + 1; // column 0 is the intercept
    const coefficient = coefficients[j];
    const variance = meanSquareError * inverse[j][j];
    const standardError = Math.sqrt(Math.max(0, variance));
    const sumSquares = (coefficient * coefficient) / inverse[j][j];
    const fStatistic = sumSquares / meanSquareError;
    return {
      label: term.label,
      // For a two-level design in coded units the effect is twice the slope:
      // moving from -1 to +1 is a change of 2.
      effect: 2 * coefficient,
      coefficient,
      standardError,
      sumSquares,
      fStatistic,
      pValue: fPValue(fStatistic, 1, residualDf),
      percentContribution: totalSS > 0 ? (100 * sumSquares) / totalSS : 0
    };
  });

  return {
    order,
    terms: entries,
    intercept: coefficients[0],
    coefficients,
    termDefinitions: terms,
    fitted,
    residuals,
    n,
    parameters: p,
    totalSS,
    modelSS,
    residualSS,
    residualDf,
    meanSquareError,
    rSquared: totalSS > 0 ? modelSS / totalSS : 0,
    adjustedRSquared: totalSS > 0 ? 1 - (residualSS / residualDf) / (totalSS / (n - 1)) : 0,
    modelF: (modelSS / (p - 1)) / meanSquareError,
    modelPValue: fPValue((modelSS / (p - 1)) / meanSquareError, p - 1, residualDf),
    /** Predicts the response at a coded point. */
    predict(point) {
      return coefficients[0] + terms.reduce(
        (s, term, i) => s + coefficients[i + 1] * termValue(term, point), 0
      );
    }
  };
}

/**
 * Splits residual error into pure error (from replicated design points) and
 * lack of fit. A significant lack of fit says the model form is wrong, however
 * good R-squared looks.
 *
 * @param {number[][]} design
 * @param {number[]} response
 * @param {FitResult} fitResult
 * @returns {{pureErrorSS: number, pureErrorDf: number, lackOfFitSS: number,
 *            lackOfFitDf: number, fStatistic: number, pValue: number}|null}
 */
export function lackOfFit(design, response, fitResult) {
  const groups = new Map();
  design.forEach((row, i) => {
    const key = row.join(',');
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(response[i]);
  });

  let pureErrorSS = 0;
  let pureErrorDf = 0;
  for (const values of groups.values()) {
    if (values.length < 2) continue;
    const m = values.reduce((a, b) => a + b, 0) / values.length;
    pureErrorSS += values.reduce((s, v) => s + (v - m) ** 2, 0);
    pureErrorDf += values.length - 1;
  }
  if (pureErrorDf === 0) return null;

  const lackOfFitSS = fitResult.residualSS - pureErrorSS;
  const lackOfFitDf = fitResult.residualDf - pureErrorDf;
  if (lackOfFitDf <= 0) return null;

  const fStatistic = (lackOfFitSS / lackOfFitDf) / (pureErrorSS / pureErrorDf);
  return {
    pureErrorSS,
    pureErrorDf,
    lackOfFitSS,
    lackOfFitDf,
    fStatistic,
    pValue: fPValue(fStatistic, lackOfFitDf, pureErrorDf)
  };
}

/**
 * Curvature test for a two-level design with centre points: compares the mean
 * of the factorial corners with the mean of the centre runs. A significant
 * result says a straight-line model will not do, and it is time for a
 * response-surface design.
 *
 * @param {number[][]} design
 * @param {number[]} response
 * @returns {{factorialMean: number, centreMean: number, difference: number,
 *            fStatistic: number, pValue: number}|null}
 */
export function curvatureTest(design, response) {
  const isCentre = row => row.every(v => v === 0);
  const centre = response.filter((_, i) => isCentre(design[i]));
  const factorial = response.filter((_, i) => !isCentre(design[i]));
  if (centre.length < 2 || factorial.length < 2) return null;

  const meanOf = a => a.reduce((x, y) => x + y, 0) / a.length;
  const centreMean = meanOf(centre);
  const factorialMean = meanOf(factorial);

  // Pure error from the replicated centre points.
  const pureErrorSS = centre.reduce((s, v) => s + (v - centreMean) ** 2, 0);
  const pureErrorDf = centre.length - 1;
  const meanSquare = pureErrorSS / pureErrorDf;

  const nF = factorial.length;
  const nC = centre.length;
  const curvatureSS = ((nF * nC) / (nF + nC)) * (factorialMean - centreMean) ** 2;
  const fStatistic = curvatureSS / meanSquare;

  return {
    factorialMean,
    centreMean,
    difference: factorialMean - centreMean,
    fStatistic,
    pValue: fPValue(fStatistic, 1, pureErrorDf)
  };
}

/* ------------------------------------------------------------ optimisation */

/**
 * Small seeded PRNG so an optimisation is reproducible by default. A
 * recommendation that changes every time you re-run the analysis is not a
 * recommendation anyone can check.
 *
 * @param {number} seed
 * @returns {() => number}
 */
function seededRng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Finds coded factor settings that hit a target response, breaking ties towards
 * the most repeatable settings.
 *
 * The mean model usually has a whole ridge of solutions for a given target -
 * which is exactly the point. Once the target is met, the leftover freedom is
 * spent on minimising predicted variation.
 *
 * @param {object} options
 * @param {(point: number[]) => number} options.predictMean
 * @param {(point: number[]) => number} [options.predictSpread] - optional, minimised secondarily
 * @param {number} options.k - number of factors
 * @param {number} options.target
 * @param {number} [options.spreadWeight=1] - relative price of variation; make it
 *        negative to deliberately seek the *worst* settings that still hit target
 * @param {number[]} [options.lower] - per-factor lower bound in coded units
 * @param {number[]} [options.upper]
 * @param {() => number} [options.rng] - defaults to a fixed seeded sequence, so
 *        the same models always yield the same recommendation
 * @returns {{point: number[], predictedMean: number, predictedSpread: number, objective: number}}
 */
export function optimiseToTarget({
  predictMean,
  predictSpread = null,
  k,
  target,
  spreadWeight = 1,
  lower = new Array(k).fill(-1),
  upper = new Array(k).fill(1),
  rng = seededRng(0x5EED)
}) {
  const clampPoint = p => p.map((v, i) => Math.min(upper[i], Math.max(lower[i], v)));

  // Missing the target is priced far above a little extra spread, so the search
  // only trades variation once the mean is essentially on target. A negative
  // spreadWeight flips the second term and hunts for the least robust answer.
  const objective = point => {
    const miss = predictMean(point) - target;
    const spread = predictSpread ? predictSpread(point) : 0;
    return miss * miss * 1000 + spreadWeight * spread * spread;
  };

  // Coded units run -1 to +1, so a step of 1e-4 is already finer than any
  // setting a machine could actually hold. Going below it only lets rounding
  // noise register as "improvement" and the search crawl indefinitely.
  const MIN_STEP = 1e-4;
  // Generous, because a target constraint leaves a near-flat ridge of solutions
  // and the search has to crawl along it to find the most robust point.
  const MAX_MOVES = 20000;

  let best = null;

  // Multi-start pattern search: robust, derivative-free, and good enough for the
  // smooth low-dimensional surfaces a DOE model produces.
  for (let start = 0; start < 40; start++) {
    let point = start === 0
      ? new Array(k).fill(0)
      : clampPoint(Array.from({ length: k }, (_, i) =>
          lower[i] + rng() * (upper[i] - lower[i])));
    let value = objective(point);
    let step = 0.5;
    let moves = 0;

    while (step > MIN_STEP && moves < MAX_MOVES) {
      let improved = false;
      for (let i = 0; i < k; i++) {
        for (const direction of [1, -1]) {
          const trial = clampPoint(point.map((v, j) => (j === i ? v + direction * step : v)));
          const trialValue = objective(trial);
          // A relative threshold: an "improvement" smaller than the rounding
          // error of the value itself is not an improvement.
          if (trialValue < value - Math.max(1e-12, Math.abs(value) * 1e-9)) {
            point = trial;
            value = trialValue;
            improved = true;
            moves++;
          }
        }
      }
      if (!improved) step /= 2;
    }

    if (!best || value < best.objective) {
      best = {
        point,
        objective: value,
        predictedMean: predictMean(point),
        predictedSpread: predictSpread ? predictSpread(point) : 0
      };
    }
  }

  return best;
}
