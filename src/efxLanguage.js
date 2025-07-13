// CodeMirror 6 language support for efx
import {LRLanguage, LanguageSupport} from '@codemirror/language';
import {parser} from '../dist/efx-parser';

export const efxLanguage = LRLanguage.define({
  parser,
  languageData: {
    commentTokens: {line: '//'}
  }
});

export function efx() {
  return new LanguageSupport(efxLanguage);
}
