/**
 * Copyright (c) GeeekyBoy
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import t from "@babel/types";
import * as util from "../util/index.js";
import runtimeMethods from "../util/constants/runtimeMethods.js";

/** @type {import('@babel/traverse').VisitNodeFunction<{}, t.JSXFragment>} */
const jsxFragment = (path) => {
  const children = util.children.normalize(path.node.children, path.scope);
  if (children.length) {
    const childrenArray = t.arrayExpression(children);
    const callee = t.memberExpression(
      t.identifier("Mango"),
      t.identifier(runtimeMethods.createDynamicView)
    );
    const elementCreator = t.functionExpression(
      null,
      [],
      t.blockStatement([t.returnStatement(childrenArray)])
    );
    const args = [elementCreator];
    const callExpression = t.callExpression(callee, args);
    path.replaceWith(callExpression);
  } else {
    path.remove();
  }
};

export default jsxFragment;