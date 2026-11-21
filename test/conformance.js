// The conformance test: each corpus file is read by the ANTLR lexer of its language and by the
// editor's parser, and the tokens they agree on are counted (FileComparison says when a token
// matches). The EFX-2 corpus is the SDK's view templates and rules files, read by the EFX-2 lexer
// and parser; the EFX-1 corpus is the view templates of the SDK 1, read by the EFX-1 lexer and
// parser. It reads the parsers built in dist/, so it runs after `npm run build`.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parser as efx1Parser } from '../dist/efx1/parser.js';
import { Efx1TokenNames } from './conformance/Efx1TokenNames.js';
import { FileComparison } from './conformance/FileComparison.js';
import { OracleTokens } from './conformance/OracleTokens.js';
import { Efx2TokenNames } from './conformance/Efx2TokenNames.js';
import { EfxLexer as Efx1Lexer } from './efx1/oracle/EfxLexer.js';

// The languages, each with its corpus, the top that reads the files of each corpus folder, and the
// numbers as measured by the last commit that changed them, by corpus folder. The test fails when
// they change, in either direction, until that commit updates them here.
const LANGUAGES = [
  {
    name: 'EFX-2',
    corpus: fileURLToPath(new URL('./efx2/corpus/', import.meta.url)),
    tops: { validation: 'RulesFile', 'view-templates': 'TemplateFile' },
    names: Efx2TokenNames,
    pinned: {
      validation: { files: 7, tokens: 128456 },
      'view-templates': { files: 51, tokens: 346668 },
    },
  },
  {
    name: 'EFX-1',
    corpus: fileURLToPath(new URL('./efx1/corpus/', import.meta.url)),
    tops: { 'view-templates': 'TemplateFile' },
    names: Efx1TokenNames,
    Lexer: Efx1Lexer,
    parser: efx1Parser,
    pinned: {
      'view-templates': { files: 51, tokens: 505015 },
    },
  },
];

const sum = (counts, key) => [...counts.values()].reduce((total, count) => total + count[key], 0);
const number = (value) => value.toLocaleString('en-US');

/** The counts of a group of files, kept by kind of token. */
function countsOf(group) {
  const counts = new Map();
  group.forEach((comparison) => comparison.addCountsTo(counts));
  return counts;
}

/** Compares the corpus of a language and reports it; whether its numbers are the pinned ones. */
function check(language) {
  const files = fs.readdirSync(language.corpus, { recursive: true }).filter((file) => file.endsWith('.efx')).sort();
  const folderOf = (file) => file.split(path.sep)[0];
  const comparisons = files.map((file) => new FileComparison(file,
    fs.readFileSync(path.join(language.corpus, file), 'utf8'), language.tops[folderOf(file)], language));

  console.log(`Conformance of the editor's ${language.name} parser with the ${language.name} lexer, `
    + `over ${files.length} corpus files:`);
  const folders = [...new Set(files.map(folderOf))];
  const measured = {};
  for (const folder of folders) {
    const group = comparisons.filter((_, index) => folderOf(files[index]) === folder);
    const groupCounts = countsOf(group);
    const total = sum(groupCounts, 'total');
    measured[folder] = {
      files: group.filter((comparison) => comparison.matches).length,
      tokens: sum(groupCounts, 'matched'),
    };
    const pinned = language.pinned[folder] ?? { files: 0, tokens: 0 };
    console.log(`  ${folder}: ${measured[folder].files} of ${group.length} files match (pinned: ${pinned.files}), `
      + `${number(measured[folder].tokens)} of ${number(total)} tokens, `
      + `${(100 * measured[folder].tokens / total).toFixed(1)}% (pinned: ${number(pinned.tokens)})`);
  }
  const counts = countsOf(comparisons);
  const kinds = [...counts.entries()];

  console.log('\nFirst difference in each file:');
  comparisons.map((comparison) => comparison.firstDifference())
    .filter((difference) => difference !== undefined)
    .forEach((difference) => console.log(`  ${difference}`));

  console.log('\nToken kinds not fully matched, unmatched of total:');
  kinds.filter(([, count]) => count.matched < count.total)
    .sort(([, a], [, b]) => (b.total - b.matched) - (a.total - a.matched))
    .forEach(([kind, count]) => console.log(`  ${kind} ${number(count.total - count.matched)} of ${number(count.total)}`));

  const lexerKinds = OracleTokens.kinds(language.Lexer);
  const absent = lexerKinds.filter((kind) => !counts.has(kind));
  console.log(`\n${absent.length} of the lexer's ${lexerKinds.length} token kinds do not occur in the corpus: `
    + `${absent.join(', ')}\n`);

  let passes = true;
  const missing = kinds.map(([kind]) => kind).filter((kind) => !language.names.has(kind));
  if (missing.length > 0) {
    console.error(`Token kinds missing from the table of ${language.name} token names: ${missing.join(', ')}\n`);
    passes = false;
  }
  const isPinned = (folder) => language.pinned[folder]?.files === measured[folder].files
    && language.pinned[folder]?.tokens === measured[folder].tokens;
  if (folders.length !== Object.keys(language.pinned).length || !folders.every(isPinned)) {
    console.error(`The ${language.name} numbers differ from the pins. If the change is intended, set its pins at the `
      + `top of test/conformance.js to:\npinned: ${JSON.stringify(measured, null, 2)},\n`);
    passes = false;
  }
  return passes;
}

const results = LANGUAGES.map(check);
if (!results.every(Boolean)) {
  process.exitCode = 1;
}
