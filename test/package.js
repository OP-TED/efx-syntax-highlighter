// The package test: the package's entry point (dist/index.js), as an application loads it. It checks
// what the entry point offers; that efx(kind) reads each kind of EFX-2 text from its own top, with no
// error, and offers its completions; that efx(kind, { version: 1 }) reads each kind of EFX-1 text,
// highlighted as EFX-2 is, and offers none; that each text of the demo page reads with no error; that
// the EFX colours are the editor's default colours and give way to an application's own, and to the
// dark ones with the dark look; and that an
// unknown kind or version is refused. It reads the build in dist/, so it runs after `npm run build`.
// What the completions offer is checked by efx2/completions.js.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import { EditorState } from '@codemirror/state';
import { HighlightStyle, ensureSyntaxTree, highlightingFor, syntaxHighlighting } from '@codemirror/language';
import { highlightTree, tags } from '@lezer/highlight';
import * as entryPoint from '../dist/index.js';

const { efx, efxHighlightStyle } = entryPoint;

// A text of each kind, and the top that must read it.
const KINDS = [
  { kind: 'template', top: 'TemplateFile', text: fs.readFileSync(new URL('efx2/sample.efx', import.meta.url), 'utf8') },
  { kind: 'rules', top: 'RulesFile', text: fs.readFileSync(new URL('efx2/corpus/validation/stage-4m.efx', import.meta.url), 'utf8') },
  { kind: 'expression', top: 'SingleExpression', text: 'WITH ND-Root COMPUTE BT-01-notice is present' },
  { kind: 'bare-expression', top: 'BareExpression', text: '  BT-01-notice is present\n  and not(BT-1-Lot in [1, 2])' },
];

// A text of each kind of EFX-1, and the top that must read it.
const EFX1_KINDS = [
  { kind: 'template', top: 'TemplateFile', text: fs.readFileSync(new URL('efx1/corpus/view-templates/1.efx', import.meta.url), 'utf8') },
  { kind: 'expression', top: 'SingleExpression', text: '{ND-Root} ${BT-01-notice is present}' },
  { kind: 'bare-expression', top: 'BareExpression', text: "BT-01-notice in ('a', 'b') and count(BT-1-Lot) > 1" },
];

// Colours an application might give the editor.
const OWN_COLOURS = HighlightStyle.define([{ tag: tags.keyword, color: 'red' }]);

/** The tree of an editor's whole text. */
function treeOf(state) {
  return ensureSyntaxTree(state, state.doc.length, 10_000);
}

/** The number of parse errors in a tree. */
function errorsIn(tree) {
  let errors = 0;
  tree.iterate({ enter: (node) => { errors += node.type.isError ? 1 : 0; } });
  return errors;
}

