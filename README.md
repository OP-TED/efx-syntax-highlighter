# efx-syntax-highlighter

A minimal JavaScript package providing Lezer-based parsing and CodeMirror 6 language support for the efx language.

## Features
- Lezer parser for efx
- CodeMirror 6 language extension
- Custom highlight theme

## Usage
Install via npm:
```bash
npm install efx-syntax-highlighter
```

Import and use in CodeMirror 6:
```js
import { efx, efxHighlightStyle } from 'efx-syntax-highlighter';

const editor = new EditorView({
  extensions: [efx(), efxHighlightStyle]
});
```

## Build & Test
To build the parser:
```bash
npm run build
```
To run tests:
```bash
npm test
```

## Publishing
- Only the `dist/` output is published
- Do not include grammar or test files in the package
- Use `npm publish` to release

## License
EUPL 2.0
