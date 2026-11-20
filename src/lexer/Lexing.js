// A text as an ANTLR lexer reads it (AntlrLexer.js): from its start, token after token, each read in
// the mode on top of the lexer's stack of modes, which the token's commands then change. The text is
// read as far as asked, and what is read is kept. A token that holds a comment (a fragment rule the
// grammar names) and more is cut into pieces: its text before the comment, the comment, and the text
// after it, so that the comment, and only the comment, can be shown as one.
//
// The text is the parts of a document a parse reads (its ranges), one after the other, as ANTLR would
// read them; positions in it are offsets from its start, which `offsetOf` gives for a position in the
// document.

import { AntlrLexer } from './AntlrLexer.js';

// The end of the text, as the lexer reads it.
const END = -1;

// How much of the text is read in one go.
const CHUNK = 4096;

/**
 * The parts of a document, one after the other, read in chunks through a function that gives the
 * text between two positions of the document. A part may run to the end of the document.
 */
class Reader {
  #read;
  #ranges;
  #text = '';
  // The part being read, and the position in the document where its next chunk starts.
  #range = 0;
  #position;

  constructor(read, ranges) {
    this.#read = read;
    this.#ranges = ranges;
    this.#position = ranges[0]?.from ?? 0;
  }

  /** The code of the character at an offset of the text, or -1 past its end. */
  characterAt(offset) {
    while (offset >= this.#text.length && this.#range < this.#ranges.length) {
      const { to } = this.#ranges[this.#range];
      const chunk = this.#read(this.#position, Math.min(to, this.#position + CHUNK));
      this.#text += chunk;
      this.#position += chunk.length;
      if (this.#position >= to || chunk.length < Math.min(CHUNK, to - (this.#position - chunk.length))) {
        this.#range += 1;
        this.#position = this.#ranges[this.#range]?.from;
      }
    }
    return offset < this.#text.length ? this.#text.charCodeAt(offset) : END;
  }

  /** The offset in the text of a position of the document, in one of the parts. */
  offsetOf(position) {
    let before = 0;
    for (const { from, to } of this.#ranges) {
      if (position <= to) {
        return before + position - from;
      }
      before += to - from;
    }
    return before;
  }
}

/**
 * A stretch of the text as the lexer reads it: a token, or the text it skips after an error (no
 * token); where it starts and ends; how far the lexer read to decide it; and the stack of modes
 * after it. A token that holds a comment has its pieces.
 */
class Stretch {
  constructor(start, end, token, extent, modes, pieces) {
    this.start = start;
    this.end = end;
    this.token = token;
    this.extent = extent;
    this.modes = modes;
    this.pieces = pieces;
  }
}

export class Lexing {
  #lexer;
  #reader;
  // The stretches read so far, in order, and each by where it starts.
  #stretches = [];
  #byStart = new Map();
  // The stretches with pieces, by where each of their pieces but the first starts.
  #byPieceStart = new Map();
  // The stack of modes at the start of the text, and after what is read so far.
  #startModes;
  #modes;
  #position = 0;
  // The fragment rule that is a comment inside a token, and for each mode the rules that use it.
  #comment;
  #rulesWithComments = new Map();
  // Whether a comment can start with a character, by the character.
  #commentStarts = new Map();

  /**
   * The reading of a text by a lexer, the text being some parts (ranges) of a document that
   * `read(from, to)` gives, from a stack of modes; `comment` names the fragment rule that is a
   * comment inside a token, if any.
   */
  constructor(lexer, read, ranges, modes, comment) {
    this.#lexer = lexer;
    this.#reader = new Reader(read, ranges);
    this.#startModes = modes;
    this.#modes = modes;
    this.#comment = comment;
  }

  /** The offset in the text of a position of the document, in one of the parts read. */
  offsetOf(position) {
    return this.#reader.offsetOf(position);
  }

  /** The stretch that starts at a position, read if need be; undefined if none starts there. */
  stretchAt(position) {
    this.#readTo(position);
    return this.#byStart.get(position);
  }

  /**
   * The stretch that has a piece starting at a position, read if need be, and that piece: the whole
   * stretch, for one without pieces; undefined if none starts there.
   */
  pieceAt(position) {
    this.#readTo(position);
    const stretch = this.#byStart.get(position) ?? this.#byPieceStart.get(position);
    if (stretch === undefined) {
      return undefined;
    }
    const piece = stretch.pieces?.find(({ start }) => start === position)
      ?? { start: stretch.start, end: stretch.end, kind: 'token' };
    return { stretch, piece };
  }

