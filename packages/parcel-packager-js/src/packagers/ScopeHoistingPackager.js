/**
 * Copyright (c) GeeekyBoy
 * Some parts are derived from @parcel/packager-js
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import parcelUtils from "@parcel/utils";
import parcelSourceMap from "@parcel/source-map";
import nullthrows from "nullthrows";
import invariant from "assert";
import globals from "globals";

import { prelude, helpers } from "../helpers.js";
import { getSpecifier } from "../utils.js";

const { DefaultMap, PromiseQueue, countLines } = parcelUtils;
const SourceMap = parcelSourceMap.default;

/** @typedef {import("@parcel/types").Asset} Asset */
/** @typedef {import("@parcel/types").NamedBundle} NamedBundle */
/** @typedef {import("@parcel/types").BundleGraph<NamedBundle>} BundleGraph */
/** @typedef {import("@parcel/types").Dependency} Dependency */
/** @typedef {import("@parcel/types").PluginOptions} PluginOptions */

// https://262.ecma-international.org/6.0/#sec-names-and-keywords
const IDENTIFIER_RE = /^[$_\p{ID_Start}][$_\u200C\u200D\p{ID_Continue}]*$/u;
const ID_START_RE = /^[$_\p{ID_Start}]/u;
const NON_ID_CONTINUE_RE = /[^$_\u200C\u200D\p{ID_Continue}]/gu;

// General regex used to replace imports with the resolved code, references with resolutions,
// and count the number of newlines in the file for source maps.
const REPLACEMENT_RE =
  /\n|import\s+"([0-9a-f]{16}:.+?)";|(?:\$[0-9a-f]{16}\$exports)|(?:\$[0-9a-f]{16}\$(?:import|importAsync|require)\$[0-9a-f]+(?:\$[0-9a-f]+)?)|new URL\(("[0-9a-f]{16}"), "file:" \+ __filename\)/g;

const BUILTINS = Object.keys(globals.builtin);
const GLOBALS_BY_CONTEXT = {
  browser: new Set([...BUILTINS, ...Object.keys(globals.browser)]),
  "web-worker": new Set([...BUILTINS, ...Object.keys(globals.worker)]),
  "service-worker": new Set([
    ...BUILTINS,
    ...Object.keys(globals.serviceworker),
  ]),
  worklet: new Set([...BUILTINS]),
  "electron-main": new Set([...BUILTINS, ...Object.keys(globals.node)]),
  "electron-renderer": new Set([
    ...BUILTINS,
    ...Object.keys(globals.node),
    ...Object.keys(globals.browser),
  ]),
};

export class ScopeHoistingPackager {
  /** @type {PluginOptions} */
  options;
  /** @type {BundleGraph} */
  bundleGraph;
  /** @type {NamedBundle} */
  bundle;
  /** @type {Set<string>} */
  globalNames;
  /** @type {Map<string, {code: string, map: ?Buffer}>} */
  assetOutputs;
  /** @type {Map<string, Map<string, string>>} */
  externals = new Map();
  /** @type {Map<string, number>} */
  topLevelNames = new Map();
  /** @type {Set<string>} */
  seenAssets = new Set();
  /** @type {Set<string>} */
  wrappedAssets = new Set();
  /** @type {Map<string, Map<string, string>>} */
  hoistedRequires = new Map();
  /** @type {boolean} */
  needsPrelude = false;
  /** @type {Set<string>} */
  usedHelpers = new Set();

  /**
   * @param {PluginOptions} options
   * @param {BundleGraph} bundleGraph
   * @param {NamedBundle} bundle
   */
  constructor(options, bundleGraph, bundle) {
    this.options = options;
    this.bundleGraph = bundleGraph;
    this.bundle = bundle;
    this.globalNames = GLOBALS_BY_CONTEXT[bundle.env.context];
  }

