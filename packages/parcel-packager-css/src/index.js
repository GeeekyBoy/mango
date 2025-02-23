/**
 * Copyright (c) GeeekyBoy
 * Some parts are derived from @parcel/packager-css
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { bundleAsync } from 'lightningcss';
import invariant from 'assert';
import nullthrows from 'nullthrows';
import postcss from 'postcss';
import parcelSourceMap from "@parcel/source-map";
import { Packager } from '@parcel/plugin';
import { convertSourceLocationToHighlight } from '@parcel/diagnostic';
import parcelUtils from "@parcel/utils";

const { PromiseQueue, replaceURLReferences } = parcelUtils;
const SourceMap = typeof parcelSourceMap === "object" ? parcelSourceMap.default : parcelSourceMap;

const isWebContainer = process.versions.hasOwnProperty('webcontainer');
let locked = false;

/** @typedef {import("postcss").Root} Root */
/** @typedef {import("@parcel/types").Asset} Asset */
/** @typedef {import("@parcel/types").Dependency} Dependency */
/** @typedef {import("@parcel/types").PluginOptions} PluginOptions */
/** @typedef {import("@parcel/types").PluginLogger} PluginLogger */
/** @typedef {import("@parcel/types").NamedBundle} NamedBundle */
/** @typedef {import("@parcel/types").BundleGraph<NamedBundle>} BundleGraph */
/** @typedef {import("@parcel/types").Asset} Asset */


