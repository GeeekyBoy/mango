/**
 * Copyright (c) GeeekyBoy
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { types as t } from "@babel/core";
import unitlessProps from "./constants/unitlessProps.js";

/**
 * @param {"style" | "event" | "prop" | "attr"} attrType
 * @param {string} attrName
 * @param {t.Expression} attrValue
 * @param {boolean} isBound
 * @param {t.Identifier} instanceIdentifier
 * @returns {t.Statement}
 */
const createStatement = (attrType, attrName, attrValue, isBound, instanceIdentifier) => {
  const propChangerStatement =
    attrType === "style"
      ? t.expressionStatement(
          t.assignmentExpression(
            "=",
            t.memberExpression(
              t.memberExpression(instanceIdentifier, t.identifier("style")),
              t.identifier(attrName)
            ),
            t.isNumericLiteral(attrValue) && !unitlessProps.includes(attrName)
              ? t.stringLiteral(attrValue.value + "px")
              : attrValue
          )
        )
      : attrType === "prop" && attrName === "paused"
      ? t.ifStatement(
          attrValue,
          t.expressionStatement(
            t.callExpression(t.memberExpression(instanceIdentifier, t.identifier("pause")), [])
          ),
          t.expressionStatement(
            t.callExpression(t.memberExpression(instanceIdentifier, t.identifier("play")), [])
          )
        )
      : attrType === "event" && attrName === "ondestroy"
        ? t.expressionStatement(
            t.assignmentExpression(
              "=",
              t.memberExpression(instanceIdentifier, t.identifier("$c")),
              attrValue
            )
          )
      : attrType === "prop" || attrType === "event"
      ? t.expressionStatement(
          t.assignmentExpression(
            "=",
            t.memberExpression(instanceIdentifier, t.identifier(attrName)),
            attrValue
          )
        )
      : t.expressionStatement(
          t.callExpression(
            t.memberExpression(instanceIdentifier, t.identifier("setAttribute")),
            [t.stringLiteral(attrName), attrValue]
          )
        );
  if (isBound) {
    const elemAccessor = instanceIdentifier;
    const recentUpdateAccessor = t.memberExpression(elemAccessor, t.identifier("$ru"));
    const propNameLiteral = t.stringLiteral(attrName);
    const donotMutateCondition = t.binaryExpression("===", recentUpdateAccessor, propNameLiteral)
    const recentUpdateNullifier = t.assignmentExpression("=", recentUpdateAccessor, t.nullLiteral());
    return t.ifStatement(donotMutateCondition, t.expressionStatement(recentUpdateNullifier), propChangerStatement);
  } else {
    return propChangerStatement;
  }
};

/**
 * @param {{ [key: string]: [("style" | "event" | "prop" | "attr"), string, t.Expression, boolean][] }} deps2attrs
 * @param {import('@babel/traverse').Scope} scope
 * @returns {t.ArrayExpression[]}
 */
const fromDeps2Attrs = (deps2attrs, scope) => {
  const elementPropsExp = [];
  const instanceIdentifier = scope.hasBinding("i")
    ? scope.generateUidIdentifier("i")
    : t.identifier("i");
  for (const dep in deps2attrs) {
    const depsIdentifiers = dep.split(",").map(x => t.identifier(x));
    const statements = deps2attrs[dep].map(x => createStatement(...x, instanceIdentifier));
    const mutatorExp = t.functionExpression(null, [instanceIdentifier], t.blockStatement(statements));
    const elementPropExp = t.arrayExpression([mutatorExp, ...depsIdentifiers]);
    elementPropExp.leadingComments = [{ type: "CommentBlock", value: " DYNAMIC_ATTRS " }];
    elementPropExp.extra = { isDepsArray: true };
    elementPropsExp.push(elementPropExp);
  }
  return elementPropsExp;
}

export { fromDeps2Attrs };
