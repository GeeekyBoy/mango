/**
 * Copyright (c) GeeekyBoy
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { types as t } from "@babel/core";
import * as util from "../../../util/index.js";

/**
 * @param {import('@babel/traverse').NodePath<t.JSXElement>} path
 * @param {t.JSXAttribute[]} attrs
 * @param {t.Expression[]} children
 */
const translation = (path, attrs, children) => {
  if (attrs.length > 2) {
    throw path.buildCodeFrameError("'$t' only accepts the following properties: 'id', 'params'.");
  }
  /** @type {t.StringLiteral?} */
  let idLiteral = null;
  /** @type {(t.ObjectExpression | t.Identifier)?} */
  let paramsExpression = t.identifier("undefined");
  for (const attr of attrs) {
    const attrName = attr.name.name;
    const attrValue = util.attrs.getValue(attr);
    if (attrName === "id") {
      if (!t.isStringLiteral(attrValue)) {
        throw path.buildCodeFrameError("'$t' only accepts a string literal as a value for 'id' property.")
      }
      idLiteral = attrValue;
    } else if (attrName === "params") {
      if (!t.isObjectExpression(attrValue)) {
        throw path.buildCodeFrameError("'$t' only accepts an object literal as a value for 'params' property.")
      }
      for (const prop of attrValue.properties) {
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
      paramsExpression = attrValue;
    } else {
      throw path.buildCodeFrameError("'$t' only accepts the following properties: 'id', 'params'.");
    }
  }
  if (!idLiteral) {
    throw path.buildCodeFrameError("'$t' has the following missing properties: 'id'.")
  }
  const args = [idLiteral, paramsExpression, ...children];
  const callee = t.identifier("MANGO_TRANSLATION");
  const callExpression = t.callExpression(callee, args);
  path.replaceWith(callExpression);
}

export default translation;
