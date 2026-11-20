# EFX Syntax Highlighter 0.4.1 Release Notes

_The EFX Syntax Highlighter gives [CodeMirror 6](https://codemirror.net/) editors syntax highlighting and completions for [EFX](https://docs.ted.europa.eu/eforms/latest/efx), the expression and template language of the eForms SDK._

---

## In this release

This release fixes three things an application noticed when it moved to 0.4.0, and adds types for applications written in TypeScript. An application that sets up its editor as for 0.4.0 needs no change.

### Field types beside field ids

- `efxSymbols` also takes an id with its type, `{ id: 'BT-01-notice', type: 'code' }`, as well as a plain id. The completions show the type beside the id, as an application's own completions often did; an id without a type shows "field" or "node", as before.

### Colours

- Outline numbers (the `1` before `WITH` in a template line) are coloured as literals, in EFX-2 and EFX-1. In 0.4.0 they had no colour.
- Commas, and in EFX-2 the semicolons that end template lines, are coloured as punctuation, as brackets and pipes are. In 0.4.0 they had no colour.
- A test now checks that every token of the tested texts has a colour, but the blanks, indentation and line ends, which stay plain on purpose.

### TypeScript types

- The package ships its types (`dist/index.d.ts`): the kinds `efx` takes for each version, its options, the entries `efxSymbols` takes, `efxHighlightStyle` and `efxTheme`. A TypeScript compiler now refuses an unknown kind, `'rules'` with `{ version: 1 }`, an unknown version or a misspelt option.
- A test compiles an application's use of the package against them.
