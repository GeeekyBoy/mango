/**
 * Copyright (c) GeeekyBoy
 * Some parts are derived from @parcel/packager-js
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import parcelUtils from "@parcel/utils";
import parcelSourceMap from "@parcel/source-map";
import invariant from "assert";
import { getSpecifier } from "../utils.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const { PromiseQueue, countLines } = parcelUtils;
const SourceMap = parcelSourceMap.default;

/** @typedef {import("@parcel/types").BundleGraph} BundleGraph */
/** @typedef {import("@parcel/types").NamedBundle} NamedBundle */
/** @typedef {import("@parcel/types").PluginOptions} PluginOptions */

const PRELUDE = fs.readFileSync(path.join(__dirname, "../dev-prelude.js"), "utf8")
  .trim()
  .replace(/;$/, "");

export class DevPackager {
  /** @type {PluginOptions} */
  options;
  /** @type {BundleGraph} */
  bundleGraph;
  /** @type {NamedBundle} */
  bundle;

  /**
   * @param {PluginOptions} options
   * @param {BundleGraph} bundleGraph
   * @param {NamedBundle} bundle
   */
  constructor(options, bundleGraph, bundle) {
    this.options = options;
    this.bundleGraph = bundleGraph;
    this.bundle = bundle;
  }

  /**
   * @returns {Promise<{contents: string, map: ?SourceMap}>}
   */
  async package() {
    // Load assets
    const queue = new PromiseQueue({maxConcurrent: 32});
    this.bundle.traverseAssets(asset => {
      queue.add(async () => {
        const [code, mapBuffer] = await Promise.all([
          asset.getCode(),
          this.bundle.env.sourceMap && asset.getMapBuffer(),
        ]);
        return {code, mapBuffer};
      });
    });

    const results = await queue.run();

    let assets = "";
    let i = 0;
    let first = true;
    const map = new SourceMap(this.options.projectRoot);

    let lineOffset = countLines(PRELUDE);

    this.bundle.traverse(node => {
      let wrapped = first ? "" : ",";

      if (node.type === "dependency") {
        const resolved = this.bundleGraph.getResolvedAsset(node.value, this.bundle);
        if (resolved && resolved.type !== "js") {
          // if this is a reference to another javascript asset, we should not include
          // its output, as its contents should already be loaded.
          invariant(!this.bundle.hasAsset(resolved));
          wrapped += JSON.stringify(this.bundleGraph.getAssetPublicId(resolved)) + ":[function() {},{}]";
        } else {
          return;
        }
      }

      if (node.type === "asset") {
        const asset = node.value;
        invariant(
          asset.type === "js",
          "all assets in a js bundle must be js assets",
        );

        const deps = {};
        const dependencies = this.bundleGraph.getDependencies(asset);
        for (const dep of dependencies) {
          const resolved = this.bundleGraph.getResolvedAsset(dep, this.bundle);
          const specifier = getSpecifier(dep);
          if (this.bundleGraph.isDependencySkipped(dep)) {
            deps[specifier] = false;
          } else if (resolved) {
            deps[specifier] = this.bundleGraph.getAssetPublicId(resolved);
          } else {
            // An external module - map placeholder to original specifier.
            deps[specifier] = dep.specifier;
          }
        }

        // Add dependencies for parcelRequire calls added by runtimes
        // so that the HMR runtime can correctly traverse parents.
        const hmrDeps = asset.meta.hmrDeps;
        if (this.options.hmrOptions && Array.isArray(hmrDeps)) {
          for (const id of hmrDeps) {
            invariant(typeof id === 'string');
            deps[id] = id;
          }
        }

        const {code, mapBuffer} = results[i];
        const output = code || "";
        wrapped +=
          JSON.stringify(this.bundleGraph.getAssetPublicId(asset)) +
          ":[function(require,module,exports,__globalThis) {\n" +
          output +
          "\n}," +
          JSON.stringify(deps) +
          "]";

        if (this.bundle.env.sourceMap) {
          if (mapBuffer) {
            map.addBuffer(mapBuffer, lineOffset);
          } else {
            map.addEmptyMap(
              path
                .relative(this.options.projectRoot, asset.filePath)
                .replace(/\\+/g, "/"),
              output,
              lineOffset,
            );
          }

          lineOffset += countLines(output) + 1;
        }
        i++;
      }

      assets += wrapped;
      first = false;
    });

    const entries = this.bundle.getEntryAssets();
    const mainEntry = this.bundle.getMainEntry();

    const contents =
      PRELUDE +
      "({" +
      assets +
      "}," +
      JSON.stringify(entries.map(asset => this.bundleGraph.getAssetPublicId(asset))) +
      ", " +
      JSON.stringify(mainEntry ? this.bundleGraph.getAssetPublicId(mainEntry) : null) +
      ")" +
      "\n";

    return { contents, map };
  }
}
