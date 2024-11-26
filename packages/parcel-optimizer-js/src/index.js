/**
 * Copyright (c) GeeekyBoy
 * Some parts are derived from @parcel/optimizer-swc
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import path from "path";
import { fileURLToPath } from "url";
import nullthrows from "nullthrows";
import { transform } from "@swc/core";
import { Optimizer } from "@parcel/plugin";
import parcelUtils from "@parcel/utils";
import parcelSourceMap from "@parcel/source-map";
import ThrowableDiagnostic, { escapeMarkdown } from "@parcel/diagnostic";

const { blobToString, stripAnsi } = parcelUtils;
const SourceMap = parcelSourceMap.default;

export default new Optimizer({
  async optimize({
    contents,
    map: originalMap,
    bundle,
    options,
    getSourceMapReference,
  }) {
    if (!bundle.env.shouldOptimize) {
      return { contents, map: originalMap };
    }

    const code = await blobToString(contents);
    let result;
    try {
      result = await transform(code, {
        jsc: {
          minify: {
            mangle: {
              ie8: true,
              safari10: true,
            },
            compress: {
              passes: 2,
              keep_fargs: false,
              negate_iife: false,
              side_effects: true,
              properties: false,
              directives: false,
              ie8: true,
            },
            format: {
              comments: "all",
            },
            safari10: true,
            toplevel: false,
            module: false
          },
        },
        env: {
          targets: bundle.env.engines.browsers,
        },
        minify: true,
        isModule: false,
        sourceMaps: !!bundle.env.sourceMap,
        configFile: false,
        swcrc: false,
      });
    } catch (err) {
      // SWC doesn't give us nice error objects, so we need to parse the message.
      let message = escapeMarkdown(
        (
          stripAnsi(err.message)
            .split("\n")
            .find((line) => line.trim().length > 0) || ""
        )
          .trim()
          .replace(/^(×|x)\s+/, ""),
      );
      const location = err.message.match(/(?:╭─|,-)\[(\d+):(\d+)\]/);
      if (location) {
        const line = Number(location[1]);
        const col = Number(location[1]);
        const mapping = originalMap?.findClosestMapping(line, col);
        if (mapping && mapping.original && mapping.source) {
          const { source, original } = mapping;
          const filePath = path.resolve(options.projectRoot, source);
          throw new ThrowableDiagnostic({
            diagnostic: {
              message,
              origin: "@parcel/optimizer-swc",
              codeFrames: [
                {
                  language: "js",
                  filePath,
                  codeHighlights: [{ start: original, end: original }],
                },
              ],
            },
          });
        }

        const loc = {
          line: line,
          column: col,
        };

        throw new ThrowableDiagnostic({
          diagnostic: {
            message,
            origin: "@parcel/optimizer-swc",
            codeFrames: [
              {
                language: "js",
                filePath: undefined,
                code,
                codeHighlights: [{ start: loc, end: loc }],
              },
            ],
          },
        });
      }

      throw err;
    }

    try {
      result = await transform(result.code, {
        jsc: {
          minify: {
            mangle: {
              ie8: true,
              safari10: true,
            },
            compress: {
              passes: 2,
              keep_fargs: false,
              negate_iife: false,
              side_effects: true,
              properties: false,
              directives: true,
              ie8: true,
            },
            format: {
              comments: false,
            },
            safari10: true,
            toplevel: false,
            module: false
          },
          experimental: {
            plugins: [
              [fileURLToPath(await import.meta.resolve("./mango_optimizer_js.wasm")), {}]
            ],
          }
        },
        env: {
          targets: bundle.env.engines.browsers,
        },
        minify: true,
        isModule: false,
        sourceMaps: !!bundle.env.sourceMap,
        configFile: false,
        swcrc: false,
      });
    } catch (err) {
      // SWC doesn't give us nice error objects, so we need to parse the message.
      let message = escapeMarkdown(
        (
          stripAnsi(err.message)
            .split("\n")
            .find((line) => line.trim().length > 0) || ""
        )
          .trim()
          .replace(/^(×|x)\s+/, ""),
      );
      const location = err.message.match(/(?:╭─|,-)\[(\d+):(\d+)\]/);
      if (location) {
        const line = Number(location[1]);
        const col = Number(location[1]);
        const mapping = originalMap?.findClosestMapping(line, col);
        if (mapping && mapping.original && mapping.source) {
          const { source, original } = mapping;
          const filePath = path.resolve(options.projectRoot, source);
          throw new ThrowableDiagnostic({
            diagnostic: {
              message,
              origin: "@parcel/optimizer-swc",
              codeFrames: [
                {
                  language: "js",
                  filePath,
                  codeHighlights: [{ start: original, end: original }],
                },
              ],
            },
          });
        }

        const loc = {
          line: line,
          column: col,
        };

        throw new ThrowableDiagnostic({
          diagnostic: {
            message,
            origin: "@parcel/optimizer-swc",
            codeFrames: [
              {
                language: "js",
                filePath: undefined,
                code,
                codeHighlights: [{ start: loc, end: loc }],
              },
            ],
          },
        });
      }

      throw err;
    }

    let sourceMap = null;
    const isComponent = bundle.getMainEntry().query.has("component");
    let minifiedContents = isComponent
      ? "(" + nullthrows(result.code).slice("window.__MANGO_COMPONENT__=".length, -3) + ")();"
      : nullthrows(result.code);
    const resultMap = result.map;
    if (resultMap) {
      sourceMap = new SourceMap(options.projectRoot);
      sourceMap.addVLQMap(JSON.parse(resultMap));
      if (originalMap) {
        sourceMap.extends(originalMap);
      }
      const sourcemapReference = await getSourceMapReference(sourceMap);
      if (sourcemapReference) {
        let sourceMapDir = bundle.target.publicUrl + path.dirname(bundle.name).replaceAll(path.sep, "/").replace(/^\.\//, '');
        sourceMapDir += sourceMapDir.endsWith('/') ? '' : '/';
        minifiedContents += `\n//# sourceMappingURL=${sourceMapDir}${sourcemapReference}\n`;
        minifiedContents += `\n//# sourceMappingURL=${sourcemapReference}\n`;
      }
    }

    return { contents: minifiedContents, map: sourceMap };
  },
});
