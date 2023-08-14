/**
 * Copyright (c) GeeekyBoy
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import t from "@babel/types";
import * as util from "../util/index.js";

/** @type {import('@babel/traverse').VisitNodeFunction<{}, t.JSXFragment>} */
const jsxFragment = (path) => {
  const children = util.children.normalize(path.node.children, path.scope);
  if (children.length) {
    const childrenArray = t.arrayExpression(children);
    path.replaceWith(childrenArray);
  } else {
    path.remove();
  }
};

export default jsxFragment;
