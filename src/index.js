// The package's public surface: EFX support for a CodeMirror 6 editor (efx), the field and node ids
// it offers (efxSymbols), the EFX colours (efxHighlightStyle) and a light look for the editor
// (efxTheme), and the same for a dark background (efxDarkHighlightStyle, efxDarkTheme); and, without
// an editor, the highlighting of a text (efxHighlights), the version and kind of file a text holds
// (inferEfx), and the TextMate scope of each highlight tag (efxTextMateScopes).
export { efx } from './efxLanguage.js';
export { efxHighlights } from './efxHighlights.js';
export { inferEfx } from './efxInference.js';
export { efxSymbols } from './efxSymbols.js';
export { efxTextMateScopes } from './efxTextMateScopes.js';
export { efxDarkHighlightStyle, efxDarkTheme, efxHighlightStyle, efxTheme } from './efxTheme.js';
