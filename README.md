# efx-syntax-highlighter

EFX support for [CodeMirror 6](https://codemirror.net/) editors: syntax highlighting and completions for EFX-2, the EFX language of the eForms SDK 2, and syntax highlighting for EFX-1, the language of the SDK 1. It reads template files (view templates), rules files (validation rules, EFX-2 only), single expressions with their context, and bare expressions, whose context the application keeps apart. For other editors, such as VS Code, it gives the highlighting of a text without an editor, tells which version and kind of file a text holds, and has a TextMate grammar of each version.

Both parsers read the tokens of the SDK's own ANTLR lexer (`efx-grammar/EfxLexer.g4`): `npm run sync` takes the lexer's compiled table from the lexer ANTLR generates, and a small engine (`src/lexer/`) runs it in the editor as ANTLR runs it, over the whole text, mode by mode. The EFX-2 parser is a [Lezer](https://lezer.codemirror.net/) grammar that follows the SDK's ANTLR grammar (`efx-grammar/Efx.g4`) rule for rule; its completion list comes from the EFX Toolkit. The EFX-1 parser gives expressions no type (`grammar/efx1.grammar`). All of it is taken at the commits pinned in `package.json` (`config`). Tests compare the editor's tokens with ANTLR's lexer's, over the SDK's view templates and rules files and over texts made at random, the EFX-2 trees with ANTLR's parser's, and the EFX-1 grouping of operators with ANTLR's parser's. What each release changes is in [CHANGELOG.md](CHANGELOG.md).

## Install

```bash
npm install @op-ted/efx-syntax-highlighter
```

The package is an ES module. It needs the CodeMirror packages it lists as dependencies; a bundler resolves them, or an import map in the page, which must then name their own dependencies too (`demo/index.html` has one).

## Use

```js
import { autocompletion } from '@codemirror/autocomplete';
import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { efx, efxSymbols, efxTheme } from '@op-ted/efx-syntax-highlighter';

const view = new EditorView({
  parent: document.getElementById('editor'),
  state: EditorState.create({
    doc: text, // the EFX text to edit
    extensions: [
      efx('template'),
      efxSymbols.of({ fields: ['BT-01-notice', 'BT-26(m)-Procedure'], nodes: ['ND-Root', 'ND-Lot'] }),
      autocompletion(),
      efxTheme,
    ],
  }),
});
```

The package offers these things:

- **`efx(kind)`** gives an editor what it needs to read one kind of EFX-2 text: its parser, the EFX colours and the completions. The kind is `'template'` for a template file, `'rules'` for a rules file, `'expression'` for a single expression with its context, such as `WITH ND-Root COMPUTE BT-01-notice is present`, or `'bare-expression'` for an expression with no context in the text, such as `BT-01-notice is present`, read as the expression of `WITH … COMPUTE`. Any other kind is refused with a `RangeError`. `efx(kind).language` is the CodeMirror language, for an application that needs it on its own.
- **`efx(kind, { version: 1 })`** does the same for EFX-1 text, without completions. The kinds are `'template'`, `'expression'`, such as `{ND-Root} ${BT-01-notice is present}`, and `'bare-expression'`; EFX-1 has no rules files. Any other kind or version is refused with a `RangeError`.
- **`efxSymbols`** gives the editor the field and node ids it offers: `efxSymbols.of({ fields, nodes })`, each a list of ids, for example those of the SDK's `fields.json`. An entry can also be an id with its type, such as `{ id: 'BT-01-notice', type: 'code' }`; the editor shows the type beside the id, and "field" or "node" beside an id without one. The ids of several such extensions add up.
- **`efxHighlightStyle`** is the EFX colours. `efx(kind)` already uses them as the editor's default colours; an application that gives its editor its own colours with `syntaxHighlighting(...)` replaces them.
- **`efxTheme`** is a light look for the editor itself (white background, black cursor). Add it if you want it.
- **`efxDarkTheme`** is a dark look for the editor, with the EFX colours for a dark background. Add it instead of `efxTheme` on a dark screen. **`efxDarkHighlightStyle`** is those colours on their own, for an application that gives its editor its own dark look: `syntaxHighlighting(efxDarkHighlightStyle)`.

For an application that colours EFX without CodeMirror, such as an extension of another editor, the package also offers:

- **`efxHighlights(text, kind)`** gives the ranges of an EFX-2 text that the EFX colours colour, as the parser of an editor reads it: a list of `{ from, to, tag }`, in their order, where `from` and `to` are offsets in the text and `tag` is the name of the range's highlight tag, as Lezer writes it: `'keyword'`, `'string'`, `'function(keyword)'` and so on (the type `EfxHighlightTag` lists them). Text that no tag colours, such as blanks, is in no range. **`efxHighlights(text, kind, { version: 1 })`** does the same for EFX-1. The kinds and versions are those of `efx`; any other is refused with a `RangeError`.
- **`inferEfx(text)`** tells which version of EFX, and which kind of file, a text holds, for an application that opens EFX files without being told: `{ version: 2, kind: 'template' }`, `{ version: 2, kind: 'rules' }` or `{ version: 1, kind: 'template' }`. It reads the start of the text, about 2,000 characters after any leading blank and comment lines, to the end of a line, in each version, as each kind of file and as a bare expression. Where that start is the whole text, it takes the version whose best reading has the fewest errors, EFX-2 on a tie, as for an empty file, a file of comments only or a bare expression; then the kind of file of that version with the fewest errors, a template on a tie. Where the start is cut from a longer text, where a cut string, say, makes errors in every reading, it takes the kind of file that reads furthest into it without error, if one reads further than every other reading; else it reads a start twice as long, up to about 16,000 characters, where the reading that reads furthest tells. **`inferEfx(text, { version: 2 })`** tells only the kind of file, for an application that knows the version otherwise; an EFX-1 text is a template. Any other version is refused with a `RangeError`.
- **The TextMate grammars** of EFX-2 and EFX-1, which editors such as VS Code colour text with before, or instead of, a parser: `@op-ted/efx-syntax-highlighter/efx2.tmLanguage.json` (scope `source.efx2`) and `@op-ted/efx-syntax-highlighter/efx1.tmLanguage.json` (scope `source.efx1`). They follow the modes of the SDK's lexer, and give each token the scope of its highlight tag, which **`efxTextMateScopes`** gives too, by the tag's name:

  | Highlight tag | TextMate scope |
  |---|---|
  | `keyword` | `keyword.control.efx` |
  | `className` | `keyword.other.efx` |
  | `typeName` | `storage.type.efx` |
  | `function(keyword)` | `support.function.efx` |
  | `literal` | `constant.language.efx` |
  | `string` | `string.quoted.efx` |
  | `number` | `constant.numeric.efx` |
  | `propertyName` | `variable.other.property.efx` |
  | `variableName` | `variable.other.efx` |
  | `function(name)` | `entity.name.function.efx` |
  | `special(name)` | `constant.other.efx` |
  | `special(string)` | `meta.text.efx` |
  | `operator` | `keyword.operator.efx` |
  | `punctuation` | `punctuation.separator.efx` |
  | `bracket` | `punctuation.section.block.efx` |
  | `lineComment` | `comment.line.double-slash.efx` |

  A regular expression cannot see the parent of a token, as the parser does: where the style table gives a token a tag of its own only under some parents, such as the colon of a type, or the name of a notice type in a rule, the grammar gives it the tag of its type, or none. A grammar also reads one line at a time: of a token that a line break cuts, such as `OTHERWISE` at the end of a line with `ASSERT` on the next, it reads each part as a token of its own, with the same colours; a string that goes on after an escaped line break is one part of the grammar, from its opening quote to its closing one.

Both sets of colours mark the same kind of word with the same hue: purple for keywords and the words of expressions, green for fields and nodes, orange for variables and declared functions, pink for literals and the names of assets, and grey for operators and punctuation. Every colour reaches 4.5:1 against its background, the contrast that WCAG 2.1 AA and EN 301 549 require for text: the light colours against white, the dark ones against `#1e1f22`.

The package ships its TypeScript types, so that an application written in TypeScript has its calls checked.

### Completions

The application turns completion on, with `autocompletion()` from `@codemirror/autocomplete` (or the `basicSetup` of the `codemirror` package, which includes it). While you type, the editor offers the words the grammar can take at the cursor:

- at the start of an expression, the functions as calls with their required parameters (`contains(haystack, needle)`), with their signatures beside them, and the keywords;
- after a field and a colon, the field's properties (`:rawValue`, `:publicationDate`, ...);
- after `is`, `not`, `empty`, `present` and `unique`;
- in a label block, the asset types and label types; after the pipe of an expression block, the format options;
- at the start of a line, the words of a template line or of a rule;
- the variables the cursor can use, and the field and node ids given through `efxSymbols`, where the grammar takes one.

In template text any word can go, so there the list opens only when asked for (Ctrl-Space). Nothing is offered inside a comment or a string.

Known limits: after a `/` the `@` of an attribute is not offered; after a syntax error nothing is offered until the error is fixed.

## Develop

```bash
npm run sync    # writes the lexer tables, the words, the TextMate grammars and the completion list (committed), and the SDK's EFX files and ANTLR grammars that the tests and the demo read (not committed)
npm run build   # generates the parsers from grammar/efx2.grammar and grammar/efx1.grammar and writes the package to dist/
npm test        # the package, lexer, conformance, style, EFX-2 tree and completion, EFX-1 entry, inference, TextMate, incremental, types and colour tests, on the build
npm run demo    # serves a demo page at http://localhost:8080/demo/ (after npm run sync and npm run build)
npm run site    # gathers the demo page and what it loads into site/ (after npm run sync and npm run build)
```

Each version of EFX has its own places: its grammar in `grammar/efx2.grammar` or `grammar/efx1.grammar`, the modules its parser loads in `src/efx2/` or `src/efx1/` (its lexer table in `lexer.js` and the lexer's options in `lexerOptions.js`, its highlight tags, and for EFX-2 its completions), its TextMate grammar in `generated/` there, and its tests, its copy of the SDK's ANTLR grammar (`oracle/`) and of the SDK's EFX files (`corpus/`) in `test/efx2/` or `test/efx1/`. What both share is at the top of `src/` and `test/`: the entry point and the language (`src/efxLanguage.js`), the highlighting without an editor (`src/efxHighlights.js`), the inference of version and kind (`src/efxInference.js`), the lexer engine (`src/lexer/`), the ids (`src/efxSymbols.js`), the colours (`src/efxTheme.js`), and the package, lexer, conformance, style, inference, TextMate, incremental and colour tests. The build writes each parser beside its modules, in `dist/efx2/` and `dist/efx1/`.

The lexer reads the text on its own, as ANTLR's does, whatever the parser makes of the tokens, so the editor shows the tokens ANTLR's lexer reads, errors included. As a token depends on all the text before it, through the lexer's modes, the editor reuses its earlier tree only before the first change to the text, and the lexer reads the parts of the document a parse reads as one text, as ANTLR would (`src/lexer/EditorParser.js`). A comment that a token holds (the `;` that ends a template line, the path of an include) is shown as a comment.

The sync writes each TextMate grammar from the rules of the SDK's lexer, and none of it is written by hand (`scripts/sync/TextMateGrammar.js`, which reads the rules with `scripts/sync/LexerGrammar.js` as the regular expressions of `scripts/sync/RegularExpression.js`). Each mode of the lexer is a part of the grammar that begins at a rule that enters the mode and ends at one that leaves it, and each token rule is a pattern of its mode, scoped by the tag that the style table gives its type. As one match can end only one part, where a token ends a mode and the mode that it replaced, the part of the first ends before the token, and the part of the second reads it with its own rule of that type, which may read it otherwise than the lexer, but with the same colours, as a template reads its semicolon with the blanks and comment after it; the sync stops where another rule of that mode could read the token, or go on after it. A TextMate grammar takes the first pattern that matches, where ANTLR's lexer takes the longest token, and the rule written first on a tie: the patterns are therefore in an order where a rule that wins a tie comes first, and each pattern is followed by a lookahead that refuses where its own rule, or a rule of its mode tried after it, could read a longer token from the same place: a rule tried before it that could matches first. The sync finds the lookahead from what is left of each rule once the pattern's match is read; where that depends on the match, as for mixed indentation, which can go on with a space after some matches only, it cuts the pattern by the state its match ends in, so that each part has a lookahead of its own (`scripts/sync/LongestMatch.js`). As the end of a mode is tried either before its patterns or after them, a pattern does not match a text that a rule of the other kind, written before it, reads too. A TextMate engine looks for each pattern from where it is to the end of the line: a pattern that can start with a long run of blanks is kept from being tried inside the run, where no token can begin, so that a long line is coloured soon (`scripts/sync/RunGuards.js`). The sync stops at a lexer rule the grammar could not follow, such as a command it does not know. The TextMate test colours every corpus file, and the files of the entries of the tree tests, with the grammar, as VS Code does, with its own engine (`vscode-textmate` and `vscode-oniguruma`), and with the parser, and compares them character by character: the grammar may leave plain, or give the tag of the type, where the parser gives a token another tag for its parent, but it fails on any other difference, such as a word it does not know or an id it does not read whole. The numbers of characters it colours as the parser does, and of those it colours more vaguely, are pinned in `test/textmate.js`. The TextMate test also colours lines with runs of 5,000 blanks, each within 250 ms. The sync test checks the longest token, the tie, a rule that can go on after some of its matches only, a token that ends inside a run of blanks, and the rules the sync stops at, on small lexers.

`npm run sync` reads the SDK, the toolkit and the SDK of EFX-1 from GitHub at the commits pinned in `package.json`, or pins new ones first: `npm run sync -- <owner>/<repository>@<commit> <owner>/<repository>@<commit> [<owner>/<repository>@<commit>]` (the SDK, then the toolkit, then, if it changes, the SDK of EFX-1). It needs Node 22.13 or later and network access; behind a proxy, set `NODE_USE_ENV_PROXY=1`. A `GITHUB_TOKEN`, when set, is sent to the GitHub API only. Building needs neither network nor Java: the lexer tables, the words, the TextMate grammars and the completion list it builds from are committed. The SDK's EFX files and ANTLR grammars are not: the sync writes them into `corpus/` and `oracle/` of `test/efx2/` and `test/efx1/`, which git ignores, so run `npm run sync` once after cloning and again after moving a pin; the tests say so when they are missing. The Check workflow syncs, builds and tests every push, and fails if a generated file differs from the committed one. The Pages workflow publishes `site/` to the repository's GitHub Pages site on every push to `develop`.

## Publishing

Only `dist/` is published, with the README and the licence. Pushing a tag of the form `x.y.z` runs the Publish workflow, which builds, tests and publishes to npm, with provenance, the version written in `package.json`: the tag does not set the version, so tag the commit that sets it, with the same number (for example `0.3.0`).

## License

[EUPL 1.2](LICENSE)
