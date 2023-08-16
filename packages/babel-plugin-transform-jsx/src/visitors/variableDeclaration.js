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
    if ((isState || isStatefulArray) && !wasDeclaredAsProp) {
      const calleeName = isState ? runtimeMethods.createState : runtimeMethods.createStatefulArray;
      const callee = t.memberExpression(t.identifier("Mango"), t.identifier(calleeName));
      const args = t.isExpression(declarator.init) ? [declarator.init] : [t.identifier("undefined")];
      const callExpression = t.callExpression(callee, args);
      declarator.init = callExpression;
    }
  }
}

export default variableDeclaration;
