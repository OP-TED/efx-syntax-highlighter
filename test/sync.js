// The sync test: the sync stops at a lexer the editor's lexer cannot run as ANTLR runs it, rather
// than write a table that reads otherwise (scripts/sync/LexerTable.js), and takes one it can. Each case is a small lexer
// grammar that antlr-ng generates here, which needs neither network nor Java.

import assert from 'node:assert/strict';
import { AntlrGrammar } from '../scripts/sync/AntlrGrammar.js';

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
console.log(`Sync: ${REFUSED.length + 1 - failures.length} of ${REFUSED.length + 1} lexers are refused or taken as they `
  + 'should be.');
failures.forEach((failure) => console.error(`  ${failure}`));
if (failures.length > 0) {
  process.exitCode = 1;
}
