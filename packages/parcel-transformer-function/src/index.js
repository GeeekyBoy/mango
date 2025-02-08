/**
 * Copyright (c) GeeekyBoy
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import path from "path";
import { Transformer } from "@parcel/plugin";
import { transformAsync } from "@babel/core";

export default new Transformer({
  async transform({ asset, resolve, options }) {
    let code = await asset.getCode();
    const isTypeScriptFile = asset.type === "ts";
    const projectRoot = options.projectRoot;
    const tildePath = path.dirname(await resolve(asset.filePath, "~/package.json"));
    /** @type {string[]} */
    const nodeDeps = [];
    /** @type {string[]} */
    const bareImports = [];
    /** @type {{ [key: string]: string }} */
    const bareImportsResolutions = {};
    ({ code } = await transformAsync(code, {
      code: true,
      ast: false,
      filename: asset.filePath,
      sourceMaps: false,
      sourceFileName: asset.relativeName,
      comments: false,
      plugins: [
        [import.meta.resolve("./processor.js"), { asset, nodeDeps, bareImports, projectRoot, tildePath }],
        ...(isTypeScriptFile ? [[import.meta.resolve("@babel/plugin-transform-typescript"), {}]] : []),
      ]
    }));
    for (let i = 0; i < bareImports.length; i++) {
      try {
        const resolvedPath = import.meta.resolve(bareImports[i]);
        if (options.mode !== "production") {
          bareImportsResolutions[bareImports[i]] = resolvedPath;
        }
      } catch {
        bareImportsResolutions[bareImports[i]] = asset.addURLDependency("function-util:" + bareImports[i], {});
        nodeDeps.splice(i, 1);
      }
    }
    if (Object.keys(bareImportsResolutions).length > 0) {
      ({ code } = await transformAsync(code, {
        code: true,
        ast: false,
        filename: asset.filePath,
        sourceMaps: false,
        sourceFileName: asset.relativeName,
        comments: false,
        plugins: [
          [import.meta.resolve("./resolver.js"), { bareImportsResolutions }],
        ]
      }));
    }
    asset.type = "js";
    asset.bundleBehavior = "isolated";
    asset.meta.nodeDeps = nodeDeps;
    asset.setCode(code);
    return [asset];
  },
});
