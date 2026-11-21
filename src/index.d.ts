// The types of the package's public surface (index.js), for applications written in TypeScript.

import type { HighlightStyle, LanguageSupport } from '@codemirror/language';
import type { Extension, Facet } from '@codemirror/state';

/** The kinds of EFX text an editor can hold. */
export type EfxKind = 'template' | 'rules' | 'expression' | 'bare-expression';

/** The kinds of EFX text that both versions of EFX have: EFX-1 has no rules files. */
export type EfxCommonKind = Exclude<EfxKind, 'rules'>;

/** EFX support for an editor that holds one kind of EFX-2 text: its parser, the EFX colours and the completions. */
export function efx(kind: EfxKind, options?: { version?: 2 }): LanguageSupport;
/** EFX support for an editor that holds one kind of EFX-1 text: its parser and the EFX colours. */
export function efx(kind: EfxCommonKind, options: { version: 1 }): LanguageSupport;
/** EFX support for a kind of text both versions have, in a version chosen when the application runs. */
export function efx(kind: EfxCommonKind, options?: { version?: 1 | 2 }): LanguageSupport;

/** A field or node id, with its type, such as a field's type in the SDK's fields.json, shown beside the id. */
export interface EfxSymbol {
  id: string;
  type?: string;
}

/** The field and node ids an application gives the editor: ids, or ids with their type. */
export interface EfxSymbols {
  fields?: readonly (string | EfxSymbol)[];
  nodes?: readonly (string | EfxSymbol)[];
}

/**
 * The field and node ids the editor offers where the grammar takes one: `efxSymbols.of({ fields, nodes })`.
 * The ids of several such extensions add up, each entry as the application gave it.
 */
export const efxSymbols: Facet<EfxSymbols, { fields: (string | EfxSymbol)[]; nodes: (string | EfxSymbol)[] }>;

/** The EFX colours for a light background, which efx() gives the editor as its default colours. */
export const efxHighlightStyle: HighlightStyle;

/** A light look for the editor itself, which an application adds if it wants it. */
export const efxTheme: Extension;

/** The EFX colours for a dark background. efxDarkTheme already includes them. */
export const efxDarkHighlightStyle: HighlightStyle;

/**
 * A dark look for the editor itself, with the EFX colours for a dark background, which an application
 * adds instead of efxTheme on a dark screen.
 */
export const efxDarkTheme: Extension;