const CHECKS = {
  'the entry point offers efx, efxSymbols, the light and dark colours and looks': () => {
    assert.deepEqual(Object.keys(entryPoint).sort(),
      ['efx', 'efxDarkHighlightStyle', 'efxDarkTheme', 'efxHighlightStyle', 'efxSymbols', 'efxTheme']);
  },
  'the dark look gives the editor the dark colours': () => {
    const state = EditorState.create({ extensions: [efx('template'), entryPoint.efxDarkTheme] });
    assert.equal(highlightingFor(state, [tags.keyword]), entryPoint.efxDarkHighlightStyle.style([tags.keyword]));
  },
  ...Object.fromEntries(KINDS.map(({ kind, top, text }) => [`efx('${kind}') reads its text from ${top}`, () => {
    const tree = treeOf(EditorState.create({ doc: text, extensions: [efx(kind)] }));
    assert.equal(tree.type.name, top);
    assert.equal(errorsIn(tree), 0);
  }])),
  ...Object.fromEntries(KINDS.map(({ kind }) => [`efx('${kind}') offers its completions`, () => {
    const state = EditorState.create({ extensions: [efx(kind)] });
    assert.equal(state.languageDataAt('autocomplete', 0).length, 1);
  }])),
  ...Object.fromEntries(EFX1_KINDS.map(({ kind, top, text }) => [`efx('${kind}', { version: 1 }) reads its text from ${top}`, () => {
    const tree = treeOf(EditorState.create({ doc: text, extensions: [efx(kind, { version: 1 })] }));
    assert.equal(tree.type.name, top);
    assert.equal(errorsIn(tree), 0);
  }])),
  'EFX-1 offers no completions': () => {
    const state = EditorState.create({ extensions: [efx('template', { version: 1 })] });
    assert.equal(state.languageDataAt('autocomplete', 0).length, 0);
  },
  'EFX-1 has the colours of EFX-2': () => {
    const styleAt = (kind, options, text, word) => {
      const state = EditorState.create({ doc: text, extensions: [efx(kind, options)] });
      const tree = treeOf(state);
      const position = text.indexOf(word);
      let style = null;
      highlightTree(tree, efxHighlightStyle, (from, to, classes) => {
        if (from <= position && position < to) {
          style = classes;
        }
      });
      return style;
    };
    for (const word of ['BT-1-Lot', '$x', "'a'", 'every', 'count', 'satisfies']) {
      const efx2 = styleAt('bare-expression', {}, "every text:$x in BT-1-Lot satisfies count($x) > 0 and $x == 'a'", word);
      const efx1 = styleAt('bare-expression', { version: 1 }, "every text:$x in BT-1-Lot satisfies count($x) > 0 and $x == 'a'", word);
      assert.ok(efx2 !== null, word);
      assert.equal(efx1, efx2, word);
    }
  },
  'the demo page reads each of its texts with no error': () => {
    const page = fs.readFileSync(new URL('../demo/index.html', import.meta.url), 'utf8');
    // Each option names its version, and its texts as a JSON list of { kind, file, label }.
    const options = [...page.matchAll(/<option [^>]*data-version="(\d)" data-texts='([^']+)'/g)];
    assert.ok(options.length > 0);
    for (const [, version, texts] of options) {
      for (const { kind, file } of JSON.parse(texts)) {
        const text = fs.readFileSync(new URL(`../demo/${file}`, import.meta.url), 'utf8');
        const tree = treeOf(EditorState.create({ doc: text, extensions: [efx(kind, { version: Number(version) })] }));
        assert.equal(errorsIn(tree), 0, file);
      }
    }
  },
  'a parse of some parts of a document reads them as one text': () => {
    for (const version of [2, 1]) {
      const { parser } = efx('bare-expression', { version }).language;
      const shown = (tree) => tree.toString();
      // A part that starts after the start of the document reads as that part alone.
      assert.equal(shown(parser.parse('prefix1 + 2', [], [{ from: 6, to: 11 }])), shown(parser.parse('1 + 2')), `EFX-${version}`);
      // Parts with a gap between them read as the parts one after the other.
      const document = 'BT-1-Lot <gap> is present';
      const parts = [{ from: 0, to: 9 }, { from: 14, to: document.length }];
      assert.equal(shown(parser.parse(document, [], parts)), shown(parser.parse('BT-1-Lot  is present')), `EFX-${version}`);
    }
  },
  'the EFX colours are the default': () => {
    const state = EditorState.create({ extensions: [efx('template')] });
    assert.equal(highlightingFor(state, [tags.keyword]), efxHighlightStyle.style([tags.keyword]));
  },
  "an application's colours replace them": () => {
    const state = EditorState.create({ extensions: [efx('template'), syntaxHighlighting(OWN_COLOURS)] });
    assert.equal(highlightingFor(state, [tags.keyword]), OWN_COLOURS.style([tags.keyword]));
  },
  'an unknown kind or version is refused': () => {
    assert.throws(() => efx(), RangeError);
    assert.throws(() => efx('rule'), RangeError);
    assert.throws(() => efx('rules', { version: 1 }), RangeError);
    assert.throws(() => efx('template', { version: 3 }), RangeError);
    assert.throws(() => efx('template', { version: '1' }), RangeError);
  },
};

const failures = Object.entries(CHECKS).flatMap(([name, check]) => {
  try {
    check();
    return [];
  } catch (error) {
    return [`  ${name}: ${error.message}`];
  }
});
console.log(`Package: ${Object.keys(CHECKS).length - failures.length} of ${Object.keys(CHECKS).length} checks pass.`);
if (failures.length > 0) {
  console.error(failures.join('\n'));
  process.exitCode = 1;
}
