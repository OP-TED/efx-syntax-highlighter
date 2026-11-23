// Regular expressions as trees, made from the rules of an ANTLR lexer (LexerGrammar.js), and written
// out in the syntax of Oniguruma, the engine of TextMate grammars (TextMateGrammar.js). Besides
// writing itself out, an expression can say what it matches: whether it matches the empty text, how
// long its shortest match is, the texts it matches when they are finitely many, and what is left of it
// once some text is read (its derivative, after Brzozowski). The last is what tells, for a word the
// lexer reads, whether another rule could read a longer token from the same place.

const MAX_CODE_POINT = 0x10ffff;

// The characters Oniguruma reads as operators outside and inside a character class.
const SPECIAL = /[\\^$.|?*+()[\]{}]/;
const SPECIAL_IN_CLASS = /[\\^\]\[&-]/;
const CONTROL_ESCAPES = { 0x09: '\\t', 0x0a: '\\n', 0x0c: '\\f', 0x0d: '\\r' };

/** A character as Oniguruma reads it, in a pattern or in a character class. */
function escaped(code, special) {
  const character = String.fromCodePoint(code);
  if (special.test(character)) {
    return `\\${character}`;
  }
  if (CONTROL_ESCAPES[code] !== undefined) {
    return CONTROL_ESCAPES[code];
  }
  if (code < 0x20 || code === 0x7f || code > 0x7e) {
    return code > 0xffff ? `\\x{${code.toString(16)}}` : `\\x{${code.toString(16).padStart(2, '0')}}`;
  }
  return character;
}

/** The ranges of code points that no range of a list of sorted, merged ranges holds. */
function complementOf(ranges) {
  const outside = [];
  let next = 0;
  for (const [from, to] of ranges) {
    if (from > next) {
      outside.push([next, from - 1]);
    }
    next = to + 1;
  }
  if (next <= MAX_CODE_POINT) {
    outside.push([next, MAX_CODE_POINT]);
  }
  return outside;
}

/** A list of ranges of code points, sorted and merged. */
function merged(ranges) {
  const sorted = [...ranges].sort((a, b) => a[0] - b[0]);
  const result = [];
  for (const [from, to] of sorted) {
    const last = result.at(-1);
    if (last !== undefined && from <= last[1] + 1) {
      last[1] = Math.max(last[1], to);
    } else {
      result.push([from, to]);
    }
  }
  return result;
}

/** The base of every expression. */
class Expression {
  /** Whether the expression matches the empty text. */
  get nullable() {
    return false;
  }

  /** Whether it matches the empty text inside a line, with more of the line on both sides: as nullable, but $ and ^ do not. */
  get nullableInLine() {
    return this.nullable;
  }

  /** Whether the expression matches nothing at all. */
  get empty() {
    return false;
  }

  /** The length, in characters, of its shortest match. */
  get minLength() {
    return 0;
  }

  /** The texts it matches when they are finitely many, else undefined. */
  get texts() {
    return undefined;
  }

  /** The text that every match ends with, as far as it is fixed; '' when none is. */
  get fixedEnd() {
    return '';
  }

  /** What is left of the expression once a character is read: the expression of the rest of its matches. */
  derivative() {
    return NOTHING;
  }

  /** What is left of the expression once a text is read. */
  derivativeBy(text) {
    let rest = this;
    for (const character of text) {
      rest = rest.derivative(character.codePointAt(0));
      if (rest.empty) {
        return NOTHING;
      }
    }
    return rest;
  }

  /** The expression of its matches but the empty text. */
  nonEmpty() {
    return NOTHING;
  }

  /** The expression without its captures. */
  bare() {
    return this;
  }

  /** The expressions it is made of. */
  get parts() {
    return [];
  }

  /** The expression of its matches that hold no line break. */
  withoutLineBreaks() {
    return this;
  }

  /** Whether the expression holds the given one. */
  refersTo(expression) {
    return this === expression;
  }

  /**
   * Adds to a set the code points where the characters it reads start or stop being alike: each
   * range of a set, and each character of a text, from its first code point to the one after its last.
   */
  addBoundaries() {}

