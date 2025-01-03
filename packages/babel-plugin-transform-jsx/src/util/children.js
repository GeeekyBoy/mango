/**
 * Copyright (c) GeeekyBoy
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { types as t } from "@babel/core";
import * as depsUtil from "./deps.js";
import * as typesUtil from "./types.js";
import runtimeMethods from "./constants/runtimeMethods.js";

/**
 * @param {t.JSXElement["children"]} children
 * @param {import('@babel/traverse').Scope} scope
 * @returns {t.Expression[]}
 */
const normalize = (children, scope) => {
  return /** @type {t.Expression[]} */ (children
    .filter((child, i) => {
      if (t.isJSXText(child)) {
        if (i === 0 || i === children.length - 1) {
          return child.value.trim() !== "";
        } else {
          return true;
        }
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
          if (t.isValidIdentifier(tagNameExpression.name)) {
            const tagNameIdentifier = t.identifier(tagNameExpression.name);
            if (typesUtil.isState(tagNameIdentifier) || typesUtil.isProp(tagNameIdentifier, scope)) {
              child = t.jsxExpressionContainer(child);
            }
          }
        }
      }
      if (t.isJSXText(child)) {
        return t.stringLiteral(child.value.replace(/\s+/g, " "));
      } else if (t.isJSXExpressionContainer(child)) {
        if (depsUtil.shouldHave(child.expression)) {
          const deps = depsUtil.find(child.expression, scope);
          if (deps.length) {
            const depsExpression = t.arrayExpression(deps);
            depsExpression.leadingComments = [{ type: "CommentBlock", value: " DYNAMIC_VIEW_DEPS " }];
            depsExpression.extra = { isDepsArray: true };
            const callee = t.memberExpression(
              t.identifier("Mango"),
              t.identifier(runtimeMethods.createDynamicView)
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
