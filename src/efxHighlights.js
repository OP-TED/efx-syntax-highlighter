// The highlighting of an EFX text without an editor, for an application that colours EFX in its own
// way, such as an editor that is not CodeMirror: the ranges of the text that the EFX colours colour,
// each with the name of its highlight tag, as the parser of an editor reads the text.
import { highlightTree } from "@lezer/highlight";
import { languageOf } from "./efxLanguage.js";

// Names a range by its highlight tag, as Lezer writes it: "keyword", "string", "function(keyword)".
const TAG_NAMES = { style: (tags) => tags.map(String).join(" ") };

/**
 * The highlighted ranges of a text of one kind of EFX, in their order: from and to are offsets in the
 * text, and tag is the name of the range's highlight tag. Text that no tag colours, such as blanks, is
 * in no range. The kinds and versions are those of efx().
 */
export function efxHighlights(text, kind, { version = 2 } = {}) {
  const { parser } = languageOf(kind, version);
  const highlights = [];
  highlightTree(parser.parse(text), TAG_NAMES, (from, to, tag) => highlights.push({ from, to, tag }));
  return highlights;
}
