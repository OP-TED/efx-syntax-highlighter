// The pattern of a token rule, or of one of its words, for a TextMate grammar (TextMateGrammar.js),
// written so that it matches only where ANTLR's lexer would read that token: where neither the rule
// itself nor a rule that the grammar may try after it (its rivals) could read a longer one from the
// same place, and where no rule that wins a tie against it, and that the grammar may try after it,
// reads the same token. A TextMate grammar takes the first pattern that matches, ANTLR's lexer the
// longest token, and on a tie the rule written first: a rule tried before it that could read a
// longer token there matches first.
//
// The pattern is followed by a lookahead that refuses what the rule and its rivals could go on with
// after its match: what is left of each once it has read the match (uniformQuotient). That is right
// when what is left of each is the same after every match of the pattern, as it is for a word. When
// it is not, as for free text, after which a comment could go on only where the text starts with
// //, or for mixed indentation, which can go on with a space after some matches only, the matches
// are cut by the state they end in, of the rule and of each rival, and those that end with the same
// lookahead are written together, followed by it (#statePatterns). The pattern then matches exactly
// where the lexer reads the token. As these parts are written anew from the states, they lose the
// captures of the expression, such as the comment of a template's last semicolon: a part that holds
// some is cut by its options and optional items instead, and refused where that is not enough.

import {
  Alternation, Characters, EMPTY, END_OF_TEXT, Groups, NOTHING, Sequence, alternation, classesOf, completingCharacters,
  goesOnAfter, overlap, repetition, sequence, shortestStarts, text, uniformQuotient,
} from './RegularExpression.js';

// How many states the graph of a part may have, at most (LongestMatch #statePatterns).
const STATE_LIMIT = 2000;

/** What the rivals could go on with, as a lookahead that refuses it, or '' when they could not. */
function refusing(rests) {
  const continuations = shortestStarts(alternation(rests));
  return continuations.empty ? '' : `(?!${continuations.pattern(new Groups())})`;
}

/**
 * The two parts of an expression that a match of it takes, either one, where an optional item at its
 * start or at its end is left out or reads something, or its options: undefined for an expression
 * with none. The parts keep the captures of the expression.
 */
function optionalPartsOf(expression) {
  if (expression instanceof Alternation) {
    return expression.options;
  }
  if (expression instanceof Sequence) {
    // An item that can be left out, but reads something when it is there: not one that reads nothing, as $.
    const optional = (item) => item.nullable && !item.nonEmpty().empty;
    const { items } = expression;
    if (optional(items[0])) {
      return [sequence(items.slice(1)), sequence([items[0].nonEmpty(), ...items.slice(1)])];
    }
    if (optional(items.at(-1))) {
      return [sequence(items.slice(0, -1)), sequence([...items.slice(0, -1), items.at(-1).nonEmpty()])];
    }
  }
  return undefined;
}

/** Whether every match of an expression ends at the end of a line ($), where only a line break can follow. */
function endsAtLineEnd(expression) {
  if (expression instanceof Alternation) {
    return expression.options.every(endsAtLineEnd);
  }
  return expression === END_OF_TEXT || (expression instanceof Sequence && expression.items.at(-1) === END_OF_TEXT);
}

/**
 * The graph of states with the states that lead to the same endings, by the same characters, made
 * one (Moore's refinement): for each of them, by its first state, its edges, by the state they lead
 * to, with the ranges of characters that lead there, and its ending, if any.
 */
function merged(states, endings) {
  const tails = new Map(endings.map(({ from, tail }) => [from, tail]));
  // A state where a match ends with nothing more read is not one where none ends.
  let blockOf = new Map([...states.keys()].map((key) => [key, JSON.stringify(tails.get(key)?.pattern(new Groups()) ?? null)]));
  let blocks = new Set(blockOf.values()).size;
  for (;;) {
    const signatureOf = (key) => {
      const ranges = [...states.get(key).edges].flatMap(([to, toRanges]) => toRanges.map(([from, end]) => [from, end, blockOf.get(to)]))
        .sort(([a], [b]) => a - b)
        .reduce((runs, [from, end, block]) => {
          const last = runs.at(-1);
          if (last !== undefined && last[1] + 1 === from && last[2] === block) {
            last[1] = end;
          } else {
            runs.push([from, end, block]);
          }
          return runs;
        }, []);
      return JSON.stringify([blockOf.get(key), ranges]);
    };
    const signatures = new Map([...states.keys()].map((key) => [key, signatureOf(key)]));
    const ids = new Map([...new Set(signatures.values())].map((signature, index) => [signature, String(index)]));
    blockOf = new Map([...signatures].map(([key, signature]) => [key, ids.get(signature)]));
    if (ids.size === blocks) {
      break;
    }
    blocks = ids.size;
  }
  const graph = new Map();
  for (const [key, { edges }] of states) {
    const block = blockOf.get(key);
    if (!graph.has(block)) {
      const out = new Map();
      edges.forEach((ranges, to) => out.set(blockOf.get(to), [...(out.get(blockOf.get(to)) ?? []), ...ranges]));
      graph.set(block, { edges: out, tail: tails.get(key) });
    }
  }
  return { graph, blockOf };
}

