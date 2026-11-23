// The sync test: the sync stops at a lexer the editor's lexer cannot run as ANTLR runs it, rather
// than write a table that reads otherwise (scripts/sync/LexerTable.js), and takes one it can. Each case is a small lexer
// grammar that antlr-ng generates here, which needs neither network nor Java. It also checks, on small
// lexers, that the TextMate grammar the sync writes (scripts/sync/TextMateGrammar.js) reads the longest
// token, and the token of the rule written first on a tie, as ANTLR's lexer does, also between a
// rule that leaves its mode and one that does not, that a pattern looks out only for the rules tried
// after it, and that the sync stops at a rule the TextMate grammar could not follow.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { tags } from '@lezer/highlight';
import { AntlrGrammar } from '../scripts/sync/AntlrGrammar.js';
import { TextMateGrammar } from '../scripts/sync/TextMateGrammar.js';
import { TextMateColours } from './textmate/TextMateColours.js';

// The lexer grammars the sync must refuse, each with what it has that the editor's lexer cannot run.
const REFUSED = [
  { has: 'a non-greedy loop', rules: "Block: '<' .*? '>';\nOther: .;" },
  { has: 'a predicate', rules: "Word: [a-z]+ {this.text.length > 1}?;\nOther: .;" },
  { has: 'a custom action', rules: "Word: [a-z]+ {console.log('word');};\nOther: .;" },
  { has: 'a more command', rules: "Start: '<' -> more;\nOther: .;" },
];

// A parser grammar for the lexer, which antlr-ng generates with it.
const PARSER = "grammar Efx;\noptions { tokenVocab = EfxLexer; }\nstart: Other*;\n";

const failures = [];
for (const { has, rules } of REFUSED) {
  const grammar = await AntlrGrammar.generate(Buffer.from(`lexer grammar EfxLexer;\n${rules}\n`), Buffer.from(PARSER));
  try {
    assert.throws(() => grammar.lexerTable(), /does not read/);
  } catch {
    failures.push(`a lexer with ${has} is not refused`);
  }
}
// And a lexer with none of these is taken.
const plain = await AntlrGrammar.generate(Buffer.from("lexer grammar EfxLexer;\nWord: [a-z]+ -> pushMode(M);\nOther: .;\n"
  + "mode M;\nEnd: ';' -> popMode, type(Other);\nSpace: ' ' -> skip;\n"), Buffer.from(PARSER));
try {
  plain.lexerTable();
} catch (error) {
  failures.push(`a lexer the editor can run is refused: ${error.message}`);
}

// Lexers whose TextMate grammar must read texts as ANTLR's lexer does: each text with the tag of each
// of its characters, as test/textmate/TextMateColours.js gives them, a dot for none. A string that a
// line break ends, which is no token for ANTLR, is a string to the end of its line.
const STYLES = { Free: tags.special(tags.string), Key: tags.keyword, Number: tags.number, Date: tags.literal, String: tags.string };
const READ_AS_ANTLR = [
  { has: 'a word that a rule written before reads too', rules: "Free: [a-z]+;\nKey: 'text';\nSpace: ' ' -> skip;",
    text: 'text texts', tags: 'FFFF.FFFFF' },
  { has: 'a longer token of a rule written after', rules: "Number: [0-9]+;\nDate: [0-9][0-9][0-9][0-9] '-' [0-9][0-9];\nSpace: ' ' -> skip;",
    text: '2024-01 20', tags: 'DDDDDDD.NN' },
  { has: 'a longer token of a rule written after, which goes on with a character that the rule could read next',
    rules: "Free: 'ab'+;\nKey: 'ab'+ 'ac'?;\nSpace: ' ' -> skip;", text: 'abac abab ababac', tags: 'KKKK.FFFF.KKKKKK' },
  { has: 'a rule that can go on after some of its matches only, which depends on how they end',
    rules: "Number: ('x'+ 'y'+ | 'y'+ 'x'+)+;\nKey: [xy];\nSpace: ' ' -> skip;", text: 'xyyxx yxxy xyx yxxxyyx', tags: 'NNNNN.NNNN.NNK.NNNNNNN' },
  { has: 'a rule written before a rule that leaves its mode, which reads the same token',
    rules: "Start: '<' -> pushMode(M);\nFree: [a-z]+;\nSpace: ' ' -> skip;\nmode M;\nNumber: [ab]+;\n"
      + "Key: 'a'+ 'c'? -> popMode;\nInner: ' ' -> skip;", text: '<aa b', tags: '.NN.N' },
  { has: 'a rule that leaves its mode written before a rule that reads the same token, where the end is tried last',
    rules: "Start: '<' -> pushMode(M), pushMode(X);\nFree: [a-z]+;\nSpace: ' ' -> skip;\nmode X;\nClose: '>' -> popMode;\n"
      + "mode M;\nKey: 'a'+ 'c'? -> popMode;\nNumber: [ab]+;\nInner: ' ' -> skip;", text: '<>aa b', tags: '..KK.F' },
  { has: 'a rule that leaves its mode and loses every tie to a rule written before it',
    rules: "Start: '<' -> pushMode(M);\nFree: [a-z]+;\nSpace: ' ' -> skip;\nmode M;\nNumber: [ab]+;\n"
      + "Key: 'a'+ -> popMode;\nInner: ' ' -> skip;", text: '<aa b', tags: '.NN.N' },
  { has: 'a mode that replaces another and ends with a token of the type that ends the other',
    rules: "Start: '<' -> pushMode(M);\nFree: [a-z]+;\nSpace: ' ' -> skip;\nmode M;\nSwitch: '!' -> mode(N);\n"
      + "Key: 'a'+ 'c'? -> popMode;\nmode N;\nNumber: [ab]+;\nEnd: 'a'+ 'c'? -> popMode, type(Key);\nInner: ' ' -> skip;",
    text: '<!aab aa aac b', tags: '..NNN.NN.KKK.F' },
  { has: 'a token that ends inside a run of blanks, before a rule that can start with the run',
    rules: "Key: 'a' ' ';\nFree: ' '* 'b';\nSpace: ' ' -> skip;", text: 'a  b', tags: 'KKFF' },
  { has: 'a string that goes on after an escaped line break',
    rules: "String: '\\'' (~['\\\\\\r\\n] | '\\\\' .)* '\\'';\nNumber: [0-9]+;\nSpace: [ \\n] -> skip;",
    text: "'a\\\nb' 1\n'c\n2", tags: 'SSS.SS.N.SS.N' },
];
const TAG_LETTERS = { 'special(string)': 'F', keyword: 'K', number: 'N', literal: 'D', string: 'S' };

