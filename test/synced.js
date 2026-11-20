// Runs before the other tests: it stops them, with a message that says what to do, when the files
// they read from the SDK are missing. `npm run sync` writes those files, at the commits pinned in
// package.json, into the folders below, which git ignores: each version's copy of the SDK's EFX
// files (corpus/) and of its ANTLR grammar, with the lexer and parser generated from it (oracle/).

import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const FOLDERS = ['efx2/corpus', 'efx2/oracle', 'efx1/corpus', 'efx1/oracle'];

const missing = FOLDERS.filter((folder) => {
  const path = fileURLToPath(new URL(`./${folder}/`, import.meta.url));
  return !fs.existsSync(path) || fs.readdirSync(path).length === 0;
});
if (missing.length > 0) {
  console.error(`The tests read files that npm run sync writes, and these folders are missing or empty: `
    + `${missing.map((folder) => `test/${folder}/`).join(', ')}. Run npm run sync first.`);
  process.exitCode = 1;
}
