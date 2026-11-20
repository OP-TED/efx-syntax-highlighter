// The lexer test: the editor's lexer (src/lexer/), run from each version's table, against ANTLR's
// lexer of that version (test/efx2/oracle/, test/efx1/oracle/). Both must read the same tokens, with
// their types, texts, starts and channels, out of the version's corpus and out of texts made at
// random of pieces of the version, which reach the corners a corpus does not: tokens of every mode
// run together or cut short, and mixed line ends. Where a text holds what no rule reads, both must
// report the error at the same place, and the tokens are compared up to there: after an error each
// lexer goes on in its own way, and the editor only shows the error. It reads the build in dist/, so
// it runs after `npm run build`.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { BaseErrorListener, CharStream, Token } from 'antlr4ng';
import { lexerTable as efx1Table } from '../dist/efx1/generated/lexer.js';
import { lexerTable as efx2Table } from '../dist/efx2/generated/lexer.js';
import { AntlrLexer } from '../dist/lexer/AntlrLexer.js';
import { Lexing } from '../dist/lexer/Lexing.js';
import { OracleTokens } from './conformance/OracleTokens.js';
import { EfxLexer as Efx1Lexer } from './efx1/oracle/EfxLexer.js';
import { EfxLexer as Efx2Lexer } from './efx2/oracle/EfxLexer.js';

// How many texts are made at random for each version.
const RANDOM_TEXTS = 5000;

/** A generator of numbers at random, always the same ones, so that a failure can be read again. */
function randomNumbers(seed) {
  let state = seed;
  return (bound) => {
    state = (Math.imul(state, 1103515245) + 12345) >>> 0;
    return state % bound;
  };
}

// Pieces both versions are made of: between lines, at the start of a line, in template text, in a
// label block and in an expression. Some pieces are only the start of a token, or are wrong there.
const COMMON = {
  between: ['\n', '\r\n', '\r', '\f', '\n\n', ' \n', '\t\r\n', '// a comment\n', '  // indented comment\r\n'],
  indentation: ['', ' ', '  ', '\t', '\t\t', '\t ', ' \t', ' \t\t ', '\t  \t', '\t \t', '1 ', '12\t', '\t3 '],
  template: ['text', 'a-b', 'name', 'value', ':', ',', 'http://x', 'x//y', ' // a comment', ' ', '\t', '  ', '$value',
    '#value', '$valuex', 'a&b', '&', '(', ')', 'é', '😀'],
  label: ['|', 'name', 'text', 'field', 'business-term', 'auxiliary', 'when-true', 'my-label-1', 'a-', 'BT-1',
    'BT-1-Lot', 'BT-01(a)-Lot', 'x'],
  expression: ['and', 'or', 'not', 'in', 'is', 'present', 'empty', 'unique', 'like', 'every', 'some', 'satisfies', 'if',
    'then', 'else', 'for', 'return', 'TRUE', 'NEVER', 'notice', 'codelist', 'self', 'parent', 'preceding',
    'preceding-sibling', 'count', 'starts-with', 'starts-without', 'number', 'number:', 'text:', 'context:',
    'measure:', 'date', 'date:', 'BT-1', 'BT-1-Lot', 'BT-01(a)-Lot', 'BT-01(BT-2)-Lot', 'OPT-300-Procedure-Buyer',
    'ND-Root', '$x', '$', 'abc_1', 'a-b-c', "'a'", '"b"', "'a\\'b'", "'a\fb'", "'😀'", "'", '1', '-1', '2.5', '12.5', '.5',
    '-.5', 'P1D', 'P-2W', '-P3Y', 'P1M', 'P1', '2024-01-01Z', '2024-01-01+02:00', '2024-01-01', '12:00:00Z',
    '+02:00', '{12345678-1234-1234-1234-123456789012}', '(', ')', '[', ']', '::', ' :: ', ':', ',', '/', '/@',
    '==', '!=', '<', '<=', '>', '>=', '+', '-', '*', '%', ' ', '\t', '  '],
  wrong: ['?', '~', '\\', '"\n', '{', '}', '#', '@'],
};

