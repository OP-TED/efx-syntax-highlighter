// The EFX-1 test: each entry is read by the EFX-1 lexer and parser of the SDK 1 and by the editor's
// EFX-1 parser. The editor's tokens must be the lexer's, and the editor must report an error where
// ANTLR's parser does and nowhere else, but in the entries marked with a divergence: texts the
// editor reads and ANTLR refuses, mostly for the types the editor's grammar does not give
// expressions (grammar/efx1.grammar). Each expression entry is also read on its own, as a bare
// expression, and must give the same tokens. The operators must group as in ANTLR's tree: the trees
// are compared reduced to their operators, each with the text it spans, as the editor's grammar has
// other rules; but in the entries marked with a grouping divergence. In wrong EFX-1 only the errors are compared. The
// entries cover the kinds of tokens the corpus lacks, and the ranks of the operators. It reads the parser built in dist/, so it runs
// after `npm run build`.

import { BaseErrorListener, CharStream, CommonTokenStream } from 'antlr4ng';
import { parser } from '../../dist/efx1/parser.js';
import { EditorTokens } from '../conformance/EditorTokens.js';
import { Efx1TokenNames } from '../conformance/Efx1TokenNames.js';
import { FileComparison } from '../conformance/FileComparison.js';
import { OracleTokens } from '../conformance/OracleTokens.js';
import { EfxLexer } from './oracle/EfxLexer.js';
import { EfxParser } from './oracle/EfxParser.js';
import { ENTRIES } from './entries/entries.js';


// The lexer, quiet: the errors of wrong EFX-1 are counted, not printed.
class QuietLexer extends EfxLexer {
  constructor(input) {
    super(input);
    this.removeErrorListeners();
  }
}

class ErrorCount extends BaseErrorListener {
  count = 0;

  syntaxError() {
    this.count += 1;
  }
}

/** The text an entry reads, the top it is read from, and, for an expression, where it starts. */
function readingOf(entry) {
  if (entry.template !== undefined) {
    return { text: entry.template, top: 'TemplateFile' };
  }
  if (entry.selector !== undefined) {
    return { text: `{ND-Root} &{${entry.selector}}`, top: 'SingleExpression' };
  }
  const prefix = '{ND-Root} ${';
  return { text: `${prefix}${entry.expression}}`, top: 'SingleExpression', expressionStart: prefix.length };
}

/** ANTLR's tree of a text read from a top, and the number of syntax errors it reports. */
function oracleReading(text, top) {
  const errors = new ErrorCount();
  const lexer = new EfxLexer(CharStream.fromString(text));
  const oracle = new EfxParser(new CommonTokenStream(lexer));
  for (const recognizer of [lexer, oracle]) {
    recognizer.removeErrorListeners();
    recognizer.addErrorListener(errors);
  }
  const tree = oracle[top[0].toLowerCase() + top.slice(1)]();
  return { tree, errors: errors.count };
}

// The operators of ANTLR's tree, by the names of its alternatives, as the editor's grammar names
// them: Efx.g4 has an alternative for each type that an operator takes.
const OPERATORS = new Map([
  ...['LogicalOrCondition', 'LogicalAndCondition', 'LikePatternCondition', 'EmptinessCondition', 'PresenceCondition',
    'UniqueValueCondition', 'QuantifiedExpression'].map((name) => [name, name]),
  ...['FieldValue', 'Boolean', 'Numeric', 'String', 'Date', 'Time', 'Duration']
    .map((type) => [`${type}Comparison`, 'ComparisonExpression']),
  ...['String', 'Boolean', 'Number', 'Date', 'Time', 'Duration'].map((type) => [`${type}InListCondition`, 'InListCondition']),
  ...['MultiplicationExpression', 'DurationLeftMultiplicationExpression', 'DurationRightMultiplicationExpression']
    .map((name) => [name, 'MultiplicativeExpression']),
  ...['AdditionExpression', 'DateSubtractionExpression', 'DurationAdditionExpression', 'DurationSubtractionExpression']
    .map((name) => [name, 'AdditiveExpression']),
  ...['UntypedConditionalExpression', 'ConditionalBooleanExpression', 'ConditionalStringExpression',
    'ConditionalNumericExpression', 'ConditionalDateExpression', 'ConditionalTimeExpression',
    'ConditionalDurationExpression'].map((name) => [name, 'ConditionalExpression']),
  ...['String', 'Boolean', 'Numeric', 'Date', 'Time', 'Duration']
    .map((type) => [`${type}SequenceFromIteration`, 'IterationExpression']),
]);
const EDITOR_OPERATORS = new Set(OPERATORS.values());

