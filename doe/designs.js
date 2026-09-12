/**
 * Design-of-experiments matrix generators.
 *
 * Every generator returns rows of *coded* factor levels, where -1 is the low
 * setting, +1 the high, and 0 the centre. Coding is what makes effects
 * comparable across factors with different units and ranges, and it is the
 * scale the analysis and the optimiser work in throughout.
 *
 * Pure functions - usable from the browser and from Node.
 */

/**
 * Full 2^k factorial: every combination of low and high.
 * Standard (Yates) order, so the first column alternates fastest.
 *
 * @param {number} k - number of factors
 * @returns {number[][]} 2^k rows of k coded levels
 */
export function fullFactorial2(k) {
  const rows = [];
  for (let i = 0; i < 2 ** k; i++) {
    const row = [];
    for (let f = 0; f < k; f++) row.push((i >> f) & 1 ? 1 : -1);
    rows.push(row);
  }
  return rows;
}

/**
 * Fractional factorial 2^(k-p), built by generating the last p factors from
 * products of the first (k - p) basis factors.
 *
 * A generator like "E=ABCD" says: column E is the elementwise product of
 * columns A, B, C and D. That choice is what determines the alias structure,
 * and therefore what the design can and cannot separate.
 *
 * @param {number} k - total factors
 * @param {string[]} generators - e.g. ['E=ABCD'] or ['D=AB', 'E=AC']
 * @returns {number[][]}
 */
export function fractionalFactorial2(k, generators) {
  const basis = k - generators.length;
  const base = fullFactorial2(basis);
  const letters = 'ABCDEFGH';

  return base.map(row => {
    const full = [...row];
    for (const gen of generators) {
      const [target, source] = gen.replace(/\s/g, '').split('=');
      const targetIndex = letters.indexOf(target);
      let value = 1;
      for (const letter of source) value *= full[letters.indexOf(letter)];
      full[targetIndex] = value;
    }
    return full;
  });
}

/**
 * The defining relation and the alias structure of a fractional design.
 *
 * The defining words are the generators rewritten as products equal to I; every
 * effect is aliased with its product against each word. Students should read
 * this before trusting any coefficient from a fractional design.
 *
 * @param {number} k
 * @param {string[]} generators
 * @returns {{words: string[], resolution: number, aliases: Record<string, string[]>}}
 */
export function aliasStructure(k, generators) {
  const letters = 'ABCDEFGH'.slice(0, k).split('');

  // Each generator D=AB becomes the defining word ABD (multiply both sides by D).
  const generatorWords = generators.map(g => {
    const [target, source] = g.replace(/\s/g, '').split('=');
    return [...new Set((source + target).split(''))].sort().join('');
  });

  // The full defining relation includes every product of the generator words.
  const multiply = (w1, w2) => {
    const counts = {};
    for (const ch of w1 + w2) counts[ch] = (counts[ch] || 0) + 1;
    return Object.keys(counts).filter(ch => counts[ch] % 2 === 1).sort().join('');
  };

  const words = new Set(generatorWords);
  for (let added = true; added;) {
    added = false;
    for (const a of [...words]) {
      for (const b of generatorWords) {
        const product = multiply(a, b);
        if (product && !words.has(product)) { words.add(product); added = true; }
      }
    }
  }
  const wordList = [...words].sort((a, b) => a.length - b.length || a.localeCompare(b));

  // Effects worth reporting: main effects and two-factor interactions.
  const effects = [...letters];
  for (let i = 0; i < letters.length; i++) {
    for (let j = i + 1; j < letters.length; j++) effects.push(letters[i] + letters[j]);
  }

  const aliases = {};
  for (const effect of effects) {
    aliases[effect] = wordList
      .map(word => multiply(effect, word))
      .filter(alias => alias && alias !== effect)
      .sort((a, b) => a.length - b.length || a.localeCompare(b));
  }

  return {
    words: wordList,
    resolution: wordList.length ? Math.min(...wordList.map(w => w.length)) : Infinity,
    aliases
  };
}

/**
 * Cyclic generating rows for the Plackett-Burman designs, one per run count.
 *
 * Each string has N-1 entries and seeds N-1 rows by successive rotation; an
 * all-low run completes the design. N = 8 and N = 16 are powers of two and
 * reproduce a regular fractional factorial, which is exactly why they are worth
 * offering: they let a class see that Plackett-Burman is only a *different*
 * design when N is not a power of two.
 */
const PB_GENERATORS = {
  8:  '+++-+--',
  12: '++-+++---+-',
  16: '++++-+-++--+---',
  20: '++--++++-+-+----++-',
  24: '+++++-+-++--++--+-+----'
};

/**
 * Plackett-Burman screening design: N runs for up to N-1 factors, where N is a
 * multiple of four rather than a power of two.
 *
 * Built by rotating a cyclic generating row, then adding one run with every
 * factor low. Columns are orthogonal and balanced, so main effects are still
 * estimated independently of each other.
 *
 * The reason to reach for one is run economy at awkward factor counts: five
 * factors need 8 runs as a regular 2^(5-2), but eleven factors would need 16,
 * whereas a 12-run Plackett-Burman covers them all.
 *
 * The price is a *different kind* of confounding. A regular resolution III
 * design aliases each main effect completely with a few specific two-factor
 * interactions. A non-regular Plackett-Burman spreads that bias thinly across
 * many of them at once - for N = 12, every main effect is partially aliased
 * with every two-factor interaction it is not part of, at a correlation of
 * plus or minus one third. Use `aliasCorrelations` to see it.
 *
 * @param {number} k - factors to keep (columns beyond this are dropped)
 * @param {number} [runs] - 8, 12, 16, 20 or 24; defaults to the smallest that fits
 * @returns {number[][]} `runs` rows of k coded levels
 */