  /** The pattern of the expression; groups numbers the captures it holds, as they are written. */
  pattern() {
    throw new Error(`${this.constructor.name} has no pattern`);
  }

  /** Its pattern as the operand of a repetition: one group, or one character or class. */
  operand(groups) {
    return `(?:${this.pattern(groups)})`;
  }

  /** Its pattern as an item of a sequence. */
  term(groups) {
    return this.pattern(groups);
  }
}

/** Matches nothing. */
class Nothing extends Expression {
  get empty() {
    return true;
  }

  get minLength() {
    return Infinity;
  }

  get texts() {
    return [];
  }

  pattern() {
    return '(?!)';
  }

  operand() {
    return '(?!)';
  }
}

/** Matches the empty text only. */
class EmptyText extends Expression {
  get nullable() {
    return true;
  }

  get texts() {
    return [''];
  }

  pattern() {
    return '';
  }
}

export const NOTHING = new Nothing();
export const EMPTY = new EmptyText();

/** Matches at the end of the text, which a TextMate grammar sees as the end of a line. */
class EndOfText extends Expression {
  get nullable() {
    return true;
  }

  get nullableInLine() {
    return false;
  }

  get texts() {
    return [''];
  }

  pattern() {
    return '$';
  }

  operand() {
    return '$';
  }
}

export const END_OF_TEXT = new EndOfText();

/** Matches at the start of a line, as a TextMate grammar reads one line at a time. */
class StartOfLine extends Expression {
  get nullable() {
    return true;
  }

  get nullableInLine() {
    return false;
  }

  pattern() {
    return '^';
  }

  operand() {
    return '^';
  }
}

export const START_OF_LINE = new StartOfLine();

/** Stands for the rule being read, where it refers to itself, until LexerGrammar replaces it. */
class SelfReference extends Expression {
  get minLength() {
    return 1;
  }

  pattern() {
    return '(?:SELF)';
  }
}

export const SELF = new SelfReference();

/**
 * Matches the empty text where its item matches what follows, or, negative, where it does not,
 * without reading it: the pattern of a rule that only decides what comes next, as where a token that
 * a line break cut ends.
 */
export class Lookahead extends Expression {
  constructor(item, { negative = false } = {}) {
    super();
    this.item = item;
    this.negative = negative;
  }

  get nullable() {
    return true;
  }

  pattern(groups) {
    return `(?${this.negative ? '!' : '='}${this.item.pattern(groups)})`;
  }

  operand(groups) {
    return this.pattern(groups);
  }
}

/** Matches a fixed text. */
class Text extends Expression {
  constructor(text) {
    super();
    this.text = text;
  }

  get nullable() {
    return this.text === '';
  }

  get minLength() {
    return [...this.text].length;
  }

  get texts() {
    return [this.text];
  }

  get fixedEnd() {
    return this.text;
  }

  derivative(code) {
    const [first, ...rest] = this.text;
    return first !== undefined && first.codePointAt(0) === code ? text(rest.join('')) : NOTHING;
  }

  nonEmpty() {
    return this.text === '' ? NOTHING : this;
  }

  withoutLineBreaks() {
    return this.text.includes('\n') ? NOTHING : this;
  }

  addBoundaries(boundaries) {
    for (const character of this.text) {
      const code = character.codePointAt(0);
      boundaries.add(code).add(code + 1);
    }
  }

  pattern() {
    return Array.from(this.text, (character) => escaped(character.codePointAt(0), SPECIAL)).join('');
  }

  operand() {
    return [...this.text].length === 1 ? this.pattern() : `(?:${this.pattern()})`;
  }
}

/** Matches one character of a set, given as ranges of code points. */
export class Characters extends Expression {
  constructor(ranges) {
    super();
    this.ranges = merged(ranges);
  }

  /** The characters of none of the ranges. */
  static notIn(ranges) {
    return new Characters(complementOf(merged(ranges)));
  }

  get empty() {
    return this.ranges.length === 0;
  }

  get minLength() {
    return 1;
  }

  get texts() {
    const count = this.ranges.reduce((total, [from, to]) => total + to - from + 1, 0);
    return count === 1 ? [String.fromCodePoint(this.ranges[0][0])] : undefined;
  }

