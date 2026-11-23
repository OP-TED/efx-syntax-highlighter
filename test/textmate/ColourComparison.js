// The colours the TextMate grammar and the parser give one text, compared character by character,
// blanks left out, as no colour shows on them. A character is:
// - the same, when both give it the same highlight tag (or none);
// - vaguer, when the grammar gives it the tag that the style table gives its token's type whatever
//   the parent, and the parser, which sees the parent, another one; or no tag, where the style table
//   styles the type only under some parents: a regular expression cannot see the parent;
// - a problem otherwise: missing, when the grammar leaves plain what the parser colours, or wrong,
//   when it colours it otherwise. A word the grammar does not know, or an id pattern it gets wrong,
//   is a problem.
// The name tag of plain identifiers counts as no tag, as it colours them as the text around them.

import { efxHighlights } from '../../dist/efxHighlights.js';
import { languageOf } from '../../dist/efxLanguage.js';

const PLAIN = 'name';

const BLANK = /\s/;

/** A tag, with the plain one as none. */
function shown(tag) {
  return tag === PLAIN ? undefined : tag;
}

export class ColourComparison {
  /** The number of characters compared, the same, and vaguer. */
  counts = { characters: 0, same: 0, vaguer: 0 };

  /** The runs of characters that are problems, one for each token: where, its type, and the two tags. */
  problems = [];

  /** The vaguer characters, counted by their token's type and the two tags. */
  vaguer = new Map();

  /**
   * Compares the colours of a text of one kind and version of EFX: the parser's, and those of the
   * TextMate grammar (TextMateColours). tagOfType gives the tag the style table gives a type
   * whatever its parent.
   */
  constructor(name, text, { kind, version, textMate, tagOfType }) {
    const parser = this.#parserTagsOf(text, kind, version);
    const types = this.#tokenTypesOf(text, kind, version);
    const grammar = textMate.tagsOf(text);
    for (let index = 0; index < text.length; index += 1) {
      if (!BLANK.test(text[index])) {
        this.#compare(name, text, index, { parser: shown(parser[index]), grammar: shown(grammar[index]),
          type: types[index], free: shown(tagOfType(types[index])) });
      }
    }
  }

  #compare(name, text, index, { parser, grammar, type, free }) {
    this.counts.characters += 1;
    if (parser === grammar) {
      this.counts.same += 1;
      return;
    }
    if ((grammar === free && parser !== free) || (grammar === undefined && free === undefined)) {
      this.counts.vaguer += 1;
      const key = `${type}: parser ${parser}, TextMate ${grammar}`;
      this.vaguer.set(key, (this.vaguer.get(key) ?? 0) + 1);
      return;
    }
    const kind = grammar === undefined ? 'missing' : 'wrong';
    const last = this.problems.at(-1);
    if (last !== undefined && last.end === index && last.kind === kind && last.type === type && last.parser === parser
      && last.grammar === grammar) {
      last.end = index + 1;
      return;
    }
    const lineStart = text.lastIndexOf('\n', index - 1) + 1;
    const line = text.slice(0, index).split('\n').length;
    this.problems.push({ at: `${name}:${line}:${index - lineStart + 1}`, end: index + 1, kind, type, parser, grammar });
  }

  /** The highlight tag the parser gives each character of a text. */
  #parserTagsOf(text, kind, version) {
    const tags = new Array(text.length);
    for (const { from, to, tag } of efxHighlights(text, kind, { version })) {
      tags.fill(tag, from, to);
    }
    return tags;
  }

  /** The type of the token over each character of a text, as the parser reads it. */
  #tokenTypesOf(text, kind, version) {
    const types = new Array(text.length);
    languageOf(kind, version).parser.parse(text).iterate({
      enter: (node) => {
        if (node.node.firstChild === null) {
          types.fill(node.name, node.from, node.to);
        }
      },
    });
    return types;
  }
}