  /**
   * @returns {Promise<{contents: string, map: ?SourceMap}>}
   */
  async package() {
    const wrappedAssets = await this.loadAssets();

    let res = "";
    let lineCount = 0;
    let sourceMap = null;
    /** @type {(asset: Asset, helpersOnly: Boolean) => void} */
    const processAsset = (asset, helpersOnly) => {
      if (helpersOnly && !/@swc[/\\]helpers/.test(asset.filePath)) {
        return;
      }

      let [content, map, lines] = this.visitAsset(asset);
      if (sourceMap && map) {
        sourceMap.addSourceMap(map, lineCount);
      } else if (this.bundle.env.sourceMap) {
        sourceMap = map;
      }

      res += content + "\n";
      lineCount += lines + 1;
    };

    // Hoist wrapped asset to the top of the bundle to ensure that they are registered
    // before they are used.
    for (const asset of wrappedAssets) {
      if (!this.seenAssets.has(asset.id)) {
        processAsset(asset);
      }
    }

    // Add each asset that is directly connected to the bundle. Dependencies will be handled
    // by replacing `import` statements in the code.
    // First, add SWC helpers.
    this.bundle.traverseAssets((asset, _, actions) => {
      if (this.seenAssets.has(asset.id)) {
        actions.skipChildren();
        return;
      }

      processAsset(asset, true);
      actions.skipChildren();
    });
    // Then, add the rest of the assets.
    this.bundle.traverseAssets((asset, _, actions) => {
      if (this.seenAssets.has(asset.id)) {
        actions.skipChildren();
        return;
      }

      processAsset(asset);
      actions.skipChildren();
    });

    let [prelude, preludeLines] = this.buildBundlePrelude();
    res = prelude + res;
    lineCount += preludeLines;
    sourceMap?.offsetLines(1, preludeLines);

    const entries = this.bundle.getEntryAssets();
    const mainEntry = this.bundle.getMainEntry();

    // If any of the entry assets are wrapped, call parcelRequire so they are executed.
    for (const entry of entries) {
      if (this.wrappedAssets.has(entry.id)) {
        res += `\nparcelRequire(${JSON.stringify(this.bundleGraph.getAssetPublicId(entry))});\n`;
        lineCount += 2;
      }
    }

    if (mainEntry.query.has("component")) {
      const exportedSymbol = mainEntry.symbols.get("default");
      res += `return ${exportedSymbol.local};`;
    }

    res += "})();";
    lineCount += 0;

    return {
      contents: res,
      map: sourceMap,
    };
  }

  /**
   * @returns {Promise<Array<Asset>>}
   */
  async loadAssets() {
    const queue = new PromiseQueue({maxConcurrent: 32});
    const wrapped = [];
    this.bundle.traverseAssets(asset => {
      queue.add(async () => {
        const [code, map] = await Promise.all([
          asset.getCode(),
          this.bundle.env.sourceMap ? asset.getMapBuffer() : null,
        ]);
        return [asset.id, {code, map}];
      });

      if (
        asset.meta.shouldWrap ||
        this.bundleGraph.isAssetReferenced(this.bundle, asset) ||
        this.bundleGraph
          .getIncomingDependencies(asset)
          .some(dep => dep.meta.shouldWrap && dep.specifierType !== "url")
      ) {
        this.wrappedAssets.add(asset.id);
        wrapped.push(asset);
      }
    });

    for (const wrappedAssetRoot of [...wrapped]) {
      this.bundle.traverseAssets((asset, _, actions) => {
        if (asset === wrappedAssetRoot) {
          return;
        }

        if (this.wrappedAssets.has(asset.id)) {
          actions.skipChildren();
          return;
        }

        this.wrappedAssets.add(asset.id);
        wrapped.push(asset);
      }, wrappedAssetRoot);
    }

    this.assetOutputs = new Map(await queue.run());
    return wrapped;
  }

  /**
   * @param {string} name
   * @returns {string}
   */
  getTopLevelName(name) {
    name = name.replace(NON_ID_CONTINUE_RE, "");
    if (!ID_START_RE.test(name) || this.globalNames.has(name)) {
      name = "_" + name;
    }

    const count = this.topLevelNames.get(name);
    if (count == null) {
      this.topLevelNames.set(name, 1);
      return name;
    }

    this.topLevelNames.set(name, count + 1);
    return name + count;
  }