/**
 * The expression of the texts that lead, in a graph of states, from start to the end of one of the
 * endings, each a state and an expression of what is read there: the states that lead to the same
 * endings alike are made one (merged), then eliminated one by one, those with the fewest paths
 * through them first. Each state has its edges, by the state they lead to, with the ranges of
 * characters that lead there.
 */
function pathsOf(states, start, endings) {
  const END = Symbol('end');
  const { graph, blockOf } = merged(states, endings);
  const edges = new Map([...graph].map(([block, { edges: out }]) =>
    [block, new Map([...out].map(([to, ranges]) => [to, new Characters(ranges)]))]));
  const add = (from, to, expression) => {
    const out = edges.get(from);
    out.set(to, out.has(to) ? alternation([out.get(to), expression]) : expression);
  };
  graph.forEach(({ tail }, block) => tail !== undefined && add(block, END, tail));
  const first = blockOf.get(start);
  const loopOf = (key) => {
    const loop = edges.get(key).get(key);
    return loop === undefined ? EMPTY : repetition(loop, 0, Infinity);
  };
  const into = (key) => [...edges].filter(([from, out]) => from !== key && out.has(key));
  const left = new Set([...edges.keys()].filter((key) => key !== first));
  while (left.size > 0) {
    const through = (key) => into(key).length * [...edges.get(key).keys()].filter((to) => to !== key).length;
    const key = [...left].reduce((best, candidate) => (through(candidate) < through(best) ? candidate : best));
    const loop = loopOf(key);
    const outs = [...edges.get(key)].filter(([to]) => to !== key);
    for (const [from, out] of into(key)) {
      const before = out.get(key);
      out.delete(key);
      outs.forEach(([to, after]) => add(from, to, sequence([before, loop, after])));
    }
    edges.delete(key);
    left.delete(key);
  }
  return sequence([loopOf(first), edges.get(first).get(END) ?? NOTHING]);
}

// Every character but a line break.
const NOT_LINE_BREAK = Characters.notIn([[0x0a, 0x0a]]);

export class LongestMatch {
  #expression;
  #bare;
  #rivals;
  #ties;
  // The characters that each make a whole match of what the expression itself could go on with after
  // any of its matches: as the pattern never stops before one, what a rival could go on with from
  // one of them does not matter.
  #ownContinuation;

  /**
   * The longest-match pattern of an expression, with the expressions of its rivals, and of the rules
   * that win a tie against it, which the grammar may try after it: the pattern does not match a text
   * that one of them matches too, as ANTLR reads it with that rule. An expression with options that a
   * TextMate engine, which takes the first option that matches, would end too early, as
   * 'a'+ | 'a'+ 'b' on aab, is refused, and so is one whose captures the pattern could not keep, as
   * it would colour some texts otherwise than the lexer.
   */
  constructor(expression, rivals, ties = []) {
    LongestMatch.#checkOptions(expression.bare());
    this.#expression = expression;
    this.#bare = expression.bare();
    this.#rivals = rivals;
    this.#ties = ties;
    const own = uniformQuotient(this.#bare, this.#bare);
    this.#ownContinuation = own === undefined ? new Characters([]) : completingCharacters(own);
  }

  /** Refuses an expression with an option that could go on after a whole match of an option before it. */
  static #checkOptions(expression) {
    if (expression instanceof Alternation) {
      expression.options.forEach((later, index) => expression.options.slice(0, index).forEach((earlier) => {
        if (goesOnAfter(later, earlier)) {
          throw new Error(`In ${expression.pattern(new Groups())}, ${later.pattern(new Groups())} can go on after a match of `
            + `${earlier.pattern(new Groups())}, which a TextMate engine would take instead`);
        }
      }));
    }
    for (const part of expression.parts) {
      LongestMatch.#checkOptions(part);
    }
  }

  /** The lookahead that follows a word of a rule, which has one match only, with the rule's own expression. */
  static lookaheadOfWord(word, own, rivals) {
    return refusing([own, ...rivals].map((expression) => uniformQuotient(text(word), expression)));
  }

  /**
   * The pattern; groups numbers the captures of the expression, as they are written. An expression
   * that reads nothing, which only decides what comes next, needs no lookahead: no token is longer
   * than none, and the rules that read something come before it. Undefined where no match is left,
   * as for a rule whose every token a rule that wins the tie reads too.
   */
  pattern(groups) {
    if (this.#bare.nonEmpty().empty) {
      return this.#expression.term(groups);
    }
    const parts = this.#partsOf(this.#expression, groups);
    return parts.length === 0 ? undefined : parts.join('|');
  }

