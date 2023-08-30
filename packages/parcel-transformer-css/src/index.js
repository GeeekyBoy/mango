/**
 * Copyright (c) GeeekyBoy
 * Some parts are derived from @parcel/transformer-css
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import path from 'path';
import { Transformer } from '@parcel/plugin';
import { transform, transformStyleAttribute, browserslistToTargets } from 'lightningcss';
import parcelSourceMap from "@parcel/source-map";
import parcelDiagnostic from "@parcel/diagnostic";
import parcelUtils from "@parcel/utils";
import browserslist from 'browserslist';
import nullthrows from 'nullthrows';

const { remapSourceLocation, relativePath } = parcelUtils;
const { default: SourceMap } = parcelSourceMap;
const { default: ThrowableDiagnostic, errorToDiagnostic } = parcelDiagnostic;

/** @typedef {import("lightningcss").SourceLocation} LightningSourceLocation */
/** @typedef {import("@parcel/types").SourceLocation} SourceLocation */
/** @typedef {import("@parcel/types").Dependency} Dependency */

// https://www.w3.org/TR/CSS22/grammar.html#scanner
const CSS_RE = /(?<=\.)((?:[_a-zA-Z0-9-]|[\240-\377]|\\{h}{1,6}(\r\n|[ \t\r\n\f])?||\\[^\r\n\f0-9a-f])+)(?![^\{]*\})/g;