  /** The stretch after another, read if need be; undefined at the end of the text. */
  stretchAfter(stretch) {
    return this.stretchAt(stretch.end);
  }

  /**
   * The stack of modes at a position: after the stretch that ends there, or at the start; undefined
   * if the position is inside a stretch.
   */
  modesAt(position) {
    this.#readTo(position);
    if (position === 0) {
      return this.#startModes;
    }
    return this.stretchEndingAt(position)?.modes;
  }

  /** The stretch that ends at a position, read if need be; undefined if none ends there. */
  stretchEndingAt(position) {
    this.#readTo(position);
    const stretch = this.#stretches.findLast(({ end }) => end <= position);
    return stretch?.end === position ? stretch : undefined;
  }

  /** The tokens of the whole text, as ANTLR's lexer gives them, the skipped ones left out, and its errors. */
  static tokensOf(lexer, text) {
    const lexing = new Lexing(lexer, (from, to) => text.slice(from, to), [{ from: 0, to: text.length }], ['DEFAULT_MODE']);
    lexing.#readTo(text.length);
    const tokens = lexing.#stretches.filter(({ token }) => token !== undefined && !token.skipped)
      .map(({ start, end, token }) => ({ type: token.type, text: text.slice(start, end), start, hidden: token.hidden }));
    const errors = lexing.#stretches.filter(({ token }) => token === undefined).map(({ start }) => start);
    return { tokens, errors };
  }

  /** Reads stretches until one starts after a position, or the text ends. */
  #readTo(position) {
    while (this.#position <= position) {
      const start = this.#position;
      const characterAt = (offset) => this.#reader.characterAt(start + offset);
      if (characterAt(0) === END) {
        return;
      }
      const mode = this.#modes.at(-1);
      const { token, length, extent } = this.#lexer.match(mode, characterAt);
      const modes = token === undefined ? this.#modes : AntlrLexer.modesAfter(this.#modes, token.commands);
      const pieces = token === undefined ? undefined : this.#piecesOf(mode, token, start, length, characterAt);
      // A stack popped empty stays as it was: ANTLR's lexer would stop there.
      const stretch = new Stretch(start, start + length, token, extent, modes.length === 0 ? this.#modes : modes,
        pieces);
      this.#stretches.push(stretch);
      this.#byStart.set(start, stretch);
      pieces?.slice(1).forEach((piece) => this.#byPieceStart.set(piece.start, stretch));
      this.#modes = stretch.modes;
      this.#position = stretch.end;
    }
  }

  /**
   * The pieces of a token of a rule that can hold a comment: the text before the comment (the token
   * itself, or blanks in a token the lexer skips or hides), the comment, and the text after it, each
   * if it is there. A token the lexer skips or hides with no comment is one piece of blanks; a token
   * the parser takes with no comment has no pieces.
   */
  #piecesOf(mode, token, start, length, characterAt) {
    if (this.#comment === undefined || !this.#usesComment(mode, token.rule)) {
      return undefined;
    }
    const hidden = token.skipped || token.hidden;
    const span = this.#mayHoldComment(characterAt, length)
      ? this.#lexer.spanOf(characterAt, { rule: token.rule, length }, this.#comment) : undefined;
    if (span === undefined) {
      return hidden ? [{ start, end: start + length, kind: 'space' }] : undefined;
    }
    return [
      { start, end: start + span.from, kind: hidden ? 'space' : 'token' },
      { start: start + span.from, end: start + span.to, kind: 'comment' },
      { start: start + span.to, end: start + length, kind: 'space' },
    ].filter((piece) => piece.end > piece.start);
  }

  /** Whether a text holds a character a comment can start with, which a comment needs. */
  #mayHoldComment(characterAt, length) {
    for (let offset = 0; offset < length; offset += 1) {
      const character = characterAt(offset);
      if (!this.#commentStarts.has(character)) {
        this.#commentStarts.set(character, this.#lexer.canStart(this.#comment, character));
      }
      if (this.#commentStarts.get(character)) {
        return true;
      }
    }
    return false;
  }

  #usesComment(mode, rule) {
    if (!this.#rulesWithComments.has(mode)) {
      this.#rulesWithComments.set(mode, new Set(this.#lexer.rulesUsing(mode, this.#comment)));
    }
    return this.#rulesWithComments.get(mode).has(rule);
  }
}
