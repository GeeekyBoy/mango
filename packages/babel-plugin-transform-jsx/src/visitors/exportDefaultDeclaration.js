/**
 * Copyright (c) GeeekyBoy
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { types as t } from "@babel/core";

/**
 * @param {import('@babel/traverse').NodePath<import("@babel/core").types.ExportDefaultDeclaration>} path
 * @param {Set<string>} exportedNames
 * @param {boolean} isPage
 * @param {{ name: ?string }} pageComponentName
 */
const exportDefaultDeclaration = (path, exportedNames, isPage, pageComponentName) => {
  const declaration = path.node.declaration;
  if (t.isIdentifier(declaration)) {
    if (isPage) {
      pageComponentName.name = declaration.name;
      path.remove();
    } else {
      exportedNames.add(declaration.name);
    }
  } else if (t.isClassDeclaration(declaration)) {
    if (isPage) {
      pageComponentName.name = declaration.id.name;
      path.replaceWith(declaration);
    } else {
      exportedNames.add(declaration.id.name);
    }
  } else if (t.isFunctionDeclaration(declaration)) {
    if (isPage) {
      if (declaration.id) {
        pageComponentName.name = declaration.id.name;
        path.replaceWith(declaration);
      } else {
        declaration.id = path.scope.generateUidIdentifier("page");
        pageComponentName.name = declaration.id.name;
        path.replaceWith(declaration);
      }
    } else if (declaration.id) {
      exportedNames.add(declaration.id.name);
    }
  } else {
    if (isPage && !t.isTSDeclareFunction(declaration)) {
      const variableId = path.scope.generateUidIdentifier("page");
      const variableDeclarator = t.variableDeclarator(variableId, declaration);
      const variableDeclaration = t.variableDeclaration("var", [variableDeclarator]);
      pageComponentName.name = variableId.name;
      path.replaceWith(variableDeclaration);
    } else {
      exportedNames.add("*");
    }
  }
};

export default exportDefaultDeclaration;