export default new Transformer({
  async transform({ asset, options, logger }) {
    // Normalize the asset's environment so that properties that only affect JS don't cause CSS to be duplicated.
    // For example, with ESModule and CommonJS targets, only a single shared CSS bundle should be produced.
    const env = asset.env;
    asset.setEnvironment({
      context: 'browser',
      engines: {
        browsers: asset.env.engines.browsers,
      },
      shouldOptimize: asset.env.shouldOptimize,
      shouldScopeHoist: asset.env.shouldScopeHoist,
      sourceMap: asset.env.sourceMap,
    });

    const [code, originalMap] = await Promise.all([
      asset.getBuffer(),
      asset.getMap(),
    ]);

    const targets = getTargets(asset.env.engines.browsers);
    let res;
    try {
      if (asset.meta.type === 'attr') {
        res = transformStyleAttribute({
          code,
          analyzeDependencies: true,
          errorRecovery: false,
          targets,
        });
      } else {
        const isCssModule =
          asset.meta.type !== 'tag' &&
          asset.meta.cssModulesCompiled == null &&
          /\.module\./.test(asset.filePath);

        res = transform({
          filename: path.relative(options.projectRoot, asset.filePath),
          code,
          cssModules: isCssModule ? { dashedIdents: false } : false,
          analyzeDependencies: asset.meta.hasDependencies !== false,
          sourceMap: !!asset.env.sourceMap,
          drafts: { nesting: true, customMedia: true },
          nonStandard: { deepSelectorCombinator: true },
          errorRecovery: false,
          targets,
        });

        if (env.shouldOptimize) {
          /** @type {Set<string>} */
          const collectedClasses = new Set();
          for (const local in res.exports) {
            collectedClasses.add(res.exports[local].name);
          }
          const stringifiedCollectedClasses = encodeURI(Array.from(collectedClasses).join(","));
          if (stringifiedCollectedClasses.length) {
            const { MINIFIER_PORT: minifierPort } = options.env;
            const fetchRes = await fetch(`http://localhost:${minifierPort}/classes/${stringifiedCollectedClasses}`);
            /** @type {{ [key: string]: string }} */
            const optimizedClasses = await fetchRes.json();
            res.code = Buffer.from(res.code.toString().replace(CSS_RE, (match, className) => {
              const optimizedClassName = optimizedClasses[className];
              if (optimizedClassName) {
                return optimizedClassName;
              }
              return match;
            }));
            for (const local in res.exports) {
              res.exports[local].name = optimizedClasses[res.exports[local].name];
            }
          }
        }
      }
    } catch (err) {
      err.filePath = asset.filePath;
      const diagnostic = errorToDiagnostic(err, { origin: '@parcel/transformer-css' });
      if (err.data?.type === 'AmbiguousUrlInCustomProperty' && err.data.url) {
        const p =
          '/' +
          relativePath(
            options.projectRoot,
            path.resolve(path.dirname(asset.filePath), err.data.url),
            false,
          );
        diagnostic[0].hints = [`Replace with: url(${p})`];
        diagnostic[0].documentationURL = 'https://parceljs.org/languages/css/#url()';
      }

      throw new ThrowableDiagnostic({ diagnostic });
    }

    if (res.warnings) {
      for (const warning of res.warnings) {
        logger.warn({
          message: warning.message,
          codeFrames: [
            {
              filePath: asset.filePath,
              codeHighlights: [
                {
                  start: {
                    line: warning.loc.line,
                    column: warning.loc.column + 1,
                  },
                  end: {
                    line: warning.loc.line,
                    column: warning.loc.column + 1,
                  },
                },
              ],
            },
          ],
        });
      }
    }

    asset.setBuffer(res.code);

    if (res.map != null) {
      const vlqMap = JSON.parse(res.map.toString());
      const map = new SourceMap(options.projectRoot);
      map.addVLQMap(vlqMap);

      if (originalMap) {
        map.extends(originalMap);
      }

      asset.setMap(map);
    }

    if (res.dependencies) {
      for (const dep of res.dependencies) {
        let loc = convertLoc(dep.loc);
        if (originalMap) {
          loc = remapSourceLocation(loc, originalMap);
        }

        if (dep.type === 'import' && !res.exports) {
          asset.addDependency({
            specifier: dep.url,
            specifierType: 'url',
            loc,
            packageConditions: ['style'],
            meta: {
              // For the glob resolver to distinguish between `@import` and other URL dependencies.
              isCSSImport: true,
              media: dep.media,
            },
          });
        } else if (dep.type === 'url') {
          asset.addURLDependency(dep.url, {
            loc,
            meta: {
              placeholder: dep.placeholder,
            },
          });
        }
      }
    }

    const assets = [asset];

    if (res.exports != null) {
      const exports = res.exports;
      asset.symbols.ensure();
      asset.symbols.set('default', 'default');

      const dependencies = new Map();
      const locals = new Map();
      let c = 0;
      let depjs = '';
      let js = '';

      const jsDeps = [];

      for (const key in exports) {
        locals.set(exports[key].name, key);
      }

      asset.uniqueKey ??= asset.id;

      const seen = new Set();
      const add = key => {
        if (seen.has(key)) {
          return;
        }
        seen.add(key);

        const e = exports[key];
        let s = `module.exports[${JSON.stringify(key)}] = \`${e.name}`;

        for (let ref of e.composes) {
          s += ' ';
          if (ref.type === 'local') {
            let exported = nullthrows(locals.get(ref.name));
            add(exported);
            s += '${' + `module.exports[${JSON.stringify(exported)}]` + '}';
            asset.addDependency({
              specifier: nullthrows(asset.uniqueKey),
              specifierType: 'esm',
              symbols: new Map([
                [exported, {local: ref.name, isWeak: false, loc: null}],
              ]),
            });
          } else if (ref.type === 'global') {
            s += ref.name;
          } else if (ref.type === 'dependency') {
            let d = dependencies.get(ref.specifier);
            if (d == null) {
              d = `dep_${c++}`;
              depjs += `import * as ${d} from ${JSON.stringify(ref.specifier)};\n`;
              dependencies.set(ref.specifier, d);
              asset.addDependency({
                specifier: ref.specifier,
                specifierType: 'esm',
                packageConditions: ['style'],
              });
            }
            s += '${' + `${d}[${JSON.stringify(ref.name)}]` + '}';
          }
        }

        s += '`;\n';

        // If the export is referenced internally (e.g. used @keyframes), add a self-reference
        // to the JS so the symbol is retained during tree-shaking.
        if (e.isReferenced) {
          s += `module.exports[${JSON.stringify(key)}];\n`;
          asset.addDependency({
            specifier: nullthrows(asset.uniqueKey),
            specifierType: 'esm',
            symbols: new Map([
              [key, {local: exports[key].name, isWeak: false, loc: null}],
            ]),
          });
        }

        js += s;
      };

      // It's possible that the exports can be ordered differently between builds.
      // Sorting by key is safe as the order is irrelevant but needs to be deterministic.
      for (const key of Object.keys(exports).sort()) {
        asset.symbols.set(key, exports[key].name);
        add(key);
      }

      if (res.dependencies) {
        for (const dep of res.dependencies) {
          if (dep.type === 'import') {
            // TODO: Figure out how to treeshake this
            const d = `dep_$${c++}`;
            depjs += `import * as ${d} from ${JSON.stringify(dep.url)};\n`;
            js += `for (let key in ${d}) { if (key in module.exports) module.exports[key] += ' ' + ${d}[key]; else module.exports[key] = ${d}[key]; }\n`;
            asset.symbols.set('*', '*');
          }
        }
      }

      if (res.references != null) {
        const references = res.references;
        for (const symbol in references) {
          const reference = references[symbol];
          asset.addDependency({
            specifier: reference.specifier,
            specifierType: 'esm',
            packageConditions: ['style'],
            symbols: new Map([
              [reference.name, { local: symbol, isWeak: false, loc: null }],
            ]),
          });

          asset.meta.hasReferences = true;
        }
      }

      assets.push({
        type: 'js',
        content: depjs + js,
        dependencies: jsDeps,
        env,
      });
    }

    return assets;
  },
});

const cache = new Map();

function getTargets(browsers) {
  if (browsers == null) {
    return undefined;
  }

  const cached = cache.get(browsers);
  if (cached != null) {
    return cached;
  }

  const targets = browserslistToTargets(browserslist(browsers));

  cache.set(browsers, targets);
  return targets;
}

/**
 * @param {LightningSourceLocation} loc
 * @returns {SourceLocation}
 */
function convertLoc(loc) {
  return {
    filePath: loc.filePath,
    start: {line: loc.start.line, column: loc.start.column},
    end: {line: loc.end.line, column: loc.end.column + 1},
  };
}