/**
 * The operators of ANTLR's tree of a text, as the editor names them, each with the text it spans:
 * where each operator starts and ends tells how the operators group. ANTLR counts positions in
 * characters and the editor in UTF-16 units, so the spans are given in UTF-16 units.
 */
function oracleOperators(text, tree) {
  const offsets = OracleTokens.utf16Offsets(text);
  const found = [];
  const visit = (node) => {
    const name = OPERATORS.get(node.constructor.name.replace(/Context$/, ''));
    if (name !== undefined) {
      found.push(`${name} ${offsets[node.start.start]}-${offsets[node.stop.stop + 1]}`);
    }
    (node.children ?? []).forEach(visit);
  };
  visit(tree);
  return found;
}

/** The operators of the editor's tree of a text, each with the text it spans. */
function editorOperators(text, top) {
  const found = [];
  parser.configure({ top }).parse(text).iterate({
    enter: ({ name, from, to }) => {
      if (EDITOR_OPERATORS.has(name)) {
        found.push(`${name} ${from}-${to}`);
      }
    },
  });
  return found;
}

/** The number of parse errors in the editor's tree of a text. */
function editorErrors(text, top, dialect) {
  let errors = 0;
  parser.configure({ top, dialect }).parse(text).iterate({
    enter: (node) => { errors += node.type.isError ? 1 : 0; },
  });
  return errors;
}

/** The editor's tokens of an expression, without its position: names and texts. */
const shown = (tokens) => tokens.map(({ name, text }) => `${name} ${JSON.stringify(text)}`).join(', ');

/** What is wrong with an entry, or nothing. */
function problemsOf(entry) {
  const { text, top, expressionStart } = readingOf(entry);
  const problems = [];
  const comparison = new FileComparison('entry', text, top, { Lexer: QuietLexer, parser, names: Efx1TokenNames });
  if (entry.mistake === undefined && !comparison.matches) {
    problems.push(`tokens: ${comparison.firstDifference()}`);
  }
  const editor = editorErrors(text, top);
  const oracleRead = oracleReading(text, top);
  const oracle = oracleRead.errors;
  if (entry.mistake !== undefined) {
    if (editor === 0 || oracle === 0) {
      problems.push(`a mistake both refuse: editor ${editor} errors, ANTLR ${oracle}`);
    }
  } else if (editor > 0) {
    problems.push(`editor: ${editor} parse errors`);
  } else if ((entry.divergence !== undefined) !== (oracle > 0)) {
    problems.push(entry.divergence === undefined ? `ANTLR: ${oracle} syntax errors`
      : `ANTLR now reads it without errors: the divergence "${entry.divergence}" is gone`);
  }
  if (entry.mistake === undefined && entry.divergence === undefined) {
    const editorGrouping = editorOperators(text, top).join(', ');
    const oracleGrouping = oracleOperators(text, oracleRead.tree).join(', ');
    if ((entry.grouping === undefined) !== (editorGrouping === oracleGrouping)) {
      problems.push(entry.grouping === undefined
        ? `grouping: editor ${editorGrouping}, ANTLR ${oracleGrouping}`
        : `ANTLR now groups it as the editor does: the grouping divergence "${entry.grouping}" is gone`);
    }
  }
  if (expressionStart !== undefined && entry.mistake === undefined) {
    const inBlock = EditorTokens.of(text, top, { parser })
      .filter(({ start }) => start >= expressionStart && start < text.length - 1);
    const bare = EditorTokens.of(entry.expression, 'BareExpression', { parser, dialect: 'bare' });
    if (shown(bare) !== shown(inBlock)) {
      problems.push(`as a bare expression: ${shown(bare)}`);
    }
    if (editorErrors(entry.expression, 'BareExpression', 'bare') > 0) {
      problems.push('as a bare expression: parse errors');
    }
  } else if (expressionStart !== undefined && editorErrors(entry.expression, 'BareExpression', 'bare') === 0) {
    problems.push('as a bare expression: no parse errors');
  }
  return problems;
}

const failures = ENTRIES.map((entry) => ({ entry, problems: problemsOf(entry) }))
  .filter(({ problems }) => problems.length > 0);
console.log(`EFX-1: ${ENTRIES.length - failures.length} of ${ENTRIES.length} entries read as ANTLR reads them.`);
for (const { entry, problems } of failures) {
  console.error(`\n${JSON.stringify(entry.expression ?? entry.selector ?? entry.template)}`);
  problems.forEach((problem) => console.error(`  ${problem}`));
}
if (failures.length > 0) {
  process.exitCode = 1;
}