/** The text of the TextMate grammar the sync writes for a lexer grammar's rules. */
function textMateOf(rules) {
  return TextMateGrammar.of(`lexer grammar EfxLexer;\n${rules}\n`,
    { name: 'Test', scopeName: 'source.test', source: 'a test', styles: STYLES, lexerOptions: {} }).toFile();
}

/** The TextMate grammar the sync writes for a lexer grammar's rules, in a file of its own. */
function textMateFileOf(rules) {
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'efx-sync-test-')), 'test.tmLanguage.json');
  fs.writeFileSync(file, textMateOf(rules));
  return file;
}

for (const { has, rules, text, tags: expected } of READ_AS_ANTLR) {
  const file = textMateFileOf(rules);
  const read = Array.from((await TextMateColours.of(file)).tagsOf(text), (tag) => TAG_LETTERS[tag] ?? '.').join('');
  fs.rmSync(path.dirname(file), { recursive: true });
  if (read !== expected) {
    failures.push(`the TextMate grammar of a lexer with ${has} reads ${JSON.stringify(text)} as ${read}, not ${expected}`);
  }
}

// A pattern looks out only for the longer tokens of the rules that the grammar tries after it: a rule
// tried before it that reads a longer token there matches first. The date, whose shortest token is
// the longer, is tried before the number, which therefore needs no lookahead for it.
const { repository } = JSON.parse(textMateOf("Number: [0-9]+;\nDate: [0-9][0-9][0-9][0-9] '-' [0-9][0-9];"));
const number = repository.DEFAULT_MODE.patterns.find(({ name }) => name === 'constant.numeric.efx')?.match;
if (number !== '[0-9]+(?![0-9])') {
  failures.push(`the pattern of a number tried after a date looks out for the date: ${number}`);
}
// A rule whose every token a rule written before it reads too, here one that leaves the mode, has no pattern.
const shadowed = JSON.parse(textMateOf("Start: '<' -> pushMode(M);\nmode M;\nKey: [ab]+ -> popMode;\nNumber: 'a'+;"))
  .repository.M.patterns.find(({ name }) => name === 'constant.numeric.efx');
if (shadowed !== undefined) {
  failures.push(`a rule that loses every tie has the pattern ${JSON.stringify(shadowed.match)}`);
}

// Lexer rules that the TextMate grammar could not follow, at which the sync must stop.
const UNFOLLOWED = [
  { has: 'options that a first match would end too early', rules: "Word: 'a'+ | 'a'+ 'b';" },
  { has: 'a command the sync does not read', rules: "Word: 'a' -> more;\nOther: 'b';" },
  { has: 'a rule that refers to itself before its end', rules: "Word: 'a' Word? | 'b';" },
  { has: 'a rule that refers to itself at the end of some alternatives only', rules: "Word: 'a' Word* | 'b';" },
  { has: 'a token that ends a mode and the mode it replaced, where a rule of that mode goes on after it',
    rules: "Start: '<' -> pushMode(M);\nmode M;\nSwitch: '!' -> mode(N);\nA: 'a'+ 'd';\nEndM: 'a'+ -> popMode;\n"
      + "mode N;\nEndN: 'a'+ -> popMode, type(EndM);" },
  { has: 'a token that ends a mode and the mode it replaced, where a rule of that mode reads it too',
    rules: "Start: '<' -> pushMode(M);\nmode M;\nSwitch: '!' -> mode(N);\nA: 'a'+;\nEndM: 'a'+ -> popMode;\n"
      + "mode N;\nEndN: 'a'+ -> popMode, type(EndM);" },
];
for (const { has, rules } of UNFOLLOWED) {
  try {
    textMateFileOf(rules);
    failures.push(`the TextMate grammar of a lexer with ${has} is written`);
  } catch {
    // Refused, as it should be.
  }
}

const total = REFUSED.length + 1 + READ_AS_ANTLR.length + 2 + UNFOLLOWED.length;
console.log(`Sync: ${total - failures.length} of ${total} lexers are refused or taken, and read, as they should be.`);
failures.forEach((failure) => console.error(`  ${failure}`));
if (failures.length > 0) {
  process.exitCode = 1;
}
