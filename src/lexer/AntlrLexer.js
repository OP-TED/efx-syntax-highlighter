// An ANTLR lexer, run from its table (src/efx<version>/generated/lexer.js, written by `npm run sync`
// from the lexer antlr-ng generates: scripts/sync/LexerTable.js), as ANTLR's own LexerATNSimulator
// runs it. In the mode on top of its stack of modes, it follows the network of states of the mode's
// rules over the text, one character at a time: from every state it is in, each transition the
// character takes, and on through the transitions that take none (ANTLR's closure). Where a rule
// reaches its end, a token of that rule could end there. It goes on while some state is left, and
// keeps the longest token, and of tokens of the same length the one whose rule comes first in the
// mode, as ANTLR does. The commands of the rule (-> type(...), skip, channel(...), pushMode(...),
// popMode, mode(...)) are those met on the way, in the rule itself and not in the rules it uses.
// Where no rule matches, ANTLR's lexer reports an error and goes on after the character where the
// rules stopped matching; so does this one.
//
// The sets of states it reaches are kept, each with where each character leads from it, so that a
// text is read through states already met (ANTLR's DFA).

const EPSILON = 0;
const RULE = 1;
const ACTION = 2;
const ATOM = 3;
const SET = 4;
const NOT_SET = 5;
const WILDCARD = 6;

// The end of the text, as ANTLR's EOF and as the reader of the text gives it.
const END = -1;

// The largest character, as ANTLR's lexer reads them.
const MAX_CHARACTER = 0x10ffff;

/** Whether a transition takes a character. */
function takes(transition, character) {
  const [kind] = transition;
  if (kind === ATOM) {
    return transition[2] === character;
  }
  if (character === END) {
    return false;
  }
  if (kind === WILDCARD) {
    return true;
  }
  let inRanges = false;
  for (let index = 2; index < transition.length; index += 2) {
    inRanges ||= transition[index] <= character && character <= transition[index + 1];
  }
  return kind === SET ? inRanges : kind === NOT_SET && !inRanges && character <= MAX_CHARACTER;
}

/** A list of states to return to, innermost first. */
class Returns {
  constructor(state, next) {
    this.state = state;
    this.next = next;
    this.key = next === null ? `${state}` : `${state}.${next.key}`;
  }
}

// Where a place stands toward a fragment rule whose text is looked for in a token (`spanOf`): before
// it, inside it, or after it.
const BEFORE = 0;
const INSIDE = 1;
const AFTER = 2;

/**
 * A place in the network: a state, the states the rules it is in return to (null when it is in a
 * token rule itself), the rank of its token rule in the mode, the commands met in that rule so far,
 * and, when a fragment is looked for, where it stands toward it.
 */
class Place {
  constructor(state, returns, rank, actions, stage = BEFORE) {
    this.state = state;
    this.returns = returns;
    this.rank = rank;
    this.actions = actions;
    this.stage = stage;
    this.key = `${state}/${returns?.key ?? ''}/${rank}/${actions.join(',')}/${stage}`;
  }

  /** The same place in another state, in rules that return to other states, with more commands or at another stage. */
  with({ state = this.state, returns = this.returns, actions = this.actions, stage = this.stage }) {
    return new Place(state, returns, this.rank, actions, stage);
  }
}

/**
 * A set of places the lexer can be in, with the token that ends there, if any, and the step each
 * character makes from it: the set it leads to, and for each place there, and then for the token,
 * the place of this set it came from (the first one, in the order ANTLR meets them).
 */
class Places {
  constructor(places, accepted, rules, fragmentStart) {
    this.places = places;
    this.accepted = accepted;
    // The rules of the mode, by rank.
    this.rules = rules;
    // The start state of the fragment whose text is looked for (spanOf), if any: the same places
    // step otherwise when it is, as they enter it.
    this.fragmentStart = fragmentStart;
    this.next = new Map();
  }
}

// The most sets of places the lexer keeps. Past it, it still reads as ANTLR does, without keeping
// what it meets: the sets are finite but for rules that call themselves, which make one for each depth.
const MOST_KEPT = 50000;

