/**
 * Copyright (c) GeeekyBoy
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { types as t } from "@babel/core";

/**
 * @param {t.JSXAttribute} attr
 * @returns {t.Expression}
 */
const getValue = (attr) => {
  if (t.isJSXExpressionContainer(attr.value) && t.isExpression(attr.value.expression)) {
    return attr.value.expression;
  } else if (t.isExpression(attr.value)) {
    return attr.value;
  } else {
    return t.booleanLiteral(true);
  }
};

/**
 * @param {string} stdAttr
 * @param {"style" | "event" | "prop" | "attr"} attrType
 * @param {t.Expression | t.Statement} attrValue
 * @param {{ [key: string]: ["style" | "event" | "prop" | "attr", t.Expression, boolean] }} foundAttrs
 * @param {boolean} [internal]
 */
const stackValue = (stdAttr, attrType, attrValue, foundAttrs, internal) => {
  if (attrType === "event") {
    if (!foundAttrs[stdAttr]) {
      const handler = t.isExpression(attrValue) && stdAttr === "oncreate"
        ? t.functionExpression(null, [t.identifier("e")], t.blockStatement([t.expressionStatement(t.callExpression(attrValue, [t.identifier("e")])), t.returnStatement(t.identifier("e"))]))
        : !t.isExpression(attrValue)
        ? t.functionExpression(null, [t.identifier("e")], t.blockStatement([attrValue]))
        : internal
        ? t.functionExpression(null, [t.identifier("e")], t.blockStatement([t.expressionStatement(attrValue)]))
        : attrValue;
      foundAttrs[stdAttr] = [attrType, handler, false];
    } else {
      let prevHandler = foundAttrs[stdAttr][1];
      if (!t.isFunctionExpression(foundAttrs[stdAttr][1]) && t.isExpression(prevHandler)) {
        foundAttrs[stdAttr][1] = t.functionExpression(null, [t.identifier("e")], t.blockStatement([t.expressionStatement(t.callExpression(prevHandler, [t.identifier("e")]))]));
      }
      prevHandler = foundAttrs[stdAttr][1];
      if (t.isFunctionExpression(prevHandler)) {
        const handler = t.isExpression(attrValue) && internal
          ? t.expressionStatement(attrValue)
          : t.isExpression(attrValue)
          ? t.expressionStatement(t.callExpression(attrValue, [t.identifier("e")]))
          : attrValue;
        if (stdAttr === "oncreate") {
          prevHandler.body.body.splice(prevHandler.body.body.length - 1, 0, handler);
        } else {
          prevHandler.body.body.push(handler);
        }
      }
    }
  } else if (t.isExpression(attrValue)) {
    if ((attrType === "prop" && stdAttr == "className") || (attrType === "attr" && stdAttr == "class")) {
      if (!foundAttrs[stdAttr]) {
        const safeAttrValue = t.logicalExpression("||", attrValue, t.stringLiteral(""));
        foundAttrs[stdAttr] = [attrType, safeAttrValue, false];
      } else {
        const prevAttrValue = foundAttrs[stdAttr][1];
        const safeAttrValue = t.logicalExpression("||", attrValue, t.stringLiteral(""));
        const paddedValue = t.binaryExpression("+", t.stringLiteral(" "), safeAttrValue);
        foundAttrs[stdAttr][1] = t.binaryExpression("+", prevAttrValue, paddedValue);
      }
    } else if (!foundAttrs[stdAttr]) {
      foundAttrs[stdAttr] = [attrType, attrValue, false];
    } else {
      const prevAttrValue = foundAttrs[stdAttr][1];
      foundAttrs[stdAttr][1] = t.logicalExpression("||", prevAttrValue, attrValue);
    }
  }
};

export { getValue, stackValue };
