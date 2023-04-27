/**
 * Copyright (c) GeeekyBoy
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import sysPath from "path";
import t from "@babel/types";
import { pathToFileURL } from "url";
import * as util from "../util/index.js";

/**
 * @param {import('@babel/traverse').NodePath<import("@babel/types").ImportDeclaration>} path
 * @param {import("@parcel/types").MutableAsset} asset
 */
const importDeclaration = (path, asset) => {
  const specifiers = path.node.specifiers;
  const source = path.node.source.value;
  if (source.match(/.*\.ssg(\.js)?$/)) {
    const sourceWithExtension = source.endsWith(".js") ? source : source + ".js";
    const modulePath = sysPath.resolve(sysPath.dirname(asset.filePath), sourceWithExtension);
    const values = util.dynamicImport(pathToFileURL(modulePath).toString());
    asset.invalidateOnFileChange(modulePath);
    /** @type {t.VariableDeclaration[]} */
    const declarations = [];
    for (const specifier of specifiers) {
      if (specifier.type === "ImportDefaultSpecifier" || specifier.type === "ImportNamespaceSpecifier") {
        throw path.buildCodeFrameError("Only named imports are supported for static imports.");
      } else if (specifier.type === "ImportSpecifier") {
        const name = specifier.local.name;
        if (!Object.hasOwnProperty.call(values, name)) {
          throw path.buildCodeFrameError(`No value named ${name} was exported from ${sourceWithExtension}.`);
        }
        const value = values[name];
        const valueExpression = t.valueToNode(value);
        const declaration = t.variableDeclaration("var", [t.variableDeclarator(specifier.local, valueExpression)]);
        declarations.push(declaration);
      }
    }
    path.replaceWithMultiple(declarations);
  } else if (source.match(/.*\.ssr(\.js)?$/)) {
    const sourceWithExtension = source.endsWith(".js") ? source : source + ".js";
    asset.invalidateOnFileChange(sysPath.join(sysPath.dirname(asset.filePath), sourceWithExtension));
    const ssrFunctionPath = asset.addURLDependency("function:" + sourceWithExtension, {});
    /** @type {t.VariableDeclaration[]} */
    const declarations = [];
    for (const specifier of specifiers) {
      if (specifier.type === "ImportDefaultSpecifier" || specifier.type === "ImportNamespaceSpecifier") {
        throw path.buildCodeFrameError("Only named imports are supported for static imports.");
      } else if (specifier.type === "ImportSpecifier") {
        const name = specifier.local.name;
        const valueExpression = t.stringLiteral(ssrFunctionPath + '#' + name);
        const declaration = t.variableDeclaration("var", [t.variableDeclarator(specifier.local, valueExpression)]);
        declarations.push(declaration);
      }
    }
    path.replaceWithMultiple(declarations);
  } else {
    path.skip();
  }
};

export default importDeclaration;
