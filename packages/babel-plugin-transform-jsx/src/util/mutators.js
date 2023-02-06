/**
 * Copyright (c) GeeekyBoy
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import t from "@babel/types";
import unitlessProps from "./constants/unitlessProps.js";

/**
 * @param {"style" | "event" | "prop" | "attr" | "unknown"} attrType
 * @param {string} attrName
 * @param {t.Expression} attrValue
 * @param {boolean} isBound
 * @returns {t.Statement}
 */
const createStatement = (attrType, attrName, attrValue, isBound) => {
  const propChangerStatement =
    attrType === "style"
      ? t.expressionStatement(
          t.assignmentExpression(
            "=",
            t.memberExpression(
              t.memberExpression(t.identifier("i"), t.identifier("style")),
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
            t.callExpression(t.memberExpression(t.identifier("i"), t.identifier("pause")), [])
          ),
          t.expressionStatement(
            t.callExpression(t.memberExpression(t.identifier("i"), t.identifier("play")), [])
          )
        )
      : attrType === "event" && attrName === "ondestroy"
        ? t.expressionStatement(
            t.assignmentExpression(
              "=",
              t.memberExpression(t.identifier("i"), t.identifier("$c")),
              attrValue
            )
          )
      : attrType === "prop" || attrType === "event"
      ? t.expressionStatement(
          t.assignmentExpression(
            "=",
            t.memberExpression(t.identifier("i"), t.identifier(attrName)),
            attrValue
          )
        )
      : t.expressionStatement(
          t.callExpression(
            t.memberExpression(t.identifier("i"), t.identifier("setAttribute")),
            [t.stringLiteral(attrName), attrValue]
          )
        );
  if (isBound) {
    const elemAccessor = t.identifier("i");
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
 * @param {{ [key: string]: [("style" | "event" | "prop" | "attr" | "unknown"), string, t.Expression, boolean][] }} deps2attrs
 * @returns {t.ArrayExpression[]}
 */
const fromDeps2Attrs = (deps2attrs) => {
  const elementPropsExp = [];
  for (const dep in deps2attrs) {
    const depsIdentifiers = dep.split(",").map(x => t.identifier(x));
    const statements = deps2attrs[dep].map(x => createStatement(...x));
    const mutatorExp = t.functionExpression(null, [t.identifier("i")], t.blockStatement(statements));
    const elementPropExp = t.arrayExpression([mutatorExp, ...depsIdentifiers]);
    elementPropExp.extra = { isDepsArray: true };
    elementPropsExp.push(elementPropExp);
  }
  return elementPropsExp;
}

export { fromDeps2Attrs };