  get fixedEnd() {
    return this.texts?.[0] ?? '';
  }

  contains(code) {
    return this.ranges.some(([from, to]) => from <= code && code <= to);
  }

  derivative(code) {
    return this.contains(code) ? EMPTY : NOTHING;
  }

  withoutLineBreaks() {
    return new Characters(complementOf(merged([...complementOf(this.ranges), [0x0a, 0x0a]])));
  }

  addBoundaries(boundaries) {
    for (const [from, to] of this.ranges) {
      boundaries.add(from).add(to + 1);
    }
  }

  nonEmpty() {
    return this;
  }

  pattern() {
    if (this.texts !== undefined) {
      return escaped(this.ranges[0][0], SPECIAL);
    }
    const outside = complementOf(this.ranges);
    if (outside.length === 0) {
      return '[\\s\\S]';
    }
    // A set written by what it leaves out reads better when that is shorter, as ~[\r\n] is.
    const [negated, ranges] = outside.length < this.ranges.length ? ['^', outside] : ['', this.ranges];
    const items = ranges.map(([from, to]) => {
      const first = escaped(from, SPECIAL_IN_CLASS);
      return from === to ? first : `${first}${to > from + 1 ? '-' : ''}${escaped(to, SPECIAL_IN_CLASS)}`;
    });
    return `[${negated}${items.join('')}]`;
  }

  operand() {
    return this.pattern();
  }
}

/** Matches its items one after the other. */
export class Sequence extends Expression {
  constructor(items) {
    super();
    this.items = items;
  }

  get nullable() {
    return this.items.every((item) => item.nullable);
  }

  get nullableInLine() {
    return this.items.every((item) => item.nullableInLine);
  }

  get minLength() {
    return this.items.reduce((total, item) => total + item.minLength, 0);
  }

  get texts() {
    let texts = [''];
    for (const item of this.items) {
      const itemTexts = item.texts;
      if (itemTexts === undefined) {
        return undefined;
      }
      texts = texts.flatMap((start) => itemTexts.map((end) => start + end));
    }
    return texts;
  }

  get fixedEnd() {
    let end = '';
    for (const item of [...this.items].reverse()) {
      const itemEnd = item.fixedEnd;
      end = itemEnd + end;
      if (item.texts?.length !== 1) {
        return end;
      }
    }
    return end;
  }

  derivative(code) {
    const [first, ...rest] = this.items;
    const restExpression = sequence(rest);
    const throughFirst = sequence([first.derivative(code), restExpression]);
    return first.nullable ? alternation([throughFirst, restExpression.derivative(code)]) : throughFirst;
  }

  nonEmpty() {
    const [first, ...rest] = this.items;
    const restExpression = sequence(rest);
    const fromFirst = sequence([first.nonEmpty(), restExpression]);
    return first.nullable ? alternation([fromFirst, restExpression.nonEmpty()]) : fromFirst;
  }

  bare() {
    return sequence(this.items.map((item) => item.bare()));
  }

  get parts() {
    return this.items;
  }

  withoutLineBreaks() {
    return sequence(this.items.map((item) => item.withoutLineBreaks()));
  }

  refersTo(expression) {
    return this.items.some((item) => item.refersTo(expression));
  }

  addBoundaries(boundaries) {
    this.items.forEach((item) => item.addBoundaries(boundaries));
  }

  pattern(groups) {
    return this.items.map((item) => item.term(groups)).join('');
  }
}

/** Matches one of its options. */
export class Alternation extends Expression {
  constructor(options) {
    super();
    this.options = options;
  }

  get nullable() {
    return this.options.some((option) => option.nullable);
  }

  get nullableInLine() {
    return this.options.some((option) => option.nullableInLine);
  }

  get minLength() {
    return Math.min(...this.options.map((option) => option.minLength));
  }

  get texts() {
    const texts = [];
    for (const option of this.options) {
      const optionTexts = option.texts;
      if (optionTexts === undefined) {
        return undefined;
      }
      texts.push(...optionTexts);
    }
    return [...new Set(texts)];
  }

