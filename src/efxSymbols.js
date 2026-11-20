// The field and node ids an application gives the editor, which it offers where the grammar takes
// one: an extension, `efxSymbols.of({ fields, nodes })`, each a list of ids, for example those of
// the SDK's fields.json. An entry is an id, or an id with its type, `{ id, type }`, such as a
// field's type in fields.json, which the editor shows beside the id. The ids of several such
// extensions add up, each entry as the application gave it.

import { Facet } from '@codemirror/state';

export const efxSymbols = Facet.define({
  combine: (symbols) => ({
    fields: symbols.flatMap(({ fields = [] }) => fields),
    nodes: symbols.flatMap(({ nodes = [] }) => nodes),
  }),
});
