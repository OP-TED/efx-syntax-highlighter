// The commits the generated files come from, recorded in package.json: the SDK of EFX-2
// (config.sdk), the toolkit (config.toolkit) and the SDK of EFX-1 (config.sdk1).

import fs from 'node:fs';
import { GitHubCommit } from './GitHubCommit.js';

const PACKAGE = new URL('../../package.json', import.meta.url);

export class Pins {
  constructor(sdk, toolkit, sdk1) {
    this.sdk = sdk;
    this.toolkit = toolkit;
    this.sdk1 = sdk1;
  }

  /**
   * The pins given on the command line: `npm run sync -- <sdk> <toolkit> [<sdk1>]`. The SDK of
   * EFX-1, when it is not given, stays as recorded.
   */
  static of([sdk, toolkit, sdk1, ...rest]) {
    if (!sdk || !toolkit || rest.length > 0) {
      throw new Error('Usage: npm run sync [-- <owner/eForms-SDK@commit> <owner/efx-toolkit-java@commit> '
        + '[<owner/eForms-SDK@commit of EFX-1>]]');
    }
    return new Pins(GitHubCommit.parse(sdk), GitHubCommit.parse(toolkit),
      sdk1 ? GitHubCommit.parse(sdk1) : Pins.recorded().sdk1);
  }

  /** The pins recorded in package.json. */
  static recorded() {
    const { config } = Pins.#package();
    return new Pins(GitHubCommit.parse(config.sdk), GitHubCommit.parse(config.toolkit),
      GitHubCommit.parse(config.sdk1));
  }

  /** The same pins, each commit named by its full hash. */
  async resolved() {
    const [sdk, toolkit, sdk1] = await Promise.all([this.sdk.resolved(), this.toolkit.resolved(),
      this.sdk1.resolved()]);
    return new Pins(sdk, toolkit, sdk1);
  }

  record() {
    const manifest = Pins.#package();
    manifest.config = { ...manifest.config, sdk: String(this.sdk), toolkit: String(this.toolkit),
      sdk1: String(this.sdk1) };
    fs.writeFileSync(PACKAGE, JSON.stringify(manifest, null, 2) + '\n');
  }

  static #package() {
    return JSON.parse(fs.readFileSync(PACKAGE, 'utf8'));
  }
}
