// CodeMirror 6 language support for efx
import { LRLanguage, LanguageSupport } from "@codemirror/language";
import { parser } from "../dist/efx-parser";
import { efxHighlighting } from "./efxTheme";

export const efxLanguage = LRLanguage.define({
  parser
});

export function efx() {
  return new LanguageSupport(efxLanguage, [efxHighlighting]);
}
