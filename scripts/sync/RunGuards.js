// The guards that keep a pattern of a TextMate grammar (TextMateGrammar.js) from being tried inside a
// run of the characters it starts with. A TextMate engine looks for each pattern from where it is on a
// line to the end of the line, and, on a long line (from 1,000 bytes, with vscode-oniguruma), for each
// pattern apart. A pattern that can start with a run of some characters does not stop inside it, as
// it does not stop where its rule could read on (LongestMatch.js). Where what follows the run does not
// let it match, as a line break must follow the blanks of an empty line, or as another rule that reads
// the run could go on there, it reads the rest of the run again from each of its characters before it
// fails, which takes a time that grows with the square of the length of the run. Behind the guard (?!(?<=R)R), the pattern fails at once between two of
// the characters R.
//
// Where the engine starts, the guard keeps the pattern from matching only between two of R, so it
// leaves out each pair of characters between which the rule could begin a token. A token begins
// there only after another that ends there, in a mode that the pattern is tried in. After a match of
// a rule, no token ends before a character that a rule of its mode could read one more of, as the
// lexer would read a longer token; nor where the rule stays in the mode of the pattern's rule, and
// the two matches together make one of the pattern's rule, which the lexer would read from the start
// of the first. The same holds for the other matches that the grammar makes inside a token (splits),
// as the start of a token that a line break cuts (LineBreakCuts.js). Further on, the guard does not
// matter in a text that the lexer reads: a pattern matches where the engine starts, and the engine
// takes it.

import { Characters, Groups, classesOf, sequence } from './RegularExpression.js';

// The line break that ends each line a TextMate engine reads, after the match of a $.
const LINE_BREAK = 0x0a;

// The characters that end a line in an editor, which no run goes on after.
const LINE_ENDS = [[0x0a, 0x0a], [0x0d, 0x0d]];

const MAX_CODE_POINT = 0x10ffff;

/** The classes of characters that expressions read alike, each as the range [from, to]. */
function rangesOf(...expressions) {
  const codes = classesOf(...expressions);
  return codes.map((from, index) => [from, (codes[index + 1] ?? MAX_CODE_POINT + 1) - 1]);
}

/** The characters of both sets. */
function intersection(first, second) {
  return new Characters(first.ranges.flatMap(([from, to]) => second.ranges
    .map(([otherFrom, otherTo]) => [Math.max(from, otherFrom), Math.min(to, otherTo)])
    .filter(([start, end]) => start <= end)));
}

/** The key of states of expressions, which are the same when they are written the same. */
function keyOf(expressions) {
  return expressions.map((expression) => expression.pattern(new Groups())).join('\u0000');
}

/**
 * The states that an expression goes through as it reads a run of one character: those it reads it
 * in again and again, undefined where it cannot read a run of it as long as any.
 */
function loopOf(expression, code) {
  const seen = new Map();
  let state = expression.derivative(code);
  while (!state.empty) {
    const key = keyOf([state]);
    if (seen.has(key)) {
      const states = [...seen.values()];
      return states.slice(states.indexOf(seen.get(key)));
    }
    seen.set(key, state);
    state = state.derivative(code);
  }
  return undefined;
}

/**
 * The characters that an expression can read a run of, as long as any, from its start, where its
 * pattern may then fail: where the expression must read something else after the run, or where a
 * rival, or a rule that wins a tie against it, reads the run too and could go on after it, which the
 * pattern's lookahead refuses (LongestMatch.js). The pattern never stops inside such a run, as it
 * does not stop where the expression could read on. Those that end a line are left out, as no run
 * goes on after them.
 */
function runCharactersOf(expression, rivals) {
  const ranges = rangesOf(expression, ...rivals).filter(([from]) => {
    const loop = loopOf(expression, from);
    return loop !== undefined
      && (loop.some((state) => !state.nullableInLine) || rivals.some((rival) => loopOf(rival, from) !== undefined));
  });
  return intersection(new Characters(ranges), Characters.notIn(LINE_ENDS));
}

/** Whether every text that one expression matches, another matches too. */
function includes(bigger, smaller) {
  const seen = new Set();
  const pending = [[smaller, bigger]];
  while (pending.length > 0) {
    const [smallerRest, biggerRest] = pending.pop();
    if (smallerRest.nullable && !biggerRest.nullable) {
      return false;
    }
    const key = keyOf([smallerRest, biggerRest]);
    if (!seen.has(key)) {
      seen.add(key);
      for (const [from] of rangesOf(smallerRest, biggerRest)) {
        const next = smallerRest.derivative(from);
        if (!next.empty) {
          pending.push([next, biggerRest.derivative(from)]);
        }
      }
    }
  }
  return true;
}

export class RunGuards {
  // The rules of each mode, and the other matches that the grammar makes inside a token (splits).
  #modes;
  #splits;
  // The modes that can be under each mode on the stack of modes.
  #below = new Map();
  // The places where a token, or another match that the grammar makes, can end: each with the
  // characters it can end with (last), the characters that can follow it there (next), the modes the
  // next token can be read in (follows), and, for a rule that changes no mode, its mode and its
  // expression (stays).
  #ends = [];

