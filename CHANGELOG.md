# EFX Syntax Highlighter 0.7.0 Release Notes

_The EFX Syntax Highlighter gives [CodeMirror 6](https://codemirror.net/) editors syntax highlighting and completions for [EFX](https://docs.ted.europa.eu/eforms/latest/efx), the expression and template language of the eForms SDK._

---

## In this release

This release lets other editors, such as VS Code with the EFX extension, colour EFX as the package does. An application that sets up its editor as for 0.6 needs no change: its editor shows the same colours.

### Highlighting without an editor

**`efxHighlights(text, kind)`** gives the ranges of an EFX-2 text that the EFX colours colour, as the parser of an editor reads it, each with the name of its highlight tag, such as `keyword` or `function(keyword)`; `efxHighlights(text, kind, { version: 1 })` does the same for EFX-1. The kinds are those of `efx`. The type `EfxHighlightTag` lists the names of the tags.

### The version and kind of a file

**`inferEfx(text)`** tells which version of EFX, and which kind of file, a text holds: an EFX-2 template, EFX-2 rules or an EFX-1 template. It reads the start of the text, about 2,000 characters after any leading blank and comment lines, or more where that is not enough, in each version, as each kind of file and as a bare expression. It takes the version and kind of file that read it best; on a tie, as for an empty file, a file of comments only or a bare expression, it takes EFX-2 before EFX-1, and a template before rules. It finds the version and kind of every view template and rules file of the SDK 2, and of every view template of the SDK 1. With `{ version: 2 }`, it tells the kind of an EFX-2 text only.

### TextMate grammars

The package has a TextMate grammar for each version, which editors such as VS Code use to colour a text before a parser does, or instead of one: `@op-ted/efx-syntax-highlighter/efx2.tmLanguage.json` and `@op-ted/efx-syntax-highlighter/efx1.tmLanguage.json`. They are made from the rules of the SDK's lexer, and give each token the TextMate scope of its highlight tag, listed in the README. They colour a text as the parser does, except where only a token's parent tells its colour, which a regular expression cannot see; there, they give the token the colour of its type, or none.

### Strings and numbers

String literals, and the path of an include, now have the highlight tag `string`, and numbers the tag `number`. Both are kinds of `literal`, so an editor shows them in the colour of literals as before; an editor that colours strings and numbers apart, as most VS Code themes do, can now tell them.