// The pieces only EFX-2 has: its words, prefixes and the parts of its lines and rules.
const EFX2 = {
  expression: [...COMMON.expression, 'has', 'no', 'duplicates', 'distinct', 'at', 'EVERY', 'AT', 'ALWAYS', 'indicator',
    'text', 'date', 'time', 'duration', 'context:', 'upper-case', 'substring-before', 'index-of', ':rawValue',
    ':publicationDate', ':isWithheld', '?f', '?f(', '#codelist', '[...codelist]', '...', '..', '.', '@listName',
    '$x::', 'ND-Lot::BT-1-Lot', 'R-AAA-001', '@PRE', '@POST', 'WITH', 'COMPUTE', 'SELECT', ';', '|', '=',
    '// a comment\n'],
  template: [...COMMON.template, '\\n', ' \\n ', '\\\\', '\\$', '&amp;', '&#38;', '&#x26;', '\\\n', ' @{', '@{'],
  format: ['short', 'medium', 'long', 'no-unit', 'no-formatting', '2', ' ', 'x'],
  heads: ['WITH ', 'WITH EVERY ', 'LET ', 'WHEN ', 'OTHERWISE ', 'OTHERWISE DISPLAY ', 'OTHERWISE\n DISPLAY ',
    'DISPLAY ', 'DISPLAY\n', 'INVOKE ', 'ENDPOINT ', 'ASSERT ', 'REPORT ', 'OTHERWISE ASSERT ', 'AS ERROR ',
    'AS WARNING ', 'FOR ', 'IN ', 'SCOPE ', 'WITH', 'DISPLAY'],
  lines: ['--- STAGE 1a ---\n', '--- STAGE 1a --- // stage\n', '---- SUMMARY ----\n', '--- NAVIGATION ---\n',
    '#include "a.efx"\n', '#include "a.efx" // here\n', '#include "a//b.efx"\n', 'LET template:t(text:$p) ',
    'LET text:$g = \'a\';\n', 'LET dynamic:?f() = CALL API \'x\' ON ERROR REJECT;\n'],
};

/**
 * Texts made at random for a version: each up to four lines, each line its indentation, its start
 * (the context of an EFX-1 line, or for EFX-2 also its words), and its template, of text, label
 * blocks and expression blocks of random pieces run together; now and then a wrong piece goes
 * anywhere, and a line ends with any line end or none.
 */
function randomTexts(seed, pieces, isEfx2) {
  const random = randomNumbers(seed);
  const pick = (list) => list[random(list.length)];
  const some = (list, most) => Array.from({ length: random(most + 1) }, () => pick(list)).join('');
  const maybeWrong = () => (random(12) === 0 ? pick(COMMON.wrong) : '');
  const format = () => (isEfx2 && random(4) === 0 ? `|${some(EFX2.format, 2)}` : '');
  const expressionBlock = () => `\${${some(pieces.expression, 8)}${format()}${maybeWrong()}}`;
  const labelBlock = () => `#{${some([...pieces.label, '${"x"}', ...(isEfx2 ? [';', '${1}'] : [])], 5)}${maybeWrong()}}`;
  const fragment = () => [() => some(pieces.template, 3), expressionBlock, labelBlock, maybeWrong][random(4)]();
  const template = () => Array.from({ length: 1 + random(4) }, fragment).join('');
  const contextLine = () => `{${some(pieces.expression, 4)}}${random(8) === 0 ? '' : ' '}${template()}`;
  const efx2Line = () => [contextLine,
    () => `${pick(EFX2.heads)}${some(pieces.expression, 4)} ${pick(EFX2.heads)}${template()}${random(3) === 0 ? ';' : ''}`,
    () => `${pick(EFX2.heads)}${some(pieces.expression, 6)}${random(3) === 0 ? ';' : ''}`,
    () => pick(EFX2.lines)][random(4)]();
  const line = () => `${pick(COMMON.indentation)}${isEfx2 ? efx2Line() : contextLine()}`
    + `${random(10) === 0 ? '' : pick(COMMON.between)}`;
  return Array.from({ length: RANDOM_TEXTS }, () =>
    `${random(4) === 0 ? pick(COMMON.between) : ''}${Array.from({ length: 1 + random(4) }, line).join('')}`);
}

