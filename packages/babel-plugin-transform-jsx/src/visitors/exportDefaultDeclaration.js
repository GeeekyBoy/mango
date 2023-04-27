/**
 * Copyright (c) GeeekyBoy
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import t from "@babel/types";

/**
 * @param {import('@babel/traverse').NodePath<import("@babel/types").ExportDefaultDeclaration>} path
 * @param {Set<string>} exportedNames
 */
const exportDefaultDeclaration = (path, exportedNames) => {
  const declaration = path.node.declaration;
  if (t.isIdentifier(declaration)) {
    exportedNames.add(declaration.name);
  } else if (t.isClassDeclaration(declaration)) {
    exportedNames.add(declaration.id.name);
  } else if (t.isFunctionDeclaration(declaration)) {
    if (declaration.id) {
      exportedNames.add(declaration.id.name);
    }
  } else {
    exportedNames.add("*");
  }
};

export default exportDefaultDeclaration;
