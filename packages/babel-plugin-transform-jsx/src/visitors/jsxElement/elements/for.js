/**
 * Copyright (c) GeeekyBoy
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import t from "@babel/types";
import * as util from "../../../util/index.js";
import runtimeMethods from "../../../util/constants/runtimeMethods.js";

/**
 * @param {import('@babel/traverse').NodePath<t.JSXElement>} path
 * @param {t.JSXAttribute[]} attrs
 */
const forElement = (path, attrs) => {
  if (attrs.length > 2) {
    throw path.buildCodeFrameError("'For' only accepts the following properties: 'of', 'render'.");
  }
  /** @type {t.Identifier?} */
  let ofIdentifier = null;
  /** @type {t.Function?} */
  let renderFunction = null;
  for (const attr of attrs) {
    const attrName = attr.name.name;
    const attrValue = util.attrs.getValue(attr);
    if (attrName === "of") {
      if (!util.types.isStatefulArray(attrValue)) {
        throw path.buildCodeFrameError("'For' only accepts a stateful array as a value for 'of' property.")
      }
      ofIdentifier = attrValue;
    } else if (attrName === "render") {
      if (!t.isFunction(attrValue)) {
        throw path.buildCodeFrameError("'For' only accepts a function a value for 'render' property.")
      }
      const params = attrValue.params;
      if (params.length > 2) {
        throw path.buildCodeFrameError("'For' only accepts a function with a maximum of two parameters, 'item' and 'index'.");
      }
      if (params.length === 0) {
        throw path.buildCodeFrameError("'For' only accepts a function with a minimum of one parameter, 'item'.");
      }
      renderFunction = attrValue;
    }
  }
  if (renderFunction === null || ofIdentifier === null) {
    const missingAttrs = [];
    if (ofIdentifier === null) missingAttrs.push("'of'");
    if (renderFunction === null) missingAttrs.push("'render'");
    throw path.buildCodeFrameError(`'For' has the following missing properties: ${missingAttrs.join(", ")}.`)
  }
  const callee = t.memberExpression(t.identifier("Mango"), t.identifier(runtimeMethods.createListView));
  const args = [ofIdentifier, renderFunction];
  const callExpression = t.callExpression(callee, args);
  path.replaceWith(callExpression);
}

export default forElement;
