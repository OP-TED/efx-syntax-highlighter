// The TextMate test: each corpus file is coloured by the TextMate grammar of its version, as VS Code
// colours it (textmate/TextMateColours.js), and by the editor's parser, and the two are compared
// character by character (textmate/ColourComparison.js); so are the files of the entries of the
// tree tests, which hold forms the corpus has not, and their expressions, each as the expression of
// a template line, a few texts where a TextMate grammar could easily go wrong (EFX2_EDGES), and texts
// with long runs, which it must also colour soon (longRunsOf). The grammar may be vaguer than the
// parser where a regular expression cannot see the parent of a token, but a character it colours
// otherwise, or leaves plain although the style table colours its type whatever the parent, fails
// the test. Only texts that the parser reads with
// no error are compared: the colours of wrong EFX depend on how each recovers. The numbers of
// characters, the same and vaguer, are pinned for each version and set of texts: the test fails
// when they change, in either direction, until the commit that changes them updates them here. It
// reads the build in dist/, so it runs after `npm run build`.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { EFX1_STYLES } from '../dist/efx1/efx1Highlighting.js';
import { EFX2_STYLES } from '../dist/efx2/efx2Highlighting.js';
import { languageOf } from '../dist/efxLanguage.js';
import { ENTRIES as EFX1_ENTRIES } from './efx1/entries/entries.js';
import { ENTRIES as EFX2_ENTRIES } from './efx2/trees/entries.js';
import { ColourComparison } from './textmate/ColourComparison.js';
import { TextMateColours } from './textmate/TextMateColours.js';

/** The files of a corpus folder, each with its name, text and kind, by the kind of file of each folder. */
function corpusOf(folder, kinds) {
  const directory = fileURLToPath(new URL(folder, import.meta.url));
  return fs.readdirSync(directory, { recursive: true }).filter((file) => file.endsWith('.efx')).sort()
    .map((file) => ({ name: file, text: fs.readFileSync(path.join(directory, file), 'utf8'), kind: kinds[file.split(path.sep)[0]] }));
}

/** The file of an entry of the EFX-2 tree test, if it has one: a rules file, a template, or an expression in a template line. */
function efx2FileOf(entry, index) {
  const name = `entry ${index + 1}`;
  if (entry.rules !== undefined) {
    return { name, text: entry.rules, kind: 'rules' };
  }
  if (entry.template !== undefined) {
    return { name, text: entry.template, kind: 'template' };
  }
  return entry.input === undefined ? undefined : { name, text: `WITH ND-Root DISPLAY \${${entry.input}};\n`, kind: 'template' };
}

/** The file of an entry of the EFX-1 test, if it has one: a template, or an expression in a template line. */
function efx1FileOf(entry, index) {
  const name = `entry ${index + 1}`;
  if (entry.template !== undefined) {
    return { name, text: entry.template, kind: 'template' };
  }
  return entry.expression === undefined ? undefined : { name, text: `{ND-Root} \${${entry.expression}}\n`, kind: 'template' };
}

// Texts of EFX-2 that only a few rules of the lexer read, where a TextMate grammar, which reads one
// line at a time and takes the first pattern that matches, could easily go wrong.
const EFX2_EDGES = [
  // A word that a rule of the template reads only alone, here the start of free text.
  'WITH ND-Root DISPLAY OTHERWISEX;\n',
  // OTHERWISE at the end of a line, the start of a longer token, here alone, before template text.
  'WITH ND-Root WHEN 1 == 1 INVOKE foo() OTHERWISE\nno;\n',
  'WITH ND-Root WHEN 1 == 1 INVOKE foo() OTHERWISE\n${BT-01-notice};\n',
  // ... and with the rest of the token on the next line.
  'WITH ND-Root WHEN 1 == 1 DISPLAY a\nOTHERWISE\nDISPLAY b;\n',
  // A template line joined to the next across a blank line, and DISPLAY before a blank line.
  'WITH ND-Root DISPLAY a \\\n\nb;\n',
  'WITH ND-Root DISPLAY\n\n  text ${BT-01-notice};\n',
  // A string that goes on after an escaped line break.
  "WITH ND-Root DISPLAY ${'a\\\nb' == 'c'};\n",
].map((text, index) => ({ name: `edge ${index + 1}`, text, kind: 'template' }));

