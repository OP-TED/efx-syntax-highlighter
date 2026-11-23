// The TextMate scope of each highlight tag, by the tag's name, as the package's TextMate grammars
// scope the tokens the tag colours (scripts/sync/TextMateGrammar.js writes them): for an editor
// that colours EFX with them, such as VS Code, and that maps its own kinds of token onto them. The
// tag of plain names has none, as it colours them as the text around them.
export const efxTextMateScopes = Object.freeze({
  keyword: "keyword.control.efx",
  className: "keyword.other.efx",
  typeName: "storage.type.efx",
  "function(keyword)": "support.function.efx",
  literal: "constant.language.efx",
  string: "string.quoted.efx",
  number: "constant.numeric.efx",
  propertyName: "variable.other.property.efx",
  variableName: "variable.other.efx",
  "function(name)": "entity.name.function.efx",
  "special(name)": "constant.other.efx",
  "special(string)": "meta.text.efx",
  operator: "keyword.operator.efx",
  punctuation: "punctuation.separator.efx",
  bracket: "punctuation.section.block.efx",
  lineComment: "comment.line.double-slash.efx",
});
