// What the parse state cannot tell about the lexer's mode, kept as the parser goes: where the last
// token leaves the lexer, in the places where the tokens the parser can take do not say it.
// - LINE_START: after a `;`, a line end, a header or an include, the lexer is at the start of a line
//   (DEFAULT or SKIP_WHITESPACE). After a rule of a rules file the parser can take the same tokens,
//   but the lexer is still in EXPRESSION mode, until a `;`.
// - TEMPLATE_END: after a template is closed, the lexer is still in TEMPLATE mode, and reads a line
//   end as the CRLF that ends an EFX-1 line (TemplateMode.js).
// - TEMPLATE_SEMICOLON: after the `;` that ends a template, the lexer is at the start of a line, as
//   at LINE_START, but the `;` takes the blanks and the comment after it on its line (EndTemplate),
//   so that comment needs no line end (LineMode.js).
// The skip tokens leave it as it is; any other token sets none of them.

import { ContextTracker } from '@lezer/lr';
import * as terms from '../efx-parser.terms.js';

export const LINE_START = 1;
export const TEMPLATE_END = 2;
export const TEMPLATE_SEMICOLON = 3;

// The tokens after which the lexer is at the start of a line.
const LINE_ENDS = new Set([terms.Semicolon, terms.CRLF, terms.IncludePath, terms.StageHeaderEnd,
  terms.SummarySectionHeader, terms.NavigationSectionHeader]);

// The rules that end with a template. The template's own nodes are its fragments, which the
// grammar defines inside templateFragment, so they have no term of their own to look for.
const ENDS_WITH_TEMPLATE = new Set([terms.DisplayTemplate, terms.OtherwiseDisplayTemplate]);

const SKIPPED = new Set([terms.space, terms.Comment]);

function shift(context, term) {
  if (SKIPPED.has(term)) {
    return context;
  }
  if (term === terms.Semicolon && context === TEMPLATE_END) {
    return TEMPLATE_SEMICOLON;
  }
  return LINE_ENDS.has(term) ? LINE_START : 0;
}

export const lexerContext = new ContextTracker({
  start: LINE_START,
  shift,
  reduce: (context, term) => (ENDS_WITH_TEMPLATE.has(term) ? TEMPLATE_END : context),
  hash: (context) => context,
});
