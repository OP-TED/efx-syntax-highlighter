// The TextMate grammar of a version of EFX, which an editor such as VS Code colours text with before,
// or instead of, the parser (src/efx2/generated/efx2.tmLanguage.json, src/efx1/generated/
// efx1.tmLanguage.json). Nothing of it is written by hand: it is made from the rules of the SDK's
// ANTLR lexer (LexerGrammar.js), each mode of the lexer a part of the grammar, each token rule a
// pattern of its mode, and each token scoped by the highlight tag the style table of the version
// gives its type (src/efx2/efx2Highlighting.js, src/efx1/efx1Highlighting.js), with the scope of
// the tag (src/efxTextMateScopes.js).
//
// A TextMate grammar reads a text as the lexer does, with a stack of the parts it is in, but not
// quite: it reads one line at a time, it takes the first pattern that matches rather than the
// longest, and a part can only begin inside the part it is in and end where it began. So:
// - A rule that enters a mode begins a part that ends at a rule of that mode that leaves it. A rule
//   that enters two modes begins a part for the first with the part for the second inside it, from
//   the same place.
// - A rule that leaves its mode for another begins the other inside it. Where the other ends with
//   a token of the same type as one that ends its mode, it ends just before it, where the lexer
//   reads that token in the other, and its mode ends on it, read by its own rule of that type, as one
//   match can end only one part; a mode that has no rule that leaves it ends where the other one
//   does. That rule may read the token otherwise than the lexer, but with the same colours, as a
//   template reads its semicolon with the blanks and comment after it, which the lexer reads after
//   the semicolon of an expression; the sync stops where another rule of the mode could read the
//   token, or go on after it.
// - ANTLR's lexer takes the longest token that a rule of the mode matches, and on a tie the rule
//   written first. Each pattern is therefore written so as to match only where no rule of its mode
//   could read a longer token (LongestMatch.js), and the patterns are in an order where a rule that
//   wins a tie comes first. The words of the rules that only make a token come first, one pattern for
//   each scope, but those that a rule written before reads too, which ANTLR reads with that rule. As
//   the end of a part is tried either before its patterns or after them, a pattern does not match a
//   text that a rule of the other kind, written before it, reads too.
// - A TextMate engine looks for a pattern from where it is to the end of the line: a pattern that
//   can start with a long run of blanks is kept from being tried inside the run, where no token can
//   begin (RunGuards.js), as it would otherwise read the run again from each of its characters.
// The test that colours the SDK's EFX files with this grammar and with the parser, and compares
// them (test/textmate.js), shows how close this comes.

import { Alternation, Characters, Groups, delimitedAcrossLines, goesOnAfter, overlap, text } from './RegularExpression.js';
import { LineBreakCuts } from './LineBreakCuts.js';
import { LongestMatch } from './LongestMatch.js';
import { LexerGrammar } from './LexerGrammar.js';
import { RunGuards } from './RunGuards.js';
import { efxTextMateScopes } from '../../src/efxTextMateScopes.js';

// The tag of plain names, which colours them as the text around them, and so has no scope.
const PLAIN_TAG = 'name';

/** The scope of a highlight tag, or undefined for a tag that colours nothing, such as name. */
function scopeOfTag(tag) {
  return efxTextMateScopes[tag];
}

export class TextMateGrammar {
  #lexer;
  #name;
  #scopeName;
  #source;
  // The highlight tag of each token type that the style table styles whatever its parent, by type.
  #tags = new Map();
  // The highlight tags of each token type that the style table styles under a parent, by type, then parent.
  #tagsUnder = new Map();
  #skipTokens;
  // The modes of the tokens that a line break cuts.
  #cuts;
  // The pattern of each rule that ends the part of a mode, with its groups, made once for all the
  // parts, and its lookahead, where the token of the rule ends the part of a mode begun inside another.
  #endPatterns = new Map();
  #endLookaheads = new Map();
  // The guards that keep patterns from being tried inside runs.
  #guards;

