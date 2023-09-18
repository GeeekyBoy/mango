/**
 * Copyright (c) GeeekyBoy
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { types as t } from "@babel/core";

/**
 * @param {t.Node} node
 * @returns {node is t.Identifier & boolean}
 */
 const isState = (node) => {
  return t.isIdentifier(node) &&
    node.name !== "$createEffect" &&
    node.name !== "$createIEffect" &&
    node.name !== "$destroyEffect" &&
    node.name !== "$t" &&
    node.name.startsWith("$") &&
    !node.name.startsWith("$$") &&
    node.name.length > 1;
}

/**
 * @param {t.Node} node
 * @returns {node is t.Identifier & boolean}
 */
const isStatefulArray = (node) => {
  return t.isIdentifier(node) &&
    node.name.startsWith("$$") &&
    node.name.length > 2;
}

/**
 * @param {t.Node} node
 * @param {import('@babel/traverse').Scope} scope
 * @returns {node is t.Identifier & boolean}
 */
const isProp = (node, scope) => {
  if (!t.isIdentifier(node)) {
    return false;
  }
  const binding = scope.getBinding(node.name);
  if (!binding) {
    return false;
  }
  const declarationPath = binding.path;
  const declaration = declarationPath.node;
  if (declaration?.extra?.isPropDeclarator) {
    return true;
  }
  return false;
}

/**
 * @param {t.Node} node
 * @returns {node is t.Identifier & boolean}
 */
const isDefaultProp = (node) => {
  return t.isIdentifier(node) &&
    node.name.startsWith("__") &&
    node.name.length > 2;
}

/**
 * @param {t.Node} node
 * @returns {node is (t.StringLiteral | t.NumericLiteral | t.BigIntLiteral | t.DecimalLiteral | t.BooleanLiteral)}
 */
const isStringfiable = (node) => {
  return t.isStringLiteral(node) ||
    t.isNumericLiteral(node) ||
    t.isBigIntLiteral(node) ||
    t.isDecimalLiteral(node) ||
    t.isBooleanLiteral(node);
}

export {
  isState,
  isStatefulArray,
  isProp,
  isDefaultProp,
  isStringfiable,
};
