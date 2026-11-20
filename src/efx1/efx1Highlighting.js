// The highlight tags of the EFX-1 grammar (grammar/efx1.grammar, @external propSource), by the same
// rules as those of EFX-2 (src/efx2/efx2Highlighting.js), so that both read alike with the same colours.
import { styleTags, tags as t } from "@lezer/highlight";

export const EFX1_STYLES = {
  // The words of expressions.
  "And Or Not Is In Like Present Empty Unique Every Some Satisfies If Then Else For Return Notice Axis": t.className,
  // The words chosen from a fixed list: asset and label types.
  "AssetType LabelType": t.className,

  // Types, which EFX-1 writes with their colon.
  "BooleanTypeCast NumericTypeCast TextTypeCast CodeTypeCast DateTypeCast TimeTypeCast DurationTypeCast": t.typeName,
  ContextTypeCast: t.typeName,

  // The built-in functions.
  "FunctionCall/Not CountFunction SubstringFunction StringFunction NumberFunction ContainsFunction": t.function(t.keyword),
  "StartsWithFunction EndsWithFunction StringLengthFunction SumFunction FormatNumberFunction ConcatFunction": t.function(t.keyword),
  "DateFunction TimeFunction DayTimeDurationFunction YearMonthDurationFunction AddMeasure SubtractMeasure": t.function(t.keyword),
  "DistinctValuesFunction UnionFunction IntersectFunction ExceptFunction SequenceEqualFunction": t.function(t.keyword),

  // Literals, and the outline numbers of a template.
  "STRING UUIDV4 INTEGER DECIMAL DATE TIME DayTimeDurationLiteral YearMonthDurationLiteral": t.literal,
  "True False Always Never OutlineNumber": t.literal,

  // The data of a notice: fields, nodes and attributes.
  "FieldId NodeId BtId AttributeReference/Identifier": t.propertyName,

  // Variables, and the field value and label of the context in a template.
  "Variable ShorthandFieldValueReferenceFromContextField ShorthandIndirectLabelReferenceFromContextField": t.variableName,

  // Names of assets in a label.
  "OtherAssetId AssetId/AssetType AssetId/LabelType": t.special(t.name),

  // Template text.
  FreeText: t.special(t.string),

  "Comparison Plus Minus Star Slash Percent ColonColon": t.operator,
  "OpenParenthesis CloseParenthesis OpenBracket CloseBracket Pipe Comma": t.punctuation,
  SlashAt: t.punctuation,
  "StartExpression StartLabel StartSelector EndExpression EndLabel": t.bracket,
  Comment: t.lineComment,
  Identifier: t.name,
};

export const efx1Highlighting = styleTags(EFX1_STYLES);
