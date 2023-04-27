/**
 * Copyright (c) GeeekyBoy
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import t from "@babel/types";
import * as util from "../util/index.js";

/**
 * @param {import('@babel/traverse').NodePath<import("@babel/types").ExportNamedDeclaration>} path
 * @param {Set<string>} exportedNames
 */
const exportNamedDeclaration = (path, exportedNames) => {
  const specifiers = path.node.specifiers;
  for (const specifier of specifiers) {
    if (t.isExportSpecifier(specifier)) {
      const localIdentifier = specifier.local;
      const exportedIdentifier = t.isIdentifier(specifier.exported)
        ? specifier.exported
        : t.identifier(specifier.exported.value);
      exportedNames.add(localIdentifier.name);
      if (util.types.isState(localIdentifier) || util.types.isState(exportedIdentifier)) {
        if (!util.types.isState(localIdentifier)) {
          throw path.buildCodeFrameError(`Exported state '${exportedIdentifier.name}' must be declared as a state.`);
        }
        if (!util.types.isState(exportedIdentifier)) {
          throw path.buildCodeFrameError(`State '${localIdentifier.name}' must be exported as a state.`);
        }
      }
    } else {
      exportedNames.add("*");
    }
  }
  path.skip();
};

export default exportNamedDeclaration;
