// The inference test: inferEfx finds the version and kind of every corpus file, as their folder
// tells (the SDK's view templates are EFX-2 templates and its rules files EFX-2 rules; the view
// templates of the SDK 1 are EFX-1 templates), and settles the texts that read alike in every way
// as EFX-2 templates. It reads the build in dist/, so it runs after `npm run build`.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { languageOf } from '../dist/efxLanguage.js';
import { inferEfx } from '../dist/index.js';

// Each corpus folder, with what its files hold.
const FOLDERS = [
  { folder: './efx2/corpus/view-templates/', reading: { version: 2, kind: 'template' } },
  { folder: './efx2/corpus/validation/', reading: { version: 2, kind: 'rules' } },
  { folder: './efx1/corpus/view-templates/', reading: { version: 1, kind: 'template' } },
];

/**
 * The parses that the inference of a text makes, in their order, each with the kind of text it reads
 * the text as, version/kind, and the text it reads: it wraps the parser of each kind of text.
 */
function parsesOf(text, options) {
  const parsers = [[2, 'template'], [2, 'rules'], [2, 'bare-expression'], [1, 'template'], [1, 'bare-expression']]
    .map(([version, kind]) => ({ reading: `${version}/${kind}`, parser: languageOf(kind, version).parser }));
  const parses = [];
  const restores = parsers.map(({ reading, parser }) => {
    const parse = parser.parse;
    parser.parse = (input, ...rest) => {
      parses.push({ reading, input });
      return parse.call(parser, input, ...rest);
    };
    return () => { parser.parse = parse; };
  });
  try {
    inferEfx(text, options);
  } finally {
    restores.forEach((restore) => restore());
  }
  return parses;
}

/** The kinds of text that the inference of a text reads it as, version/kind, in their order. */
function readingsOf(text, options) {
  return parsesOf(text, options).map(({ reading }) => reading);
}

const EFX1_LINE = '{ND-Root} ${BT-01-notice}\n';
const EFX2_LINE = 'WITH ND-Root DISPLAY ${BT-01-notice};\n';

// The most that the inference reads of a text, from its first line that is neither blank nor a comment.
const MOST_READ = 4000;