  /**
   * @param {string} obj
   * @param {string} property
   * @returns {string}
   */
  getPropertyAccess(obj, property) {
    if (IDENTIFIER_RE.test(property)) {
      return `${obj}.${property}`;
    }

    return `${obj}[${JSON.stringify(property)}]`;
  }

  /**
   * @param {Asset} asset
   * @returns {[string, ?SourceMap, number]}
   */
  visitAsset(asset) {
    invariant(!this.seenAssets.has(asset.id), "Already visited asset");
    this.seenAssets.add(asset.id);

    const { code, map } = nullthrows(this.assetOutputs.get(asset.id));
    return this.buildAsset(asset, code, map);
  }

  /**
   * @param {Asset} asset
   * @param {string} code
   * @param {?Buffer} map
   * @returns {[string, ?SourceMap, number]}
   */
  buildAsset(asset, code, map) {
    const shouldWrap = this.wrappedAssets.has(asset.id);
    const deps = this.bundleGraph.getDependencies(asset);

    const sourceMap =
      this.bundle.env.sourceMap && map
        ? new SourceMap(this.options.projectRoot, map)
        : null;

    // If this asset is skipped, just add dependencies and not the asset's content.
    if (this.shouldSkipAsset(asset)) {
      let depCode = "";
      let lineCount = 0;
      for (const dep of deps) {
        const resolved = this.bundleGraph.getResolvedAsset(dep, this.bundle);
        const skipped = this.bundleGraph.isDependencySkipped(dep);
        if (skipped) {
          continue;
        }

        if (this.bundle.hasAsset(resolved) && !this.seenAssets.has(resolved.id)) {
          const [code, map, lines] = this.visitAsset(resolved);
          depCode += code + "\n";
          if (sourceMap && map) {
            sourceMap.addSourceMap(map, lineCount);
          }
          lineCount += lines + 1;
        }
      }

      return [depCode, sourceMap, lineCount];
    }

    // TODO: maybe a meta prop?
    if (code.includes("$parcel$global")) {
      if (this.globalNames.has("window")) {
        this.usedHelpers.add("$parcel$global_window");
      } else {
        this.usedHelpers.add("$parcel$global_self");
      }
    }

    const [depMap, replacements] = this.buildReplacements(asset, deps);
    const [prepend, prependLines, append] = this.buildAssetPrelude(asset, deps);
    if (prependLines > 0) {
      sourceMap?.offsetLines(1, prependLines);
      code = prepend + code;
    }

    code += append;

    let lineCount = 0;
    const depContent = [];
    if (!depMap.size && !replacements.size) {
      // If there are no dependencies or replacements, use a simple function to count the number of lines.
      lineCount = countLines(code) - 1;
    } else {
      // Otherwise, use a regular expression to perform replacements.
      // We need to track how many newlines there are for source maps, replace
      // all import statements with dependency code, and perform inline replacements
      // of all imported symbols with their resolved export symbols. This is all done
      // in a single regex so that we only do one pass over the whole code.
      let offset = 0;
      let columnStartIndex = 0;
      code = code.replace(REPLACEMENT_RE, (m, d, i) => {
        if (m === "\n") {
          columnStartIndex = i + offset + 1;
          lineCount++;
          return "\n";
        }

        // If we matched an import, replace with the source code for the dependency.
        if (d != null) {
          const deps = depMap.get(d);
          if (!deps) {
            return m;
          }

          let replacement = "";

          // A single `${id}:${specifier}:esm` might have been resolved to multiple assets due to
          // reexports.
          for (const dep of deps) {
            const resolved = this.bundleGraph.getResolvedAsset(dep, this.bundle);
            const skipped = this.bundleGraph.isDependencySkipped(dep);
            if (resolved && !skipped) {
              // Hoist variable declarations for the referenced parcelRequire dependencies
              // after the dependency is declared. This handles the case where the resulting asset
              // is wrapped, but the dependency in this asset is not marked as wrapped. This means
              // that it was imported/required at the top-level, so its side effects should run immediately.
              let [res, lines] = this.getHoistedParcelRequires(asset, dep, resolved);
              let map;
              if (this.bundle.hasAsset(resolved) && !this.seenAssets.has(resolved.id)) {
                // If this asset is wrapped, we need to hoist the code for the dependency
                // outside our parcelRequire.register wrapper. This is safe because all
                // assets referenced by this asset will also be wrapped. Otherwise, inline the
                // asset content where the import statement was.
                if (shouldWrap) {
                  depContent.push(this.visitAsset(resolved));
                } else {
                  const [depCode, depMap, depLines] = this.visitAsset(resolved);
                  res = depCode + "\n" + res;
                  lines += 1 + depLines;
                  map = depMap;
                }
              }

              // Push this asset's source mappings down by the number of lines in the dependency
              // plus the number of hoisted parcelRequires. Then insert the source map for the dependency.
              if (sourceMap) {
                if (lines > 0) {
                  sourceMap.offsetLines(lineCount + 1, lines);
                }

                if (map) {
                  sourceMap.addSourceMap(map, lineCount);
                }
              }

              replacement += res;
              lineCount += lines;
            }
          }
          return replacement;
        }

        // If it wasn't a dependency, then it was an inline replacement (e.g. $id$import$foo -> $id$export$foo).
        const replacement = m.substring(0, 7) === "new URL" ? i : replacements.get(m) ?? m;
        if (sourceMap) {
          // Offset the source map columns for this line if the replacement was a different length.
          // This assumes that the match and replacement both do not contain any newlines.
          const lengthDifference = replacement.length - m.length;
          if (lengthDifference !== 0) {
            sourceMap.offsetColumns(
              lineCount + 1,
              i + offset - columnStartIndex + m.length,
              lengthDifference,
            );
            offset += lengthDifference;
          }
        }
        return replacement;
      });
    }



    // If the asset is wrapped, we need to insert the dependency code outside the parcelRequire.register
    // wrapper. Dependencies must be inserted AFTER the asset is registered so that circular dependencies work.
    if (shouldWrap) {
      // Offset by one line for the parcelRequire.register wrapper.
      sourceMap?.offsetLines(1, 1);
      lineCount++;

      code = `parcelRequire.register(${JSON.stringify(
        this.bundleGraph.getAssetPublicId(asset),
      )}, function(module, exports) {
${code}
});
`;

      lineCount += 2;

      for (const [depCode, map, lines] of depContent) {
        if (!depCode) continue;
        code += depCode + "\n";
        if (sourceMap && map) {
          sourceMap.addSourceMap(map, lineCount);
        }
        lineCount += lines + 1;
      }

      this.needsPrelude = true;
    }

    return [code, sourceMap, lineCount];
  }

