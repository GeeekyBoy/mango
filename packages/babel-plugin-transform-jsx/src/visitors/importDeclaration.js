/**
 * Copyright (c) GeeekyBoy
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import sysPath from "path";
import { isState } from "../util/types.js";

/**
 * @param {import('@babel/traverse').NodePath<import("@babel/core").types.ImportDeclaration>} path
 * @param {import("@parcel/types").MutableAsset} asset
 * @param {{ type: "ssg" | "ssr" | "remote", path: string, hash: string?, exports: string[] }[]} dynamicMeta
 */
const importDeclaration = (path, asset, dynamicMeta) => {
  const specifiers = path.node.specifiers;
  const source = path.node.source.value;
  if (source.match(/.*\.(ssg|ssr|remote)(\.js)?$/)) {
    const sourceWithExtension = source.endsWith(".js") ? source : source + ".js";
    const type = source.match(/.*\.ssg(\.js)?$/) ? "ssg" : source.match(/.*\.ssr(\.js)?$/) ? "ssr" : "remote";
    const modulePath = sysPath.resolve(sysPath.dirname(asset.filePath), sourceWithExtension);
    /** @type {{ type: "ssg" | "ssr" | "remote", path: string, hash: string?, exports: string[] }} */
    const info = { type, path: modulePath, hash: null, exports: [] };
    if (type === "ssr" || type === "remote") {
      info.hash = asset.addURLDependency("function:" + sourceWithExtension, {});
    }
    for (const specifier of specifiers) {
      if (specifier.type === "ImportDefaultSpecifier" || specifier.type === "ImportNamespaceSpecifier") {
        throw path.buildCodeFrameError("Only named imports are supported for dynamic content imports.");
      } else if (specifier.type === "ImportSpecifier") {
        if (isState(specifier.local)) {
          throw path.buildCodeFrameError("State imports are not supported for dynamic content imports.");
        }
        info.exports.push(specifier.local.name);
      }
    }
    dynamicMeta.push(info);
    path.remove();
  } else {
    path.skip();
  }
};

export default importDeclaration;
