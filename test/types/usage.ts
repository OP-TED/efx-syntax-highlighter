// How an application written in TypeScript uses the package: each call here must compile, and each
// call marked @ts-expect-error must not, so that the types refuse what the package refuses.

import { autocompletion } from '@codemirror/autocomplete';
import type { LanguageSupport } from '@codemirror/language';
import { EditorState, type Extension } from '@codemirror/state';
import { efx, efxDarkHighlightStyle, efxDarkTheme, efxHighlightStyle, efxSymbols, efxTheme, type EfxCommonKind, type EfxKind } from '@op-ted/efx-syntax-highlighter';

const template: LanguageSupport = efx('template');
const rules: LanguageSupport = efx('rules', { version: 2 });
const efx1: LanguageSupport = efx('bare-expression', { version: 1 });
const kind: EfxKind = 'expression';
const common: EfxCommonKind = 'template';
const version = Math.random() < 0.5 ? 1 : 2;
const chosen: LanguageSupport = efx(common, { version });
const options: { version?: 1 | 2 } = Math.random() < 0.5 ? {} : { version };
const optional: LanguageSupport = efx(common, options);
const symbols: Extension = efxSymbols.of({ fields: ['BT-01-notice', { id: 'BT-02-notice', type: 'code' }], nodes: ['ND-Root'] });
const { fields, nodes } = EditorState.create({ extensions: [efx(kind), symbols] }).facet(efxSymbols);
const ids: string[] = [...fields, ...nodes].map((entry) => (typeof entry === 'string' ? entry : entry.id));
const types: (string | undefined)[] = fields.map((entry) => (typeof entry === 'string' ? undefined : entry.type));
const extensions: Extension[] = [template, rules, efx1, chosen, optional, autocompletion(), efxTheme, efxDarkTheme];
const colours = [efxHighlightStyle.module, efxDarkHighlightStyle.module];

// @ts-expect-error an unknown kind
efx('templat');
// @ts-expect-error EFX-1 has no rules files
efx('rules', { version: 1 });
// @ts-expect-error an unknown version
efx('template', { version: 3 });
// @ts-expect-error a misspelt option
efx('template', { versoin: 2 });
// @ts-expect-error an id that is not text
efxSymbols.of({ fields: [1] });

export { colours, extensions, ids, types };
