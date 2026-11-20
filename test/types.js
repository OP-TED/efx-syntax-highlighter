// The types test: the package's types (src/index.d.ts, in dist/ after the build) as an application
// written in TypeScript uses them, through the package's name and its exports (test/types/usage.ts):
// the TypeScript compiler must accept each call the package accepts and refuse each one marked as
// refused. It reads the build in dist/, so it runs after `npm run build`.

import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const tsc = createRequire(import.meta.url).resolve('typescript/bin/tsc');
const project = fileURLToPath(new URL('types/tsconfig.json', import.meta.url));
try {
  execFileSync(process.execPath, [tsc, '--project', project], { encoding: 'utf8', stdio: 'pipe' });
  console.log('Types: the usage compiles, and every refused call is refused.');
} catch (error) {
  console.error(`Types: the compiler reports:\n${error.stdout}${error.stderr}`);
  process.exitCode = 1;
}
