// The incremental test: after an edit, an editor parses its text again reusing its earlier tree, and
// the tree must be the one a parse from scratch makes. Each version's sample is edited at random
// places, with pieces that keep it right and pieces that break it, and with pairs of edits made
// before the editor parses again, by the parser of each version's
// template language, as an editor parses (src/lexer/EditorParser.js). It reads the build in
// dist/, so it runs after `npm run build`.

import fs from 'node:fs';
import { TreeFragment } from '@lezer/common';
import { efx } from '../dist/index.js';

// How many edits are made to each sample with each set of pieces.
const EDITS = 200;

// The pieces put in: some keep a text right, some break it, as typing does.
const PIECES = {
  'pieces that keep it right': ['x', ' ', 'BT-1-Lot', '1', '\n{ND-Root} more text\n', ' and BT-2-Lot is present', '-'],
  'pieces that break it': ['${', '}', '//', '"', ';', '#{', '|', 'DISPLAY ', 'WITH ', '\n', '(', ')', '/', '@'],
};

const VERSIONS = [
  { name: 'EFX-2', version: 2, sample: 'efx2/sample.efx' },
  { name: 'EFX-1', version: 1, sample: 'efx1/sample.efx' },
];

/** A generator of numbers at random, always the same ones, so that a failure can be read again. */
function randomNumbers(seed) {
  let state = seed;
  return (bound) => {
    state = (Math.imul(state, 1103515245) + 12345) >>> 0;
    return state % bound;
  };
}

const failures = [];
for (const { name, version, sample } of VERSIONS) {
  const { parser } = efx('template', { version }).language;
  const original = fs.readFileSync(new URL(sample, import.meta.url), 'utf8');
  const earlier = TreeFragment.addTree(parser.parse(original));
  for (const [kind, pieces] of Object.entries(PIECES)) {
    const random = randomNumbers(20261120);
    let differing = 0;
    for (let edit = 0; edit < EDITS; edit += 1) {
      const at = random(original.length);
      const piece = pieces[random(pieces.length)];
      const text = original.slice(0, at) + piece + original.slice(at);
      const change = { fromA: at, toA: at, fromB: at, toB: at + piece.length };
      const again = parser.parse(text, TreeFragment.applyChanges(earlier, [change]));
      if (again.toString() !== parser.parse(text).toString()) {
        differing += 1;
        failures.push(`${name}, ${JSON.stringify(piece)} put in at ${at}: the tree differs from a parse from scratch`);
      }
    }
    console.log(`Incremental: ${name}, ${EDITS - differing} of ${EDITS} edits with ${kind} parse as from scratch.`);
  }
}
// Edits that come one after the other before the editor parses again: each pair of edits is made on
// the earlier tree as two changes, the second after the first.
for (const { name, version, sample } of VERSIONS) {
  const { parser } = efx('template', { version }).language;
  const original = fs.readFileSync(new URL(sample, import.meta.url), 'utf8');
  const earlier = TreeFragment.addTree(parser.parse(original));
  const random = randomNumbers(20261121);
  const pieces = PIECES['pieces that break it'];
  let differing = 0;
  for (let edit = 0; edit < EDITS; edit += 1) {
    const [first, second] = [random(original.length), random(original.length)].sort((a, b) => a - b);
    const [one, two] = [pieces[random(pieces.length)], pieces[random(pieces.length)]];
    const text = original.slice(0, first) + one + original.slice(first, second) + two + original.slice(second);
    const once = TreeFragment.applyChanges(earlier, [{ fromA: first, toA: first, fromB: first, toB: first + one.length }]);
    const shifted = second + one.length;
    const twice = TreeFragment.applyChanges(once, [{ fromA: shifted, toA: shifted, fromB: shifted, toB: shifted + two.length }]);
    if (parser.parse(text, twice).toString() !== parser.parse(text).toString()) {
      differing += 1;
      failures.push(`${name}, ${JSON.stringify(one)} at ${first} then ${JSON.stringify(two)} at ${shifted}: the tree differs`);
    }
  }
  console.log(`Incremental: ${name}, ${EDITS - differing} of ${EDITS} pairs of edits made before parsing again parse as from scratch.`);
}

failures.slice(0, 10).forEach((failure) => console.error(`  ${failure}`));
if (failures.length > 0) {
  process.exitCode = 1;
}