export class AntlrLexer {
  #table;
  // The modes by name, each with its start state, its rules in their order and its first places.
  #modes;
  // For each rule's stop state, the rule.
  #ruleOfStop = new Map();
  // For each rule's start state, the rule.
  #ruleOfStart = new Map();
  // The places at the start of a token of one rule, where a fragment is looked for, by the rule and
  // the fragment.
  #ruleFirsts = new Map();
  // Every set of places kept, by its contents and the rules it is in, so that one set is kept once.
  #kept = new Map();

  constructor(table) {
    this.#table = table;
    table.rules.forEach((rule, index) => {
      this.#ruleOfStart.set(rule.start, index);
      this.#ruleOfStop.set(rule.stop, index);
    });
    this.#modes = new Map(table.modes.map(({ name, start }) => {
      const rules = table.states[start].map(([, ruleStart]) => this.#ruleOfStart.get(ruleStart));
      return [name, { start, rules, first: undefined }];
    }));
  }

  /**
   * What the lexer reads at the start of a text in a mode, the text read through
   * `characterAt(offset)`, which gives a character code, or -1 past the end: the token, with its
   * rule, its type, whether it is skipped or hidden and the commands it gives the stack of modes, or
   * no token where no rule matches; the length of the token, or of the text ANTLR's lexer skips after
   * an error; and the extent of the text read to decide, from the start.
   */
  match(mode, characterAt) {
    let places = this.#firstPlaces(mode);
    let token;
    let length = 0;
    let offset = 0;
    let character;
    for (; ; offset += 1) {
      character = characterAt(offset);
      const next = this.#step(places, character);
      if (next === null) {
        break;
      }
      places = next.places;
      if (places.accepted !== undefined) {
        token = places.accepted;
        length = character === END ? offset : offset + 1;
      }
      if (character === END) {
        break;
      }
    }
    // Where no rule matches, ANTLR's lexer goes on after the character where its rules stopped
    // matching, if any.
    if (token === undefined) {
      length = character === END ? offset : offset + 1;
    }
    return { token, length, extent: offset + 1 };
  }

  /**
   * Where a token uses a fragment rule itself: the offsets where it enters the fragment the first
   * time and leaves it, or undefined if it does not. The token is the one `match` found at the start
   * of a text, of its rule and length; only its rule is followed. The sets of places are kept as in
   * `match`; each step between them says where each of its places came from, so that the offsets,
   * which the sets do not hold, follow the places through them.
   */
  spanOf(characterAt, token, fragment) {
    const fragmentStart = this.#table.rules.find(({ name }) => name === fragment).start;
    let places = this.#firstPlacesOf(token.rule, fragmentStart);
    // Where each place, and the token that ends there, entered and left the fragment.
    const spanOfStage = (stage, offset) => (stage === BEFORE ? null : { from: offset, to: stage === AFTER ? offset : undefined });
    let spans = [...places.places, places.accepted].map((place) => (place === undefined ? null : spanOfStage(place.stage, 0)));
    // The token's characters, and the end of the text after them, where `match` took it.
    const steps = characterAt(token.length) === END ? token.length + 1 : token.length;
    for (let offset = 0; offset < steps; offset += 1) {
      const next = this.#step(places, characterAt(offset));
      if (next === null) {
        if (offset === token.length) {
          break;
        }
        return undefined;
      }
      if (offset === token.length && next.places.accepted === undefined) {
        break;
      }
      const before = places.places;
      spans = [...next.places.places, next.places.accepted].map((place, index) => {
        if (place === undefined) {
          return null;
        }
        const origin = next.from[index];
        const span = spans[origin];
        const stage = before[origin].stage;
        if (stage === place.stage) {
          return span;
        }
        const at = Math.min(offset + 1, token.length);
        return { from: stage === BEFORE ? at : span.from, to: place.stage === AFTER ? at : undefined };
      });
      places = next.places;
    }
    const span = places?.accepted === undefined ? undefined : spans.at(-1);
    return span?.to === undefined ? undefined : span;
  }

  /**
   * Whether a character can start the text of a fragment rule: whether some transition the rule can
   * take first takes it.
   */
  canStart(fragment, character) {
    const start = this.#table.rules.find(({ name }) => name === fragment).start;
    const seen = new Set();
    const visit = (state) => {
      if (seen.has(state)) {
        return false;
      }
      seen.add(state);
      return this.#table.states[state].some((transition) => {
        const [kind, target] = transition;
        if (kind === EPSILON || kind === ACTION) {
          return visit(target);
        }
        return kind === RULE ? visit(target) : takes(transition, character);
      });
    };
    return visit(start);
  }

  /** The names of the rules of a mode that use a fragment rule themselves. */
  rulesUsing(mode, fragment) {
    const fragmentStart = this.#table.rules.find(({ name }) => name === fragment)?.start;
    return this.#rulesOf(mode).filter((rule) => this.#statesOf(rule).some((state) =>
      this.#table.states[state].some(([kind, target]) => kind === RULE && target === fragmentStart)))
      .map((rule) => this.#table.rules[rule].name);
  }

  /** The stack of modes, a list of mode names, after some commands. */
  static modesAfter(stack, commands) {
    let modes = stack;
    for (const [command, mode] of commands) {
      if (command === 'pushMode') {
        modes = [...modes, mode];
      } else if (command === 'popMode') {
        modes = modes.slice(0, -1);
      } else {
        modes = [...modes.slice(0, -1), mode];
      }
    }
    return modes;
  }

  #rulesOf(mode) {
    const entry = this.#modes.get(mode);
    if (entry === undefined) {
      throw new RangeError(`The lexer has no mode ${mode}`);
    }
    return entry.rules;
  }

  /** The states of a rule itself, not those of the rules it uses. */
  #statesOf(rule) {
    const states = new Set();
    const visit = (state) => {
      if (states.has(state)) {
        return;
      }
      states.add(state);
      for (const transition of this.#table.states[state]) {
        visit(transition[0] === RULE ? transition[2] : transition[1]);
      }
    };
    visit(this.#table.rules[rule].start);
    return [...states];
  }

  /** The places at the start of a token of one rule, where a fragment is looked for, kept once made. */
  #firstPlacesOf(ruleName, fragmentStart) {
    const key = `${ruleName}/${fragmentStart}`;
    if (!this.#ruleFirsts.has(key)) {
      const rule = this.#table.rules.findIndex(({ name }) => name === ruleName);
      const places = [];
      const accepted = [];
      this.#close(new Place(this.#table.rules[rule].start, null, 0, []),
        { places, accepted, seen: new Set(), rules: [rule], fragmentStart, from: [], acceptedFrom: [], origin: 0 });
      this.#ruleFirsts.set(key, new Places(places, accepted[0], [rule], fragmentStart));
    }
    return this.#ruleFirsts.get(key);
  }

  /** The places at the start of a token in a mode, kept once made. */
  #firstPlaces(mode) {
    const entry = this.#modes.get(mode);
    if (entry === undefined) {
      throw new RangeError(`The lexer has no mode ${mode}`);
    }
    if (entry.first !== undefined) {
      return entry.first;
    }
    const places = [];
    const accepted = [];
    const seen = new Set();
    this.#table.states[entry.start].forEach(([, ruleStart], rank) => this.#close(new Place(ruleStart, null, rank, []),
      { places, accepted, seen, rules: entry.rules, from: [], acceptedFrom: [], origin: 0 }));
    entry.first = new Places(places, accepted[0], entry.rules);
    return entry.first;
  }

  /**
   * The step a character makes from some places: the places it leads to, and where each came from;
   * null if it leads to none. Each step is kept, and each set of places once, to the limit.
   */
  #step(places, character) {
    const { fragmentStart } = places;
    if (places.next.has(character)) {
      return places.next.get(character);
    }
    const reached = [];
    const accepted = [];
    const closing = { places: reached, accepted, seen: new Set(), rules: places.rules, fragmentStart, from: [],
      acceptedFrom: [], origin: 0 };
    places.places.forEach((place, origin) => {
      closing.origin = origin;
      for (const transition of this.#table.states[place.state]) {
        if (transition[0] >= ATOM && takes(transition, character)) {
          this.#close(place.with({ state: transition[1] }), closing);
        }
      }
    });
    if (reached.length === 0 && accepted.length === 0) {
      return this.#keep(places, character, null);
    }
    const target = this.#kept.get(this.#keyOf(reached, accepted[0], places.rules, fragmentStart))
      ?? new Places(reached, accepted[0], places.rules, fragmentStart);
    return this.#keep(places, character, { places: target, from: [...closing.from, closing.acceptedFrom[0]] });
  }

  /** Keeps a step, and the set it leads to, while there is room; the step. */
  #keep(places, character, step) {
    if (this.#kept.size < MOST_KEPT) {
      places.next.set(character, step);
      if (step !== null) {
        const { places: kept } = step;
        this.#kept.set(this.#keyOf(kept.places, kept.accepted, kept.rules, kept.fragmentStart), kept);
      }
    }
    return step;
  }

  /**
   * What tells a set of places from another: its places in order, its token, the rules it is in, and
   * the fragment looked for, if any.
   */
  #keyOf(places, accepted, rules, fragmentStart) {
    const token = accepted === undefined ? '' : `${accepted.rule}/${accepted.type}/${accepted.stage}/${JSON.stringify(accepted.commands)}/${accepted.skipped}/${accepted.hidden}`;
    return `${rules.join(',')}|${fragmentStart ?? ''}|${places.map(({ key }) => key).join(';')}|${token}`;
  }

  /**
   * Adds a place and every place it leads to through transitions that take no character: the places
   * that take one, and the token whose rule ends there, in the order ANTLR meets them.
   */
  #close(place, closing) {
    const { places, accepted, seen, rules, fragmentStart, from, acceptedFrom, origin } = closing;
    if (seen.has(place.key)) {
      return;
    }
    seen.add(place.key);
    if (this.#ruleOfStop.has(place.state)) {
      if (place.returns === null) {
        accepted.push({ ...this.#token(rules[place.rank], place.actions), stage: place.stage });
        acceptedFrom.push(origin);
        return;
      }
      const leaving = place.stage === INSIDE && place.returns.next === null;
      this.#close(place.with({ state: place.returns.state, returns: place.returns.next,
        stage: leaving ? AFTER : place.stage }), closing);
      return;
    }
    let takesCharacters = false;
    for (const transition of this.#table.states[place.state]) {
      const [kind, target] = transition;
      if (kind === EPSILON) {
        this.#close(place.with({ state: target }), closing);
      } else if (kind === RULE) {
        const entering = place.stage === BEFORE && target === fragmentStart && place.returns === null;
        this.#close(place.with({ state: target, returns: new Returns(transition[2], place.returns),
          stage: entering ? INSIDE : place.stage }), closing);
      } else if (kind === ACTION) {
        const actions = place.returns === null ? [...place.actions, transition[2]] : place.actions;
        this.#close(place.with({ state: target, actions }), closing);
      } else {
        takesCharacters = true;
      }
    }
    if (takesCharacters) {
      places.push(place);
      from.push(origin);
    }
  }

  /** The token a rule makes with the commands met on its way. */
  #token(rule, actions) {
    const { name, type } = this.#table.rules[rule];
    const token = { rule: name, type, skipped: false, hidden: false, commands: [] };
    for (const [command, argument] of actions.map((action) => this.#table.actions[action])) {
      if (command === 'type') {
        token.type = argument;
      } else if (command === 'skip') {
        token.skipped = true;
      } else if (command === 'channel') {
        token.hidden = argument !== 0;
      } else {
        token.commands.push(argument === undefined ? [command] : [command, argument]);
      }
    }
    return token;
  }
}
