// The tokens of a lexer that a line break can cut (lineBreakCutOf), which a TextMate grammar
// (TextMateGrammar.js), reading one line at a time, cannot match whole: OTHERWISE at the end of a
// line, with REPORT, DISPLAY or something else on the next, DISPLAY before a blank line, or the \ that
// joins a template line to the next across blank lines. For each start of such tokens in a mode, the
// grammar gets two modes of its own, which a line that ends after the start enters, as if they were
// modes of the lexer:
// - the blanks, which reads the blanks and line breaks of the gap, and ends before anything else;
// - the decision, under it, which then reads each rest that a token of the start can go on with
//   (REPORT), as the token, with its mode change, and, where the start alone is a token too,
//   anything else, without reading it, with the mode change of that token. Each leaves the mode, and
//   the mode ends where the modes the rest enters end, so that the grammar goes on as the lexer does
//   after the whole token.

import { LexerRule } from './LexerGrammar.js';
import {
  Alternation, Characters, Groups, Lookahead, Repetition, START_OF_LINE, Sequence, alternation, lineBreakCutOf, repetition,
  sequence,
} from './RegularExpression.js';

export class LineBreakCuts {
  #lexer;
  // The rules of each mode of the cuts, by its name.
  #modes = new Map();
  // The modes of the cuts that decide, which end where the modes they enter end.
  #decisions = new Set();
  // The cuts of each mode of the lexer.
  #cuts = new Map();
  // The pattern of the blank lines after each mode of the lexer that leaves with them.
  #blankLines = new Map();

  constructor(lexer) {
    this.#lexer = lexer;
    for (const [mode, rules] of lexer.modes) {
      const starts = new Map();
      for (const rule of rules) {
        const cut = lineBreakCutOf(rule.expression);
        // A rule that only leaves its mode ends the part of the mode, where nothing can begin.
        if (cut !== undefined && !(rule.modeChange.leaves === 1 && rule.modeChange.enters.length === 0)) {
          const start = cut.before.bare().pattern(new Groups());
          if (!starts.has(start)) {
            starts.set(start, []);
          }
          starts.get(start).push({ rule, cut });
        }
      }
      this.#cuts.set(mode, [...starts.values()].map((cuts, index) => this.#cutOf(mode, index, cuts)));
      this.#blankLinesOf(mode);
    }
  }

  /** The rules of the modes of the cuts, by their names. */
  get modes() {
    return this.#modes;
  }

  /**
   * The pattern of the blank lines after a token that leaves a mode at a line break, but can read the
   * line breaks after it too, as SKIP_WHITESPACE leaves at one or more line breaks: for the grammar
   * to read them, at the start of a line, in the mode below, which would end at a line break of its
   * own, as a template line does. Undefined for a mode with no such token.
   */
  blankLinesAfter(mode) {
    return this.#blankLines.get(mode);
  }

  /** Whether a mode of the lexer has a rule that leaves it at a line break, as a template line ends. */
  endsAtLineBreak(mode) {
    return this.#lexer.modes.has(mode) && this.#leavesOf(mode).some((leave) => leave.expression.bare().derivativeBy('\n').nullable);
  }

  /** Finds the blank lines after a mode's tokens that leave it with all the line breaks that follow. */
  #blankLinesOf(mode) {
    const gaps = this.#leavesOf(mode).map((leave) => leave.expression.bare())
      .flatMap((expression) => (expression instanceof Alternation ? expression.options : [expression]))
      .map((expression) => (expression instanceof Sequence ? expression.items.at(-1) : expression))
      .filter((last) => last instanceof Repetition && last.max === Infinity && last.item.derivative(0x0a).nullable);
    if (gaps.length > 0) {
      this.#blankLines.set(mode, { match: sequence([START_OF_LINE, repetition(gaps[0].item, 1, Infinity)]).pattern(new Groups()) });
    }
  }

  /** Whether a mode is the decision of a cut, which ends where the modes it enters end. */
  decides(mode) {
    return this.#decisions.has(mode);
  }

  /**
   * The cuts of a mode of the lexer: for each, the names of its decision and blanks, the rule whose
   * start begins it, the start, and the blanks that may follow the start on its line.
   */
  cutsOf(mode) {
    return this.#cuts.get(mode) ?? [];
  }

  /** Makes the modes of the cut of the tokens with one start, and gives the cut. */
  #cutOf(mode, index, cuts) {
    const decision = `${mode}_LINE_BREAK_${index + 1}`;
    const blanks = `${decision}_BLANKS`;
    const [{ rule: first, cut }] = cuts;
    const notBlank = new Lookahead(Characters.notIn([...cut.blanks.ranges, [0x0a, 0x0a]]));
    this.#modes.set(blanks, [
      new LexerRule('Blanks', blanks, repetition(cut.gap, 1, Infinity), [{ name: 'skip' }]),
      new LexerRule('EndOfBlanks', blanks, notBlank, [{ name: 'skip' }, { name: 'popMode' }]),
    ]);
    const rules = cuts.filter(({ cut: { after } }) => !after.nullable)
      .map(({ rule, cut: { after } }) => new LexerRule(rule.name, decision, after, this.#commandsAfter(rule, rule.modeChange.enters)));
    // ANTLR's lexer reads the start alone as a token of the first rule that can. That token is decided
    // once: where the part of a mode it entered has ended, before a token that ends it, the decision
    // ends too.
    const whole = cuts.find(({ cut: { after, optional } }) => optional || after.nullable);
    if (whole !== undefined) {
      const enters = this.#entersAfterBlanks(whole);
      const ends = alternation([...rules.map((rule) => rule.modeChange.enters[0]), enters[0]]
        .filter((entered) => entered !== undefined)
        .flatMap((entered) => this.#leavesOf(entered).map((leave) => leave.expression.bare())));
      const decided = ends.empty ? notBlank : sequence([notBlank, new Lookahead(ends, { negative: true })]);
      rules.push(new LexerRule(whole.rule.name, decision, decided, this.#commandsAfter(whole.rule, enters)));
    }
    this.#modes.set(decision, rules);
    this.#decisions.add(decision);
    return { decision, blanks, rule: first, before: cut.before, followingBlanks: cut.blanks };
  }

  /** The rules of a mode of the lexer that leave it. */
  #leavesOf(mode) {
    return this.#lexer.modes.get(mode).filter((rule) => rule.modeChange.leaves === 1 && rule.modeChange.enters.length === 0);
  }

  /** The commands of a rule that reads the rest of a cut token: those of the token, from the decision. */
  #commandsAfter(rule, enters) {
    const { leaves } = rule.modeChange;
    if (leaves === 1 && rule.modeChange.enters.length === 0) {
      throw new Error(`EfxLexer.g4: ${rule.name} leaves its mode across a line break, which a TextMate grammar cannot follow`);
    }
    return [{ name: 'type', argument: rule.type }, { name: 'popMode' },
      ...enters.map((entered) => ({ name: 'pushMode', argument: entered }))];
  }

  /**
   * The modes that a token of the start alone enters, once the blanks after it are read: where the
   * blanks are not part of the token, the last mode it enters reads them, and leaves it if a rule of
   * it that leaves it reads a line break, as SKIP_WHITESPACE does.
   */
  #entersAfterBlanks({ rule, cut }) {
    const { enters } = rule.modeChange;
    const top = enters.at(-1);
    const leavesOnLineBreak = top !== undefined
      && this.#leavesOf(top).some((leave) => leave.expression.bare().derivativeBy('\n').nullable);
    return cut.optional && leavesOnLineBreak ? enters.slice(0, -1) : enters;
  }
}
