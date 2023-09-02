/**
 * Copyright (c) GeeekyBoy
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Transformer } from "@parcel/plugin";
import babel from "@babel/core";

export default new Transformer({
  async transform({ asset, options }) {
    let code = await asset.getCode();
    /** @type {string[]} */
    const nodeDeps = [];
    /** @type {string[]} */
    const bareImports = [];
    /** @type {{ [key: string]: string }} */
    const bareImportsResolutions = {};
    ({ code } = await babel.transformAsync(code, {
      code: true,
      ast: false,
      filename: asset.filePath,
      sourceMaps: false,
      sourceFileName: asset.relativeName,
      comments: false,
      plugins: [
        [await import.meta.resolve("./processor.js"), { asset, nodeDeps, bareImports }],
      ]
    }));
    if (options.mode !== "production") {
      for (const bareImport of bareImports) {
        bareImportsResolutions[bareImport] = await import.meta.resolve(bareImport);
      }
      ({ code } = await babel.transformAsync(code, {
        code: true,
        ast: false,
        filename: asset.filePath,
        sourceMaps: false,
        sourceFileName: asset.relativeName,
        comments: false,
        plugins: [
          [await import.meta.resolve("./resolver.js"), { bareImportsResolutions}],
        ]
      }));
    }
    asset.bundleBehavior = "isolated";
    asset.meta.nodeDeps = nodeDeps;
    asset.setCode(code);
    return [asset];
  },
});