  /**
   * @param {Asset} asset
   * @param {Array<Dependency>} deps
   * @returns {[Map<string, Array<Dependency>>, Map<string, string>]}
   */
  buildReplacements(asset, deps) {
    const assetId = asset.meta.id;
    invariant(typeof assetId === "string");

    // Build two maps: one of import specifiers, and one of imported symbols to replace.
    // These will be used to build a regex below.
    const depMap = new DefaultMap(() => []);
    const replacements = new Map();
    for (const dep of deps) {
      const specifierType = dep.specifierType === "esm" ? `:${dep.specifierType}` : "";
      depMap.get(`${assetId}:${getSpecifier(dep)}${!dep.meta.placeholder ? specifierType : ""}`).push(dep);

      const asyncResolution = this.bundleGraph.resolveAsyncDependency(dep, this.bundle);
      const resolved =
        asyncResolution?.type === "asset"
          ? // Prefer the underlying asset over a runtime to load it. It will
            // be wrapped in Promise.resolve() later.
            asyncResolution.value
          : this.bundleGraph.getResolvedAsset(dep, this.bundle);

      for (const [imported, { local }] of dep.symbols) {
        if (local === "*") {
          continue;
        }

        const symbol = this.getSymbolResolution(asset, resolved, imported, dep);
        replacements.set(
          local,
          // If this was an internalized async asset, wrap in a Promise.resolve.
          asyncResolution?.type === "asset"
            ? `Promise.resolve(${symbol})`
            : symbol,
        );
      }

      // Async dependencies need a namespace object even if all used symbols were statically analyzed.
      // This is recorded in the promiseSymbol meta property set by the transformer rather than in
      // symbols so that we don't mark all symbols as used.
      if (dep.priority === "lazy" && dep.meta.promiseSymbol) {
        const promiseSymbol = dep.meta.promiseSymbol;
        invariant(typeof promiseSymbol === "string");
        const symbol = this.getSymbolResolution(asset, resolved, "*", dep);
        replacements.set(
          promiseSymbol,
          asyncResolution?.type === "asset"
            ? `Promise.resolve(${symbol})`
            : symbol,
        );
      }
    }

    // If this asset is wrapped, we need to replace the exports namespace with `module.exports`,
    // which will be provided to us by the wrapper.
    if (this.wrappedAssets.has(asset.id)) {
      const exportsName = asset.symbols.get("*")?.local || `$${assetId}$exports`;
      replacements.set(exportsName, "module.exports");
    }

    return [depMap, replacements];
  }