  /**
   * The patterns of a part of the expression, each followed by its lookahead: the part whole, where
   * what each rival could go on with is the same after all its matches, and no rule that wins a tie
   * against it reads one of them; else the parts of its matches by the states they end in
   * (#statePatterns), or, as those lose the captures of the part, for a part that holds some, its
   * optional parts (optionalPartsOf).
   */
  #partsOf(part, groups) {
    const bare = part.bare();
    const rests = this.#restsAfter(bare, this.#bare, this.#rivals);
    const ties = this.#ties.filter((tie) => overlap(bare, tie));
    if (rests.every((rest) => rest !== undefined) && ties.length === 0) {
      return [`${part.term(groups)}${refusing(rests)}`];
    }
    const captures = new Groups();
    part.pattern(captures);
    if (captures.size === 0) {
      return this.#statePatterns(bare, ties);
    }
    const optional = optionalPartsOf(part);
    if (optional === undefined) {
      this.#refuse(part, 'keep its captures and follow what a rule could go on with after it');
    }
    return optional.flatMap((piece) => this.#partsOf(piece, groups));
  }

  /** Stops at a part of the expression that a TextMate pattern cannot follow, saying why. */
  #refuse(part, what) {
    throw new Error(`A TextMate pattern of ${part.pattern(new Groups())}, a part of ${this.#bare.pattern(new Groups())}, `
      + `cannot ${what}`);
  }

  /**
   * What the expression itself, from the given state of it, and each rival could go on with after a
   * match of rest; undefined for one that is not the same after every match.
   */
  #restsAfter(rest, own, rivals) {
    // After a match that ends at the end of a line, only a line break can follow.
    if (endsAtLineEnd(rest)) {
      return [own, ...rivals].map((expression) => uniformQuotient(rest, expression, NOT_LINE_BREAK));
    }
    return [uniformQuotient(rest, own), ...rivals.map((rival) => uniformQuotient(rest, rival, this.#ownContinuation))];
  }

  /**
   * The patterns of a part whose lookahead differs from one match to another, or that a rule that
   * wins a tie against it can read. The part is read as a graph of states, each what is left of the
   * part, of the expression itself, of each rival and of each such rule (tie) after a text that the
   * part can read the start of, from its start to the states where what each could go on with is the
   * same after every match of what is left of the part, and no tie can read on (settled). A match
   * ends either inside a settled state, as a match of what is left of the part there, or at a state
   * that is not, where the part can stop and no tie can. The matches that end with the same
   * lookahead are written as one expression, of the paths of the graph to where they end (pathsOf),
   * followed by it.
   */
  #statePatterns(part, ties) {
    const states = new Map();
    const endings = new Map();
    const ending = (key, tail, rests) => {
      const lookahead = refusing(rests);
      if (!endings.has(lookahead)) {
        endings.set(lookahead, []);
      }
      endings.get(lookahead).push({ from: key, tail });
    };
    const stateOf = (rest, own, rivals, tiesLeft) => {
      const alive = rivals.filter((rival) => !rival.empty);
      const tiesAlive = tiesLeft.filter((tie) => !tie.empty);
      const patterns = (expressions) => expressions.map((state) => state.pattern(new Groups())).join('\u0000');
      const key = `${patterns([rest, own, ...alive])}\u0001${patterns(tiesAlive)}`;
      if (!states.has(key)) {
        if (states.size === STATE_LIMIT) {
          this.#refuse(part, `be cut by the states of its matches, which are more than ${STATE_LIMIT}`);
        }
        states.set(key, { rest, own, rivals: alive, ties: tiesAlive, edges: new Map() });
        const rests = this.#restsAfter(rest, own, alive);
        if (rests.every((quotient) => quotient !== undefined) && tiesAlive.length === 0) {
          ending(key, rest, rests);
        } else {
          pending.push(key);
        }
      }
      return key;
    };
    const pending = [];
    const start = stateOf(part, this.#bare, this.#rivals, ties);
    while (pending.length > 0) {
      const key = pending.pop();
      const { rest, own, rivals, ties: tiesHere, edges } = states.get(key);
      // The match that ends here, after which the expression itself could still go on, unless a tie ends here too.
      if (rest.nullable && !tiesHere.some((tie) => tie.nullable)) {
        ending(key, EMPTY, this.#restsAfter(EMPTY, own, rivals));
      }
      // The ranges of characters that lead to the same states together.
      const codes = classesOf(rest, own, ...rivals, ...tiesHere);
      codes.forEach((from, index) => {
        const next = rest.derivative(from);
        if (!next.empty) {
          const to = stateOf(next, own.derivative(from), rivals.map((rival) => rival.derivative(from)),
            tiesHere.map((tie) => tie.derivative(from)));
          edges.set(to, [...(edges.get(to) ?? []), [from, (codes[index + 1] ?? 0x110000) - 1]]);
        }
      });
    }
    return [...endings].map(([lookahead, ends]) => `${pathsOf(states, start, ends).term(new Groups())}${lookahead}`);
  }
}
