// Custom theme for efx syntax
import {HighlightStyle, tags} from '@codemirror/highlight';

export const efxHighlightStyle = HighlightStyle.define([
  {tag: tags.keyword, color: '#d73a49'},
  {tag: tags.variableName, color: '#005cc5'},
  {tag: tags.number, color: '#6f42c1'},
  {tag: tags.comment, color: '#6a737d', fontStyle: 'italic'},
]);
