// The demo page: an editor for each EFX-2 or EFX-1 text of the chosen sample, with the EFX colours,
// the editor's look and, for EFX-2, the completions. The field and node ids it offers are those the text
// uses, found by the shapes of the grammar's FieldId and NodeId. Served by `npm run demo` after
// `npm run build`, and published by the Pages workflow; not part of the package.

import { autocompletion } from '@codemirror/autocomplete';
import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { efx, efxSymbols, efxTheme } from '../dist/index.js';

const FIELD_ID = /\b(?:BT|OPP|OPT|OPA)-\d+(?:\((?:BT-\d+|[a-z])\))?(?:-[a-zA-Z_][a-zA-Z_0-9]*)+/g;
const NODE_ID = /\bND-[a-zA-Z0-9]+/g;

const editors = document.getElementById('editor');
const choice = document.getElementById('kind');
let views = [];

/** The ids of a shape that a text uses, each once. */
function idsIn(text, shape) {
  return [...new Set(text.match(shape))];
}

/**
 * The editor's accessible name, and the keys of its suggestions, for screen readers. An editor among
 * several is named by the caption above it.
 */
function attributes(captionId) {
  return EditorView.contentAttributes.of(captionId
    ? { 'aria-labelledby': captionId, 'aria-describedby': 'editor-keys' }
    : { 'aria-label': 'EFX editor', 'aria-describedby': 'editor-keys' });
}

/**
 * Shows the texts of the chosen option, each from the file it names, in an editor of its own with the
 * extensions of its kind and of the option's version, unless another option was chosen meanwhile. An
 * option with several texts shows each under its caption.
 */
async function show() {
  const option = choice.selectedOptions[0];
  const { value } = option;
  const version = Number(option.dataset.version);
  const texts = JSON.parse(option.dataset.texts);
  const docs = await Promise.all(texts.map(async ({ file }) => (await fetch(file)).text()));
  if (choice.value !== value) {
    return;
  }
  for (const view of views) {
    view.destroy();
  }
  editors.replaceChildren();
  editors.classList.toggle('several', texts.length > 1);
  views = texts.map(({ kind, label }, index) => {
    const doc = docs[index];
    let captionId = null;
    if (label) {
      const caption = document.createElement('p');
      captionId = `editor-caption-${index}`;
      caption.id = captionId;
      caption.className = 'caption';
      caption.textContent = label;
      editors.append(caption);
    }
    return new EditorView({
      parent: editors,
      state: EditorState.create({
        doc,
        extensions: [
          efx(kind, { version }),
          efxTheme,
          attributes(captionId),
          efxSymbols.of({ fields: idsIn(doc, FIELD_ID), nodes: idsIn(doc, NODE_ID) }),
          autocompletion(),
          EditorView.lineWrapping,
        ],
      }),
    });
  });
}

choice.addEventListener('change', show);
show();
