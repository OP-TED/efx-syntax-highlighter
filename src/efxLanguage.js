// CodeMirror 6 language support for EFX. Each version of EFX has its grammar: EFX-2, the language of
// the eForms SDK 2, and EFX-1, the language of the SDK 1. A grammar reads some kinds of EFX text,
// each from a top of its own; an editor holds one kind, so there is one language per kind and
// version. The parsers carry the highlight tags (efx2/efx2Highlighting.js, efx1/efx1Highlighting.js); the
// EFX colours are the editor's default colours. An EFX-2 language offers its completions
// (efx2/completion/EfxCompletions.js) to the editor's autocompletion, which the application turns on; EFX-1
// is highlighted only.
import { Language, LanguageSupport, defineLanguageFacet, languageDataProp, syntaxHighlighting } from "@codemirror/language";
import { EfxCompletions } from "./efx2/completion/EfxCompletions.js";
import { parser as efx1Parser } from "./efx1/parser.js";
import { parser as efx2Parser } from "./efx2/parser.js";
import { efxHighlightStyle } from "./efxTheme.js";
import { EditorParser } from "./lexer/EditorParser.js";

// How each grammar reads each kind of EFX text: its top, and the dialect of a bare expression; and
// whether it offers completions. EFX-1 has no rules files.
const READINGS = {
  2: {
    parser: efx2Parser,
    completions: true,
    kinds: {
      template: { top: "TemplateFile" },
      rules: { top: "RulesFile" },
      expression: { top: "SingleExpression" },
      "bare-expression": { top: "BareExpression", dialect: "bare" },
    },
  },
  1: {
    parser: efx1Parser,
    completions: false,
    kinds: {
      template: { top: "TemplateFile" },
      expression: { top: "SingleExpression" },
      "bare-expression": { top: "BareExpression", dialect: "bare" },
    },
  },
};

/**
 * The language of a kind of text, read by a parser: the parser configured for the kind, which the
 * completions also use, as the language's parser, which reuses an earlier tree only before the first
 * change to the text (lexer/EditorParser.js).
 */
function languageOf(versionParser, reading) {
  const data = defineLanguageFacet();
  const parser = versionParser.configure({ ...reading, props: [languageDataProp.add((type) => (type.isTop ? data : undefined))] });
  return { parser, language: new Language(data, new EditorParser(parser), [], "efx") };
}

// The languages of each version, by kind, each with its parser.
const LANGUAGES = new Map(Object.entries(READINGS).map(([version, { parser: versionParser, kinds }]) =>
  [Number(version), new Map(Object.entries(kinds).map(([kind, reading]) => [kind, languageOf(versionParser, reading)]))]));

// The EFX colours, used where the application gives the editor no colours of its own.
const DEFAULT_COLOURS = syntaxHighlighting(efxHighlightStyle, { fallback: true });

/**
 * EFX support for an editor that holds one kind of EFX text of one version of EFX. The kinds are
 * "template", "rules", "expression" and "bare-expression"; the version is 2, unless the options say
 * `{ version: 1 }`, and EFX-1 has no rules files.
 */
export function efx(kind, { version = 2 } = {}) {
  const languages = LANGUAGES.get(version);
  if (languages === undefined) {
    throw new RangeError(`Unknown version of EFX: ${version}. The versions are ${[...LANGUAGES.keys()].join(", ")}.`);
  }
  const { language, parser } = languages.get(kind) ?? {};
  if (language === undefined) {
    throw new RangeError(`Unknown kind of EFX-${version} text: ${kind}. `
      + `The kinds are ${[...languages.keys()].join(", ")}.`);
  }
  if (!READINGS[version].completions) {
    return new LanguageSupport(language, [DEFAULT_COLOURS]);
  }
  const completions = new EfxCompletions(parser);
  const autocomplete = language.data.of({ autocomplete: (context) => completions.complete(context) });
  return new LanguageSupport(language, [DEFAULT_COLOURS, autocomplete]);
}