const VERSIONS = [
  { name: 'EFX-2', Lexer: Efx2Lexer, lexer: new AntlrLexer(efx2Table), corpus: 'efx2/corpus/',
    random: () => randomTexts(20261120, { ...COMMON, ...EFX2 }, true) },
  { name: 'EFX-1', Lexer: Efx1Lexer, lexer: new AntlrLexer(efx1Table), corpus: 'efx1/corpus/',
    random: () => randomTexts(20261119, COMMON, false) },
];

class FirstError extends BaseErrorListener {
  position;

  /** Keeps where the first error starts: its exception is the last argument. */
  syntaxError(...report) {
    this.position ??= report.at(-1).startIndex;
  }
}

/**
 * The tokens of a text as ANTLR's lexer reads it, on every channel, and where it reports its first
 * error. ANTLR counts positions in characters and the editor in UTF-16 units, so the positions are
 * given in UTF-16 units.
 */
function oracleLex(Lexer, text) {
  const lexer = new Lexer(CharStream.fromString(text));
  const firstError = new FirstError();
  lexer.removeErrorListeners();
  lexer.addErrorListener(firstError);
  const offsets = OracleTokens.utf16Offsets(text);
  const tokens = lexer.getAllTokens().map((token) => ({
    type: Lexer.vocabulary.getSymbolicName(token.type),
    text: token.text,
    start: offsets[token.start],
    hidden: token.channel !== Token.DEFAULT_CHANNEL,
  }));
  return { tokens, firstError: firstError.position === undefined ? undefined : offsets[firstError.position] };
}

const shown = ({ type, text, start, hidden }) => `${type}${hidden ? ' (hidden)' : ''} at ${start} ${JSON.stringify(text)}`;

/** The first difference between the two lexers' readings of a text, up to the first error; or undefined. */
function differenceIn(version, text) {
  const editor = Lexing.tokensOf(version.lexer, text);
  const oracle = oracleLex(version.Lexer, text);
  const editorError = editor.errors[0];
  if (editorError !== oracle.firstError) {
    return `first error: editor at ${editorError ?? 'none'}, ANTLR at ${oracle.firstError ?? 'none'}`;
  }
  const beforeError = ({ start }) => editorError === undefined || start < editorError;
  const mine = editor.tokens.filter(beforeError).map(shown);
  const theirs = oracle.tokens.filter(beforeError).map(shown);
  const index = mine.findIndex((token, at) => token !== theirs[at]);
  if (index >= 0 || mine.length !== theirs.length) {
    const at = index >= 0 ? index : Math.min(mine.length, theirs.length);
    return `token ${at}: editor ${mine[at] ?? 'none'}, ANTLR ${theirs[at] ?? 'none'}`;
  }
  return undefined;
}

let failed = false;
for (const version of VERSIONS) {
  const folder = fileURLToPath(new URL(version.corpus, import.meta.url));
  const corpus = fs.readdirSync(folder, { recursive: true }).filter((file) => file.endsWith('.efx')).sort()
    .map((file) => ({ name: file, text: fs.readFileSync(path.join(folder, file), 'utf8') }));
  const random = version.random().map((text, index) => ({ name: `random text ${index}`, text }));
  const failures = [];
  let withErrors = 0;
  let tokens = 0;
  for (const { name, text } of [...corpus, ...random]) {
    const { tokens: read, errors } = Lexing.tokensOf(version.lexer, text);
    withErrors += errors.length > 0 ? 1 : 0;
    tokens += read.filter(({ start }) => errors.length === 0 || start < errors[0]).length;
    const difference = differenceIn(version, text);
    if (difference !== undefined) {
      failures.push(`${name} ${JSON.stringify(text.length > 300 ? `${text.slice(0, 300)}…` : text)}: ${difference}`);
    }
  }
  const texts = corpus.length + random.length;
  console.log(`${version.name} lexer: ${texts - failures.length} of ${texts} texts (${corpus.length} corpus files and `
    + `${random.length} made at random, ${withErrors} of them with an error; ${tokens.toLocaleString('en-US')} tokens `
    + 'compared) read as ANTLR reads them.');
  failures.slice(0, 10).forEach((failure) => console.error(`  ${failure}`));
  failed ||= failures.length > 0;
}
if (failed) {
  process.exitCode = 1;
}
