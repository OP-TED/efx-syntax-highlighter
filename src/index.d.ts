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

/** The name of a highlight tag, as efxHighlights gives it: the tags of the EFX style tables, as Lezer writes them. */
export type EfxHighlightTag =
  | 'keyword'
  | 'className'
  | 'typeName'
  | 'function(keyword)'
  | 'literal'
  | 'string'
  | 'number'
  | 'propertyName'
  | 'variableName'
  | 'function(name)'
  | 'special(name)'
  | 'special(string)'
  | 'operator'
  | 'punctuation'
  | 'bracket'
  | 'lineComment'
  | 'name';

/** A range of an EFX text that a highlight tag colours. */
export interface EfxHighlight {
  /** Where the range starts, as an offset in the text. */
  from: number;
  /** Where it ends: the offset after its last character. */
  to: number;
  /** The name of its highlight tag. */
  tag: EfxHighlightTag;
}

/** The highlighted ranges of a text of one kind of EFX-2 text, in their order, as an editor's parser reads it. */
export function efxHighlights(text: string, kind: EfxKind, options?: { version?: 2 }): EfxHighlight[];
/** The highlighted ranges of a text of one kind of EFX-1 text, in their order, as an editor's parser reads it. */
export function efxHighlights(text: string, kind: EfxCommonKind, options: { version: 1 }): EfxHighlight[];
/** The highlighted ranges of a kind of text both versions have, in a version chosen when the application runs. */
export function efxHighlights(text: string, kind: EfxCommonKind, options?: { version?: 1 | 2 }): EfxHighlight[];

/** A version of EFX and a kind of file of it: EFX-1 has no rules files. */
export type EfxReading = { version: 2; kind: 'template' | 'rules' } | { version: 1; kind: 'template' };

/**
 * The version of EFX and the kind of file that a text reads as best: the reading of its start with
 * the fewest errors, EFX-2 before EFX-1 and a template before rules on a tie.
 */
export function inferEfx(text: string): EfxReading;
/** The kind of EFX-2 file that a text reads as best, for an application that knows the text is EFX-2. */
export function inferEfx(text: string, options: { version: 2 }): EfxReading & { version: 2 };
/** An EFX-1 text is a template: EFX-1 has no rules files. */
export function inferEfx(text: string, options: { version: 1 }): EfxReading & { version: 1 };
/** The version and kind, or the kind of the version given. */
export function inferEfx(text: string, options?: { version?: 1 | 2 }): EfxReading;

/**
 * The TextMate scope of each highlight tag, as the package's TextMate grammars scope the tokens the
 * tag colours. The tag of plain names, name, has none.
 */
export const efxTextMateScopes: Readonly<Record<Exclude<EfxHighlightTag, 'name'>, string>>;
