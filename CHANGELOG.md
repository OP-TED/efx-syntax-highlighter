# EFX Syntax Highlighter 0.4.0 Release Notes

_The EFX Syntax Highlighter gives [CodeMirror 6](https://codemirror.net/) editors syntax highlighting and completions for [EFX](https://docs.ted.europa.eu/eforms/latest/efx), the expression and template language of the eForms SDK._

---

## In this release

This release adds EFX-1, the language of the eForms SDK 1, and a fourth kind of text: an expression on its own, whose context the application keeps apart. Both versions now read their text with the SDK's own lexer. An application that sets up its editor as for 0.3.0 needs no change.

### Bare expressions

- `efx('bare-expression')` reads an expression on its own, such as `BT-01-notice is present`, with no context in the text. It suits an application that keeps the condition of a rule apart from its context.
- The SDK's grammar has no start rule for such a text: the editor reads it as the expression of `WITH context COMPUTE expression`, with the same highlighting and the same completions.

### EFX-1 language support

- `efx(kind, { version: 1 })` reads EFX-1 text: a template file (`'template'`), a single expression with its context (`'expression'`) or a bare expression (`'bare-expression'`). EFX-1 has no rules files. Without the option, `efx(kind)` reads EFX-2, as before.
- EFX-1 is highlighted with the EFX colours, as EFX-2 is. It offers no completions.
- The EFX-1 parser reads the tokens of the SDK 1's lexer (see below, at SDK 1.16.0). It gives expressions no type, unlike the SDK's grammar, so it also reads some texts that the SDK's grammar refuses for their types, such as `'a' + 1`.
- Tests compare the EFX-1 grouping of operators with the ANTLR parser's.

### The SDK's own lexer

- Both versions read their text with the SDK's ANTLR lexer (`efx-grammar/EfxLexer.g4`): `npm run sync` takes its compiled table from the lexer ANTLR generates, and the editor runs it as ANTLR runs it. The EFX-2 lexer of 0.3.0, written for the editor, is gone.
- The editor's tokens are the lexer's: tests find them equal over the view templates and rules files of the SDK and over texts made at random, for both versions.
- Some texts the editor read in 0.3.0, and ANTLR's lexer refuses, are now shown as errors, as ANTLR shows them: a missing or extra blank where the lexer requires or refuses one (`{ND-Root}a`, `DISPLAY${1}`), a rule id or scope annotation in an expression, and `$value` in a label block.
- A keyword that the lexer reads with the whitespace after it (`DISPLAY`, `OTHERWISE DISPLAY`) is highlighted with it. A comment after the `;` of a template line, or after the path of an include, is highlighted as a comment.
- After the label shorthand `#{name|`, the field ids are now offered.
- The editor parses its text again from the first change on, as a change can make the lexer read the rest of the text otherwise.

### Other changes

- The EFX-2 grammar follows the SDK's at its new pinned commit, which removes the shortcuts `.`, `..` and `/` for a context (`{.}`, `{..}`, `{/}` and `context:$c = /`). The editor now shows them as errors.
- The Publish workflow installs a fixed version of npm, so that a new release of npm cannot stop a publication.
- `npm run sync` also reads the EFX-1 grammar and the view templates of the SDK 1, at the commit pinned in `package.json` (`config.sdk1`).
- The repository no longer holds copies of the SDK's EFX files and ANTLR grammars, which only the tests and the demo read: `npm run sync` writes them, at the pinned commits, into folders git ignores.
- Each version of EFX has its own folders, in `grammar/`, `src/` and `test/`.

### Known limits

- After a `/` the `@` of an attribute is not offered.
- After a syntax error nothing is offered until the error is fixed.
