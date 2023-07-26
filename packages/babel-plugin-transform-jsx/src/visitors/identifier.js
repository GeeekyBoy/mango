/**
 * Copyright (c) GeeekyBoy
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import t from "@babel/types";
import * as util from "../util/index.js";
import runtimeMethods from "../util/constants/runtimeMethods.js";

/**
 * @param {import('@babel/traverse').NodePath<t.Identifier>} path
 * @returns
 */
const identifier = (path) => {
  if (!path.parentPath) return;
  if (path.node.extra?.raw) return;
  const isThisState = util.types.isState(path.node);
  const isThisProp = util.types.isProp(path.node, path.scope);
  const identifierName = path.node.name;
  if (isThisState || isThisProp) {
    const isMemberExpressionProperty = t.isMemberExpression(path.parentPath.node) &&
      path.parentPath.node.property === path.node;
    const isBeingDeclared = t.isVariableDeclarator(path.parent) &&
      path.parent.id === path.node;
    const isInDepArray = path.parentPath.node.extra?.isDepsArray;
    const isStateBeingResolved = t.isCallExpression(path.parent) &&
      t.isMemberExpression(path.parent.callee) &&
      t.isIdentifier(path.parent.callee.object, { name: "Mango" }) &&
      t.isIdentifier(path.parent.callee.property, { name: runtimeMethods.getState }) &&
      path.parent.arguments[0] === path.node;
    const isStateBeingSet = t.isCallExpression(path.parent) &&
      t.isMemberExpression(path.parent.callee) &&
      t.isIdentifier(path.parent.callee.object, { name: "Mango" }) &&
      t.isIdentifier(path.parent.callee.property, { name: runtimeMethods.setState }) &&
      path.parent.arguments[0] === path.node;
    const isLabeledStatementLabel = path.parent.type === "LabeledStatement";
    const isArgument = t.isFunction(path.parent) &&
      path.parent.params &&
      path.parent.params.includes(path.node);
    const isObjectTypeProperty = t.isObjectTypeProperty(path.parent);
    const isTsPropertySignature = t.isTSPropertySignature(path.parent);
    const isObjectPropertyKey = t.isObjectProperty(path.parent) && path.parent.key === path.node;
    const shouldBeResolved = !isBeingDeclared &&
      !isLabeledStatementLabel &&
      !isArgument &&
      !isMemberExpressionProperty &&
      !isStateBeingResolved &&
      !isInDepArray &&
      !isStateBeingSet &&
      !isObjectTypeProperty &&
      !isObjectPropertyKey &&
      !isTsPropertySignature;
    if (shouldBeResolved) {
      const stateVar = t.identifier(identifierName);
      const getStateIdentifier = t.memberExpression(t.identifier("Mango"), t.identifier(runtimeMethods.getState));
      const getStateCall = t.callExpression(getStateIdentifier, [stateVar]);
      if (isThisProp) {
        const binding = path.scope.getBinding(path.node.name);
        if (binding) {
          const declarationPath = binding.path;
          const declaration = declarationPath.node;
          const isPropUsedIdentifierName = /** @type {string|null} */ (declaration?.extra?.isPropUsedIdentifierName);
          if (isPropUsedIdentifierName) {
            const fallbackToDefaultExpression = t.conditionalExpression(t.identifier(isPropUsedIdentifierName), getStateCall, stateVar);
            path.replaceWith(fallbackToDefaultExpression);
            path.skip();
          } else {
            path.replaceWith(getStateCall);
          }
        }
      } else {
        path.replaceWith(getStateCall);
      }
    } else if (isInDepArray && isThisProp) {
      const stateVar = t.identifier(identifierName);
      const binding = path.scope.getBinding(path.node.name);
      if (binding) {
        const declarationPath = binding.path;
        const declaration = declarationPath.node;
        const isPropUsedIdentifierName = /** @type {string|null} */ (declaration?.extra?.isPropUsedIdentifierName);
        if (isPropUsedIdentifierName) {
          const fallbackToDefaultExpression = t.conditionalExpression(t.identifier(isPropUsedIdentifierName), stateVar, t.identifier("undefined"));
          path.replaceWith(fallbackToDefaultExpression);
          path.skip();
        }
      }
    }
  }
}

export default identifier;
