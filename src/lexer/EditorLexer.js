// An ANTLR lexer (AntlrLexer.js) as the tokenizer of an editor's grammar. The lexer reads the text on
// its own, from its start, as ANTLR's does (Lexing.js), whatever the parser makes of the tokens: the
// tokenizer gives the parser the token the lexer read at the parser's position. As a token depends on
// all the text before it, through the lexer's modes, a parse may reuse an earlier tree only before
// the first change to the text, and the lexer reads the parts of the document the parse reads as one
// text (EditorParser.js).
//
// A token of a type the grammar declares is that token of the grammar, or the token the grammar
// names for its type, where a rule of the grammar has the type's name. A token the lexer skips or
// hides (-> skip, -> channel(...)) is one of the grammar's skip tokens, named for each such rule. A
// type the grammar takes in no rule is listed as unused: the tokenizer gives no token there, so the
// parser reports an error, as ANTLR's parser would. A type that is neither declared nor listed is
// reported when the lexer first makes it. Where the lexer finds no token, the tokenizer gives none
// either, and the parser reports the error.
//
// Where an LR parser must see past a token to know what it is, the grammar may give the token a term
// of its own for when a given type follows it (`followedBy`): the tokenizer looks at the next token
// the lexer read, past the ones it skips or hides. A token that holds a comment and more is given as
// its pieces (Lexing.js): the token, or blanks, before the comment; the comment; the blanks and line
// ends after it.
//
// A bare expression has no lines: in the grammar's `bare` dialect, the lexer starts in the mode of
// expressions, on top of the default one.

import { ExternalTokenizer } from '@lezer/lr';
import { AntlrLexer } from './AntlrLexer.js';
import { Lexing } from './Lexing.js';
import { currentRanges } from './ParseRanges.js';

const DEFAULT_MODE = 'DEFAULT_MODE';

/**
 * The tokenizer of a grammar for a lexer's table: `terms`, the grammar's terms;
 * `skipTokens`, the grammar's skip token for each rule the lexer skips or hides, by its name;
 * `typeTokens`, the grammar's token for each type it does not name after the type; `followedBy`, for
 * a type, the grammar's token for it when a token of another type follows, by that type;
 * `unusedTypes`, the types the grammar takes in no rule; `comment`, the lexer's fragment rule of a
 * comment, and `commentToken` and `spaceToken`, the grammar's skip tokens for the comment and the
 * blanks of a token that holds one; `bare`, the dialect of a bare expression and the mode its text starts in.
 */
export function editorLexer(table, terms, options) {
  const { skipTokens, typeTokens = {}, followedBy = {}, unusedTypes, comment, commentToken, spaceToken, bare } = options;
  const lexer = new AntlrLexer(table);
  const unused = new Set(unusedTypes);
  // The lexer's reading of each parse's input, by the input and the dialect.
  const readings = new WeakMap();

  /** The lexer's reading of the input a tokenizer or a context tracker is given, for a parse stack. */
  const lexingOf = (input, stack) => {
    const isBare = bare !== undefined && stack.dialectEnabled(terms[`Dialect_${bare.dialect}`]);
    if (!readings.has(input)) {
      readings.set(input, new Map());
    }
    const byDialect = readings.get(input);
    if (!byDialect.has(isBare)) {
      byDialect.set(isBare, new Lexing(lexer, (from, to) => input.read(from, to), currentRanges(),
        isBare ? [DEFAULT_MODE, bare.mode] : [DEFAULT_MODE], comment));
    }
    return byDialect.get(isBare);
  };

  /** The grammar's term for a token: a term, or null for a type the grammar takes in no rule. */
  const termOf = (token) => {
    if (token.skipped || token.hidden) {
      const term = terms[skipTokens[token.rule]];
      if (term === undefined) {
        throw new Error(`The lexer skips or hides the tokens of ${token.rule}, which has no skip token in the grammar`);
      }
      return term;
    }
    if (unused.has(token.type)) {
      return null;
    }
    const term = terms[typeTokens[token.type] ?? token.type];
    if (term === undefined) {
      throw new Error(`The lexer makes tokens of type ${token.type}, which the grammar does not declare`);
    }
    return term;
  };

  /** The type of the token the parser takes after a stretch, past those the lexer skips or hides. */
  const nextType = (lexing, stretch) => {
    let next = lexing.stretchAfter(stretch);
    while (next?.token !== undefined && (next.token.skipped || next.token.hidden)) {
      next = lexing.stretchAfter(next);
    }
    return next?.token?.type;
  };

  /**
   * What the tokenizer gives at a position: the stretch the lexer read there, the piece of it that
   * starts there (the whole token, if it has no pieces) and the grammar's term for it; undefined
   * where the lexer read no token, or the type is one the grammar takes in no rule.
   */
  const tokenAt = (lexing, position) => {
    const { stretch, piece } = lexing.pieceAt(position) ?? {};
    if (stretch?.token === undefined) {
      return undefined;
    }
    if (piece.kind === 'comment') {
      return { stretch, piece, term: terms[commentToken] };
    }
    if (piece.kind === 'space') {
      return { stretch, piece, term: terms[spaceToken] };
    }
    const term = termOf(stretch.token);
    const other = followedBy[stretch.token.type]?.[nextType(lexing, stretch)];
    if (term === null) {
      return undefined;
    }
    return { stretch, piece, term: other === undefined ? term : terms[other] };
  };

  const lexerModes = new ExternalTokenizer((input, stack) => {
    const lexing = lexingOf(input, stack);
    const offset = lexing.offsetOf(input.pos);
    const found = tokenAt(lexing, offset);
    if (found === undefined) {
      return;
    }
    const { stretch, piece, term } = found;
    // The token depends on the text the lexer read to decide it.
    input.peek(stretch.start + stretch.extent - 1 - offset);
    input.acceptToken(term, piece.end - piece.start);
  }, { contextual: true });

  /** The name of the mode the lexer is in where a parse stack stands, in the input given. */
  const modeAt = (input, stack) => {
    const lexing = lexingOf(input, stack);
    return lexing.modesAt(lexing.offsetOf(stack.pos))?.at(-1);
  };

  return { lexerModes, modeAt };
}