  get fixedEnd() {
    const ends = this.options.map((option) => option.fixedEnd);
    let common = ends[0];
    for (const end of ends.slice(1)) {
      while (!end.endsWith(common)) {
        common = common.slice(1);
      }
    }
    return common;
  }

  derivative(code) {
    return alternation(this.options.map((option) => option.derivative(code)));
  }

  nonEmpty() {
    return alternation(this.options.map((option) => option.nonEmpty()));
  }

  bare() {
    return alternation(this.options.map((option) => option.bare()));
  }

  get parts() {
    return this.options;
  }

  withoutLineBreaks() {
    return alternation(this.options.map((option) => option.withoutLineBreaks()));
  }

  refersTo(expression) {
    return this.options.some((option) => option.refersTo(expression));
  }

  addBoundaries(boundaries) {
    this.options.forEach((option) => option.addBoundaries(boundaries));
  }

  pattern(groups) {
    return this.options.map((option) => option.pattern(groups)).join('|');
  }

  term(groups) {
    return `(?:${this.pattern(groups)})`;
  }
}

/** Matches its item from min to max times (max is Infinity for no limit), as often as it can. */
export class Repetition extends Expression {
  constructor(item, min, max) {
    super();
    this.item = item;
    this.min = min;
    this.max = max;
  }

  get nullable() {
    return this.min === 0 || this.item.nullable;
  }

  get nullableInLine() {
    return this.min === 0 || this.item.nullableInLine;
  }

  get minLength() {
    return this.min * this.item.minLength;
  }

  get texts() {
    if (this.max === Infinity) {
      return undefined;
    }
    return alternation(Array.from({ length: this.max - this.min + 1 },
      (_, extra) => sequence(Array(this.min + extra).fill(this.item)))).texts;
  }

