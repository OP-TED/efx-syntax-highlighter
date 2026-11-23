// The rules of an ANTLR lexer grammar (EfxLexer.g4), read from its text: for each mode, its token
// rules in their order, each with the regular expression it matches (RegularExpression.js), with
// its fragments in place, and its commands. It reads what EfxLexer.g4 is written with: string
// literals, character sets and their negation, the wildcard, EOF, rule references, groups,
// alternatives, the ?, * and + operators, and commands. Anything else stops the sync, so that a
// grammar written otherwise is noticed rather than misread.

import {
  Alternation, Capture, Characters, END_OF_TEXT, Repetition, SELF, Sequence, alternation, repetition, sequence, text,
} from './RegularExpression.js';

// The commands of a rule that the sync reads: what token it makes, and the modes it enters and leaves.
const COMMANDS = ['skip', 'channel', 'type', 'pushMode', 'popMode', 'mode'];

// The escapes of ANTLR string literals and character sets.
const ESCAPES = { n: '\n', r: '\r', t: '\t', f: '\f', b: '\b', '\\': '\\', "'": "'", '"': '"', ']': ']', '-': '-' };

// The parts of the grammar's text: names, literals, sets, operators, and blanks and comments, which
// are skipped.
const PARTS = /(?<blank>\s+|\/\/[^\n]*|\/\*[\s\S]*?\*\/)|(?<name>[A-Za-z_][A-Za-z0-9_]*)|(?<literal>'(?:\\.|[^'\\])*')|(?<set>\[(?:\\.|[^\]\\])*\])|(?<operator>->|[:;|()?*+~.,{}])/y;

/** The parts of a grammar's text, read one at a time. */
class Parts {
  #text;
  #index = 0;
  #next;

  constructor(textOfGrammar) {
    this.#text = textOfGrammar;
    this.#advance();
  }

  get next() {
    return this.#next;
  }

  /** Takes the next part, which must be the given operator or name when one is given. */
  take(expected) {
    const part = this.#next;
    if (part === undefined || (expected !== undefined && part.value !== expected)) {
      throw new Error(`EfxLexer.g4: expected ${expected ?? 'more'} at ${this.#where()}, found ${part?.value ?? 'the end'}`);
    }
    this.#advance();
    return part;
  }

  /** Takes the next part when it is the given operator, and says whether it was. */
  takeIf(value) {
    if (this.#next?.value === value && this.#next.kind !== 'literal') {
      this.#advance();
      return true;
    }
    return false;
  }

  #advance() {
    for (;;) {
      if (this.#index >= this.#text.length) {
        this.#next = undefined;
        return;
      }
      PARTS.lastIndex = this.#index;
      const match = PARTS.exec(this.#text);
      if (match === null) {
        throw new Error(`EfxLexer.g4: cannot read the text at ${this.#where()}`);
      }
      this.#index = PARTS.lastIndex;
      const [kind, value] = Object.entries(match.groups).find(([, part]) => part !== undefined);
      if (kind !== 'blank') {
        this.#next = { kind, value, at: match.index };
        return;
      }
    }
  }

  #where() {
    const at = this.#next?.at ?? this.#index;
    return `line ${this.#text.slice(0, at).split('\n').length}`;
  }
}

/** The characters of a string literal or of the inside of a character set, with escapes read. */
function unescaped(body) {
  return body.replace(/\\(u\{[0-9a-fA-F]+\}|u[0-9a-fA-F]{4}|.)/g, (_, escape) => {
    if (escape.startsWith('u') && escape.length > 1) {
      return String.fromCodePoint(Number.parseInt(escape.replace(/[u{}]/g, ''), 16));
    }
    if (ESCAPES[escape] === undefined) {
      throw new Error(`EfxLexer.g4: unknown escape \\${escape}`);
    }
    return ESCAPES[escape];
  });
}

// One character of a set, written as itself or as an escape, or an unescaped dash between two.
const SET_PART = /\\(u\{[0-9a-fA-F]+\}|u[0-9a-fA-F]{4}|.)|(-)|([\s\S])/gu;

