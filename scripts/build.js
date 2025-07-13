
// Build script to generate parser from grammar
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');


const grammarFile = path.join(__dirname, '../grammar/efx.grammar');
const srcDir = path.join(__dirname, '../src');
const distDir = path.join(__dirname, '../dist');

try {
  if (!fs.existsSync(distDir)) fs.mkdirSync(distDir);
  execSync(`npx lezer-generator ${grammarFile} -o ${distDir}/efx-parser.js`, { stdio: 'inherit' });
  console.log('Parser generated successfully in dist/.');

  // Copy all relevant JS files from src to dist (except parser)
  const filesToCopy = ['efxLanguage.js', 'efxTheme.js', 'index.js'];
  for (const file of filesToCopy) {
    const srcFile = path.join(srcDir, file);
    const distFile = path.join(distDir, file);
    if (fs.existsSync(srcFile)) {
      fs.copyFileSync(srcFile, distFile);
    }
  }
  console.log('Copied source files to dist/.');
} catch (err) {
  console.error('Build failed:', err);
  process.exit(1);
}
