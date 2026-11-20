// The tree test: each entry is read by the EFX-2 parser and by the editor's parser, and both trees
// must be the pinned one. An entry marked with a divergence pins the editor's tree and checks that
// ANTLR's still differs, so that a divergence that goes away is noticed and its mark removed. An
// entry marked as a mistake is wrong EFX: it pins the editor's tree and checks that both parsers
// report an error. Each expression entry is also read on its own, as a bare expression, and must give
// the same expression. It reads the parser built in dist/, so it runs after `npm run build`.

import { EditorTree } from './trees/EditorTree.js';
import { OracleTree } from './trees/OracleTree.js';
import { ENTRIES } from './trees/entries.js';

/** The text an entry reads, the top it is read from, and the part of the tree the entry pins. */
function readingOf(entry) {
  if (entry.rules !== undefined) {
    return { text: entry.rules, top: 'RulesFile', shown: String };
  }
  if (entry.template !== undefined) {
    return { text: entry.template, top: 'TemplateFile', shown: String };
  }
  if (entry.text !== undefined) {
    return { text: entry.text, top: 'SingleExpression', shown: String };
  }
  return { text: `WITH ND-Root COMPUTE ${entry.input}`, top: 'SingleExpression', shown: (tree) => String(tree.expression()) };
}

/** What is wrong with an entry, or nothing. */
function problemsOf(entry) {
  const { text, top, shown } = readingOf(entry);
  const editor = EditorTree.of(text, top);
  const oracle = OracleTree.of(text, top);
  const oracleAgrees = oracle.errors === 0 && shown(oracle.tree) === entry.tree;
  const problems = [];
  if (shown(editor.tree) !== entry.tree) {
    problems.push(`editor: ${shown(editor.tree)}`);
  }
  if (entry.mistake !== undefined) {
    if (editor.errors === 0) {
      problems.push('editor: no parse errors');
    }
    if (oracle.errors === 0) {
      problems.push(`ANTLR reads it without errors: ${shown(oracle.tree)}`);
    }
  } else if (entry.divergence !== undefined) {
    if (oracleAgrees) {
      problems.push(`ANTLR now agrees: the divergence "${entry.divergence}" is gone from this entry`);
    }
  } else {
    if (editor.errors > 0) {
      problems.push(`editor: ${editor.errors} parse errors`);
    }
    if (!oracleAgrees) {
      problems.push(`ANTLR (${oracle.errors} syntax errors): ${shown(oracle.tree)}`);
    }
  }
  return problems;
}

/**
 * What is wrong with an expression entry read as a bare expression: the expression must be the
 * pinned one, with no error, or with one if the entry is a mistake. Efx.g4 has no start rule for a
 * bare expression, so its tree is compared with the expression's tree of the entry.
 */
function bareProblemsOf(entry) {
  const editor = EditorTree.of(entry.input, 'BareExpression', 'bare');
  const shown = String(editor.tree).replace(/^BareExpression\((.*)\)$/s, '$1');
  const problems = [];
  if (shown !== entry.tree) {
    problems.push(`editor, as a bare expression: ${shown}`);
  }
  if ((entry.mistake !== undefined) !== (editor.errors > 0)) {
    problems.push(`editor, as a bare expression: ${editor.errors} parse errors`);
  }
  return problems;
}

const failures = ENTRIES.map((entry) => ({ entry, problems: problemsOf(entry) }))
  .concat(ENTRIES.filter((entry) => entry.input !== undefined && entry.divergence === undefined)
    .map((entry) => ({ entry, problems: bareProblemsOf(entry) })))
  .filter(({ problems }) => problems.length > 0);

const divergences = ENTRIES.filter((entry) => entry.divergence !== undefined).length;
const mistakes = ENTRIES.filter((entry) => entry.mistake !== undefined).length;
const bare = ENTRIES.filter((entry) => entry.input !== undefined && entry.divergence === undefined).length;
console.log(`Trees: ${ENTRIES.length + bare - failures.length} of ${ENTRIES.length + bare} readings as pinned, `
  + `${bare} of them expressions read again as bare expressions `
  + `(${divergences} of them listed divergences, ${mistakes} mistakes).`);
for (const { entry, problems } of failures) {
  console.error(`\n${JSON.stringify(entry.input ?? entry.text ?? entry.template ?? entry.rules)}\n  pinned: ${entry.tree}`);
  problems.forEach((problem) => console.error(`  ${problem}`));
}
if (failures.length > 0) {
  process.exitCode = 1;
}