// How long the runs are, and how long the grammar may take to colour a text with one, at most: a
// pattern that read a run again from each of its characters would take seconds (scripts/sync/RunGuards.js).
const RUN = 5000;
const LONG_RUN_TIME = 250;

// Runs of blanks, each made of spaces, of tabs, or of both, by its name; the other runs are of the
// dashes of a section header and the slashes of a comment.
const BLANKS = { spaces: ' '.repeat(RUN), tabs: '\t'.repeat(RUN), 'mixed blanks': ' \t'.repeat(RUN / 2) };

/**
 * Texts of templates with long runs, on lines long enough for a TextMate engine to look for each
 * pattern apart (from 1,000 bytes for vscode-oniguruma): each of the given lines with each of the runs
 * of blanks, and the other texts.
 */
function longRunsOf(lines, blanks, others = []) {
  return [...Object.entries(blanks).flatMap(([name, run]) => lines.map((line, index) => ({ name: `${name} ${index + 1}`, text: line(run) }))),
    ...others].map((file) => ({ ...file, kind: 'template' }));
}

const EFX2_LONG_RUNS = longRunsOf([
  (blanks) => `${blanks}WITH ND-Root DISPLAY text;\n`,
  (blanks) => `WITH ND-Root DISPLAY a${blanks}b;\n`,
  (blanks) => `WITH ND-Root DISPLAY a;${blanks}// a comment\n`,
  (blanks) => `${blanks}// a comment\nWITH ND-Root DISPLAY a;\n`,
  (blanks) => `WITH ND-Root DISPLAY \${BT-01-notice${blanks}== 'a'};\n`,
  (blanks) => `WITH ND-Root WHEN 1 == 1 DISPLAY a${blanks};\n`,
], BLANKS, [
  { name: 'dashes', text: `---${'-'.repeat(RUN)} MAIN ---\nWITH ND-Root DISPLAY a;\n` },
  { name: 'slashes 1', text: `WITH ND-Root DISPLAY a; ${'/'.repeat(RUN)} a comment\n` },
  { name: 'slashes 2', text: `${'/'.repeat(RUN)} a comment\nWITH ND-Root DISPLAY a;\n` },
]);

// Not mixed blanks for EFX-1: the editor's EFX-1 lexer cannot yet read a mixed indentation as long.
const EFX1_LONG_RUNS = longRunsOf([
  (blanks) => `${blanks}{ND-Root} text\n`,
  (blanks) => `{ND-Root} a${blanks}b\n`,
  (blanks) => `{ND-Root} a${blanks}// a comment\n`,
  (blanks) => `{ND-Root} \${BT-01-notice${blanks}== 'a'}\n`,
], { spaces: BLANKS.spaces, tabs: BLANKS.tabs }, [{ name: 'slashes', text: `{ND-Root} a ${'/'.repeat(RUN)} a comment\n` }]);

/** Files that the parser must read with no error, as their colours are compared. */
function correctFiles(files, version) {
  const wrong = files.filter((file) => hasErrors(file, version));
  if (wrong.length > 0) {
    throw new Error(`The parser finds errors in ${wrong.map(({ name }) => name).join(', ')}`);
  }
  return files;
}

/** The files of the entries of a test that the parser reads with no error. */
function entryFilesOf(entries, fileOf, version) {
  return entries.map(fileOf).filter((file) => file !== undefined && !hasErrors(file, version));
}

/** Whether the parser finds an error in a file. */
function hasErrors({ text, kind }, version) {
  let errors = false;
  languageOf(kind, version).parser.parse(text).iterate({ enter: (node) => { errors ||= node.type.isError; } });
  return errors;
}

