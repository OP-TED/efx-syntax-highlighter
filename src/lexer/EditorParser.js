// The parser of an EFX language in an editor, around the LR parser of its grammar. A token of an
// ANTLR lexer depends on all the text before it, through the lexer's modes (EditorLexer.js), so:
//
// - a parse reuses the parts of an earlier tree only before the first change to the text: the
//   fragments that run on from the start of the text with no change in them. After a change, the same
//   text may be read in other modes, so no part of the earlier tree after it can be trusted;
// - nor after the first error in the earlier tree: the parser recovers from an error by trying
//   several ways on at once, and which one it keeps depends on the text after the error, so the tree
//   after an error is not what a parse from scratch would make of the changed text;
// - the lexer must know which parts of the document a parse reads (its ranges), to read them as one
//   text, as ANTLR would: the parse makes them known to it while it runs (ParseRanges.js).

import { Parser, TreeFragment } from '@lezer/common';
import { withRanges } from './ParseRanges.js';

/** A parse that makes its ranges known to the lexer while it runs. */
class RangedParse {
  #parse;
  #ranges;

  constructor(parse, ranges) {
    this.#parse = parse;
    this.#ranges = ranges;
  }

  advance() {
    return withRanges(this.#ranges, () => this.#parse.advance());
  }

  get parsedPos() {
    return this.#parse.parsedPos;
  }

  stopAt(pos) {
    this.#parse.stopAt(pos);
  }

  get stoppedAt() {
    return this.#parse.stoppedAt;
  }
}

export class EditorParser extends Parser {
  #parser;

  /** The LR parser that does the parsing. */
  constructor(parser) {
    super();
    this.#parser = parser;
  }

  createParse(input, fragments, ranges) {
    const reused = EditorParser.#beforeFirstError(EditorParser.#unchangedStart(fragments));
    return new RangedParse(this.#parser.createParse(input, reused, ranges), ranges);
  }

  /**
   * The fragments of earlier trees with no change in or before them: those that run on, one after the
   * other, from the start of the text, where a change would have cut them apart or moved them.
   */
  static #unchangedStart(fragments) {
    const kept = [];
    let end = 0;
    for (const fragment of fragments) {
      if (fragment.from !== end || fragment.offset !== 0 || fragment.openStart) {
        break;
      }
      kept.push(fragment);
      end = fragment.to;
    }
    return kept;
  }

  /** The fragments, cut where the first of them that holds an error has its first error. */
  static #beforeFirstError(fragments) {
    const kept = [];
    for (const fragment of fragments) {
      const error = EditorParser.#firstError(fragment);
      if (error === undefined) {
        kept.push(fragment);
        continue;
      }
      if (error > fragment.from) {
        kept.push(new TreeFragment(fragment.from, error, fragment.tree, fragment.offset, fragment.openStart, true));
      }
      break;
    }
    return kept;
  }

  /** Where the first error in a fragment's part of its tree starts, if it has one. */
  static #firstError(fragment) {
    let error;
    fragment.tree.iterate({
      from: fragment.from - fragment.offset,
      to: fragment.to - fragment.offset,
      enter: (node) => {
        if (error !== undefined) {
          return false;
        }
        if (node.type.isError) {
          error = Math.max(fragment.from, node.from + fragment.offset);
          return false;
        }
        return undefined;
      },
    });
    return error;
  }
}
