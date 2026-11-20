// The style test: the highlight tags the editor gives some texts are pinned as lists of runs
// (styles/StyleDump.js), in each version's styles/ folder: for EFX-2 its sample, a rules file of its
// corpus and the entries of its tree test; for EFX-1 its sample and the entries of its test, but the
// few that are long only to test the lexer's limits. It also checks, for each version, that every
// node its style table (src/efx2/efx2Highlighting.js, src/efx1/efx1Highlighting.js) names is a node
// of its grammar, as a name that is not one styles nothing, silently; and that each occurs in the
// pinned texts, so that a change to any line of the table changes a pinned run. `node test/styles.js
// --write` writes the pinned lists anew, so that the commit that changes the highlighting shows each
// change. It reads the build in dist/, so it runs after `npm run build`.

import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { EFX1_STYLES } from '../dist/efx1/efx1Highlighting.js';
import { parser as efx1Parser } from '../dist/efx1/parser.js';
import { EFX2_STYLES } from '../dist/efx2/efx2Highlighting.js';
import { parser as efx2Parser } from '../dist/efx2/parser.js';
import { ENTRIES as EFX1_ENTRIES } from './efx1/entries/entries.js';
import { ENTRIES as EFX2_ENTRIES } from './efx2/trees/entries.js';
import { StyleDump } from './styles/StyleDump.js';

// The longest entry text pinned: longer ones only test the limits of the lexer.
const LONGEST_ENTRY = 1000;

/** The text and top of an entry of the EFX-2 tree test, read as that test reads it. */
function efx2Reading(entry) {
  if (entry.rules !== undefined) {
    return { text: entry.rules, top: 'RulesFile' };
  }
  if (entry.template !== undefined) {
    return { text: entry.template, top: 'TemplateFile' };
  }
  return { text: entry.text ?? `{ND-Root} \${${entry.input}}`, top: 'SingleExpression' };
}

/** The text and top of an entry of the EFX-1 test, read as that test reads it. */
function efx1Reading(entry) {
  if (entry.template !== undefined) {
    return { text: entry.template, top: 'TemplateFile' };
  }
  if (entry.selector !== undefined) {
    return { text: `{ND-Root} &{${entry.selector}}`, top: 'SingleExpression' };
  }
  return { text: `{ND-Root} \${${entry.expression}}`, top: 'SingleExpression' };
}

// Each version: its parser, its style table, and what it pins: a file and the top that reads it, or
// the readings of entries, each with the file of its runs, by their paths in test/.
const VERSIONS = [
  {
    name: 'EFX-2',
    parser: efx2Parser,
    styles: EFX2_STYLES,
    pinned: [
      { file: 'efx2/sample.efx', top: 'TemplateFile', runs: 'efx2/styles/sample.txt' },
      { file: 'efx2/corpus/validation/stage-4m.efx', top: 'RulesFile', runs: 'efx2/styles/stage-4m.txt' },
      { entries: EFX2_ENTRIES.map(efx2Reading), runs: 'efx2/styles/entries.txt' },
    ],
  },
  {
    name: 'EFX-1',
    parser: efx1Parser,
    styles: EFX1_STYLES,
    pinned: [
      { file: 'efx1/sample.efx', top: 'TemplateFile', runs: 'efx1/styles/sample.txt' },
      { entries: EFX1_ENTRIES.map(efx1Reading), runs: 'efx1/styles/entries.txt' },
    ],
  },
];

// The most differences shown for one file.
const SHOWN = 10;

const pathOf = (file) => fileURLToPath(new URL(file, import.meta.url));
const write = process.argv.includes('--write');

/** The texts a pin reads, each with its top and the line that names it in the runs. */
function textsOf(pin) {
  if (pin.file !== undefined) {
    return [{ text: fs.readFileSync(pathOf(pin.file), 'utf8'), top: pin.top }];
  }
  return pin.entries.filter(({ text }) => text.length <= LONGEST_ENTRY)
    .map(({ text, top }) => ({ text, top, title: `# ${top} ${JSON.stringify(text)}` }));
}

/** The runs of a pin: those of each of its texts, each after the line that names it, if any. */
const runsOf = (parser, pin) => textsOf(pin).flatMap(({ text, top, title }) =>
  [...(title === undefined ? [] : [title]), ...StyleDump.of(parser, text, top)]);

/** The nodes of the trees of a pin's texts, by name and by parent and name, as a style table names them. */
function nodesOf(parser, pin) {
  const nodes = new Set();
  for (const { text, top } of textsOf(pin)) {
    parser.configure({ top }).parse(text).iterate({
      enter: (node) => {
        nodes.add(node.name);
        if (node.node.parent !== null) {
          nodes.add(`${node.node.parent.name}/${node.name}`);
        }
      },
    });
  }
  return nodes;
}

for (const { name, parser, styles, pinned } of VERSIONS) {
  const selectors = Object.keys(styles).flatMap((selector) => selector.split(' '));
  const nodeNames = new Set(parser.nodeSet.types.map((type) => type.name));
  const unknown = selectors.flatMap((path) => path.split('/')).filter((node) => !nodeNames.has(node));
  if (unknown.length > 0) {
    console.error(`The ${name} style table names nodes the grammar does not have: ${unknown.join(', ')}`);
    process.exitCode = 1;
  }
  const occurring = new Set(pinned.flatMap((pin) => [...nodesOf(parser, pin)]));
  const absent = selectors.filter((selector) => !occurring.has(selector));
  if (absent.length > 0) {
    console.error(`The ${name} style table names nodes that no pinned text has: ${absent.join(', ')}`);
    process.exitCode = 1;
  }

  for (const pin of pinned) {
    const actual = runsOf(parser, pin);
    if (write) {
      fs.writeFileSync(pathOf(pin.runs), `${actual.join('\n')}\n`);
      console.log(`Styles: ${pin.runs}, ${actual.length} runs written.`);
      continue;
    }
    const expected = fs.readFileSync(pathOf(pin.runs), 'utf8').split('\n').slice(0, -1);
    const differences = [...Array(Math.max(actual.length, expected.length)).keys()]
      .filter((index) => actual[index] !== expected[index]);
    console.log(`Styles: ${pin.runs}, ${actual.length - differences.length} of ${expected.length} pinned lines as pinned.`);
    for (const index of differences.slice(0, SHOWN)) {
      console.error(`  pinned: ${expected[index] ?? '(none)'}\n  editor: ${actual[index] ?? '(none)'}`);
    }
    if (differences.length > 0) {
      process.exitCode = 1;
    }
  }
}