  /** The repetition with one match of its item fewer. */
  #less() {
    return repetition(this.item, Math.max(this.min - 1, 0), this.max - 1);
  }

  derivative(code) {
    return sequence([this.item.derivative(code), this.#less()]);
  }

  /**
   * The non-empty matches, as one repetition of the non-empty matches of the item, at least once: x+
   * for x*, which a part of a match (LongestMatch.js) can take as one item that reads something.
   */
  nonEmpty() {
    return repetition(this.item.nonEmpty(), this.item.nullable ? 1 : Math.max(this.min, 1), this.max);
  }

  bare() {
    return repetition(this.item.bare(), this.min, this.max);
  }

  get parts() {
    return [this.item];
  }

  withoutLineBreaks() {
    return repetition(this.item.withoutLineBreaks(), this.min, this.max);
  }

  refersTo(expression) {
    return this.item.refersTo(expression);
  }

  addBoundaries(boundaries) {
    this.item.addBoundaries(boundaries);
  }

  pattern(groups) {
    const operand = this.item.operand(groups);
    if (this.min === 0 && this.max === 1) {
      return `${operand}?`;
    }
    if (this.max === Infinity) {
      return `${operand}${this.min === 0 ? '*' : this.min === 1 ? '+' : `{${this.min},}`}`;
    }
    return `${operand}{${this.min},${this.max}}`;
  }
}

/** Matches what its item matches, and gives that part of the match a scope of its own. */
export class Capture extends Expression {
  constructor(item, scope) {
    super();
    this.item = item;
    this.scope = scope;
  }

  get nullable() {
    return this.item.nullable;
  }

  get nullableInLine() {
    return this.item.nullableInLine;
  }

  get minLength() {
    return this.item.minLength;
  }

  get texts() {
    return this.item.texts;
  }

  get fixedEnd() {
    return this.item.fixedEnd;
  }

  derivative(code) {
    return this.item.derivative(code);
  }

  nonEmpty() {
    const item = this.item.nonEmpty();
    return item.empty ? NOTHING : new Capture(item, this.scope);
  }

  bare() {
    return this.item.bare();
  }

  get parts() {
    return [this.item];
  }

  withoutLineBreaks() {
    return new Capture(this.item.withoutLineBreaks(), this.scope);
  }

  refersTo(expression) {
    return this.item.refersTo(expression);
  }

  addBoundaries(boundaries) {
    this.item.addBoundaries(boundaries);
  }

  pattern(groups) {
    groups.add(this.scope);
    return `(${this.item.pattern(groups)})`;
  }

  operand(groups) {
    return this.pattern(groups);
  }
}

/** The groups a pattern holds, numbered in the order they are written, each with its scope. */
export class Groups {
  #scopes = [];

  /** Numbers a new group with the given scope, after the groups already written. */
  add(scope) {
    this.#scopes.push(scope);
    return this.#scopes.length;
  }

  /** Numbers the groups of another pattern, written next, after the groups already written. */
  addAll(other) {
    other.#scopes.forEach((scope) => this.add(scope));
  }

  /** The captures of a TextMate rule: each group's number with its scope. */
  toCaptures(offset = 0) {
    return Object.fromEntries(this.#scopes.map((scope, index) => [String(index + 1 + offset), { name: scope }]));
  }

  get size() {
    return this.#scopes.length;
  }
}

/** The text. */
export function text(value) {
  return value === '' ? EMPTY : new Text(value);
}

/** The items one after the other, with empty ones left out and a text joined with the text before it. */
export function sequence(items) {
  const flat = [];
  for (const item of items) {
    if (item.empty) {
      return NOTHING;
    }
    for (const part of item instanceof Sequence ? item.items : [item]) {
      const last = flat.at(-1);
      if (part === EMPTY) {
        continue;
      }
      if (part instanceof Text && last instanceof Text) {
        flat[flat.length - 1] = new Text(last.text + part.text);
      } else {
        flat.push(part);
      }
    }
  }
  if (flat.length === 0) {
    return EMPTY;
  }
  return flat.length === 1 ? flat[0] : new Sequence(flat);
}

/** The ranges of an expression that matches one character only, else undefined. */
function singleCharacterRanges(expression) {
  if (expression instanceof Characters) {
    return expression.ranges;
  }
  if (expression instanceof Text && [...expression.text].length === 1) {
    const code = expression.text.codePointAt(0);
    return [[code, code]];
  }
  return undefined;
}

/** The longest text an expression matches when its texts are finitely many, else Infinity. */
function longestText(expression) {
  const texts = expression.texts;
  return texts === undefined ? Infinity : Math.max(...texts.map((value) => [...value].length));
}

/**
 * One of the options, with options that match nothing, and repeated ones, left out. As Oniguruma
 * takes the first option that matches, and an ANTLR rule the longest, the options are put in an
 * order where none comes before an option that can match a longer text from the same place: the
 * options of finitely many texts by their longest text, the longer first, after the others, the
 * options of one character each made one set after them, and an option that can match the empty
 * text last.
 */
export function alternation(options) {
  const kept = new Map();
  const characters = [];
  for (const option of options) {
    for (const part of option instanceof Alternation ? option.options : [option]) {
      const ranges = singleCharacterRanges(part);
      if (ranges !== undefined) {
        characters.push(...ranges);
      } else if (!part.empty) {
        kept.set(part.pattern(new Groups()), part);
      }
    }
  }
  const parts = [...kept.values()];
  const longer = (a, b) => longestText(b) - longestText(a);
  const ordered = [
    ...parts.filter((part) => !part.nullable && part.texts === undefined),
    ...parts.filter((part) => !part.nullable && part.texts !== undefined).sort(longer),
    ...(characters.length > 0 ? [new Characters(characters)] : []).map((set) => (set.texts?.length === 1 ? text(set.texts[0]) : set)),
    ...parts.filter((part) => part.nullable),
  ];
  if (ordered.length === 0) {
    return NOTHING;
  }
  return ordered.length === 1 ? ordered[0] : new Alternation(ordered);
}

/**
 * The item from min to max times. A repetition of an unlimited repetition is written as one, as
 * (x+)+ is x+ and (x+)? is x*, so that Oniguruma does not try the ways of splitting a text between
 * the two, which can take it very long.
 */
export function repetition(item, min, max) {
  if (max === 0 || item === EMPTY) {
    return EMPTY;
  }
  if (item.empty) {
    return min === 0 ? EMPTY : NOTHING;
  }
  if (min === 1 && max === 1) {
    return item;
  }
  if (item instanceof Repetition && item.max === Infinity && item.min <= 1) {
    return repetition(item.item, item.min === 0 ? 0 : min, Infinity);
  }
  return new Repetition(item, min, max);
}

// How many pairs of states exploreTogether explores, at most, before it gives up: a lexer's rules need far fewer.
const EXPLORATION_LIMIT = 100000;

/** The starts of the ranges of characters that every expression reads alike, from the code point 0. */
export function classesOf(...expressions) {
  const boundaries = new Set([0]);
  expressions.forEach((expression) => expression.addBoundaries(boundaries));
  return [...boundaries].filter((code) => code <= MAX_CODE_POINT).sort((a, b) => a - b);
}

/**
 * Explores two expressions together, a character at a time, from their start, and calls visit with
 * what is left of each after every text that the first can read (the second is NOTHING once it can
 * read no more of it). Each pair of states is visited once.
 */
function exploreTogether(first, second, visit) {
  const seen = new Set();
  const pending = [[first, second]];
  while (pending.length > 0) {
    const [firstRest, secondRest] = pending.pop();
    const key = `${firstRest.pattern(new Groups())}\u0000${secondRest.pattern(new Groups())}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    if (seen.size > EXPLORATION_LIMIT) {
      throw new Error(`${first.pattern(new Groups())} and ${second.pattern(new Groups())} have too many states to explore`);
    }
    visit(firstRest, secondRest);
    for (const code of classesOf(firstRest, secondRest)) {
      const next = firstRest.derivative(code);
      if (!next.empty) {
        pending.push([next, secondRest.derivative(code)]);
      }
    }
  }
}

/** Whether an expression can match a longer text that starts with a whole match of another, first. */
export function goesOnAfter(expression, first) {
  let goesOn = false;
  exploreTogether(first, expression, (firstRest, rest) => {
    goesOn ||= firstRest.nullable && !rest.nonEmpty().empty;
  });
  return goesOn;
}

/** Whether two expressions match a text in common. */
export function overlap(first, second) {
  let common = false;
  exploreTogether(first, second, (firstRest, secondRest) => {
    common ||= firstRest.nullable && secondRest.nullable;
  });
  return common;
}

/** The non-empty matches of an expression that do not start with one of the given characters. */
function startingOutside(expression, excluded) {
  const codes = classesOf(expression, excluded);
  const options = [];
  codes.forEach((from, index) => {
    const rest = excluded.contains(from) ? NOTHING : expression.derivative(from);
    if (!rest.empty) {
      options.push(sequence([new Characters([[from, (codes[index + 1] ?? MAX_CODE_POINT + 1) - 1]]), rest]));
    }
  });
  return alternation(options);
}

/**
 * What an expression could go on with, once it has read a whole match of another, prefix: its
 * non-empty matches that start with a match of prefix, with that start taken off, and that do not
 * start with one of the excluded characters. Defined when that is written the same whichever match
 * of prefix it read (NOTHING when it cannot go on after any); undefined otherwise, as when it
 * differs from one match to another, for a rule that can go on after some matches only.
 */
export function uniformQuotient(prefix, expression, excluded = new Characters([])) {
  const rests = new Map();
  exploreTogether(prefix, expression, (prefixRest, rest) => {
    if (prefixRest.nullable) {
      const goingOn = startingOutside(rest, excluded);
      rests.set(goingOn.pattern(new Groups()), goingOn);
    }
  });
  return rests.size === 1 ? [...rests.values()][0] : rests.size === 0 ? NOTHING : undefined;
}

// How many characters shortestStarts writes out, at most, before it lets the rest stand as it is.
const STARTS_DEPTH = 2;

/**
 * An expression that matches at the same places as the non-empty matches of another, written by its
 * shortest starts: the first character, then, while the other could not stop yet, the next ones, up
 * to STARTS_DEPTH, and then the rest of the other as it is. A lookahead that only asks whether the
 * other matches there is then short, and quick for the engine, as (?!-[0-9A-Z_a-z]|[0-9A-Z_a-z]) is
 * for a name that may go on.
 */
export function shortestStarts(expression, depth = 0) {
  if (depth === STARTS_DEPTH) {
    return expression;
  }
  const starts = classesOf(expression);
  const rangesOfRest = new Map();
  starts.forEach((from, index) => {
    const to = (starts[index + 1] ?? MAX_CODE_POINT + 1) - 1;
    const rest = expression.derivative(from);
    if (!rest.empty) {
      const key = rest.pattern(new Groups());
      if (!rangesOfRest.has(key)) {
        rangesOfRest.set(key, { rest, ranges: [] });
      }
      rangesOfRest.get(key).ranges.push([from, to]);
    }
  });
  return alternation([...rangesOfRest.values()].map(({ rest, ranges }) =>
    sequence([new Characters(ranges), rest.nullable ? EMPTY : shortestStarts(rest, depth + 1)])));
}


/**
 * A match between delimiters that can go on after a line break, as a string literal can after an
 * escaped one: open, repeated items of body, close. Gives the parts, and the characters after which
 * the body can read a line break (the backslash of an escape), when an expression is of that form;
 * undefined otherwise.
 */
export function delimitedAcrossLines(expression) {
  if (!(expression instanceof Sequence) || expression.items.length !== 3) {
    return undefined;
  }
  const [open, repeated, close] = expression.items;
  if (!(open instanceof Text) || !(close instanceof Text) || !(repeated instanceof Repetition) || repeated.min !== 0
    || repeated.max !== Infinity) {
    return undefined;
  }
  const body = repeated.item;
  const codes = classesOf(body);
  const beforeLineBreak = codes.flatMap((from, index) => (from !== 0x0a && !body.derivative(from).derivative(0x0a).empty
    ? [[from, (codes[index + 1] ?? MAX_CODE_POINT + 1) - 1]] : []));
  return beforeLineBreak.length === 0 ? undefined
    : { open: open.text, body, close: close.text, beforeLineBreak: new Characters(beforeLineBreak) };
}

/** The characters that are, each on its own, a whole non-empty match of an expression. */
export function completingCharacters(expression) {
  const codes = classesOf(expression);
  return new Characters(codes.flatMap((from, index) => (expression.derivative(from).nullable
    ? [[from, (codes[index + 1] ?? MAX_CODE_POINT + 1) - 1]] : [])));
}

/** Whether an expression is a repetition whose item can be a line break: blanks that go over lines. */
function isGap(expression) {
  return expression instanceof Repetition && !expression.item.derivative(0x0a).empty;
}

/**
 * Where a line break can cut a match of an expression, which a TextMate grammar, reading one line
 * at a time, cannot follow: in blanks that go over lines (a gap), after a start that is not blank.
 * Gives the start (before), the gap's item, the blanks it reads other than line breaks, and what
 * must follow the gap (after, empty when nothing must); optional tells whether the gap and what
 * follows it can be left out, as in OTHERWISE ((TAB | SPACE | EOL)+ DISPLAY)?. Blanks that the match
 * can start with are left out of the start. Undefined for an expression with no such gap.
 */
export function lineBreakCutOf(expression) {
  if (!(expression instanceof Sequence)) {
    return undefined;
  }
  const items = isGap(expression.items[0]) && expression.items[0].min === 0 ? expression.items.slice(1) : expression.items;
  const isOptionalGroup = (item) => item instanceof Repetition && item.max === 1 && item.item instanceof Sequence
    && isGap(item.item.items[0]);
  const index = items.findIndex((item, position) => position > 0 && (isOptionalGroup(item) || isGap(item)));
  if (index < 0) {
    return undefined;
  }
  const before = sequence(items.slice(0, index));
  const cut = items[index];
  const optional = isOptionalGroup(cut);
  const [gap, ...inGroup] = optional ? cut.item.items : [cut];
  if (before.nullable) {
    return undefined;
  }
  const codes = classesOf(gap.item);
  const blanks = codes.flatMap((from, position) => (from !== 0x0a && gap.item.derivative(from).nullable
    ? [[from, (codes[position + 1] ?? MAX_CODE_POINT + 1) - 1]] : []));
  return { before, gap: gap.item, blanks: new Characters(blanks), after: sequence([...inGroup, ...items.slice(index + 1)]), optional };
}