  /**
   * @param {Asset} parentAsset
   * @param {Asset} resolved
   * @param {string} imported
   * @param {?Dependency} dep
   * @returns {string}
   */
  getSymbolResolution(parentAsset, resolved, imported, dep) {
    const {
      asset: resolvedAsset,
      exportSymbol,
      symbol,
    } = this.bundleGraph.getSymbolResolution(resolved, imported, this.bundle);

    if (
      resolvedAsset.type !== "js" ||
      (dep && this.bundleGraph.isDependencySkipped(dep))
    ) {
      // Graceful fallback for non-js imports or when trying to resolve a symbol
      // that is actually unused but we still need a placeholder value.
      return "{}";
    }

    const isWrapped =
      !this.bundle.hasAsset(resolvedAsset) ||
      (this.wrappedAssets.has(resolvedAsset.id) &&
        resolvedAsset !== parentAsset);
    const staticExports = resolvedAsset.meta.staticExports !== false;
    const publicId = this.bundleGraph.getAssetPublicId(resolvedAsset);

    // If the resolved asset is wrapped, but imported at the top-level by this asset,
    // then we hoist parcelRequire calls to the top of this asset so side effects run immediately.
    if (
      isWrapped &&
      dep &&
      !dep?.meta.shouldWrap &&
      symbol !== false &&
      // Only do this if the asset is part of a different bundle (so it was definitely
      // parcelRequire.register'ed there), or if it is indeed registered in this bundle.
      (!this.bundle.hasAsset(resolvedAsset) ||
        !this.shouldSkipAsset(resolvedAsset))
    ) {
      let hoisted = this.hoistedRequires.get(dep.id);
      if (!hoisted) {
        hoisted = new Map();
        this.hoistedRequires.set(dep.id, hoisted);
      }

      hoisted.set(
        resolvedAsset.id,
        `var $${publicId} = parcelRequire(${JSON.stringify(publicId)});`,
      );
    }

    if (isWrapped) {
      this.needsPrelude = true;
    }

    // If this is an ESM default import of a CJS module with a `default` symbol,
    // and no __esModule flag, we need to resolve to the namespace instead.
    const isDefaultInterop =
      exportSymbol === "default" &&
      staticExports &&
      !isWrapped &&
      (dep?.meta.kind === "Import" || dep?.meta.kind === "Export") &&
      resolvedAsset.symbols.hasExportSymbol("*") &&
      resolvedAsset.symbols.hasExportSymbol("default") &&
      !resolvedAsset.symbols.hasExportSymbol("__esModule");

    // Find the namespace object for the resolved module. If wrapped and this
    // is an inline require (not top-level), use a parcelRequire call, otherwise
    // the hoisted variable declared above. Otherwise, if not wrapped, use the
    // namespace export symbol.
    const assetId = resolvedAsset.meta.id;
    invariant(typeof assetId === "string");
    const obj =
      isWrapped && (!dep || dep?.meta.shouldWrap)
        ? // Wrap in extra parenthesis to not change semantics, e.g.`new (parcelRequire("..."))()`.
          `(parcelRequire(${JSON.stringify(publicId)}))`
        : isWrapped && dep
        ? `$${publicId}`
        : resolvedAsset.symbols.get("*")?.local || `$${assetId}$exports`;

    if (imported === "*" || exportSymbol === "*" || isDefaultInterop) {
      // Resolve to the namespace object if requested or this is a CJS default interop reqiure.
      if (parentAsset === resolvedAsset && this.wrappedAssets.has(resolvedAsset.id)) {
        // Directly use module.exports for wrapped assets importing themselves.
        return "module.exports";
      } else {
        return obj;
      }
    } else if (
      (!staticExports || isWrapped || !symbol) &&
      resolvedAsset !== parentAsset
    ) {
      // If the resolved asset is wrapped or has non-static exports,
      // we need to use a member access off the namespace object rather
      // than a direct reference. If importing default from a CJS module,
      // use a helper to check the __esModule flag at runtime.
      const kind = dep?.meta.kind;
      if (
        (!dep || kind === "Import" || kind === "Export") &&
        exportSymbol === "default" &&
        resolvedAsset.symbols.hasExportSymbol("*") &&
        this.needsDefaultInterop(resolvedAsset)
      ) {
        this.usedHelpers.add("$parcel$interopDefault");
        return `(/*@__PURE__*/$parcel$interopDefault(${obj}))`;
      } else {
        return this.getPropertyAccess(obj, exportSymbol);
      }
    } else if (!symbol) {
      invariant(false, "Asset was skipped or not found.");
    } else {
      return symbol;
    }
  }

