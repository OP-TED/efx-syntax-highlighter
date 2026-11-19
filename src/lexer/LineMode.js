// DEFAULT mode, between lines and at their start. Blanks indent a line (the grammar's own Tabs,
// Spaces and MixedIndent) unless a comment or a line end follows them (EmptyOrCommentLine), or they
// follow a `;`, after which the lexer skips one run of whitespace (SKIP_WHITESPACE): those blanks
// are hidden, and so are line ends. A comment is hidden only before a line end (EmptyOrCommentLine,
// SkippedComment), except on the line of a template's `;`, which takes it (EndTemplate). A word is
// one of the line words; DISPLAY takes the whitespace after it, which must be there. `#include` and
// the blanks after it are an IncludeDirective, which only this mode reads. Directly after a `;`, the
// lexer is still skipping whitespace and has found none (SKIP_WHITESPACE): it reads only the words of
// that mode there, and no IncludeDirective.

import * as terms from '../efx-parser.terms.js';
import { lineTokens, skipWhitespaceTokens } from '../generated/words.js';
import { LINE_START, TEMPLATE_SEMICOLON } from './LexerContext.js';
import { LexerMode } from './LexerMode.js';
import { ReservedWords } from './ReservedWords.js';

export class LineMode extends LexerMode {
  static #words = new ReservedWords(lineTokens);
  static #skipWhitespaceWords = new ReservedWords(skipWhitespaceTokens);

  /** At the start of a line (LexerContext.js), or where the parser can take a line's indentation. */
  isActive(stack) {
    return stack.context === LINE_START || stack.context === TEMPLATE_SEMICOLON || stack.canShift(terms.Tabs);
  }

  hide(input, stack) {
    if (input.isComment(0)) {
      const length = input.commentLength(0);
      const afterTemplate = stack.context === TEMPLATE_SEMICOLON && input.followsSemicolon(0);
      return (input.isLineEnd(length) || afterTemplate) && input.take(terms.Comment, length);
    }
    const blanks = input.blanks(0);
    if (blanks > 0 && (input.isSemicolon(-1) || input.isComment(blanks) || input.isLineEnd(blanks))) {
      return input.take(terms.space, blanks);
    }
    return input.take(terms.space, input.lineEnds(0));
  }

  read(input) {
    if (input.isSemicolon(-1)) {
      const word = LineMode.#skipWhitespaceWords.wordAt(input, 0);
      if (word !== undefined) {
        input.accept(word.token, word.length);
      }
      return;
    }
    if (input.take(terms.IncludeDirective, input.includeDirectiveLength())) {
      return;
    }
    const word = LineMode.#words.wordAt(input, 0);
    if (word === undefined) {
      return;
    }
    if (word.token !== terms.Display) {
      input.accept(word.token, word.length);
      return;
    }
    const whitespace = input.whitespace(word.length);
    if (whitespace > 0) {
      input.accept(word.token, word.length + whitespace);
    }
  }

  words() {
    return LineMode.#words.entries();
  }
}
