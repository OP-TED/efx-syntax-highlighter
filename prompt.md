# Prompt for Agentic Copilot: Create the efx-syntax-highlighter Project

## Project Overview
Create a JavaScript package called `efx-syntax-highlighter` that provides a Lezer-based parser and CodeMirror 6 language support extension for syntax highlighting the efx language. The package should include:
- A simplified Lezer grammar for efx (plain JavaScript, not TypeScript)
- Build scripts to generate the parser
- Export of `efxLanguage` for CodeMirror 6 integration
- Custom color theme/styles for efx syntax
- Minimal test scripts using sample efx files (no heavy frameworks)
- Build output in `dist/` for npm publishing
- README with usage instructions, integration guide, and npm publishing steps
- EUPL 2.0 license file

## Requirements
- Keep dependencies and setup minimal
- Do not include integration examples or advanced test frameworks
- Do not include AST generation or advanced parsing features
- Only publish the parser and highlighting styles (not grammar source or test utilities)
- Ensure the package is ready for npm publishing

## Steps
1. Set up the project structure under the provided directory
2. Add the Lezer grammar file and build scripts
3. Implement the CodeMirror 6 language extension and color styles
4. Add minimal tests using provided sample efx files
5. Prepare the `dist/` output for publishing
6. Write a README with usage and publishing instructions
7. Add the EUPL 2.0 license file

## Success Criteria
- The package can be installed and used in CodeMirror 6 to highlight efx code
- Tests can be run to validate grammar changes
- The package is published to npm with clear documentation