  /**
   * @param {Asset} parentAsset
   * @param {Dependency} dep
   * @param {Asset} resolved
   * @returns {[string, number]}
   */
  getHoistedParcelRequires(parentAsset, dep, resolved) {
    if (resolved.type !== "js") {
      return ["", 0];
    }

    const hoisted = this.hoistedRequires.get(dep.id);
    let res = "";
    let lineCount = 0;
    const isWrapped =
      !this.bundle.hasAsset(resolved) ||
      (this.wrappedAssets.has(resolved.id) && resolved !== parentAsset);

    // If the resolved asset is wrapped and is imported in the top-level by this asset,
    // we need to run side effects when this asset runs. If the resolved asset is not
    // the first one in the hoisted requires, we need to insert a parcelRequire here
    // so it runs first.
    if (
      isWrapped &&
      !dep.meta.shouldWrap &&
      (!hoisted || hoisted.keys().next().value !== resolved.id) &&
      !this.bundleGraph.isDependencySkipped(dep) &&
      !this.shouldSkipAsset(resolved)
    ) {
      this.needsPrelude = true;
      res += `parcelRequire(${JSON.stringify(
        this.bundleGraph.getAssetPublicId(resolved),
      )});`;
    }

    if (hoisted) {
      this.needsPrelude = true;
      res += "\n" + [...hoisted.values()].join("\n");
      lineCount += hoisted.size;
    }

    return [res, lineCount];
  }

