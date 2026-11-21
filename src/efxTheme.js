// The look of EFX in an editor: the colour of each highlight tag, and a look for the editor itself.
// - efxHighlightStyle, the EFX colours for a light background, which efx() gives the editor as its
//   default colours; and efxTheme, a light look for the editor, which an application adds if it wants it.
// - efxDarkHighlightStyle, the same colours for a dark background; and efxDarkTheme, a dark look for the
//   editor together with those colours, which an application adds instead of efxTheme on a dark screen.
// Every colour reaches 4.5:1 against its background, the contrast WCAG 2.1 AA and EN 301 549 require
// for text of this size, bold or not (test/colours.js checks it). Both sets keep the same hue for the
// same kind of word: purple for keywords, green for fields and nodes, orange for variables and
// declared functions, pink for literals and names of assets, and grey for operators and punctuation.
import { tags as t } from "@lezer/highlight";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { EditorView } from "@codemirror/view";

// The background each set of colours is made for.
export const LIGHT_BACKGROUND = "#ffffff";
export const DARK_BACKGROUND = "#1e1f22";

/** The highlight style of a palette: the colour, and the weight or slant, of each highlight tag. */
function styleOf(colours) {
  return HighlightStyle.define([
    { tag: t.keyword, color: colours.keyword, fontWeight: "bold" },
    { tag: t.typeName, color: colours.keyword },
    { tag: t.literal, color: colours.literal },
    { tag: t.propertyName, color: colours.data, fontWeight: "bold" },
    { tag: t.variableName, color: colours.variable, fontWeight: "bold" },
    { tag: t.function(t.name), color: colours.variable, fontWeight: "bold" },
    { tag: t.function(t.keyword), color: colours.keyword, fontWeight: "bold" },
    { tag: t.name, color: colours.name },
    { tag: t.className, color: colours.keyword },
    { tag: t.operator, color: colours.operator, fontWeight: "bold" },
    { tag: t.punctuation, color: colours.operator },
    { tag: t.bracket, color: colours.operator, fontWeight: "bold" },
    { tag: t.lineComment, color: colours.comment, fontStyle: "italic" },
    { tag: t.special(t.name), color: colours.literal },
    { tag: t.special(t.string), color: colours.text },
  ]);
}

// The colours of each palette, by the kind of word they mark.
export const LIGHT_COLOURS = {
  keyword: "#7058be",
  data: "#208559",
  variable: "#a96508",
  literal: "#dc2b60",
  operator: "#6d6d6d",
  comment: "#757575",
  name: "#24292e",
  text: "#000000",
};

export const DARK_COLOURS = {
  keyword: "#afa1db",
  data: "#2ec081",
  variable: "#f3920c",
  literal: "#f08cab",
  operator: "#b4b4b4",
  comment: "#8c8c8c",
  name: "#c9d1d9",
  text: "#e6e6e6",
};

export const efxHighlightStyle = styleOf(LIGHT_COLOURS);

export const efxDarkHighlightStyle = styleOf(DARK_COLOURS);

export const efxTheme = EditorView.theme({
  "&": {
    backgroundColor: LIGHT_BACKGROUND,
    color: "#000000"
  },
  ".cm-content": {
    backgroundColor: LIGHT_BACKGROUND,
    caretColor: "#000000"
  },
  ".cm-cursor, .cm-dropCursor": {
    borderLeftColor: "#000000 !important",
    borderLeftWidth: "2px !important",
    borderLeftStyle: "solid !important"
  },
  ".cm-selectionMatch": {
    backgroundColor: "#add6ff !important"
  },
  "&.cm-focused .cm-cursor": {
    borderLeftColor: "#000000 !important"
  }
});

export const efxDarkTheme = [
  EditorView.theme({
    "&": {
      backgroundColor: DARK_BACKGROUND,
      color: DARK_COLOURS.text
    },
    ".cm-content": {
      backgroundColor: DARK_BACKGROUND,
      caretColor: "#ffffff"
    },
    ".cm-cursor, .cm-dropCursor": {
      borderLeftColor: "#ffffff !important",
      borderLeftWidth: "2px !important",
      borderLeftStyle: "solid !important"
    },
    "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection": {
      backgroundColor: "#264f78 !important"
    },
    ".cm-selectionMatch": {
      backgroundColor: "#3a3d41 !important"
    },
    "&.cm-focused .cm-cursor": {
      borderLeftColor: "#ffffff !important"
    }
  }, { dark: true }),
  syntaxHighlighting(efxDarkHighlightStyle),
];
