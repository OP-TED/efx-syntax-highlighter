// The EFX-1 lexer: ANTLR's lexer of EfxLexer.g4 of the SDK 1, run from its table
// (generated/lexer.js) as the tokenizer and the context of grammar/efx1.grammar
// (src/lexer/EditorLexer.js).

import { editorLexer } from '../lexer/EditorLexer.js';
import { lexerTable } from './generated/lexer.js';
import * as terms from './parser.terms.js';

// The grammar's skip token for each rule the lexer skips or hides.
const SKIP_TOKENS = { Comment: 'Comment', EmptyLine: 'space', SWS: 'space', EndOfLineComment: 'Comment', WS: 'space' };

/**
 * The token types the grammar takes in no rule: words Efx.g4 never uses, a time zone on its own, and
 * the types of rules that never make a token, since a rule before them always matches the same text.
 */
export const UNUSED_TYPES = ['ValueKeyword', 'Codelist', 'Self', 'Parent', 'ZONE', 'Colon', 'IdentifierPart',
  'Preceding', 'Following', 'PrecedingSibling', 'FollowingSibling', 'Ancestor', 'AncestorOrSelf', 'Descendant',
  'DescendantOrSelf', 'Child', ...['BT', 'FIELD', 'NODE', 'DISPLAY_GROUP', 'VIEW_TEMPLATE', 'NOTICE', 'CODE_LIST',
    'CODE', 'INDICATOR', 'AUXILIARY', 'RULE', 'EXPRESSION', 'INTERVAL', 'PATTERN'].map((name) => `ASSET_TYPE_${name}`),
  ...['NAME', 'WHEN_TRUE', 'WHEN_FALSE', 'DESCRIPTION', 'TOOLTIP', 'TEXT', 'TEMPLATE'].map((name) => `LABEL_TYPE_${name}`)];

export const { lexerModes } = editorLexer(lexerTable, terms, {
  skipTokens: SKIP_TOKENS,
  unusedTypes: UNUSED_TYPES,
  bare: { dialect: 'bare', mode: 'EXPRESSION' },
});
