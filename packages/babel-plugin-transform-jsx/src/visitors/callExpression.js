/**
 * Copyright (c) GeeekyBoy
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import t from "@babel/types";
import * as util from "../util/index.js";

/**
* @param {import('@babel/traverse').NodePath<t.CallExpression>} path
*/
const callExpression = (path) => {
  const callee = path.node.callee;
  const params = path.node.arguments;
  if (t.isIdentifier(callee, { name: "$createEffect" }) || t.isIdentifier(callee, { name: "$createIEffect" })) {
    const firstParam = params[0];
    const secondParam = params[1];
    if (!t.isFunction(firstParam)) {
      throw path.buildCodeFrameError("First parameter of $createEffect must be a function");
    }
    if (secondParam && !t.isArrayExpression(secondParam)) {
      throw path.buildCodeFrameError("Second parameter of $createEffect must be an array of states");
    }
    const effectBody = firstParam.body;
    const deps = secondParam
      ? secondParam.elements.map((element) => {
        if (t.isIdentifier(element) && util.types.isState(element)) {
          return element;
        } else {
          throw path.buildCodeFrameError("Second parameter of $createEffect must be an array of states");
        }
      })
      : util.deps.find(effectBody);
    const depsArrayExpression = t.arrayExpression(deps);
    depsArrayExpression.extra = { isDepsArray: true };
    const effectFunction = t.functionExpression(null, [], t.isBlockStatement(effectBody) ? effectBody : t.blockStatement([t.returnStatement(effectBody)]));
    const effectCallee = t.memberExpression(t.identifier("Mango"), t.identifier("createEffect"));
    /** @type {t.Expression[]} */
    const effectCallArgs = [effectFunction, depsArrayExpression];
    if (t.isIdentifier(callee, { name: "$createIEffect" })) {
      effectCallArgs.push(t.booleanLiteral(true));
    }
    const effectCall = t.callExpression(effectCallee, effectCallArgs);
    path.replaceWith(effectCall);
  } else if (t.isIdentifier(callee, { name: "$destroyEffect" })) {
    const effectCall = t.callExpression(t.memberExpression(t.identifier("Mango"), t.identifier("destroyEffect")), params);
    path.replaceWith(effectCall);
  }
}

export default callExpression;