// Builds the package in dist/: src/ as it is, and for each version of EFX the parser of its grammar,
// grammar/efx<version>.grammar, written to dist/efx<version>/parser.js beside the version's own
// modules, which the parser loads (its lexer and highlight tags). dist/ is made anew each time. The
// parsers are generated with the Lezer generator's own functions, in this process.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildParserFile } from '@lezer/generator';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const SOURCE = path.join(ROOT, 'src');
const DIST = path.join(ROOT, 'dist');

const VERSIONS = ['efx1', 'efx2'];

fs.rmSync(DIST, { recursive: true, force: true });
fs.cpSync(SOURCE, DIST, { recursive: true });
for (const version of VERSIONS) {
  const grammarFile = path.join(ROOT, 'grammar', `${version}.grammar`);
  const { parser, terms } = buildParserFile(fs.readFileSync(grammarFile, 'utf8'), {
    fileName: path.relative(ROOT, grammarFile),
    moduleStyle: 'es',
    warn: (message) => {
      throw new Error(`${path.relative(ROOT, grammarFile)}: ${message}`);
    },
  });
  fs.writeFileSync(path.join(DIST, version, 'parser.js'), parser);
  fs.writeFileSync(path.join(DIST, version, 'parser.terms.js'), terms);
}
console.log(`Built dist/: src/ and the parsers of ${VERSIONS.join(' and ')}.`);
