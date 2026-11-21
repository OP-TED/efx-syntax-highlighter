// The colour test: every colour of the EFX colours reaches 4.5:1 against the background it is made
// for, the contrast that WCAG 2.1 AA and EN 301 549 require for text of the size an editor shows,
// bold or not: the light colours against white, the dark ones against the dark look's background. The
// colours of the two sets mark the same kinds of word. It reads the build in dist/, so it runs after
// `npm run build`.

import assert from 'node:assert/strict';
import { DARK_BACKGROUND, DARK_COLOURS, LIGHT_BACKGROUND, LIGHT_COLOURS } from '../dist/efxTheme.js';

// The contrast WCAG 2.1 AA requires for text that is not large.
const CONTRAST = 4.5;

/** The relative luminance of a colour written #rrggbb, as WCAG 2.1 defines it. */
function luminance(colour) {
  const [r, g, b] = [1, 3, 5].map((start) => parseInt(colour.slice(start, start + 2), 16) / 255)
    .map((channel) => (channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** The contrast ratio of two colours, as WCAG 2.1 defines it. */
function contrast(first, second) {
  const [lighter, darker] = [luminance(first), luminance(second)].sort((a, b) => b - a);
  return (lighter + 0.05) / (darker + 0.05);
}

const CHECKS = {
  'the light and dark sets name the same kinds of word': () => {
    assert.deepEqual(Object.keys(DARK_COLOURS).sort(), Object.keys(LIGHT_COLOURS).sort());
  },
  ...Object.fromEntries([['light', LIGHT_COLOURS, LIGHT_BACKGROUND], ['dark', DARK_COLOURS, DARK_BACKGROUND]]
    .map(([set, colours, background]) => [`every ${set} colour reaches ${CONTRAST}:1 against ${background}`, () => {
      for (const [word, colour] of Object.entries(colours)) {
        const ratio = contrast(colour, background);
        assert.ok(ratio >= CONTRAST, `${word} ${colour}: ${ratio.toFixed(2)}:1`);
      }
    }])),
};

let passed = 0;
for (const [name, check] of Object.entries(CHECKS)) {
  try {
    check();
    passed += 1;
  } catch (error) {
    console.log(`  ${name}: ${error.message}`);
  }
}
console.log(`Colours: ${passed} of ${Object.keys(CHECKS).length} checks pass.`);
process.exitCode = passed === Object.keys(CHECKS).length ? 0 : 1;
