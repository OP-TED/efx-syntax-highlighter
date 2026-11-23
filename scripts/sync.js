// Copies into the highlighter what it takes from the EFX-2 grammar, the toolkit and the EFX-1
// grammar, at pinned commits:
//
//   npm run sync                               reads the commits pinned in package.json again
//   npm run sync -- <sdk> <toolkit> [<sdk1>]   pins new commits first, each as owner/repository@commit
//
// What the package is built from, committed: from the SDK, the table of its lexer, the words of
// each lexer mode and the TextMate grammar made from its lexer (src/efx2/generated/lexer.js,
// words.js, efx2.tmLanguage.json); from the toolkit, its completion list
// (src/efx2/generated/completions.js); from the SDK of EFX-1, the table of its lexer and its TextMate
// grammar (src/efx1/generated/lexer.js, efx1.tmLanguage.json). What only the tests and the demo
// read, which git ignores: from each SDK, its ANTLR lexer and parser (test/efx2/oracle/,
// test/efx1/oracle/) and its EFX files (test/efx2/corpus/, the view templates and rules files;
// test/efx1/corpus/, the view templates).

import { AntlrGrammar } from './sync/AntlrGrammar.js';
import { CompletionList } from './sync/CompletionList.js';
import { Corpus } from './sync/Corpus.js';
import { GeneratedFiles } from './sync/GeneratedFiles.js';
import { LexerWords } from './sync/LexerWords.js';
import { Pins } from './sync/Pins.js';
import { TextMateGrammar } from './sync/TextMateGrammar.js';
import { EFX1_STYLES } from '../src/efx1/efx1Highlighting.js';
import { LEXER_OPTIONS as EFX1_LEXER_OPTIONS } from '../src/efx1/lexerOptions.js';
import { EFX2_STYLES } from '../src/efx2/efx2Highlighting.js';
import { LEXER_OPTIONS as EFX2_LEXER_OPTIONS } from '../src/efx2/lexerOptions.js';

const LEXER_GRAMMAR = 'efx-grammar/EfxLexer.g4';
const PARSER_GRAMMAR = 'efx-grammar/Efx.g4';
const COMPLETIONS = 'src/main/resources/eu/europa/ted/efx/autocomplete/sdk2-completions.json';

const commandLine = process.argv.slice(2);
const pins = await (commandLine.length > 0 ? Pins.of(commandLine) : Pins.recorded()).resolved();
const { sdk, toolkit, sdk1 } = pins;

const [lexerGrammar, parserGrammar, completionList, corpus, efx1LexerGrammar, efx1ParserGrammar, efx1Corpus] =
  await Promise.all([sdk.read(LEXER_GRAMMAR), sdk.read(PARSER_GRAMMAR), toolkit.read(COMPLETIONS), Corpus.of(sdk),
    sdk1.read(LEXER_GRAMMAR), sdk1.read(PARSER_GRAMMAR), Corpus.of(sdk1, ['view-templates'])]);
const grammar = await AntlrGrammar.generate(lexerGrammar, parserGrammar);
const efx1Grammar = await AntlrGrammar.generate(efx1LexerGrammar, efx1ParserGrammar);
const words = new LexerWords(grammar);
const completions = CompletionList.parse(completionList.toString('utf8'));
const textMate = TextMateGrammar.of(lexerGrammar.toString('utf8'),
  { name: 'EFX-2', scopeName: 'source.efx2', source: sdk, styles: EFX2_STYLES, lexerOptions: EFX2_LEXER_OPTIONS });
const efx1TextMate = TextMateGrammar.of(efx1LexerGrammar.toString('utf8'),
  { name: 'EFX-1', scopeName: 'source.efx1', source: sdk1, styles: EFX1_STYLES, lexerOptions: EFX1_LEXER_OPTIONS });

const output = new GeneratedFiles();
output.write('src/efx2/generated/lexer.js', grammar.lexerTable().toModule(sdk));
output.write('src/efx2/generated/words.js', words.toModule(sdk));
output.write('src/efx2/generated/efx2.tmLanguage.json', textMate.toFile());
output.write('src/efx1/generated/lexer.js', efx1Grammar.lexerTable().toModule(sdk1));
output.write('src/efx1/generated/efx1.tmLanguage.json', efx1TextMate.toFile());
output.write('src/efx2/generated/completions.js', completions.toModule(`${COMPLETIONS} at ${toolkit}`));
output.replaceFolder('test/efx2/oracle', grammar.oracleFiles(sdk));
output.replaceFolder('test/efx2/corpus', corpus.files());
output.replaceFolder('test/efx1/oracle', efx1Grammar.oracleFiles(sdk1));
output.replaceFolder('test/efx1/corpus', efx1Corpus.files());
pins.record();

console.log(`Synced from ${sdk}, ${toolkit} and ${sdk1}:
  words: ${words}
  ${completions.size} completion items, ${corpus.size} corpus files, ${efx1Corpus.size} EFX-1 corpus files`);
