/**
 * Copyright (c) GeeekyBoy
 * Some parts are derived from @parcel/packager-js
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import path from "path";
import { Packager } from "@parcel/plugin";
import parcelUtils from "@parcel/utils";
import { DevPackager } from "./packagers/DevPackager.js";
import { ScopeHoistingPackager } from "./packagers/ScopeHoistingPackager.js";

const { replaceInlineReferences, replaceURLReferences } = parcelUtils;

/** @typedef {import("@parcel/types").Async} Async */
/** @typedef {import("@parcel/source-map").default} SourceMap */
/** @typedef {import("@parcel/types").NamedBundle} NamedBundle */
/** @typedef {import("@parcel/types").Dependency} Dependency */
/** @typedef {import("@parcel/types").PluginOptions} PluginOptions */

export default new Packager({
  async package({
    bundle,
    bundleGraph,
    getInlineBundleContents,
    getSourceMapReference,
    options,
  }) {
    // If this is a non-module script, and there is only one asset with no dependencies,
    // then we don't need to package at all and can pass through the original code un-wrapped.
    let contents, map;
    if (bundle.env.sourceType === "script") {
      let entries = bundle.getEntryAssets();
      if (entries.length === 1 && !bundleGraph.getDependencies(entries[0]).length) {
        contents = await entries[0].getCode();
        map = await entries[0].getMap();
      }
    }

    if (contents == null) {
      const packager = bundle.env.shouldScopeHoist
        ? new ScopeHoistingPackager(options, bundleGraph, bundle)
        : new DevPackager(options, bundleGraph, bundle);

      ({contents, map} = await packager.package());
    }

    let sourceMapDir = bundle.target.publicUrl + path.dirname(bundle.name).replaceAll(path.sep, "/").replace(/^\.\//, "");
    sourceMapDir += sourceMapDir.endsWith("/") ? "" : "/";
    contents += "\n" + (await getSourceMapSuffix(getSourceMapReference, map, sourceMapDir));

    ({contents, map} = replaceURLReferences({
      bundle,
      bundleGraph,
      contents,
      map,
      relative: false,
      getReplacement: s => JSON.stringify(s).slice(1, -1),
    }));

    return replaceInlineReferences({
      bundle,
      bundleGraph,
      contents,
      getInlineReplacement: (dependency, inlineType, content) => ({
        from: `"${dependency.id}"`,
        to: inlineType === "string"
          ? JSON.stringify(content)
          : content,
      }),
      getInlineBundleContents,
      map,
    });
  },
});

/**
 * @param {(?SourceMap) => Async<?string>} getSourceMapReference
 * @param {?SourceMap} map
 * @returns {Promise<string>}
 */
async function getSourceMapSuffix(getSourceMapReference, map, sourceMapDir) {
  const sourcemapReference = await getSourceMapReference(map);
  if (sourcemapReference != null) {
    return "//# sourceMappingURL=" + sourceMapDir + sourcemapReference + "\n";
  } else {
    return "";
  }
}
