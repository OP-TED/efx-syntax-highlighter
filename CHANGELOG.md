# EFX Syntax Highlighter 0.6.0 Release Notes

_The EFX Syntax Highlighter gives [CodeMirror 6](https://codemirror.net/) editors syntax highlighting and completions for [EFX](https://docs.ted.europa.eu/eforms/latest/efx), the expression and template language of the eForms SDK._

---

## In this release

This release makes the EFX colours readable for everyone, and adds a set of colours for dark backgrounds ([TEDEFO-5374](https://citnet.tech.ec.europa.eu/CITnet/jira/browse/TEDEFO-5374)). An application that sets up its editor as for 0.5 needs no change; its editor shows the new colours.

### Colours that reach 4.5:1

Every colour now reaches 4.5:1 against a white background, the contrast that WCAG 2.1 AA and EN 301 549 require for text of the size an editor shows. Four colours were below it. They keep their hues, a little darker:

| Colours | Before | Now |
|---|---|---|
| Fields and nodes | `#269d69` | `#208559` |
| Variables, and declared functions and templates | `#cc7a0a` | `#a96508` |
| Literals, outline numbers, and names of assets, rules and stages | `#e14775` | `#dc2b60` |
| Comments | `#999999` | `#757575` |

Punctuation, and the brackets `${`, `#{` and `}`, are now grey like the operators, instead of the orange of variables, so that variables stand out. The brackets are bold, so that the start and end of an expression in template text stay easy to find. All other colours are as before.

### Colours for dark backgrounds

- **`efxDarkTheme`** is a dark look for the editor, with the EFX colours for a dark background. An application adds it instead of `efxTheme` on a dark screen. The colours keep the same hue for the same kind of word, lightened to about 7:1 against the dark background `#1e1f22`.
- **`efxDarkHighlightStyle`** is those colours on their own, for an application that gives its editor its own dark look.

A new test checks that every colour of both sets reaches 4.5:1 against its background.
