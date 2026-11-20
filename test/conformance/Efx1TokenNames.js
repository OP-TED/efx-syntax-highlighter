// The table of token names of EFX-1: the EFX-1 grammar names each token as EfxLexer.g4 of the SDK 1
// does (grammar/efx1.grammar), so every type is named the same on both sides, but the types the
// grammar takes in no rule, of which the editor makes no token (UNUSED_TYPES in the lexer).

import { UNUSED_TYPES } from '../../dist/efx1/lexer.js';

export class Efx1TokenNames {
  /** Whether the table has a row for a type of token: every type has one. */
  static has() {
    return true;
  }

  /** The editor's node for a type of token: its own name, or null when the grammar has no node for it. */
  static editorNameOf(oracleName) {
    return UNUSED_TYPES.includes(oracleName) ? null : oracleName;
  }
}
