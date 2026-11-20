// The SDK's EFX files the conformance test reads: its view templates and, in SDK 2, its rules
// files, kept under the SDK's folder names so that the #include paths of the rules files still
// resolve.

const FOLDERS = ['view-templates', 'validation'];

export class Corpus {
  #files;

  constructor(files) {
    this.#files = files;
  }

  /** The EFX files of an SDK under some of its folders, by default its view templates and rules files. */
  static async of(sdk, folders = FOLDERS) {
    const paths = (await Promise.all(folders.map((folder) => sdk.filesUnder(folder))))
      .flat().filter((path) => path.endsWith('.efx'));
    return new Corpus(new Map(await Promise.all(paths.map(async (path) => [path, await sdk.read(path)]))));
  }

  get size() {
    return this.#files.size;
  }

  /** The files, by their path in the SDK. */
  files() {
    return this.#files;
  }
}