// Each version: its grammar, its style table, and its sets of texts, each with the numbers as
// measured by the last commit that changed them.
const VERSIONS = [
  {
    name: 'EFX-2',
    version: 2,
    grammar: '../dist/efx2/generated/efx2.tmLanguage.json',
    styles: EFX2_STYLES,
    sets: [
      { name: 'corpus', files: corpusOf('./efx2/corpus/', { 'view-templates': 'template', validation: 'rules' }),
        pinned: { characters: 2584401, same: 2542246, vaguer: 42155 } },
      { name: 'entries', files: entryFilesOf(EFX2_ENTRIES, efx2FileOf, 2),
        pinned: { characters: 12199, same: 12052, vaguer: 147 } },
      { name: 'edges', files: correctFiles(EFX2_EDGES, 2), pinned: { characters: 263, same: 257, vaguer: 6 } },
      { name: 'long runs', files: correctFiles(EFX2_LONG_RUNS, 2), within: LONG_RUN_TIME,
        pinned: { characters: 15599, same: 15599, vaguer: 0 } },
    ],
  },
  {
    name: 'EFX-1',
    version: 1,
    grammar: '../dist/efx1/generated/efx1.tmLanguage.json',
    styles: EFX1_STYLES,
    sets: [
      { name: 'corpus', files: corpusOf('./efx1/corpus/', { 'view-templates': 'template' }),
        pinned: { characters: 2948945, same: 2943771, vaguer: 5174 } },
      { name: 'entries', files: entryFilesOf(EFX1_ENTRIES, efx1FileOf, 1),
        pinned: { characters: 98646, same: 65933, vaguer: 32713 } },
      { name: 'long runs', files: correctFiles(EFX1_LONG_RUNS, 1), within: LONG_RUN_TIME,
        pinned: { characters: 5164, same: 5164, vaguer: 0 } },
    ],
  },
];

// The problems shown, at most, for each version.
const SHOWN = 20;

const number = (value) => value.toLocaleString('en-US');

/** The tag the style table gives each type whatever its parent, by type. */
function tagsOfTypes(styles) {
  const tags = new Map();
  for (const [names, tag] of Object.entries(styles)) {
    names.split(' ').filter((name) => !name.includes('/')).forEach((name) => tags.set(name, String(tag)));
  }
  return tags;
}

/**
 * Compares the files of a set of texts of a version and reports it; whether none has a problem, the
 * numbers are pinned, and, for a set with a time (within), the grammar colours each file within it.
 */
function check({ name, version, styles }, textMate, set) {
  const tags = tagsOfTypes(styles);
  const counts = { characters: 0, same: 0, vaguer: 0 };
  const problems = [];
  const vaguer = new Map();
  for (const file of set.files) {
    const comparison = new ColourComparison(file.name, file.text,
      { kind: file.kind, version, textMate, tagOfType: (type) => tags.get(type) });
    Object.keys(counts).forEach((key) => { counts[key] += comparison.counts[key]; });
    problems.push(...comparison.problems);
    comparison.vaguer.forEach((count, key) => vaguer.set(key, (vaguer.get(key) ?? 0) + count));
  }
  const otherwise = counts.characters - counts.same - counts.vaguer;
  console.log(`TextMate: ${name} ${set.name} (${set.files.length} files), ${number(counts.same)} of `
    + `${number(counts.characters)} characters coloured as the parser colours them, ${number(counts.vaguer)} vaguer, `
    + `${number(otherwise)} otherwise, in ${problems.length} tokens.`);
  [...vaguer].sort(([, a], [, b]) => b - a)
    .forEach(([key, count]) => console.log(`  vaguer: ${key}, ${number(count)}`));
  problems.slice(0, SHOWN).forEach(({ at, kind, type, parser, grammar: tag }) =>
    console.error(`  ${kind}: ${at} ${type}, parser ${parser}, TextMate ${tag}`));
  let passes = problems.length === 0;
  for (const file of set.within === undefined ? [] : set.files) {
    const started = performance.now();
    textMate.tagsOf(file.text);
    const took = Math.round(performance.now() - started);
    if (took > set.within) {
      console.error(`  ${file.name}: coloured in ${number(took)} ms, more than ${number(set.within)} ms`);
      passes = false;
    }
  }
  if (Object.keys(set.pinned).some((key) => set.pinned[key] !== counts[key])) {
    console.error(`The ${name} ${set.name} numbers differ from the pins. If the change is intended, set its pins in `
      + `test/textmate.js to:\npinned: ${JSON.stringify(counts).replaceAll(',', ', ').replaceAll(':', ': ')},`);
    passes = false;
  }
  return passes;
}

const results = [];
for (const version of VERSIONS) {
  const textMate = await TextMateColours.of(fileURLToPath(new URL(version.grammar, import.meta.url)));
  for (const set of version.sets) {
    results.push(check(version, textMate, set));
  }
}
if (!results.every(Boolean)) {
  process.exitCode = 1;
}
