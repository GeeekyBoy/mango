/**
 * Copyright (c) GeeekyBoy
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import * as elements from "./elements/index.js";
import t from "@babel/types";
import * as util from "../../util/index.js";

/**
 * @param {import('@babel/traverse').NodePath<t.JSXElement>} path
 * @param {import("@parcel/types").MutableAsset} asset
 */
const jsxElement = (path, asset) => {
  const openingElement = path.node.openingElement;
  const tagNameExpression = openingElement.name;
  if (t.isJSXNamespacedName(tagNameExpression)) {
    throw path.buildCodeFrameError("Namespaced names are not supported.");
  }
  if (openingElement.attributes.some((attr) => t.isJSXSpreadAttribute(attr))) {
    throw path.buildCodeFrameError("Spread attributes are not supported yet.");
  }
  const attrs = /** @type {t.JSXAttribute[]} */ (openingElement.attributes.filter((x) => t.isJSXAttribute(x)));
  const children = util.children.normalize(path.node.children, path.scope);
  const isNativeElement = t.isJSXIdentifier(tagNameExpression) &&
    tagNameExpression.name[0] === tagNameExpression.name[0].toLowerCase() && !(
      util.types.isState(t.identifier(tagNameExpression.name)) ||
      tagNameExpression.name === "for" ||
      tagNameExpression.name === "lazy" ||
      tagNameExpression.name === "children"
    );
  const isHead = isNativeElement && tagNameExpression.name === "head";
  const isFor = t.isJSXIdentifier(tagNameExpression, { name: "for" });
  if (isHead) {
    elements.head(path, attrs, children);
  } else if (isNativeElement) {
    elements.native(path, tagNameExpression.name, attrs, children);
  } else if (isFor) {
    elements.for(path, attrs);
  } else {
    elements.custom(path, tagNameExpression, attrs, children, asset);
  }
}

export default jsxElement;
