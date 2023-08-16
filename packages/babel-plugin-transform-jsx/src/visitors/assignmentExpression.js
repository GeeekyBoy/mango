/**
 * Copyright (c) GeeekyBoy
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { types as t } from "@babel/core";
import * as util from "../util/index.js";
import runtimeMethods from "../util/constants/runtimeMethods.js";

/** @type {import('@babel/traverse').VisitNodeFunction<{}, t.AssignmentExpression>} */
const assignmentExpression = (path) => {
  const leftSide = path.node.left;
  /** @type {t.Expression | null} */
  const binder = /** @type {t.Expression | null} */ (path.node.extra?.binder);
  if (t.isIdentifier(leftSide)) {
    if (util.types.isStatefulArray(leftSide)) {
      const stateVar = t.identifier(leftSide.name);
      const stateValue = path.node.right;
      const setStateCall = t.callExpression(
        t.memberExpression(t.identifier("Mango"), t.identifier(runtimeMethods.updateStatefulArray)),
        [stateVar, stateValue]
      );
      path.replaceWith(setStateCall);
    } else if (util.types.isState(leftSide)) {
      const stateVar = t.identifier(leftSide.name);
      const operator = path.node.operator.length > 1 ? path.node.operator.slice(0, -1) : path.node.operator;
      if (operator === "=") {
        const stateValue = path.node.right;
        const setStateCall = t.callExpression(
          t.memberExpression(t.identifier("Mango"), t.identifier(runtimeMethods.setState)),
          binder ? [stateVar, stateValue, binder] : [stateVar, stateValue]
        );
        path.replaceWith(setStateCall);
      } else if (
        operator === "+" || operator === "-" || operator === "*" ||
        operator === "/" || operator === "%" || operator === "<<" ||
        operator === ">>" || operator === ">>>" || operator === "|" ||
        operator === "^" || operator === "&" || operator === "**"
      ) {
        const stateValue = t.binaryExpression(operator, stateVar, path.node.right);
        const setStateCall = t.callExpression(
          t.memberExpression(t.identifier("Mango"), t.identifier(runtimeMethods.setState)),
          binder ? [stateVar, stateValue, binder] : [stateVar, stateValue]
        );
        path.replaceWith(setStateCall);
      }
    } else if (util.types.isProp(leftSide, path.scope)) {
      throw path.buildCodeFrameError("Component one-way props can't be changed from inside the component.");
    }
  }
}

export default assignmentExpression;
