/**
 * Copyright (c) GeeekyBoy
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import t from "@babel/types";
import * as util from "../util/index.js";

/** @type {import('@babel/traverse').VisitNodeFunction<{}, t.UpdateExpression>} */
const updateExpression = (path) => {
  const expression = path.node.argument;
  if (util.types.isState(expression)) {
    if (path.node.operator === "++" || path.node.operator === "--") {
      const binaryOperator = path.node.operator === "++" ? "+" : "-";
      const binaryExpression = t.binaryExpression(binaryOperator, expression, t.numericLiteral(1));
      const assignmentExpression = t.assignmentExpression("=", expression, binaryExpression);
      if (path.node.prefix) {
        const tempIdentifier = t.identifier("temp");
        const tempAssignmentExpression = t.assignmentExpression("=", tempIdentifier, expression);
        const sequenceExpression = t.sequenceExpression([tempAssignmentExpression, assignmentExpression, tempIdentifier]);
        path.replaceWith(sequenceExpression);
      } else {
        path.replaceWith(assignmentExpression);
      }
    }
  } else if (util.types.isProp(expression, path.scope)) {
    throw path.buildCodeFrameError(`Property "${expression.name}" is read-only.`);
  } else if (util.types.isStatefulArray(expression)) {
    throw path.buildCodeFrameError(`Stateful array "${expression.name}" can be only modified with assignment operator.`);
  }
};

export default updateExpression;
