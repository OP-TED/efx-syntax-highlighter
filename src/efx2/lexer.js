// The EFX-2 lexer: ANTLR's lexer of EfxLexer.g4 of the SDK, run from its table (generated/lexer.js)
// as the tokenizer of grammar/efx2.grammar (src/lexer/EditorLexer.js).

import { editorLexer } from '../lexer/EditorLexer.js';
import { lexerTable } from './generated/lexer.js';
import * as terms from './parser.terms.js';

// The grammar's skip token for each rule the lexer skips or hides. A token of a rule that can hold a
// comment is cut into the comment and blanks (comment, below), whatever its rule's skip token.
const SKIP_TOKENS = {
  EmptyOrCommentLine: 'Comment',
  SkippedComment: 'Comment',
  SkippedWhitespace: 'space',
  LineJoining: 'space',
  EndOfLineComment: 'Comment',
  FormatWhitespace: 'space',
  ExpressionComment: 'Comment',
  WS: 'space',
};

// The grammar's token for each type it does not name after the type: a rule of the grammar has that
// name, and holds the token, as in ANTLR's tree.
const TYPE_TOKENS = { ShorthandIndirectLabelReferenceFromContextField: 'sharpValue' };

// The grammar's token for a slash that an `@` follows: at the slash, an LR parser must know whether it
// divides or starts an attribute, which ANTLR's parser finds by looking further.
const FOLLOWED_BY = { Slash: { AtPrefix: 'AttributeSlash' } };

/**
 * The token types the grammar takes in no rule: words Efx.g4 never uses, the types of rules that
 * never make a token, since a rule before them always matches the same text, and CRLF, which the
 * lexer makes only to end a template line that lacks its semicolon, an error for both parsers.
 */
export const UNUSED_TYPES = ['ValueKeyword', 'Codelist', 'Code', 'FieldIdentifier', 'NodeIdentifier', 'CRLF',
  ...['BT', 'FIELD', 'NODE', 'DISPLAY_GROUP', 'VIEW_TEMPLATE', 'NOTICE', 'AUXILIARY', 'RULE', 'EXPRESSION', 'INTERVAL',
    'PATTERN'].map((name) => `ASSET_TYPE_${name}`),
  ...['NAME', 'WHEN_TRUE', 'WHEN_FALSE', 'DESCRIPTION', 'TOOLTIP', 'TEMPLATE'].map((name) => `LABEL_TYPE_${name}`)];

export const { lexerModes, modeAt } = editorLexer(lexerTable, terms, {
  skipTokens: SKIP_TOKENS,
  typeTokens: TYPE_TOKENS,
  followedBy: FOLLOWED_BY,
  unusedTypes: UNUSED_TYPES,
  // Comments are a fragment of several rules: of lines, of the `;` that ends a template, of the path
  // of an include, and of expressions.
  comment: 'COMMENT',
  commentToken: 'Comment',
  spaceToken: 'space',
  bare: { dialect: 'bare', mode: 'EXPRESSION' },
});