  /**
   * The guards of a grammar, from the rules of each of its modes, and the splits, each with its mode,
   * its expression, its mode change and the characters that can follow it.
   */
  constructor(modes, splits) {
    this.#modes = modes;
    this.#splits = splits;
    this.#findModesBelow();
    for (const [mode, rules] of modes) {
      const expressions = rules.map((rule) => rule.expression.bare());
      rules.forEach((rule, index) => {
        const { leaves, enters } = rule.modeChange;
        const stays = leaves === 0 && enters.length === 0 ? { mode, expression: expressions[index] } : undefined;
        this.#addEndsOf(expressions[index], expressions, { follows: this.#modesAfter(rule), stays });
      });
    }
    for (const split of splits) {
      this.#addEndsOf(split.expression, [], { follows: this.#modesAfter(split), following: split.next });
    }
  }

  /**
   * The guard that a pattern of an expression of a rule of a mode starts with, where the pattern is
   * tried in the given modes, with the expressions of its rivals and of the rules that win a tie
   * against it: for each character of a run, the characters of the run after it, but those before
   * which the rule could begin a token; '' where there are none.
   */
  guardOf(expression, mode, triedIn, rivals) {
    const run = runCharactersOf(expression, rivals);
    const joined = new Map();
    const blockers = this.#ends.filter(({ last, next, follows, stays }) => !intersection(last, run).empty
      && !intersection(next, run).empty && [...triedIn].some((tried) => follows.has(tried))
      && !(stays?.mode === mode && this.#joins(stays.expression, expression, joined)));
    const afterEach = new Map();
    const classes = rangesOf(run, ...blockers.flatMap(({ last, next }) => [last, next])).filter(([code]) => run.contains(code));
    for (const [from, to] of classes) {
      const begins = blockers.filter(({ last }) => last.contains(from)).flatMap(({ next }) => next.ranges);
      const after = intersection(run, Characters.notIn(begins));
      if (!after.empty) {
        const key = after.pattern(new Groups());
        afterEach.set(key, { after, before: [...(afterEach.get(key)?.before ?? []), [from, to]] });
      }
    }
    const pairs = [...afterEach.values()].map(({ after, before }) =>
      `(?<=${new Characters(before).pattern(new Groups())})${after.pattern(new Groups())}`);
    return pairs.length === 0 ? '' : `(?!${pairs.join('|')})`;
  }

  /**
   * Whether a match of an expression followed by a match of another is always a match of the other,
   * as the lexer would then read the two as one token; the answers kept in joined.
   */
  #joins(first, second, joined) {
    if (!joined.has(first)) {
      joined.set(first, includes(second, sequence([first, second])));
    }
    return joined.get(first);
  }

  /** Finds the modes that can be under each mode, from the modes that the rules and splits enter. */
  #findModesBelow() {
    const changes = [...[...this.#modes].flatMap(([, rules]) => rules), ...this.#splits];
    let added = true;
    while (added) {
      added = false;
      for (const { mode, modeChange: { leaves, enters } } of changes) {
        let under = leaves === 1 ? [...(this.#below.get(mode) ?? [])] : [mode];
        for (const entered of enters) {
          if (!this.#below.has(entered)) {
            this.#below.set(entered, new Set());
          }
          const below = this.#below.get(entered);
          under.filter((other) => !below.has(other)).forEach((other) => {
            below.add(other);
            added = true;
          });
          under = [entered];
        }
      }
    }
  }

  /**
   * The modes that the next token can be read in after a rule or a split: the mode it leaves the
   * stack with, and those that tokens that read nothing lead to from there.
   */
  #modesAfter(change) {
    const topsAfter = ({ mode, modeChange: { leaves, enters } }) => {
      if (enters.length > 0) {
        return [enters.at(-1)];
      }
      return leaves === 1 ? [...(this.#below.get(mode) ?? [])] : [mode];
    };
    const modes = new Set(topsAfter(change));
    const pending = [...modes];
    while (pending.length > 0) {
      for (const rule of this.#modes.get(pending.pop()) ?? []) {
        if (rule.expression.bare().nonEmpty().empty) {
          topsAfter(rule).filter((mode) => !modes.has(mode)).forEach((mode) => {
            modes.add(mode);
            pending.push(mode);
          });
        }
      }
    }
    return modes;
  }

  /**
   * Adds the places where the matches of an expression can end: after each, the characters among
   * those that can follow (following) of which none of the rules of its mode (rules, their
   * expressions) could read one more.
   */
  #addEndsOf(expression, rules, { follows, stays, following = Characters.notIn([]) }) {
    const seen = new Set();
    const pending = [[expression, rules]];
    while (pending.length > 0) {
      const [own, others] = pending.pop();
      const key = keyOf([own, ...others]);
      if (!seen.has(key)) {
        seen.add(key);
        for (const [from, to] of rangesOf(own, ...others)) {
          const next = own.derivative(from);
          if (!next.empty) {
            const nextOthers = others.map((other) => other.derivative(from)).filter((other) => !other.empty);
            if (next.nullable) {
              // A rule reads one more only where it then has a match whatever follows; a match that
              // needs the end of the line ($) has only the line break after it.
              const goingOn = rangesOf(...nextOthers).filter(([code]) => nextOthers.some((other) => other.derivative(code).nullableInLine));
              const after = next.nullableInLine ? following : intersection(following, new Characters([[LINE_BREAK, LINE_BREAK]]));
              const stops = intersection(after, Characters.notIn(goingOn));
              if (!stops.empty) {
                this.#ends.push({ last: new Characters([[from, to]]), next: stops, follows, stays });
              }
            }
            pending.push([next, nextOthers]);
          }
        }
      }
    }
  }
}
