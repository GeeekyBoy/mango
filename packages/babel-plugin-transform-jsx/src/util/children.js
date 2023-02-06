/**
 * Copyright (c) GeeekyBoy
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import t from "@babel/types";
import * as depsUtil from "./deps.js";
import * as typesUtil from "./types.js";

/**
 * @param {t.JSXElement["children"]} children
 * @param {import('@babel/traverse').Scope} scope
 * @returns {t.Expression[]}
 */
const normalize = (children, scope) => {
  return /** @type {t.Expression[]} */ (children
    .filter((child) => {
      if (t.isJSXText(child)) {
        return child.value.trim() !== "";
      } else if (t.isJSXExpressionContainer(child)) {
        return t.isExpression(child.expression);
      } else {
        return true;
      }
    })
    .map((child) => {
      if (t.isJSXElement(child)) {
        const openingElement = child.openingElement;
        const tagNameExpression = openingElement.name;
        if (t.isJSXIdentifier(tagNameExpression)) {
          const tagNameIdentifier = t.identifier(tagNameExpression.name);
          if (typesUtil.isState(tagNameIdentifier) || typesUtil.isProp(tagNameIdentifier, scope)) {
            child = t.jsxExpressionContainer(child);
          }
        }
      }
      if (t.isJSXText(child)) {
        return t.stringLiteral(child.value.replace(/\s+/g, " "));
      } else if (t.isJSXExpressionContainer(child)) {
        if (depsUtil.shouldHave(child.expression)) {
          const deps = depsUtil.find(child.expression);
          if (deps.length) {
            const depsExpression = t.arrayExpression(deps);
            depsExpression.extra = { isDepsArray: true };
            const callee = t.memberExpression(
              t.identifier("Mango"),
              t.identifier("createDynamicView")
            );
            const elementCreator = t.functionExpression(
              null,
              [],
              t.blockStatement([t.returnStatement(child.expression)])
            );
            const args = deps.length ? [elementCreator, depsExpression] : [elementCreator];
            const callExpression = t.callExpression(callee, args);
            return callExpression;
          } else {
            return child.expression;
          }
        } else {
          return child.expression;
        }
      } else {
        return child;
      }
    }));
};

export { normalize }