// The EFX-1 lexer: ANTLR's lexer of EfxLexer.g4 of the SDK 1, run from its table
// (generated/lexer.js) as the tokenizer and the context of grammar/efx1.grammar
// (src/lexer/EditorLexer.js).

import { editorLexer } from '../lexer/EditorLexer.js';
import { lexerTable } from './generated/lexer.js';
import { LEXER_OPTIONS } from './lexerOptions.js';
import * as terms from './parser.terms.js';

export { UNUSED_TYPES } from './lexerOptions.js';

export const { lexerModes } = editorLexer(lexerTable, terms, LEXER_OPTIONS);
