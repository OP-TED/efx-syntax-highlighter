// How the editor runs the EFX-1 lexer (src/efx1/lexer.js): the grammar's tokens for the lexer's
// rules, kept apart from the lexer itself so that the sync can read them too, where it writes the
// TextMate grammar (scripts/sync/TextMateGrammar.js).

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

export const LEXER_OPTIONS = {
  skipTokens: SKIP_TOKENS,
  unusedTypes: UNUSED_TYPES,
  bare: { dialect: 'bare', mode: 'EXPRESSION' },
};
