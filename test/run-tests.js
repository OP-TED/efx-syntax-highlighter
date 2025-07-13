// Minimal test runner for efx parser
const fs = require('fs');
const path = require('path');
const {parser} = require('../src/efx-parser');

const sample = fs.readFileSync(path.join(__dirname, 'sample.efx'), 'utf8');

try {
  const tree = parser.parse(sample);
  if (tree) {
    console.log('Parse successful:', tree.toString());
    process.exit(0);
  } else {
    console.error('Parse failed');
    process.exit(1);
  }
} catch (err) {
  console.error('Error:', err);
  process.exit(1);
}
