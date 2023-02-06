/**
 * Copyright (c) GeeekyBoy
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import t from "@babel/types";

/**
 * @param {import('@babel/traverse').NodePath<t.JSXElement>} path
 * @param {t.JSXAttribute[]} attrs
 * @param {t.Expression[]} children
 */
const head = (path, attrs, children) => {
  if (attrs.length) {
    throw path.buildCodeFrameError("Mango head doesn't accept any attributes.");
  }
  const args = [t.arrayExpression(children)];
  const callee = t.memberExpression(t.identifier("Mango"), t.identifier("createHeadElement"));
  const callExpression = t.callExpression(callee, args);
  path.replaceWith(callExpression);
}

export default head;