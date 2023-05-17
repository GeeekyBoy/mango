/**
 * Copyright (c) GeeekyBoy
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { traverse } from "@babel/core";
import t from "@babel/types";
import * as typesUtil from "./types.js";

/**
 * @param {t.Expression | t.JSXEmptyExpression} expression
 * @returns {expression is t.Expression}
 */
const shouldHave = (expression) => {
  return !(t.isFunction(expression) || typesUtil.isStringfiable(expression));
};

/**
 * @param {t.Expression | t.BlockStatement} node
 * @param {import('@babel/traverse').Scope} scope
 * @returns {t.Identifier[]}
 */
const find = (node, scope) => {
  /** @type {Set<string>} */
  const deps = new Set();
  /** @type {import('@babel/traverse').Visitor} */
  const visitor = {
    Identifier(path) {
      if (typesUtil.isState(path.node) || typesUtil.isProp(path.node, scope)) {
        const parent = path.parent;
        if (
          (t.isVariableDeclarator(parent) && parent.id === path.node) ||
          (t.isAssignmentExpression(parent) && parent.left === path.node)
        ) {
          return;
        }
        deps.add(path.node.name);
      }
    },
    JSXElement(path) {
      const openingElement = path.node.openingElement;
      const tagNameExpression = openingElement.name;
      if (t.isJSXIdentifier(tagNameExpression)) {
        const tagNameIdentifier = t.identifier(tagNameExpression.name);
        if (typesUtil.isState(tagNameIdentifier) || typesUtil.isProp(tagNameIdentifier, scope)) {
          deps.add(tagNameExpression.name);
        }
      }
      path.skip();
    },
  };
  if (t.isBlockStatement(node)) {
    traverse(t.file(t.program([node])), visitor);
  } else {
    traverse(t.file(t.program([t.expressionStatement(node)])), visitor);
  }
  return Array.from(deps).sort().map((name) => t.identifier(name));
};

export {
  shouldHave,
  find,
};
