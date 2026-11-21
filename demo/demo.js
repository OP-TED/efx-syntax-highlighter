// The demo page: an editor for each EFX-2 or EFX-1 text of the chosen sample, with the EFX colours,
// the editor's look and, for EFX-2, the completions. The field and node ids it offers are those the text
// uses, found by the shapes of the grammar's FieldId and NodeId. Served by `npm run demo` after
// `npm run build`, and published by the Pages workflow; not part of the package.

import { autocompletion } from '@codemirror/autocomplete';
import { Compartment, EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { efx, efxDarkTheme, efxSymbols, efxTheme } from '../dist/index.js';
import { DARK_BACKGROUND, DARK_COLOURS, LIGHT_BACKGROUND, LIGHT_COLOURS } from '../dist/efxTheme.js';

const FIELD_ID = /\b(?:BT|OPP|OPT|OPA)-\d+(?:\((?:BT-\d+|[a-z])\))?(?:-[a-zA-Z_][a-zA-Z_0-9]*)+/g;
const NODE_ID = /\bND-[a-zA-Z0-9]+/g;

const editors = document.getElementById('editor');
const choice = document.getElementById('kind');
const palette = document.getElementById('palette');
const buttons = { light: document.getElementById('light'), dark: document.getElementById('dark') };
let views = [];
let background = 'light';
// The look of the editors, which the switch changes without touching their texts.
const look = new Compartment();

// The two looks of the editor: its theme, and the colours and background its palette shows.
const LOOKS = {
  light: { theme: efxTheme, colours: LIGHT_COLOURS, background: LIGHT_BACKGROUND },
  dark: { theme: efxDarkTheme, colours: DARK_COLOURS, background: DARK_BACKGROUND },
};

// The palette: what each colour marks, with an example in that colour.
const KEY = [
  { colour: 'keyword', label: 'Keywords and the words of expressions', example: 'WITH', bold: true },
  { colour: 'data', label: 'Fields and nodes', example: 'BT-21-Lot', bold: true },
  { colour: 'variable', label: 'Variables and declared functions', example: '$value', bold: true },
  { colour: 'literal', label: 'Literals and names of labels', example: "'LOT-0001'" },
  { colour: 'operator', label: 'Operators and punctuation', example: '== ;', bold: true },
  { colour: 'comment', label: 'Comments', example: '// note', italic: true },
];

/** Shows the palette of the chosen look. */
function showPalette() {
  const { colours, background: ground } = LOOKS[background];
  palette.replaceChildren(...KEY.map(({ colour, label, example, bold, italic }) => {
    const item = document.createElement('li');
    const sample = document.createElement('span');
    sample.className = 'sample';
    sample.textContent = example;
    sample.style.color = colours[colour];
    sample.style.background = ground;
    sample.style.fontWeight = bold ? '700' : '400';
    sample.style.fontStyle = italic ? 'italic' : 'normal';
    sample.setAttribute('aria-hidden', 'true');
    item.append(sample, ` ${label}`);
    return item;
  }));
}

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
  editors.classList.toggle('dark', background === 'dark');
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
          look.of(LOOKS[background].theme),
          attributes(captionId),
          efxSymbols.of({ fields: idsIn(doc, FIELD_ID), nodes: idsIn(doc, NODE_ID) }),
          autocompletion(),
          EditorView.lineWrapping,
        ],
      }),
    });
  });
}

/** Changes the background of the editors, keeping their texts as they are. */
function choose(name) {
  background = name;
  for (const [buttonName, button] of Object.entries(buttons)) {
    button.setAttribute('aria-pressed', String(buttonName === name));
  }
  editors.classList.toggle('dark', name === 'dark');
  for (const view of views) {
    view.dispatch({ effects: look.reconfigure(LOOKS[name].theme) });
  }
  showPalette();
}

buttons.light.addEventListener('click', () => choose('light'));
buttons.dark.addEventListener('click', () => choose('dark'));
showPalette();
choice.addEventListener('change', show);
show();
