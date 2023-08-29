/**
 * Copyright (c) GeeekyBoy
 * Some parts are derived from @parcel/runtime-js
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import path from "path";
import { fileURLToPath } from "url";
import { Runtime } from "@parcel/plugin";
import nullthrows from "nullthrows";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** @typedef {import("@parcel/types").BundleGraph} BundleGraph */
/** @typedef {import("@parcel/types").BundleGroup} BundleGroup */
/** @typedef {import("@parcel/types").Dependency} Dependency */
/** @typedef {import("@parcel/types").Environment} Environment */
/** @typedef {import("@parcel/types").PluginOptions} PluginOptions */
/** @typedef {import("@parcel/types").NamedBundle} NamedBundle */
/** @typedef {import("@parcel/types").RuntimeAsset} RuntimeAsset */

/** @type {WeakMap<NamedBundle, Array<Dependency>}>} */
const bundleDependencies = new WeakMap();

export default new Runtime({
  apply({ bundle, bundleGraph, options }) {
    if (bundle.type !== "js") {
      return;
    }

    const assets = [];

    if (bundle.getMainEntry()?.query.has("component") || bundle.getMainEntry()?.query.has("page")) {
      const deps = [];
      bundle.traverse((node) => {
        if (node.type === "dependency" && node.value.specifier.split("?")[0].match(/(styl|stylus|sass|scss|less|css|pcss|sss)$/g)) {
          deps.push(node.value);
        }
      });
      if (deps.length) {
        const styleSheetLoader = `
          var style = document.createElement("style");
          style.type = "text/css";
          var code = ${JSON.stringify(deps.map(dep => dep.id))}.join("\\n");
          document.getElementsByTagName("head")[0].appendChild(style);
          if (style.styleSheet) style.styleSheet.cssText = code;
          else style.innerHTML = code;
        `;
        assets.push({
          filePath: "styleSheetLoader.js",
          code: styleSheetLoader,
          isEntry: true,
        });
      }
    }

    for (const dependency of getDependencies(bundle)) {
      // Resolve the dependency to a bundle. If inline, export the dependency id,
      // which will be replaced with the contents of that bundle later.
      const referencedBundle = bundleGraph.getReferencedBundle(dependency, bundle);
      if (referencedBundle?.bundleBehavior === "inline") {
        if (!dependency.specifier.match(/(styl|stylus|sass|scss|less|css|pcss|sss)$/g)) {
          assets.push({
            filePath: path.join(__dirname, `/bundles/${referencedBundle.id}.js`),
            code: `module.exports = ${JSON.stringify(dependency.id)};`,
            dependency,
            env: { sourceType: "module" },
          });
        }
        continue;
      }

      // Otherwise, try to resolve the dependency to an external bundle group
      // and insert a URL to that bundle.
      const resolved = bundleGraph.resolveAsyncDependency(dependency, bundle);
      if (dependency.specifierType === "url" && resolved == null) {
        // If a URL dependency was not able to be resolved, add a runtime that
        // exports the original specifier.
        assets.push({
          filePath: __filename,
          code: `module.exports = ${JSON.stringify(dependency.specifier)}`,
          dependency,
          env: { sourceType: "module" },
        });
        continue;
      }

      if (resolved == null || resolved.type !== "bundle_group") {
        continue;
      }

      const bundleGroup = resolved.value;
      const mainBundle = nullthrows(
        bundleGraph.getBundlesInBundleGroup(bundleGroup).find((b) => {
          const entries = b.getEntryAssets();
          return entries.some((e) => bundleGroup.entryAssetId === e.id);
        }),
      );

      // Skip URL runtimes for library builds. This is handled in packaging so that
      // the url is inlined and statically analyzable.
      if (bundle.env.isLibrary && dependency.meta?.placeholder != null) {
        continue;
      }

      // URL dependency or not, fall back to including a runtime that exports the url
      assets.push(getURLRuntime(dependency, mainBundle, options));
    }

    return assets;
  },
});

/**
 * @param {NamedBundle} bundle
 * @returns {Array<Dependency>}
 */
function getDependencies(bundle) {
  const cachedDependencies = bundleDependencies.get(bundle);

  if (cachedDependencies) {
    return cachedDependencies;
  } else {
    const dependencies = [];
    bundle.traverse((node) => {
      if (node.type === "dependency") {
        dependencies.push(node.value);
      }
    });
    bundleDependencies.set(bundle, dependencies);
    return dependencies;
  }
}

/**
 * @param {Dependency} dependency
 * @param {NamedBundle} from
 * @param {NamedBundle} to
 * @param {PluginOptions} options
 * @returns {RuntimeAsset}
 */
function getURLRuntime(dependency, to, options) {
  const relativePathExpr = getRelativePathExpr(to, options);

  return {
    filePath: __filename,
    code: `module.exports = ${relativePathExpr};`,
    dependency,
    env: { sourceType: "module" },
  };
}

/**
 * @param {NamedBundle} from
 * @param {NamedBundle} to
 * @param {PluginOptions} options
 * @returns {string}
 */
function getRelativePathExpr(to, options) {
  const relativePath = to.target.publicUrl + to.name.replace(/\\/g, "/")

  let res = JSON.stringify(relativePath);
  if (options.hmrOptions) {
    res += ' + "?" + Date.now()';
  }

  return res;
}