  constructor(lexer, { name, scopeName, source, styles, lexerOptions }) {
    this.#lexer = lexer;
    this.#cuts = new LineBreakCuts(lexer);
    // The start of a cut token is a match of its own, which enters the decision and its blanks.
    const splits = [...lexer.modes.keys()].flatMap((mode) => this.#cuts.cutsOf(mode).map(({ decision, blanks, before, followingBlanks }) =>
      ({ mode, expression: before.bare(), modeChange: { leaves: 1, enters: [decision, blanks] }, next: new Characters([...followingBlanks.ranges, [0x0a, 0x0a]]) })));
    this.#guards = new RunGuards(new Map([...lexer.modes, ...this.#cuts.modes]), splits);
    this.#name = name;
    this.#scopeName = scopeName;
    this.#source = source;
    this.#skipTokens = lexerOptions.skipTokens ?? {};
    for (const [names, tag] of Object.entries(styles)) {
      if (scopeOfTag(String(tag)) === undefined && String(tag) !== PLAIN_TAG) {
        throw new Error(`The style table gives the tag ${tag}, which has no TextMate scope: add one to src/efxTextMateScopes.js`);
      }
      for (const name of names.split(' ')) {
        const [parent, type] = name.includes('/') ? name.split('/') : [undefined, name];
        if (parent === undefined) {
          this.#tags.set(type, String(tag));
        } else {
          if (!this.#tagsUnder.has(type)) {
            this.#tagsUnder.set(type, new Map());
          }
          this.#tagsUnder.get(type).set(parent, String(tag));
        }
      }
    }
  }

  /** The grammar of the text of an EfxLexer.g4, with the style table and lexer options of its version. */
  static of(lexerGrammarText, options) {
    const { comment } = options.lexerOptions;
    const captured = comment === undefined ? {} : { [comment]: scopeOfTag('lineComment') };
    return new TextMateGrammar(LexerGrammar.parse(lexerGrammarText, { captured }), options);
  }

  /** The text of the grammar's file. */
  toFile() {
    return `${JSON.stringify(this.toJson(), null, 2)}\n`;
  }

  /** The grammar, as a TextMate grammar file holds it. */
  toJson() {
    const repository = {};
    for (const mode of [...this.#lexer.modes.keys(), ...this.#cuts.modes.keys()]) {
      repository[mode] = { patterns: this.#patternsOf(mode) };
    }
    return {
      information_for_contributors: [`Generated by \`npm run sync\` from EfxLexer.g4 at ${this.#source}. Do not edit.`],
      name: this.#name,
      scopeName: this.#scopeName,
      patterns: [{ include: '#DEFAULT_MODE' }],
      repository,
    };
  }

  /** The type of a rule's tokens as the parser names it. */
  #typeOf(rule) {
    return rule.hidden ? (this.#skipTokens[rule.name] ?? rule.type) : rule.type;
  }

  /** The scope of a rule's tokens, by the tag of their type, or undefined when no tag colours them. */
  #scopeOf(rule) {
    return scopeOfTag(this.#tags.get(this.#typeOf(rule)));
  }

  /**
   * The scope of a token that the style table styles only under a parent, next to another token
   * that begins or ends the same part: the tag that every parent which styles the token styles the
   * other with too, as it styles the name after $ as a variable, like the $. Undefined when there is
   * no such tag, or more than one.
   */
  #scopeNextTo(rule, other) {
    const tags = new Set();
    const otherType = this.#typeOf(other);
    for (const [parent, tag] of this.#tagsUnder.get(this.#typeOf(rule)) ?? []) {
      if ((this.#tagsUnder.get(otherType)?.get(parent) ?? this.#tags.get(otherType)) === tag) {
        tags.add(tag);
      }
    }
    return tags.size === 1 ? scopeOfTag([...tags][0]) : undefined;
  }

  #rulesOf(mode) {
    const rules = this.#lexer.modes.get(mode) ?? this.#cuts.modes.get(mode);
    if (rules === undefined) {
      throw new Error(`EfxLexer.g4 has no mode ${mode}`);
    }
    return rules;
  }

  /** The rules of a mode that leave it for the mode below. */
  #leavesOf(mode) {
    return this.#rulesOf(mode).filter((rule) => rule.modeChange.leaves === 1 && rule.modeChange.enters.length === 0);
  }

  /**
   * The patterns of a mode, in the order they are tried: every rule of it but those that leave it. The
   * words of the rules that only make a token come first, one pattern for each scope: as no word
   * matches where a rule could read a longer token, they matter only on a tie, and a word that a rule
   * written before reads too is left out, as ANTLR reads it with that rule. The other rules follow,
   * those that can match a longer token first, by their shortest one, but after any rule written
   * before them that can read the same token, which wins the tie. A TextMate engine tries a few long
   * patterns much faster than many short ones. The pattern of each of these rules looks out only for
   * the longer tokens of the rules tried after it, and of those that leave the mode, whose end may be
   * tried after it: a rule tried before it that reads a longer token there matches first.
   */
  #patternsOf(mode) {
    const rules = this.#rulesOf(mode).filter((rule) => !this.#leavesOf(mode).includes(rule));
    const wordRules = rules.filter((rule) => rule.expression.texts !== undefined && rule.modeChange.enters.length === 0);
    const ordered = this.#ordered(rules.filter((rule) => !wordRules.includes(rule)));
    const triedAfter = (index) => [...ordered.slice(index + 1), ...this.#leavesOf(mode)].map((rule) => rule.expression.bare());
    return [
      ...this.#cutBeginsOf(mode),
      ...this.#wordPatternsOf(wordRules),
      ...ordered.flatMap((rule, index) => this.#regionsAcrossLinesOf(rule) ?? [this.#patternOf(rule, triedAfter(index))])
        .filter(Boolean),
    ];
  }

  /**
   * The parts that a rule's tokens make when they can go on after a line break, between delimiters,
   * as a string literal can after an escaped line break (delimitedAcrossLines): one for each form of
   * the rule, from the opening delimiter to the closing one, or to the end of a line that does not
   * go on, as the rule would not match there. Undefined for any other rule.
   */
  #regionsAcrossLinesOf(rule) {
    const expression = rule.expression.bare();
    const forms = (expression instanceof Alternation ? expression.options : [expression]).map(delimitedAcrossLines);
    if (rule.modeChange.enters.length > 0 || forms.some((form) => form === undefined)) {
      return undefined;
    }
    const scope = this.#scopeOf(rule);
    return forms.map(({ open, body, close, beforeLineBreak }) => ({
      begin: text(open).pattern(new Groups()),
      // A TextMate engine reads each line with its line break: the part ends before one that does not go on.
      end: `${text(close).pattern(new Groups())}|(?<!${beforeLineBreak.pattern(new Groups())})(?=\\n)`,
      ...(scope && { name: scope }),
      patterns: [{ match: body.withoutLineBreaks().pattern(new Groups()) }],
    }));
  }

  /**
   * Rules, those whose shortest token is the longest first, but each after every rule written before
   * it with which it can read the same token.
   */
  #ordered(rules) {
    const before = new Map(rules.map((rule, index) => [rule, rules.slice(0, index)
      .filter((earlier) => overlap(earlier.expression.bare(), rule.expression.bare()))]));
    const ordered = [];
    const left = [...rules];
    while (left.length > 0) {
      const ready = left.filter((rule) => before.get(rule).every((earlier) => ordered.includes(earlier)));
      const next = ready.reduce((best, rule) => (rule.expression.minLength > best.expression.minLength ? rule : best));
      ordered.push(next);
      left.splice(left.indexOf(next), 1);
    }
    return ordered;
  }

  /**
   * The patterns that begin the modes of the tokens of a mode that a line break cuts (LineBreakCuts):
   * the start of such a token, where only blanks follow it on its line, scoped as its rule's tokens.
   * The decision is begun as if a rule left the mode for it, with the blanks inside it, so that the
   * grammar goes on as after the whole token.
   */
  #cutBeginsOf(mode) {
    return this.#cuts.cutsOf(mode).map(({ decision, blanks, rule, before, followingBlanks }) => {
      const groups = new Groups();
      const guard = this.#guards.guardOf(before.bare(), mode, new Set([mode]), []);
      const begin = `${guard}${before.term(groups)}(?=${followingBlanks.operand(new Groups())}*$)`;
      const scope = this.#scopeOf(rule);
      const beginCaptures = { ...(scope && { 0: { name: scope } }), ...groups.toCaptures() };
      return {
        begin,
        ...(Object.keys(beginCaptures).length > 0 && { beginCaptures }),
        ...this.#partOf(decision, [blanks], { inside: mode, begun: rule }),
      };
    });
  }

  /** The words of a rule that no rule written before it reads too. */
  #ownWords(rule) {
    const rules = this.#rulesOf(rule.mode);
    const before = rules.slice(0, rules.indexOf(rule)).map((other) => other.expression.bare());
    return rule.expression.texts.filter((word) => !before.some((other) => other.derivativeBy(word).nullable));
  }

  /** The words of rules that only make a token, as one pattern for each scope. */
  #wordPatternsOf(rules) {
    const wordsOfScope = new Map();
    for (const rule of rules) {
      const scope = this.#scopeOf(rule);
      if (!wordsOfScope.has(scope)) {
        wordsOfScope.set(scope, []);
      }
      wordsOfScope.get(scope).push(...this.#ownWords(rule).map((word) => ({ word, rule })));
    }
    return [...wordsOfScope].filter(([, words]) => words.length > 0)
      .map(([scope, words]) => ({ match: this.#boundedWords(words), ...(scope && { name: scope }) }));
  }

  /**
   * Words, each of a rule, as one pattern: the longest words first, and the words that the same
   * lookahead follows written together, before it (LongestMatch).
   */
  #boundedWords(words) {
    const wordsOfLookahead = new Map();
    for (const { word, rule } of [...words].sort((a, b) => [...b.word].length - [...a.word].length)) {
      const lookahead = LongestMatch.lookaheadOfWord(word, rule.expression.bare(), this.#rivalsOf(rule));
      if (!wordsOfLookahead.has(lookahead)) {
        wordsOfLookahead.set(lookahead, []);
      }
      wordsOfLookahead.get(lookahead).push(text(word).pattern(new Groups()));
    }
    return [...wordsOfLookahead].map(([lookahead, patterns]) =>
      (patterns.length === 1 || lookahead === '' ? patterns.map((pattern) => pattern + lookahead).join('|')
        : `(?:${patterns.join('|')})${lookahead}`)).join('|');
  }

  /** The expressions of the other rules of a rule's mode, which could read a longer token. */
  #rivalsOf(rule) {
    return this.#rulesOf(rule.mode).filter((other) => other !== rule).map((other) => other.expression.bare());
  }

  /**
   * The expressions of the rules that win a tie against a rule, where the grammar may try them after
   * it: those of its mode written before it that leave the mode, for a rule that does not, and those
   * that do not, for a rule that leaves it, as the end of a part is tried either before its patterns
   * or after them. The order of the patterns settles the ties among them.
   */
  #tiesOf(rule) {
    const rules = this.#rulesOf(rule.mode);
    const leaves = this.#leavesOf(rule.mode);
    return rules.slice(0, rules.indexOf(rule)).filter((earlier) => leaves.includes(earlier) !== leaves.includes(rule))
      .map((earlier) => earlier.expression.bare());
  }

  /**
   * A rule as a pattern of its mode, with the expressions of the rules that may be tried after it: a
   * match, or the beginning of the part of the modes it enters; undefined for a rule of which the
   * lexer reads no token (#bounded).
   */
  #patternOf(rule, rivals) {
    const { leaves, enters } = rule.modeChange;
    const scope = this.#scopeOf(rule);
    const groups = new Groups();
    const pattern = this.#bounded(rule, groups, rivals);
    if (pattern === undefined) {
      return undefined;
    }
    if (enters.length === 0) {
      return { match: pattern, ...(scope && { name: scope }), ...(groups.size > 0 && { captures: groups.toCaptures() }) };
    }
    const [first, ...rest] = enters;
    const beginScope = scope ?? this.#endRulesOf(first).map((end) => this.#scopeNextTo(rule, end)).find(Boolean);
    const beginCaptures = { ...(beginScope && { 0: { name: beginScope } }), ...groups.toCaptures() };
    return {
      begin: pattern,
      ...(Object.keys(beginCaptures).length > 0 && { beginCaptures }),
      ...this.#partOf(first, rest, { inside: leaves === 1 ? rule.mode : undefined, begun: rule }),
    };
  }

  /**
   * The end and patterns of the part of a mode, with the parts of the modes entered with it inside
   * it, from where it begins. inside is the mode the part was begun in when its rule left that mode,
   * and begun the rule that began it.
   */
  #partOf(mode, above, { inside, begun } = {}) {
    const nested = above.length === 0 ? [] : [{ begin: '\\G', ...this.#partOf(above[0], above.slice(1)) }];
    // Where the mode above leaves at a line break with the blank lines that follow, which this mode
    // would end at, the blank lines are read here, from the start of a line (LineBreakCuts.blankLinesAfter).
    const blankLines = above.length === 0 || !this.#cuts.endsAtLineBreak(mode) ? undefined : this.#cuts.blankLinesAfter(above[0]);
    return {
      ...this.#endOf(mode, { inside, begun }),
      ...(nested.length > 0 && { applyEndPatternLast: true }),
      patterns: [...nested, ...(blankLines === undefined ? [] : [blankLines]), { include: `#${mode}` }],
    };
  }

  /**
   * Where the part of a mode ends: at a rule that leaves the mode, scoped as its type, or as the rule
   * that began the part when only a parent styles its type. Begun inside a mode that a rule left for
   * it, it ends before a token of the same type as one that ends that mode, which ends there.
   */
  #endOf(mode, { inside, begun }) {
    const outerTypes = new Set(inside === undefined ? [] : this.#endRulesOf(inside).map((rule) => rule.type));
    const groups = new Groups();
    const options = this.#endRulesOf(mode).flatMap((rule) => {
      if (outerTypes.has(rule.type)) {
        this.#checkHandOver(rule, inside);
        const lookahead = this.#endLookaheadOf(rule);
        return lookahead === undefined ? [] : [lookahead];
      }
      const own = new Groups();
      const pattern = this.#bounded(rule, own);
      if (pattern === undefined) {
        return [];
      }
      groups.add(this.#scopeOf(rule) ?? (begun && this.#scopeNextTo(rule, begun)));
      groups.addAll(own);
      return [`(${pattern})`];
    });
    const endCaptures = Object.fromEntries(Object.entries(groups.toCaptures()).filter(([, { name }]) => name));
    return {
      end: options.length === 0 ? '(?!)' : options.join('|'),
      ...(Object.keys(endCaptures).length > 0 && { endCaptures }),
    };
  }

  /**
   * Stops at a rule whose token ends the part of its mode and, by its type, the part of the mode it
   * was begun inside, which a rule of that mode other than its ends of that type could read, or go on
   * after: as the part of its mode ends before the token, the outer part reads it, which must end
   * there as the lexer does, and not read on with that rule.
   */
  #checkHandOver(rule, inside) {
    const token = rule.expression.bare();
    const ends = this.#endRulesOf(inside).filter((end) => end.type === rule.type);
    const other = this.#rulesOf(inside).find((candidate) => !ends.includes(candidate)
      && (overlap(candidate.expression.bare(), token) || goesOnAfter(candidate.expression.bare(), token)));
    if (other !== undefined) {
      throw new Error(`EfxLexer.g4: ${rule.name} ends ${rule.mode} and, by its type, ${inside}, where ${other.name} can read its `
        + 'token, or go on after it, which a TextMate grammar cannot follow');
    }
  }

  /**
   * The rules that end the part of a mode: those that leave it, or, for a mode that no rule leaves but
   * for another, those that end the other.
   */
  #endRulesOf(mode) {
    const own = this.#leavesOf(mode);
    const ofOthers = () => this.#rulesOf(mode).filter((rule) => rule.modeChange.leaves === 1)
      .flatMap((rule) => (rule.modeChange.enters.length === 0 ? [] : this.#leavesOf(rule.modeChange.enters[0])));
    // The decision of a cut token ends with the rest of the token, as the rest leaves it.
    if (this.#cuts.decides(mode)) {
      return [...own, ...ofOthers()];
    }
    return own.length > 0 ? own : ofOthers();
  }

  /**
   * A pattern of a rule, tried in the given modes with the given rivals, after its guard against runs,
   * if it has one (RunGuards); undefined for none.
   */
  #guarded(rule, triedIn, rivals, pattern) {
    if (pattern === undefined) {
      return undefined;
    }
    const guard = this.#guards.guardOf(rule.expression.bare(), rule.mode, triedIn, [...rivals, ...this.#tiesOf(rule)]);
    return guard === '' ? pattern : `${guard}(?:${pattern})`;
  }

  /** The modes whose parts a rule that ends a part can end: its own, and those it ends for another (#endRulesOf). */
  #endedModesOf(rule) {
    return new Set([rule.mode,
      ...[...this.#lexer.modes.keys(), ...this.#cuts.modes.keys()].filter((mode) => this.#endRulesOf(mode).includes(rule))]);
  }

  /**
   * Where a token of a rule that ends the part of a mode begins, as a lookahead: its pattern
   * (#bounded) without its captures, so that the part ends only where the lexer reads that token;
   * undefined for a rule of which the lexer reads none.
   */
  #endLookaheadOf(rule) {
    if (!this.#endLookaheads.has(rule)) {
      const pattern = rule.expression.texts !== undefined ? this.#bounded(rule, new Groups())
        : this.#guarded(rule, this.#endedModesOf(rule), this.#rivalsOf(rule),
          new LongestMatch(rule.expression.bare(), this.#rivalsOf(rule), this.#tiesOf(rule)).pattern(new Groups()));
      this.#endLookaheads.set(rule, pattern === undefined ? undefined : `(?=${pattern})`);
    }
    return this.#endLookaheads.get(rule);
  }

  /**
   * The pattern of a rule, written so that it matches only where ANTLR's lexer would read a token of
   * it (LongestMatch): its words, when it has finitely many, else its expression, with the expressions
   * of the rules that may be tried after it; for a rule that ends the part of a mode, all the others
   * of its mode, as its end may be tried before or after them. Undefined for a rule of which the lexer
   * reads no token, as its words, or all its tokens, are read by rules written before it.
   */
  #bounded(rule, groups, rivals) {
    if (rule.expression.texts !== undefined) {
      const words = this.#ownWords(rule);
      return words.length === 0 ? undefined : this.#boundedWords(words.map((word) => ({ word, rule })));
    }
    if (rivals !== undefined) {
      return this.#guarded(rule, new Set([rule.mode]), rivals,
        new LongestMatch(rule.expression, rivals, this.#tiesOf(rule)).pattern(groups));
    }
    if (!this.#endPatterns.has(rule)) {
      const own = new Groups();
      const pattern = this.#guarded(rule, this.#endedModesOf(rule), this.#rivalsOf(rule),
        new LongestMatch(rule.expression, this.#rivalsOf(rule), this.#tiesOf(rule)).pattern(own));
      this.#endPatterns.set(rule, { pattern, groups: own });
    }
    const { pattern, groups: own } = this.#endPatterns.get(rule);
    if (pattern !== undefined) {
      groups.addAll(own);
    }
    return pattern;
  }
}