export function plackettBurman(k, runs = [8, 12, 16, 20, 24].find(n => n > k)) {
  const generator = PB_GENERATORS[runs];
  if (!generator) {
    throw new Error(`No Plackett-Burman generator for ${runs} runs (have 8, 12, 16, 20, 24)`);
  }
  if (k > runs - 1) {
    throw new Error(`A ${runs}-run Plackett-Burman holds at most ${runs - 1} factors, not ${k}`);
  }

  const seed = generator.split('').map(c => (c === '+' ? 1 : -1));
  const rows = [];
  for (let r = 0; r < seed.length; r++) {
    // Rotate right by r: row r column c takes seed[(c - r) mod length].
    rows.push(Array.from({ length: k }, (_, c) => seed[(c - r + seed.length) % seed.length]));
  }
  rows.push(new Array(k).fill(-1));
  return rows;
}

/**
 * Correlations between each main-effect column and each two-factor interaction
 * column - the honest way to read a non-regular design's confounding.
 *
 * `aliasStructure` answers the same question for regular fractional factorials,
 * where the answer is always 0 or +/-1 and can be derived from the generators
 * alone. A Plackett-Burman needs the design matrix itself, because its
 * correlations sit between those extremes.
 *
 * A correlation of +/-1 means the pair is fully confounded and no amount of data
 * will separate them. Anything strictly between 0 and 1 means the estimate is
 * biased by that fraction of the interaction - smaller than full confounding,
 * but spread over far more terms.
 *
 * @param {number[][]} design - coded rows
 * @param {number} [k=design[0].length] - main effects to report
 * @returns {Array<{effect: string, worst: number, correlations: Record<string, number>}>}
 */
export function aliasCorrelations(design, k = design[0].length) {
  const letters = 'ABCDEFGHIJK'.slice(0, k).split('');
  const n = design.length;
  const dot = (u, v) => u.reduce((s, x, i) => s + x * v[i], 0) / n;

  const main = letters.map((_, i) => design.map(row => row[i]));
  const pairs = [];
  for (let i = 0; i < k; i++) {
    for (let j = i + 1; j < k; j++) {
      pairs.push({ label: letters[i] + letters[j], i, j, column: design.map(row => row[i] * row[j]) });
    }
  }

  return letters.map((letter, i) => {
    const correlations = {};
    let worst = 0;
    for (const pair of pairs) {
      if (pair.i === i || pair.j === i) continue; // an effect is not aliased with itself
      const r = dot(main[i], pair.column);
      correlations[pair.label] = r;
      worst = Math.max(worst, Math.abs(r));
    }
    return { effect: letter, worst, correlations };
  });
}

/**
 * Box-Behnken design: every pair of factors is taken to its four corners while
 * the remaining factors sit at their centre. It needs only three levels per
 * factor and, unlike a central composite design, never visits a corner of the
 * cube - so it cannot ask for a setting outside the ranges you declared.
 *
 * @param {number} k - 3, 4 or 5 factors
 * @param {number} [centrePoints] - replicated centre runs (default: 3, or 6 for k=5)
 * @returns {number[][]}
 */
export function boxBehnken(k, centrePoints = k >= 5 ? 6 : 3) {
  if (k < 3 || k > 5) throw new Error('Box-Behnken is supported here for 3 to 5 factors');

  const rows = [];
  for (let i = 0; i < k; i++) {
    for (let j = i + 1; j < k; j++) {
      for (const a of [-1, 1]) {
        for (const b of [-1, 1]) {
          const row = new Array(k).fill(0);
          row[i] = a;
          row[j] = b;
          rows.push(row);
        }
      }
    }
  }
  for (let c = 0; c < centrePoints; c++) rows.push(new Array(k).fill(0));
  return rows;
}

/**
 * Appends replicated centre points to a two-level design, which is how you test
 * for curvature without committing to a full response-surface design.
 *
 * @param {number[][]} design
 * @param {number} count
 * @returns {number[][]}
 */
export function withCentrePoints(design, count) {
  const k = design[0].length;
  return [...design, ...Array.from({ length: count }, () => new Array(k).fill(0))];
}

/**
 * Replicates each run of a design.
 *
 * @param {number[][]} design
 * @param {number} times
 * @returns {number[][]}
 */
export function replicate(design, times) {
  return Array.from({ length: times }, () => design).flat();
}

/**
 * Randomises run order - the defence against time-ordered lurking variables
 * such as a band warming up over a session.
 *
 * @param {number[][]} design
 * @param {() => number} rng
 * @returns {number[][]}
 */
export function randomiseRunOrder(design, rng) {
  const rows = [...design];
  for (let i = rows.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [rows[i], rows[j]] = [rows[j], rows[i]];
  }
  return rows;
}

/**
 * Converts coded levels to real machine settings.
 *
 * @param {number[]} codedRow
 * @param {Array<{name: string, key: string, low: number, high: number}>} factors
 * @returns {Record<string, number>} settings keyed for the simulator
 */
export function decode(codedRow, factors) {
  const settings = {};
  factors.forEach((factor, i) => {
    const centre = (factor.low + factor.high) / 2;
    const halfRange = (factor.high - factor.low) / 2;
    settings[factor.key] = centre + codedRow[i] * halfRange;
  });
  return settings;
}

/** Converts real settings back to coded units. */
export function encode(settings, factors) {
  return factors.map(factor => {
    const centre = (factor.low + factor.high) / 2;
    const halfRange = (factor.high - factor.low) / 2;
    return (settings[factor.key] - centre) / halfRange;
  });
}