/** The ranges of a character set written between brackets, such as [a-zA-Z_\-]. */
function rangesOf(set) {
  const items = Array.from(set.slice(1, -1).matchAll(SET_PART), ([written, escape, dash]) =>
    dash !== undefined ? { dash: true } : { code: unescaped(escape === undefined ? written : `\\${escape}`).codePointAt(0) });
  const ranges = [];
  for (let index = 0; index < items.length; index += 1) {
    const [first, dash, last] = items.slice(index, index + 3);
    if (dash?.dash && last !== undefined && !last.dash && !first.dash) {
      ranges.push([first.code, last.code]);
      index += 2;
    } else {
      // A dash first or last in the set stands for itself.
      const code = first.dash ? 0x2d : first.code;
      ranges.push([code, code]);
    }
  }
  return ranges;
}

/** A token rule of a mode: its name, its expression, and its commands. */
export class LexerRule {
  constructor(name, mode, expression, commands) {
    this.name = name;
    this.mode = mode;
    this.expression = expression;
    this.commands = commands;
  }

  /** The type of the tokens it makes: its own name, or the one its type command gives. */
  get type() {
    return this.commands.find((command) => command.name === 'type')?.argument ?? this.name;
  }

  /** Whether its tokens are left out of what the parser reads (skip, or a channel other than the default). */
  get hidden() {
    return this.commands.some((command) => command.name === 'skip' || command.name === 'channel');
  }

  /**
   * What it does to the stack of modes: how many modes it leaves (0 or 1), then the modes it enters,
   * the last on top. mode(X) leaves the current mode and enters X.
   */
  get modeChange() {
    let leaves = 0;
    const enters = [];
    const leave = () => {
      if (enters.length > 0) {
        enters.pop();
      } else {
        leaves += 1;
      }
    };
    for (const { name, argument } of this.commands) {
      if (name === 'popMode') {
        leave();
      } else if (name === 'pushMode') {
        enters.push(argument);
      } else if (name === 'mode') {
        leave();
        enters.push(argument);
      }
    }
    if (leaves > 1) {
      throw new Error(`EfxLexer.g4: ${this.name} leaves ${leaves} modes at once, which a TextMate grammar cannot follow`);
    }
    return { leaves, enters };
  }
}

export class LexerGrammar {
  /** The modes, by name, each with its token rules in their order. */
  modes;

  constructor(modes) {
    this.modes = modes;
  }

  /**
   * Reads the text of a lexer grammar. Each occurrence of a fragment named in captured is kept
   * apart, with the given scope, as a group of the expressions that use it.
   */
  static parse(textOfGrammar, { captured = {} } = {}) {
    const parts = new Parts(textOfGrammar);
    const definitions = [];
    let mode = 'DEFAULT_MODE';
    parts.take('lexer');
    parts.take('grammar');
    parts.take();
    parts.take(';');
    while (parts.next !== undefined) {
      if (parts.takeIf('channels')) {
        parts.take('{');
        while (!parts.takeIf('}')) {
          parts.take();
        }
      } else if (parts.takeIf('mode')) {
        mode = parts.take().value;
        parts.take(';');
      } else {
        definitions.push(LexerGrammar.#definition(parts, mode));
      }
    }
    const byName = new Map(definitions.map((definition) => [definition.name, definition]));
    const resolving = new Set();
    const expressions = new Map();
    const expressionOf = (name) => {
      if (!expressions.has(name)) {
        const definition = byName.get(name);
        if (definition === undefined) {
          throw new Error(`EfxLexer.g4: no rule named ${name}`);
        }
        resolving.add(name);
        const body = definition.body((reference) => {
          if (reference === name) {
            return SELF;
          }
          if (resolving.has(reference)) {
            throw new Error(`EfxLexer.g4: ${reference} and ${name} refer to each other, which the sync does not read`);
          }
          const expression = expressionOf(reference);
          return captured[reference] === undefined ? expression : new Capture(expression, captured[reference]);
        });
        resolving.delete(name);
        expressions.set(name, LexerGrammar.#withoutSelf(name, body));
      }
      return expressions.get(name);
    };
    const modes = new Map();
    for (const definition of definitions.filter(({ fragment }) => !fragment)) {
      if (!modes.has(definition.mode)) {
        modes.set(definition.mode, []);
      }
      modes.get(definition.mode).push(new LexerRule(definition.name, definition.mode, expressionOf(definition.name),
        definition.commands));
    }
    return new LexerGrammar(modes);
  }

  /**
   * The expression of a rule that may refer to itself, as MixedIndent of EFX-1 does: when every
   * alternative ends with the rule repeated, R: A R* | B R*, the rule matches (A | B)+; a rule that
   * refers to itself otherwise stops the sync.
   */
  static #withoutSelf(name, body) {
    const options = body instanceof Alternation ? body.options : [body];
    const startsOf = options.map((option) => {
      const items = option instanceof Sequence ? option.items : [option];
      const last = items.at(-1);
      return last instanceof Repetition && last.item === SELF && last.min === 0 && last.max === Infinity
        ? sequence(items.slice(0, -1))
        : option;
    });
    const unchanged = startsOf.filter((start, index) => start === options[index]);
    if (unchanged.length === startsOf.length && !body.refersTo(SELF)) {
      return body;
    }
    if (unchanged.length > 0 || startsOf.some((start) => start.refersTo(SELF))) {
      throw new Error(`EfxLexer.g4: ${name} refers to itself other than at the end of each alternative, `
        + 'which the sync does not read');
    }
    return repetition(alternation(startsOf), 1, Infinity);
  }

  /** A rule's definition: its name, whether it is a fragment, and its body, read once its references are. */
  static #definition(parts, mode) {
    const fragment = parts.takeIf('fragment');
    const name = parts.take().value;
    parts.take(':');
    const body = LexerGrammar.#alternatives(parts);
    const commands = [];
    if (parts.takeIf('->')) {
      do {
        const command = parts.take().value;
        if (!COMMANDS.includes(command)) {
          throw new Error(`EfxLexer.g4: ${name} has the command ${command}, which the sync does not read`);
        }
        let argument;
        if (parts.takeIf('(')) {
          argument = parts.take().value;
          parts.take(')');
        }
        commands.push({ name: command, argument });
      } while (parts.takeIf(','));
    }
    parts.take(';');
    return { name, mode, fragment, commands, body };
  }

