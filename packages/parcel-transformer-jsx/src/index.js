/**
 * Copyright (c) GeeekyBoy
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Worker } from "worker_threads";
import { Transformer } from "@parcel/plugin";
import babel from "@babel/core";

export default new Transformer({
  async transform({ asset, options: { env } }) {
    if (/^.*\.(jsx|tsx|js|ts|mdx|mjs|svg)$/.test(asset.filePath)) {
      const source = await asset.getCode();
      if (/^.*\.(js|ts|mjs)$/.test(asset.filePath)) {
        let lines = source.split(/\r?\n*^\s*/gm);
        const isMango = lines
          .slice(0, lines.findIndex(line => line[0] && line[0] !== "/" && line[0] !== "*"))
          .some(line => line === "// @mango" || line === "/* @mango */");
        if (!isMango) return [asset];
      }
      /** @type {{ type: "ssg" | "ssr", path: string, exports: string[] }[]} */
      const dynamicMeta = [];
      const { ast: staticAst } = (await babel.transformAsync(source, {
        code: false,
        ast: true,
        filename: asset.filePath,
        sourceMaps: false,
        sourceFileName: asset.relativeName,
        plugins: [
          [await import.meta.resolve("@mango-js/babel-plugin-transform-jsx"), { asset, dynamic: dynamicMeta, env }],
        ],
      }));
      asset.type = /^.*\.(tsx|ts)$/.test(asset.filePath) ? "ts" : "js";
      if (dynamicMeta.length) {
        /** @type {{ [key: string]: import("@babel/types").Expression }} */
        const dynamicContent = await (new Promise((resolve, reject) => {
          const worker = new Worker(new URL("./worker.js", import.meta.url), { workerData: dynamicMeta });
          worker.on('message', resolve);
          worker.on('error', reject);
          worker.on('exit', (code) => {
            if (code !== 0) {
              reject(new Error(`Worker stopped with exit code ${code}`));
            }
          })
        }));
        const { ast } = await babel.transformFromAstAsync(staticAst, undefined, {
          code: false,
          ast: true,
          filename: asset.filePath,
          sourceMaps: false,
          sourceFileName: asset.relativeName,
          plugins: [
            [await import.meta.resolve("./dynamicInjector.js"), { dynamicContent }],
          ],
        });
        asset.setAST({
          type: 'babel',
          version: '7.0.0',
          program: ast,
        })
      } else {
        asset.setAST({
          type: 'babel',
          version: '7.0.0',
          program: staticAst,
        })
      }
    }
    return [asset];
  }
});