  /**
   * @param {Asset} asset
   * @param {Array<Dependency>} deps
   * @returns {[string, number, string]}
   */
  buildAssetPrelude(asset, deps) {
    let prepend = "";
    let prependLineCount = 0;
    let append = "";

    const shouldWrap = this.wrappedAssets.has(asset.id);
    const usedSymbols = nullthrows(this.bundleGraph.getUsedSymbols(asset));
    const assetId = asset.meta.id;
    invariant(typeof assetId === "string");

    // If the asset has a namespace export symbol, it is CommonJS.
    // If there's no __esModule flag, and default is a used symbol, we need
    // to insert an interop helper.
    const defaultInterop =
      asset.symbols.hasExportSymbol("*") &&
      usedSymbols.has("default") &&
      !asset.symbols.hasExportSymbol("__esModule");

    const usedNamespace =
      // If the asset has * in its used symbols, we might need the exports namespace.
      usedSymbols.has("*") ||
      // If a symbol is imported (used) from a CJS asset but isn't listed in the symbols,
      // we fallback on the namespace object.
      (asset.symbols.hasExportSymbol("*") && [...usedSymbols].some(s => !asset.symbols.hasExportSymbol(s)));

    // If the asset doesn't have static exports, should wrap, the namespace is used,
    // or we need default interop, then we need to synthesize a namespace object for
    // this asset.
    if (
      asset.meta.staticExports === false ||
      shouldWrap ||
      usedNamespace ||
      defaultInterop
    ) {
      // Insert a declaration for the exports namespace object. If the asset is wrapped
      // we don't need to do this, because we'll use the `module.exports` object provided
      // by the wrapper instead. This is also true of CommonJS entry assets, which will use
      // the `module.exports` object provided by CJS.
      if (!shouldWrap && asset !== this.bundle.getMainEntry()) {
        prepend += `var $${assetId}$exports = {};\n`;
        prependLineCount++;
      }

      // Insert the __esModule interop flag for this module if it has a `default` export
      // and the namespace symbol is used.
      // TODO: only if required by CJS?
      if (asset.symbols.hasExportSymbol("default") && usedSymbols.has("*")) {
        prepend += `\n$parcel$defineInteropFlag($${assetId}$exports);\n`;
        prependLineCount += 2;
        this.usedHelpers.add("$parcel$defineInteropFlag");
      }

      // Find wildcard re-export dependencies, and make sure their exports are also included in
      // ours. Importantly, add them before the asset's own exports so that wildcard exports get
      // correctly overwritten by own exports of the same name.
      for (const dep of deps) {
        const resolved = this.bundleGraph.getResolvedAsset(dep, this.bundle);
        if (dep.isOptional || this.bundleGraph.isDependencySkipped(dep)) {
          continue;
        }

        const isWrapped = resolved && resolved.meta.shouldWrap;

        for (const [imported, {local}] of dep.symbols) {
          if (imported === "*" && local === "*") {
            // If the resolved asset has an exports object, use the $parcel$exportWildcard helper
            // to re-export all symbols. Otherwise, if there's no namespace object available, add
            // $parcel$export calls for each used symbol of the dependency.
            if (
              isWrapped ||
              resolved.meta.staticExports === false ||
              nullthrows(this.bundleGraph.getUsedSymbols(resolved)).has("*") ||
              // an empty asset
              (!resolved.meta.hasCJSExports && resolved.symbols.hasExportSymbol("*"))
            ) {
              const obj = this.getSymbolResolution(asset, resolved, "*", dep);
              append += `$parcel$exportWildcard($${assetId}$exports, ${obj});\n`;
              this.usedHelpers.add("$parcel$exportWildcard");
            } else {
              for (const symbol of nullthrows(this.bundleGraph.getUsedSymbols(dep))) {
                if (
                  symbol === "default" || // `export * as ...` does not include the default export
                  symbol === "__esModule"
                ) {
                  continue;
                }

                const resolvedSymbol = this.getSymbolResolution(asset, resolved, symbol);
                const get = this.buildFunctionExpression([], resolvedSymbol);
                const set = asset.meta.hasCJSExports
                  ? ", " + this.buildFunctionExpression(["v"], `${resolvedSymbol} = v`)
                  : "";
                prepend += `$parcel$export($${assetId}$exports, ${JSON.stringify(symbol)}, ${get}${set});\n`;
                this.usedHelpers.add("$parcel$export");
                prependLineCount++;
              }
            }
          }
        }
      }

      // Find the used exports of this module. This is based on the used symbols of
      // incoming dependencies rather than the asset's own used exports so that we include
      // re-exported symbols rather than only symbols declared in this asset.
      const incomingDeps = this.bundleGraph.getIncomingDependencies(asset);
      const usedExports = [...asset.symbols.exportSymbols()].filter(symbol => {
        if (symbol === "*") {
          return false;
        }

        // If we need default interop, then all symbols are needed because the `default`
        // symbol really maps to the whole namespace.
        if (defaultInterop) {
          return true;
        }

        const unused = incomingDeps.every(d => {
          const symbols = nullthrows(this.bundleGraph.getUsedSymbols(d));
          return !symbols.has(symbol) && !symbols.has("*");
        });
        return !unused;
      });

      if (usedExports.length > 0) {
        // Insert $parcel$export calls for each of the used exports. This creates a getter/setter
        // for the symbol so that when the value changes the object property also changes. This is
        // required to simulate ESM live bindings. It's easier to do it this way rather than inserting
        // additional assignments after each mutation of the original binding.
        prepend += `\n${usedExports.map(exp => {
            const resolved = this.getSymbolResolution(asset, asset, exp);
            const get = this.buildFunctionExpression([], resolved);
            const isEsmExport = !!asset.symbols.get(exp)?.meta?.isEsm;
            const set = !isEsmExport && asset.meta.hasCJSExports
                ? ", " + this.buildFunctionExpression(["v"], `${resolved} = v`)
                : "";
            return `$parcel$export($${assetId}$exports, ${JSON.stringify(exp)}, ${get}${set});`;
          }).join("\n")}\n`;
        this.usedHelpers.add("$parcel$export");
        prependLineCount += 1 + usedExports.length;
      }
    }

    return [prepend, prependLineCount, append];
  }

