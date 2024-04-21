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
        if (t.isIdentifier(element) && (util.types.isState(element) || util.types.isProp(element, path.scope))) {
          return element;
        } else {
          throw path.buildCodeFrameError("Second parameter of $createEffect must be an array of states");
        }
      })
      : util.deps.find(effectBody, path.scope);
    const depsArrayExpression = t.arrayExpression(deps);
    if (callee.name === "$createEffect") {
      depsArrayExpression.leadingComments = [{ type: "CommentBlock", value: " EFFECT_DEPS " }];
    } else {
      depsArrayExpression.leadingComments = [{ type: "CommentBlock", value: " IMMEDIATE_EFFECT_DEPS " }];
    }
    depsArrayExpression.extra = { isDepsArray: true };
    const effectFunction = t.functionExpression(null, [], t.isBlockStatement(effectBody) ? effectBody : t.blockStatement([t.returnStatement(effectBody)]), firstParam.generator, firstParam.async);
    const effectCallee = t.memberExpression(t.identifier("Mango"), t.identifier(runtimeMethods.createEffect));
    /** @type {t.Expression[]} */
    const effectCallArgs = [effectFunction, depsArrayExpression];
    if (t.isIdentifier(callee, { name: "$createIEffect" })) {
      effectCallArgs.push(t.booleanLiteral(true));
    }
    const effectCall = t.callExpression(effectCallee, effectCallArgs);
    path.replaceWith(effectCall);
  } else if (t.isIdentifier(callee, { name: "$destroyEffect" })) {
    const destroyEffectCall = t.callExpression(t.memberExpression(t.identifier("Mango"), t.identifier(runtimeMethods.destroyEffect)), params);
    path.replaceWith(destroyEffectCall);
  } else if (t.isIdentifier(callee, { name: "$t" })) {
    if (!t.isStringLiteral(params[0])) {
      throw path.buildCodeFrameError("Translation id must be a string literal");
    }
    if (params[1]) {
      if (!t.isObjectExpression(params[1])) {
        throw path.buildCodeFrameError("Translation params must be an object literal");
      }
      for (const prop of params[1].properties) {
        if (t.isObjectMethod(prop)) {
          throw path.buildCodeFrameError("Translation parameters cannot be methods.");
        } else if (t.isSpreadElement(prop)) {
          throw path.buildCodeFrameError("Translation parameters cannot be spread elements.");
        } else if (!t.isStringLiteral(prop.key) && !t.isIdentifier(prop.key)) {
          throw path.buildCodeFrameError("Translation parameters cannot be computed properties.");
        } else if (!t.isExpression(prop.value)) {
          throw path.buildCodeFrameError("Translation parameters values must be expressions.");
        }
      }
    }
    const translationCall = t.callExpression(t.identifier("MANGO_TRANSLATION"), params);
    path.replaceWith(translationCall);
  }
}

export default callExpression;
