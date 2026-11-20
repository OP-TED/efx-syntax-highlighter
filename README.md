# efx-syntax-highlighter

EFX support for [CodeMirror 6](https://codemirror.net/) editors: syntax highlighting and completions for EFX-2, the EFX language of the eForms SDK 2, and syntax highlighting for EFX-1, the language of the SDK 1. It reads template files (view templates), rules files (validation rules, EFX-2 only), single expressions with their context, and bare expressions, whose context the application keeps apart.

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

The package offers five things:

- **`efx(kind)`** gives an editor what it needs to read one kind of EFX-2 text: its parser, the EFX colours and the completions. The kind is `'template'` for a template file, `'rules'` for a rules file, `'expression'` for a single expression with its context, such as `WITH ND-Root COMPUTE BT-01-notice is present`, or `'bare-expression'` for an expression with no context in the text, such as `BT-01-notice is present`, read as the expression of `WITH … COMPUTE`. Any other kind is refused with a `RangeError`. `efx(kind).language` is the CodeMirror language, for an application that needs it on its own.
- **`efx(kind, { version: 1 })`** does the same for EFX-1 text, without completions. The kinds are `'template'`, `'expression'`, such as `{ND-Root} ${BT-01-notice is present}`, and `'bare-expression'`; EFX-1 has no rules files. Any other kind or version is refused with a `RangeError`.
- **`efxSymbols`** gives the editor the field and node ids it offers: `efxSymbols.of({ fields, nodes })`, each a list of ids, for example those of the SDK's `fields.json`. An entry can also be an id with its type, such as `{ id: 'BT-01-notice', type: 'code' }`; the editor shows the type beside the id, and "field" or "node" beside an id without one. The ids of several such extensions add up.
- **`efxHighlightStyle`** is the EFX colours. `efx(kind)` already uses them as the editor's default colours; an application that gives its editor its own colours with `syntaxHighlighting(...)` replaces them.
- **`efxTheme`** is a light look for the editor itself (white background, black cursor). Add it if you want it.

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
npm run sync    # writes the lexer tables, the words and the completion list (committed), and the SDK's EFX files and ANTLR grammars that the tests and the demo read (not committed)
npm run build   # generates the parsers from grammar/efx2.grammar and grammar/efx1.grammar and writes the package to dist/
npm test        # the package, lexer, conformance, style, EFX-2 tree and completion, EFX-1 entry and incremental tests, on the build
npm run demo    # serves a demo page at http://localhost:8080/demo/ (after npm run sync and npm run build)
npm run site    # gathers the demo page and what it loads into site/ (after npm run sync and npm run build)
```

Each version of EFX has its own places: its grammar in `grammar/efx2.grammar` or `grammar/efx1.grammar`, the modules its parser loads in `src/efx2/` or `src/efx1/` (its lexer table and the lexer's options in `lexer.js`, its highlight tags, and for EFX-2 its completions), and its tests, its copy of the SDK's ANTLR grammar (`oracle/`) and of the SDK's EFX files (`corpus/`) in `test/efx2/` or `test/efx1/`. What both share is at the top of `src/` and `test/`: the entry point and the language (`src/efxLanguage.js`), the lexer engine (`src/lexer/`), the ids (`src/efxSymbols.js`), the colours (`src/efxTheme.js`), and the package, lexer, conformance, style and incremental tests. The build writes each parser beside its modules, in `dist/efx2/` and `dist/efx1/`.

The lexer reads the text on its own, as ANTLR's does, whatever the parser makes of the tokens, so the editor shows the tokens ANTLR's lexer reads, errors included. As a token depends on all the text before it, through the lexer's modes, the editor reuses its earlier tree only before the first change to the text, and the lexer reads the parts of the document a parse reads as one text, as ANTLR would (`src/lexer/EditorParser.js`). A comment that a token holds (the `;` that ends a template line, the path of an include) is shown as a comment.

`npm run sync` reads the SDK, the toolkit and the SDK of EFX-1 from GitHub at the commits pinned in `package.json`, or pins new ones first: `npm run sync -- <owner>/<repository>@<commit> <owner>/<repository>@<commit> [<owner>/<repository>@<commit>]` (the SDK, then the toolkit, then, if it changes, the SDK of EFX-1). It needs Node 22.13 or later and network access; behind a proxy, set `NODE_USE_ENV_PROXY=1`. A `GITHUB_TOKEN`, when set, is sent to the GitHub API only. Building needs neither network nor Java: the lexer tables, the words and the completion list it builds from are committed. The SDK's EFX files and ANTLR grammars are not: the sync writes them into `corpus/` and `oracle/` of `test/efx2/` and `test/efx1/`, which git ignores, so run `npm run sync` once after cloning and again after moving a pin; the tests say so when they are missing. The Check workflow syncs, builds and tests every push, and fails if a generated file differs from the committed one. The Pages workflow publishes `site/` to the repository's GitHub Pages site on every push to `develop`.

## Publishing

Only `dist/` is published, with the README and the licence. Pushing a tag of the form `x.y.z` runs the Publish workflow, which builds, tests and publishes to npm, with provenance, the version written in `package.json`: the tag does not set the version, so tag the commit that sets it, with the same number (for example `0.3.0`).

## License

[EUPL 2.0](LICENSE)
