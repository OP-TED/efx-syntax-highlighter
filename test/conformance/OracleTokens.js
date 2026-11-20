// The oracle's side of the conformance test: the tokens an ANTLR lexer makes of a text, by default
// the EFX-2 lexer.

import { CharStream, Token } from 'antlr4ng';
import { EfxLexer } from '../efx2/oracle/EfxLexer.js';

export class OracleTokens {
  /**
   * The tokens of a text on the lexer's default channel, in order, each with its name, its text
   * and its start. Tokens on another channel (spaces in expressions, skipped spaces, comments and
   * empty lines) are left out. ANTLR counts positions in characters and the editor in UTF-16 units,
   * so the starts are given in UTF-16 units.
   */
  static of(text, Lexer = EfxLexer) {
    const lexer = new Lexer(CharStream.fromString(text));
    const offsets = OracleTokens.utf16Offsets(text);
    return lexer.getAllTokens()
      .filter((token) => token.channel === Token.DEFAULT_CHANNEL)
      .map((token) => ({
        name: Lexer.vocabulary.getSymbolicName(token.type),
        text: token.text,
        start: offsets[token.start],
      }));
  }

  /** The names of all the token kinds the lexer can make. */
  static kinds(Lexer = EfxLexer) {
    const { vocabulary } = Lexer;
    return Array.from({ length: vocabulary.maxTokenType }, (_, index) => vocabulary.getSymbolicName(index + 1));
  }

  /** For each character of a text, the position of its first UTF-16 unit. */
  static utf16Offsets(text) {
    const offsets = [];
    let offset = 0;
    for (const character of text) {
      offsets.push(offset);
      offset += character.length;
    }
    offsets.push(offset);
    return offsets;
  }
}
