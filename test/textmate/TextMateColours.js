// The colours a TextMate grammar gives a text, as VS Code gives them: the text is read line by line
// by vscode-textmate, VS Code's own TextMate engine, with vscode-oniguruma, its regular expressions.
// Each character gets the highlight tag of the innermost EFX scope over it (efxTextMateScopes), so
// that it can be compared with the parser's tag.

import fs from 'node:fs';
import { createRequire } from 'node:module';
import { efxTextMateScopes } from '../../dist/index.js';

const require = createRequire(import.meta.url);
const textmate = require('vscode-textmate');
const oniguruma = require('vscode-oniguruma');

// The highlight tag of each EFX scope.
const TAGS = new Map(Object.entries(efxTextMateScopes).map(([tag, scope]) => [scope, tag]));

let library;

/** Oniguruma as vscode-textmate takes it, loaded once. */
function onigurumaLibrary() {
  library ??= (async () => {
    const wasm = fs.readFileSync(require.resolve('vscode-oniguruma/release/onig.wasm'));
    await oniguruma.loadWASM(wasm.buffer.slice(wasm.byteOffset, wasm.byteOffset + wasm.byteLength));
    return {
      createOnigScanner: (patterns) => new oniguruma.OnigScanner(patterns),
      createOnigString: (string) => new oniguruma.OnigString(string),
    };
  })();
  return library;
}

export class TextMateColours {
  #grammar;

  constructor(grammar) {
    this.#grammar = grammar;
  }

  /** The colours of the grammar in a TextMate grammar file. */
  static async of(file) {
    const grammar = JSON.parse(fs.readFileSync(file, 'utf8'));
    const registry = new textmate.Registry({
      onigLib: onigurumaLibrary(),
      loadGrammar: async (scopeName) => (scopeName === grammar.scopeName ? grammar : null),
    });
    return new TextMateColours(await registry.loadGrammar(grammar.scopeName));
  }

  /** The highlight tag of each character of a text, undefined where no EFX scope colours it. */
  tagsOf(text) {
    const tags = new Array(text.length);
    let state = textmate.INITIAL;
    let lineStart = 0;
    for (const line of text.split('\n')) {
      const { tokens, ruleStack } = this.#grammar.tokenizeLine(line, state);
      for (const { startIndex, endIndex, scopes } of tokens) {
        const tag = scopes.findLast((scope) => TAGS.has(scope));
        tags.fill(tag === undefined ? undefined : TAGS.get(tag), lineStart + startIndex, lineStart + Math.min(endIndex, line.length));
      }
      state = ruleStack;
      lineStart += line.length + 1;
    }
    return tags;
  }
}