  /** Alternatives separated by |, as a function of how the references are resolved. */
  static #alternatives(parts) {
    const options = [LexerGrammar.#sequence(parts)];
    while (parts.takeIf('|')) {
      options.push(LexerGrammar.#sequence(parts));
    }
    return (resolve) => alternation(options.map((option) => option(resolve)));
  }

  static #sequence(parts) {
    const items = [];
    while (parts.next !== undefined && !['|', ')', ';', '->'].includes(parts.next.value)) {
      items.push(LexerGrammar.#repeated(parts));
    }
    return (resolve) => sequence(items.map((item) => item(resolve)));
  }

  static #repeated(parts) {
    const element = LexerGrammar.#element(parts);
    const bounds = { '?': [0, 1], '*': [0, Infinity], '+': [1, Infinity] }[parts.next?.value];
    if (bounds === undefined || parts.next.kind === 'literal') {
      return element;
    }
    parts.take();
    if (parts.next?.value === '?') {
      throw new Error('EfxLexer.g4: a non-greedy operator, which the sync does not read');
    }
    return (resolve) => repetition(element(resolve), ...bounds);
  }

  static #element(parts) {
    const part = parts.take();
    if (part.kind === 'literal') {
      const value = unescaped(part.value.slice(1, -1));
      return () => text(value);
    }
    if (part.kind === 'set') {
      const ranges = rangesOf(part.value);
      return () => new Characters(ranges);
    }
    if (part.value === '~') {
      const negated = parts.take();
      if (negated.kind === 'set') {
        const ranges = rangesOf(negated.value);
        return () => Characters.notIn(ranges);
      }
      if (negated.kind === 'literal' && [...unescaped(negated.value.slice(1, -1))].length === 1) {
        const code = unescaped(negated.value.slice(1, -1)).codePointAt(0);
        return () => Characters.notIn([[code, code]]);
      }
      throw new Error(`EfxLexer.g4: the sync reads ~ only before a set or a single character, not ${negated.value}`);
    }
    if (part.value === '.') {
      return () => Characters.notIn([]);
    }
    if (part.value === '(') {
      const group = LexerGrammar.#alternatives(parts);
      parts.take(')');
      return group;
    }
    if (part.kind === 'name') {
      return part.value === 'EOF' ? () => END_OF_TEXT : (resolve) => resolve(part.value);
    }
    throw new Error(`EfxLexer.g4: the sync does not read ${part.value}`);
  }
}