export default new Packager({
  async package({
    bundle,
    bundleGraph,
    getSourceMapReference,
    logger,
    options,
  }) {
    // Inline style attributes are parsed differently from full CSS files.
    if (bundle.bundleBehavior === 'inline') {
      let entry = bundle.getMainEntry();
      if (entry?.meta.type === 'attr') {
        return replaceURLReferences({
          bundle,
          bundleGraph,
          contents: await entry.getCode(),
          map: await entry.getMap(),
          relative: false,
          getReplacement: escapeString,
        })
      }
    }

    const queue = new PromiseQueue({ maxConcurrent: 32 });
    const hoistedImports = [];
    let assetsByPlaceholder = new Map();
    let entry = null;
    let entryContents = '';

    bundle.traverse({
      enter: (node, context) => {
        if (node.type === 'asset' && !context) {
          // If there is only one entry, we'll use it directly.
          // Otherwise, we'll create a fake bundle entry with @import rules for each root asset.
          if (entry == null) {
            entry = node.value.id;
          } else {
            entry = bundle.id;
          }

          assetsByPlaceholder.set(node.value.id, node.value);
          entryContents += `@import "${node.value.id}";\n`;
        }
        return true;
      },
      exit: node => {
        if (node.type === 'dependency') {
          const resolved = bundleGraph.getResolvedAsset(node.value, bundle);

          // Hoist unresolved external dependencies (i.e. http: imports)
          if (
            node.value.priority === 'sync' &&
            !bundleGraph.isDependencySkipped(node.value) &&
            !resolved
          ) {
            hoistedImports.push(node.value.specifier);
          }

          if (resolved && bundle.hasAsset(resolved)) {
            assetsByPlaceholder.set(
              node.value.meta.placeholder ?? node.value.specifier,
              resolved,
            );
          }

          return;
        }

        let asset = node.value;
        queue.add(() => {
          if (
            !asset.symbols.isCleared &&
            options.mode === 'production' &&
            asset.astGenerator?.type === 'postcss'
          ) {
            // a CSS Modules asset
            return processCSSModule(options, logger, bundleGraph, bundle, asset);
          } else {
            return Promise.all([
              asset,
              asset.getCode().then(/** @type {(css: string) => string} */ (css) => {
                // Replace CSS variable references with resolved symbols.
                if (asset.meta.hasReferences) {
                  const replacements = new Map();
                  for (let dep of asset.getDependencies()) {
                    for (const [exported, { local }] of dep.symbols) {
                      const resolved = bundleGraph.getResolvedAsset(dep, bundle);
                      if (resolved) {
                        const resolution = bundleGraph.getSymbolResolution(resolved, exported, bundle);
                        if (resolution.symbol) {
                          replacements.set(local, resolution.symbol);
                        }
                      }
                    }
                  }
                  if (replacements.size) {
                    const regex = new RegExp([...replacements.keys()].join('|'), 'g');
                    css = css.replace(regex, m => escapeDashedIdent(replacements.get(m) || m));
                  }
                }

                return css;
              }),
              bundle.env.sourceMap ? asset.getMap() : null,
            ]);
          }
        });
      },
    });

    const outputs = new Map(
      (await queue.run()).map(([asset, code, map]) => [asset, [code, map]]),
    );
    let map = new SourceMap(options.projectRoot);
    // $FlowFixMe
    // if (process.browser) {
    //   await init();
    // }
    if (isWebContainer) {
      while (locked) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    locked = true;
    const res = await bundleAsync({
      filename: nullthrows(entry),
      sourceMap: !!bundle.env.sourceMap,
      resolver: {
        resolve(specifier) {
          return specifier;
        },
        async read(file) {
          if (file === bundle.id) {
            return entryContents;
          }

          const asset = assetsByPlaceholder.get(file);
          if (!asset) {
            return '';
          }
          let [code, map] = nullthrows(outputs.get(asset));
          if (map) {
            const sm = await map.stringify({ format: 'inline' });
            invariant(typeof sm === 'string');
            code += `\n/*# sourceMappingURL=${sm} */`;
          }
          return code;
        },
      },
    });
    locked = false;

    let contents = res.code.toString();

    if (res.map) {
      const vlqMap = JSON.parse(res.map.toString());
      map.addVLQMap(vlqMap);
      const reference = await getSourceMapReference(map);
      if (reference != null) {
        contents += '/*# sourceMappingURL=' + reference + ' */\n';
      }
    }

    // Prepend hoisted external imports.
    if (hoistedImports.length > 0) {
      let lineOffset = 0;
      let hoistedCode = '';
      for (let url of hoistedImports) {
        hoistedCode += `@import "${url}";\n`;
        lineOffset++;
      }

      if (bundle.env.sourceMap) {
        map.offsetLines(1, lineOffset);
      }

      contents = hoistedCode + contents;
    }

    return replaceURLReferences({
      bundle,
      bundleGraph,
      contents,
      map,
      relative: false,
      getReplacement: escapeString,
    });
  },
});

/**
 * @param {string} contents
 * @returns {string}
 */
function escapeString(contents) {
  return contents.replace(/(["\\])/g, '\\$1');
}

/**
 * @param {PluginOptions} options
 * @param {PluginLogger} logger
 * @param {BundleGraph} bundleGraph
 * @param {NamedBundle} bundle
 * @param {Asset} asset
 * @returns {Promise<[Asset, string, ?SourceMap]>}
 */
async function processCSSModule(options, logger, bundleGraph, bundle, asset, media) {

  /** @type {Root} */
  const ast = postcss.fromJSON(nullthrows((await asset.getAST())?.program));

  const usedSymbols = bundleGraph.getUsedSymbols(asset);
  if (usedSymbols != null) {
    const localSymbols = new Set([...asset.symbols].map(([, {local}]) => `.${local}`));

    let defaultImport = null;
    if (usedSymbols.has('default')) {
      const incoming = bundleGraph.getIncomingDependencies(asset);
      defaultImport = incoming.find(d => d.symbols.hasExportSymbol('default'));
      if (defaultImport) {
        const loc = defaultImport.symbols.get('default')?.loc;
        logger.warn({
          message:
            'CSS modules cannot be tree shaken when imported with a default specifier',
          ...(loc && {
            codeFrames: [
              {
                filePath: nullthrows(loc?.filePath ?? defaultImport.sourcePath),
                codeHighlights: [convertSourceLocationToHighlight(loc)],
              },
            ],
          }),
          hints: [
            `Instead do: import * as style from "${defaultImport.specifier}";`,
          ],
          documentationURL: 'https://parceljs.org/languages/css/#tree-shaking',
        });
      }
    }

    if (!defaultImport && !usedSymbols.has('*')) {
      const usedLocalSymbols = new Set(
        [...usedSymbols].map(exportSymbol =>
            `.${nullthrows(asset.symbols.get(exportSymbol)).local}`,
        ),
      );
      ast.walkRules(rule => {
        if (
          localSymbols.has(rule.selector) &&
          !usedLocalSymbols.has(rule.selector)
        ) {
          rule.remove();
        }
      });
    }
  }

  let { content, map } = await postcss().process(ast, {
    from: undefined,
    to: options.projectRoot + '/index',
    map: {
      annotation: false,
      inline: false,
    },
    // Pass postcss's own stringifier to it to silence its warning
    // as we don't want to perform any transformations -- only generate
    stringifier: postcss.stringify,
  });

  let sourceMap;
  if (bundle.env.sourceMap && map != null) {
    sourceMap = new SourceMap(options.projectRoot);
    sourceMap.addVLQMap(map.toJSON());
  }

  return [asset, content, sourceMap];
}

function escapeDashedIdent(name) {
  // https://drafts.csswg.org/cssom/#serialize-an-identifier
  let res = '';
  for (const c of name) {
    const code = c.codePointAt(0);
    if (code === 0) {
      res += '\ufffd';
    } else if ((code >= 0x1 && code <= 0x1f) || code === 0x7f) {
      res += '\\' + code.toString(16) + ' ';
    } else if (
      (code >= 48 /* '0' */ && code <= 57) /* '9' */ ||
      (code >= 65 /* 'A' */ && code <= 90) /* 'Z' */ ||
      (code >= 97 /* 'a' */ && code <= 122) /* 'z' */ ||
      code === 95 /* '_' */ ||
      code === 45 /* '-' */ ||
      code & 128 // non-ascii
    ) {
      res += c;
    } else {
      res += '\\' + c;
    }
  }

  return res;
}
