# EFX Syntax Highlighter 0.5.0 Release Notes

_The EFX Syntax Highlighter gives [CodeMirror 6](https://codemirror.net/) editors syntax highlighting and completions for [EFX](https://docs.ted.europa.eu/eforms/latest/efx), the expression and template language of the eForms SDK._

---

## In this release

This release follows the EFX-2 grammar of the eForms SDK as it now stands, on its `efx-2` branch: the SDK has removed some forms from EFX-2 and added others. The editor reads EFX-2 text as the SDK does, so a text written for 0.4 that uses a removed form is now shown with an error. EFX-1 is unchanged. An application that sets up its editor as for 0.4 needs no change.

### What EFX-2 has gained

- A template file can declare its callable templates in `--- TEMPLATE name ---` sections, each with an optional `PARAMETERS` line, followed by the main section under its `--- MAIN ---` heading. The heading is optional when the file has no template sections.
- `#include "path"` may end with a `;`.
- The last line of a file may end with a comment and no line end.

### What EFX-2 has lost

- The EFX-1 forms: the template line `{context} template` and the single expressions `{context} ${expression}` and `{context} &{selection}`. Write `WITH context DISPLAY template;`, `WITH context COMPUTE expression` and `WITH context SELECT selection`.
- Templates declared with `LET template:name(...)`: they are declared in `--- TEMPLATE ---` sections.
- Field and node aliases: a field or a node is named by its id.
- The codelist form `#codelist`: write `[...codelist]`.
- A context override after anything but a context variable: `$context::BT-1-Lot` stays, `ND-Lot::BT-1-Lot` goes.
- A rule without its `;`: each rule now ends with one, and the rules after the first one of a rule set may be indented.

### Colours and completions

- The headings of template sections and the main section, and `PARAMETERS`, are coloured as keywords, and the name of a template section as a function.
- The completions follow the toolkit's list for the new grammar.

### Editing a text with errors

- After an edit, the editor reuses its earlier tree only up to the first error in it. Before, a text with errors early on could be read differently after an edit than when read anew; a new test checks texts wrong throughout.