  /**
   * @return {[string, number]}
   */
  buildBundlePrelude() {
    const enableSourceMaps = this.bundle.env.sourceMap;
    let res = "";
    let lines = 0;

    // The output format may have specific things to add at the start of the bundle (e.g. imports).
    res += this.bundle.env.supports("arrow-functions", true) ? "(() => {\n" : "(function () {\n";
    lines += 1;

    // Add used helpers.
    if (this.needsPrelude) {
      if (this.globalNames.has("window")) {
        this.usedHelpers.add("$parcel$global_window");
      } else {
        this.usedHelpers.add("$parcel$global_self");
      }
    }

    for (const helper of this.usedHelpers) {
      res += helpers[helper];
      if (enableSourceMaps) {
        lines += countLines(helpers[helper]) - 1;
      }
    }

    if (this.needsPrelude) {
      // Add the prelude if this is potentially the first JS bundle to load in a
      // particular context (e.g. entry scripts in HTML, workers, etc.).
      const parentBundles = this.bundleGraph.getParentBundles(this.bundle);
      const mightBeFirstJS =
        parentBundles.length === 0 ||
        parentBundles.some(b => b.type !== "js") ||
        this.bundleGraph
          .getBundleGroupsContainingBundle(this.bundle)
          .some(g => this.bundleGraph.isEntryBundleGroup(g)) ||
        this.bundle.env.isIsolated() ||
        this.bundle.bundleBehavior === "isolated";

      if (mightBeFirstJS) {
        const preludeCode = prelude();
        res += preludeCode;
        if (enableSourceMaps) {
          lines += countLines(preludeCode) - 1;
        }
      } else {
        // Otherwise, get the current parcelRequire global.
        res += `var parcelRequire = $parcel$global["parcelRequire"];\n`;
        lines++;
      }
    }

    return [res, lines];
  }

  /**
   * @param {Asset} asset
   * @returns {boolean}
   */
  needsDefaultInterop(asset) {
    if (asset.symbols.hasExportSymbol("*") && !asset.symbols.hasExportSymbol("default")) {
      const deps = this.bundleGraph.getIncomingDependencies(asset);
      return deps.some((dep) => this.bundle.hasDependency(dep) && dep.symbols.hasExportSymbol("default"));
    }

    return false;
  }

  /**
   * @param {Asset} asset
   * @returns {boolean}
   */
  shouldSkipAsset(asset) {
    return (
      asset.sideEffects === false &&
      nullthrows(this.bundleGraph.getUsedSymbols(asset)).size == 0 &&
      !this.bundleGraph.isAssetReferenced(this.bundle, asset)
    );
  }

  /**
   * @param {Array<string>} args
   * @param {string} expr
   * @returns {string}
   */
  buildFunctionExpression(args, expr) {
    return this.bundle.env.supports("arrow-functions", true)
      ? `(${args.join(", ")}) => ${expr}`
      : `function (${args.join(", ")}) { return ${expr}; }`;
  }
}