// Texts that are no file of either version, or that the start of the text decides.
const CHECKS = {
  'an empty text is an EFX-2 template': () => assert.deepEqual(inferEfx(''), { version: 2, kind: 'template' }),
  'a text of comments only is an EFX-2 template': () =>
    assert.deepEqual(inferEfx('// A comment\n\n// Another\n'), { version: 2, kind: 'template' }),
  'a bare expression is EFX-2, which both versions read': () => {
    assert.deepEqual(inferEfx("BT-01-notice == 'a'"), { version: 2, kind: 'template' });
    assert.deepEqual(inferEfx('BT-01-notice\n'), { version: 2, kind: 'template' });
  },
  'a stage header makes rules': () =>
    assert.deepEqual(inferEfx('--- STAGE 1a ---\nWITH ND-Root ASSERT BT-01-notice is present AS ERROR R-000-001 FOR BT-01-notice IN *;\n'),
      { version: 2, kind: 'rules' }),
  'a context in braces makes an EFX-1 template': () => assert.deepEqual(inferEfx(EFX1_LINE), { version: 1, kind: 'template' }),
  'the kind of a version given is the best of that version': () => {
    assert.deepEqual(inferEfx(EFX1_LINE, { version: 2 }), { version: 2, kind: 'template' });
    assert.deepEqual(inferEfx('--- STAGE 1a ---\n', { version: 2 }), { version: 2, kind: 'rules' });
    assert.deepEqual(inferEfx('--- STAGE 1a ---\n', { version: 1 }), { version: 1, kind: 'template' });
    assert.throws(() => inferEfx('', { version: 3 }), RangeError);
  },
  'a known version is read only as its kinds of file, even from a start with errors': () => {
    // A string longer than the start that is read, which cuts it.
    const text = `WITH ND-Root DISPLAY \${'${'a'.repeat(33000)}'};\n`;
    assert.deepEqual(inferEfx(text, { version: 2 }), { version: 2, kind: 'template' });
    const readings = readingsOf(text, { version: 2 });
    assert.ok(readings.length > 0 && readings.every((reading) => reading === '2/template' || reading === '2/rules'), readings.join(', '));
  },
  'a header is passed over whatever ends its lines, as EFX ends them': () => {
    for (const lineBreak of ['\n', '\r\n', '\r', '\f']) {
      const header = `// A licence${lineBreak}${lineBreak}`.repeat(300);
      assert.deepEqual(inferEfx(`${header}{ND-Root} \${BT-01-notice}${lineBreak}`), { version: 1, kind: 'template' }, JSON.stringify(lineBreak));
      const rules = `--- STAGE 1a ---${lineBreak}WITH ND-Root ASSERT BT-01-notice is present AS ERROR R-000-001 FOR BT-01-notice IN *;${lineBreak}`;
      assert.deepEqual(inferEfx(header + rules), { version: 2, kind: 'rules' }, JSON.stringify(lineBreak));
    }
  },
  'a header comment holds any character but a line break': () => {
    for (const character of ['\u2028', '\u2029', '\u00a0', '\t']) {
      const header = `// A licence${character}that goes on\n`.repeat(300);
      assert.deepEqual(inferEfx(header + EFX1_LINE), { version: 1, kind: 'template' }, JSON.stringify(character));
      for (const { reading, input } of parsesOf(header + EFX1_LINE)) {
        assert.equal(input, EFX1_LINE, `${reading} read the header with ${JSON.stringify(character)}`);
      }
    }
  },
  'a start that two kinds of file read alike is read further': () => {
    // A declaration longer than the start, which a template and rules both begin with.
    const text = `LET text:$message = '${'a'.repeat(2100)}';\n--- STAGE 1a ---\n`
      + 'WITH ND-Root ASSERT BT-01-notice is present AS ERROR R-000-001 FOR BT-01-notice IN *;\n';
    assert.deepEqual(inferEfx(text), { version: 2, kind: 'rules' });
    assert.deepEqual(inferEfx(text, { version: 2 }), { version: 2, kind: 'rules' });
  },
  'a start cut in a string is read by how far each reading reads it without error': () => {
    const text = `{ND-Root} \${'${'a'.repeat(5000)}'}\n${EFX1_LINE}`;
    assert.deepEqual(inferEfx(text), { version: 1, kind: 'template' });
  },
  'a long line is read by its start only': () => {
    const line = `{ND-Root} \${${Array(60000).fill('BT-1-Lot').join(' + ')}}`;
    assert.deepEqual(inferEfx(line), { version: 1, kind: 'template' });
    for (const { reading, input } of parsesOf(line)) {
      assert.ok(input.length <= MOST_READ, `${reading} read ${input.length} characters`);
      assert.ok(line.startsWith(input), `${reading} read another text than the start`);
    }
  },
  'a long header of comments and blank lines is passed over': () => {
    const header = '// Licensed under the EUPL, a header that says nothing of what the file holds.\n\n'.repeat(300);
    assert.deepEqual(inferEfx(header + EFX1_LINE), { version: 1, kind: 'template' });
    for (const { reading, input } of parsesOf(header + EFX1_LINE)) {
      assert.equal(input, EFX1_LINE, `${reading} read the header`);
    }
  },
  'a long text is read by its start': () => {
    const efx2Start = EFX2_LINE.repeat(Math.ceil(20000 / EFX2_LINE.length));
    assert.deepEqual(inferEfx(efx2Start + EFX1_LINE.repeat(2000)), { version: 2, kind: 'template' });
    const efx1Start = EFX1_LINE.repeat(Math.ceil(20000 / EFX1_LINE.length));
    assert.deepEqual(inferEfx(efx1Start + EFX2_LINE.repeat(2000)), { version: 1, kind: 'template' });
  },
};

const failures = [];
let files = 0;
for (const { folder, reading } of FOLDERS) {
  const directory = fileURLToPath(new URL(folder, import.meta.url));
  for (const file of fs.readdirSync(directory).filter((name) => name.endsWith('.efx')).sort()) {
    files += 1;
    const inferred = inferEfx(fs.readFileSync(path.join(directory, file), 'utf8'));
    if (inferred.version !== reading.version || inferred.kind !== reading.kind) {
      failures.push(`  ${folder}${file}: inferred EFX-${inferred.version} ${inferred.kind}`);
    }
  }
}
for (const [name, check] of Object.entries(CHECKS)) {
  try {
    check();
  } catch (error) {
    failures.push(`  ${name}: ${error.message}`);
  }
}
const total = files + Object.keys(CHECKS).length;
console.log(`Inference: ${total - failures.length} of ${total} texts read as what they hold (${files} corpus files).`);
if (failures.length > 0) {
  console.error(failures.join('\n'));
  process.exitCode = 1;
}
