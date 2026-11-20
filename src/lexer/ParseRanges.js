// The parts of the document that the parse now running reads (its ranges), for the lexer, which
// reads them as one text. An editor's parser makes them known while its parse runs (EditorParser.js);
// a parse that does not, such as the completions' own, reads the document from its start.

// The ranges of the parse that runs, if any.
let current;

/** Runs a function with the ranges of a parse known, and gives its result. */
export function withRanges(ranges, run) {
  const outer = current;
  current = ranges;
  try {
    return run();
  } finally {
    current = outer;
  }
}

/** The ranges of the parse that runs: the whole document, if it did not make them known. */
export function currentRanges() {
  return current ?? [{ from: 0, to: Infinity }];
}
