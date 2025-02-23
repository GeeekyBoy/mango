/**
 * Copyright (c) GeeekyBoy
 * Some parts are derived from @parcel/transformer-babel
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Worker } from "worker_threads";
import { Transformer } from "@parcel/plugin";
import parcelUtils from "@parcel/utils";
import parcelSourceMap from "@parcel/source-map";
import { parseAsync, transformFromAstAsync } from "@babel/core";
import generate from "@babel/generator";
import semver from "semver";

const { relativeUrl } = parcelUtils;
const SourceMap = typeof parcelSourceMap === "object" ? parcelSourceMap.default : parcelSourceMap;

export default new Transformer({
  async canReuseAST({ ast }) {
    return ast.type === 'babel' && semver.satisfies(ast.version, '^7.0.0');
  },
  async parse({ asset }) {
    if (/^.*\.(jsx|tsx|js|ts|mdx|mjs|es6|cjs|svg)$/.test(asset.filePath)) {
      const source = await asset.getCode();
      if (/^.*\.(js|ts|mjs|es6|cjs)$/.test(asset.filePath)) {
        const lines = source.split(/\r?\n*^\s*/gm);
        const isMango = lines
          .slice(0, lines.findIndex(line => line[0] && line[0] !== "/" && line[0] !== "*"))
          .some(line => line === "// @mango" || line === "/* @mango */");
        if (!isMango) return;
      }
      const ast = await parseAsync(source, {
        code: false,
        ast: true,
        filename: asset.filePath,
        sourceFileName: asset.relativeName,
        parserOpts: { plugins: ["jsx", "typescript"] },
      });
      return {
        type: 'babel',
        version: '^7.0.0',
        program: ast,
      };
    }
  },
  async transform({ asset, options: { env } }) {
    /** @type {import("@babel/core").types.Program?} */
    let ast = (await asset.getAST())?.program;
    if (ast) {
      const isTypeScriptFile = /^.*\.(tsx|ts)$/.test(asset.filePath);
      /** @type {{ type: "ssg" | "ssr", path: string, exports: string[] }[]} */
      const dynamicMeta = [];
      /** @type {{ [key: string]: string }} */
      let optimizedProps = {};
      if (asset.env.shouldOptimize) {
        /** @type {Set<string>} */
        const collectedProps = new Set();
        await transformFromAstAsync(ast, undefined, {
          code: false,
          ast: false,
          filename: asset.filePath,
          sourceFileName: asset.relativeName,
          plugins: [
            [import.meta.resolve("./propsCollector.js"), { collectedProps }],
          ],
        });
        const stringifiedCollectedProps = Array.from(collectedProps).join(",");
        if (stringifiedCollectedProps.length) {
          const { MINIFIER_PORT: minifierPort } = env;
          const res = await fetch(`http://localhost:${minifierPort}/props/${stringifiedCollectedProps}`);
          optimizedProps = await res.json();
        }
      }
      ({ ast } = await transformFromAstAsync(ast, undefined, {
        code: false,
        ast: true,
        filename: asset.filePath,
        sourceFileName: asset.relativeName,
        plugins: [
          [import.meta.resolve("@mango-js/babel-plugin-transform-jsx"), { asset, dynamic: dynamicMeta, optimizedProps, env }],
          ...(isTypeScriptFile ? [[import.meta.resolve("@babel/plugin-transform-typescript"), { isTSX: true }]] : []),
        ],
      }));
      asset.type = isTypeScriptFile ? "ts" : "js";
      if (dynamicMeta.length) {
        /** @type {{ [key: string]: import("@babel/core").types.Expression }} */
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
        ({ ast } = await transformFromAstAsync(ast, undefined, {
          code: false,
          ast: true,
          filename: asset.filePath,
          sourceFileName: asset.relativeName,
          plugins: [
            [import.meta.resolve("./dynamicInjector.js"), { dynamicContent }],
          ],
        }));
      }
      asset.setAST({
        type: 'babel',
        version: '^7.0.0',
        program: ast,
      })
    }
    return [asset];
  },
  async generate({ asset, ast, options }) {
    const originalSourceMap = await asset.getMap();
    const sourceFileName = relativeUrl(options.projectRoot, asset.filePath);

    const { code, rawMappings } = generate(ast.program, {
      sourceFileName: sourceFileName,
      sourceMaps: !!asset.env.sourceMap,
      comments: true,
    });

    const map = new SourceMap(options.projectRoot);
    if (rawMappings) {
      map.addIndexedMappings(rawMappings);
    }

    if (originalSourceMap) {
      // The babel AST already contains the correct mappings, but not the source contents.
      // We need to copy over the source contents from the original map.
      const sourcesContent = originalSourceMap.getSourcesContentMap();
      for (const filePath in sourcesContent) {
        const content = sourcesContent[filePath];
        if (content !== null) {
          map.setSourceContent(filePath, content);
        }
      }
    }

    return {
      content: code,
      map: map,
    };
  },
});
