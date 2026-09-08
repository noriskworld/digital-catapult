/**
 * Folds the standalone Vite build into a single self-contained .html file.
 *
 *   npm run build:standalone
 *
 * The result has no external references at all, so it runs from a double-click
 * (file://), a network share, an email attachment, or any static web host -
 * with no Node, no npm and no server. That is the whole point: most of the
 * people who need to use the simulator will not have a toolchain.
 *
 * Two details make file:// work, and both are easy to undo by accident:
 *   - the bundle must be a classic script, not type="module" (modules loaded
 *     over file:// are treated as cross-origin and blocked);
 *   - nothing may be referenced by URL - CSS and JS are inlined here.
 */

import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const BUILD_DIR = 'dist-standalone';
const OUT_DIR = 'standalone';
const OUT_FILE = join(OUT_DIR, 'digital-catapult.html');

const read = name => readFileSync(join(BUILD_DIR, name), 'utf8');

const html = read('index.html');
const css = read('app.css');
const js = read('app.js');

/**
 * Makes a bundle safe to sit inside a <script> element. An HTML parser ends the
 * element at the first "</script" it sees, wherever it occurs - including
 * inside a JavaScript string literal.
 */
const escapeForInlineScript = code =>
  code.replace(/<\/(script)/gi, '<\\/$1').replace(/<!--/g, '<\\!--');

let out = html
  .replace(/\s*<script[^>]*src="\.\/app\.js"[^>]*><\/script>/, '')
  .replace(/\s*<link[^>]*href="\.\/app\.css"[^>]*>/, '');

// Using replacement *functions* throughout: "$&" and friends inside minified
// code would otherwise be interpreted as replacement patterns.
out = out.replace('</head>', () => `  <style>\n${css}\n  </style>\n  </head>`);
out = out.replace('</body>', () => `  <script>\n${escapeForInlineScript(js)}\n  </script>\n  </body>`);

// Fail loudly rather than shipping a file that quietly does nothing.
const problems = [];
if (/<script[^>]*\bsrc=/.test(out)) problems.push('a <script src> survived inlining');
if (/<link[^>]*stylesheet/i.test(out)) problems.push('a stylesheet <link> survived inlining');
if (/type="module"/.test(out)) problems.push('a module script survived - this will not run from file://');
if (!out.includes('<style>')) problems.push('CSS was not inlined');
if (problems.length) {
  console.error('Standalone build failed:');
  for (const p of problems) console.error(`  - ${p}`);
  process.exit(1);
}

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(OUT_FILE, out);
if (existsSync(BUILD_DIR)) rmSync(BUILD_DIR, { recursive: true, force: true });

const kb = n => `${(n / 1024).toFixed(1)} kB`;
console.log(`${OUT_FILE}  ${kb(Buffer.byteLength(out))}  (single file, no external references)`);
console.log('Open it by double-clicking, or host it on any static web server.');
