// The highlighting the package gives a text (efxHighlights, as an editor's parser reads it), as a
// list of runs: each run of text with the same highlight tag, one per line, as `line:column`, the
// tag and the text, separated by tabs. Text with no tag is left out.

import { efxHighlights } from '../../dist/efxHighlights.js';

export class StyleDump {
  /** The runs of a text of one kind and version of EFX. */
  static of(text, kind, version) {
    const lineStarts = StyleDump.#lineStarts(text);
    return efxHighlights(text, kind, { version }).map(({ from, to, tag }) => {
      const line = lineStarts.findLastIndex((start) => start <= from);
      return `${line + 1}:${from - lineStarts[line] + 1}\t${tag}\t${JSON.stringify(text.slice(from, to))}`;
    });
  }

  static #lineStarts(text) {
    return [0, ...Array.from(text.matchAll(/\n/g), (match) => match.index + 1)];
  }
}
