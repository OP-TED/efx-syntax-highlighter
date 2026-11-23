// What a file of EFX holds, found from its text alone, for an application that opens EFX files
// without being told their version or kind. The start of the text, after any leading blank and
// comment lines, is read in each version, or in the version given, as each kind of file of that
// version and, where more than one version is read, as a bare expression.
//
// Where the start is the whole text, the version is the one with the fewest errors, EFX-2 on a tie,
// as for an empty file, a file of comments only or a bare expression, which both read alike; the
// kind is the kind of file of that version with the fewest errors, a template on a tie. EFX-1 has no
// rules files.
//
// Where the start is cut from a longer text, the errors that a reading makes there say little: the
// cut makes errors in every reading, as where it cuts a string, and how many more a parser makes after
// its first error depends on how it recovers. The reading that reads furthest into it without error
// fits it best: when one kind of file reads further than every other reading, it tells the version
// and the kind. When two read as far, as a template and rules do over declarations, or the furthest
// is a bare expression, a start twice as long is read, up to a limit; at the limit, the reading that
// reads furthest tells, the earlier on a tie.
import { languageOf } from "./efxLanguage.js";

// How much of the text is read first: from its first line that is neither blank nor a comment, as a
// long header comment, such as a licence, tells nothing of what the text holds, to the end of the line
// this many characters further on, but no more than twice as many, so that a line that goes on is cut.
const SAMPLE_LENGTH = 2000;

// How far a start is made longer, at most, where its readings do not tell.
const MAX_SAMPLE_LENGTH = 16000;

// A line break, as EFX ends a line.
const LINE_BREAK = /\r\n|[\n\f\r]/g;

// A line that is blank, or holds a comment only, as both versions write it, without its line break:
// a comment runs to the end of its line, whatever it holds.
const HEADER_LINE = /^[\t ]*(?:\/\/[^\n\f\r]*)?$/;

// The versions, in the order that settles a tie, each with its kinds of file in that order.
const VERSIONS = [
  { version: 2, files: ["template", "rules"] },
  { version: 1, files: ["template"] },
];

/**
 * How a version reads a text as a kind of text: the number of places where its parser finds the text
 * wrong, and where the first of them starts (Infinity for none).
 */
function readingOf(text, version, kind) {
  let errors = 0;
  let firstError = Infinity;
  languageOf(kind, version).parser.parse(text).iterate({
    enter: (node) => {
      if (node.type.isError) {
        errors += 1;
        firstError = Math.min(firstError, node.from);
      }
    },
  });
  return { version, kind, file: kind !== "bare-expression", errors, firstError };
}

/** Where the line break after a position of a text ends; the end of the text where none follows. */
function lineEndAfter(text, position) {
  LINE_BREAK.lastIndex = position;
  const lineBreak = LINE_BREAK.exec(text);
  return lineBreak === null ? text.length : lineBreak.index + lineBreak[0].length;
}

/** Where the first line of a text starts that is neither blank nor a comment; its end where there is none. */
function headerEndOf(text) {
  let start = 0;
  while (start < text.length) {
    LINE_BREAK.lastIndex = start;
    const lineBreak = LINE_BREAK.exec(text);
    const end = lineBreak === null ? text.length : lineBreak.index;
    if (!HEADER_LINE.test(text.slice(start, end))) {
      return start;
    }
    start = lineBreak === null ? text.length : end + lineBreak[0].length;
  }
  return text.length;
}

/** The readings of a text: in each version, as each kind of file, and as a bare expression where more than one version is read. */
function readingsOf(text, versions) {
  return versions.flatMap(({ version, files }) => [...files, ...(versions.length > 1 ? ["bare-expression"] : [])]
    .map((kind) => readingOf(text, version, kind)));
}

/** The version and kind of the best of the readings of a whole text: the fewest errors, the earlier on a tie. */
function fewestErrorsOf(readings) {
  const score = (version) => Math.min(...readings.filter((reading) => reading.version === version).map(({ errors }) => errors));
  const version = readings.reduce((best, reading) => (score(reading.version) < score(best.version) ? reading : best)).version;
  const files = readings.filter((reading) => reading.version === version && reading.file);
  return { version, kind: files.reduce((best, reading) => (reading.errors < best.errors ? reading : best)).kind };
}

/** The reading of a cut text that reads furthest into it without error, the earlier on a tie. */
function furthestOf(readings) {
  return readings.reduce((best, reading) => (reading.firstError > best.firstError ? reading : best));
}

/**
 * The version of EFX, 1 or 2, and the kind of file, "template" or "rules", that a text reads as best;
 * with options { version }, the kind of file of that version (EFX-1 has templates only).
 */
export function inferEfx(text, { version } = {}) {
  if (version !== undefined && version !== 1 && version !== 2) {
    throw new RangeError(`Unknown version of EFX: ${version}. The versions are 2, 1.`);
  }
  const versions = VERSIONS.filter((each) => version === undefined || each.version === version);
  const start = headerEndOf(text);
  for (let length = SAMPLE_LENGTH; ; length *= 2) {
    const end = Math.min(lineEndAfter(text, start + length), start + 2 * length);
    const readings = readingsOf(text.slice(start, end), versions);
    if (end === text.length) {
      return fewestErrorsOf(readings);
    }
    const furthest = furthestOf(readings);
    const alone = readings.every((reading) => reading === furthest || reading.firstError < furthest.firstError);
    if ((alone && furthest.file) || length >= MAX_SAMPLE_LENGTH) {
      // At the limit, the furthest kind of file of the furthest version.
      const files = readings.filter((reading) => reading.version === furthest.version && reading.file);
      return { version: furthest.version, kind: furthestOf(files).kind };
    }
  }
}
