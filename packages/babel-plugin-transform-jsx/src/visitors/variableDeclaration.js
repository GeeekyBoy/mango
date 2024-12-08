/**
 * Copyright (c) GeeekyBoy
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { types as t } from "@babel/core";
import * as util from "../util/index.js";
import runtimeMethods from "../util/constants/runtimeMethods.js";

/**
 * @param {import('@babel/traverse').NodePath<t.VariableDeclaration>} path
 */
const variableDeclaration = (path) => {
  const declarators = path.node.declarations;
  for (let declaratorIdx = 0; declaratorIdx < declarators.length; declaratorIdx++) {
    const declarator = declarators[declaratorIdx];
    const declaratorId = declarator.id;
    const isState = util.types.isState(declaratorId);
    const isStatefulArray = util.types.isStatefulArray(declaratorId);
    const wasDeclaredAsProp = declarator.extra?.isPropDeclarator;
    if (isState && !wasDeclaredAsProp) {
      const calleeName = runtimeMethods.createState;
      const callee = t.memberExpression(t.identifier("Mango"), t.identifier(calleeName));
      const args = t.isExpression(declarator.init) ? [declarator.init] : [t.identifier("undefined")];
      const callExpression = t.callExpression(callee, args);
      declarator.init = callExpression;
    } else if (isStatefulArray && !wasDeclaredAsProp) {
      const calleeName = runtimeMethods.createStatefulArray;
      const callee = t.memberExpression(t.identifier("Mango"), t.identifier(calleeName));
      /** @type {t.Expression[]} */
      let args;
      if (
        t.isCallExpression(declarator.init) &&
        t.isIdentifier(declarator.init.callee) &&
        declarator.init.callee.name === "$keyedArray"
      ) {
        const keyedArrayBuilderArgs = declarator.init.arguments;
        if (keyedArrayBuilderArgs.length !== 2) {
          throw path.buildCodeFrameError("Keyed stateful array builder can only accept two arguments.");
        }
        args = /** @type {t.Expression[]} */ (keyedArrayBuilderArgs);
      } else {
        args = t.isExpression(declarator.init) ? [declarator.init] : [t.identifier("undefined")];
      }
      const callExpression = t.callExpression(callee, args);
      declarator.init = callExpression;
    }
  }
}

export default variableDeclaration;
