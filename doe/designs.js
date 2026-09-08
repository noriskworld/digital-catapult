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
