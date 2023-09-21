/**
 * Copyright (c) GeeekyBoy
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { types as t } from "@babel/core";

/** @returns {import('@babel/core').PluginObj} */
export default () => ({
  name: "babel-plugin-transform-props-collector",
  manipulateOptions (_, parserOpts) {
    if (parserOpts.plugins.indexOf("jsx") === -1) {
      parserOpts.plugins.push("jsx");
      parserOpts.plugins.push("typescript");
    }
  },
  visitor: {
    Program(path, state) {
      /** @type {{ collectedProps: Set<string> }} */
      const { collectedProps } = state.opts;
      /** @type {import('@babel/traverse').Visitor} */
      const initialVisitor = {
        JSXElement(path) {
          const openingElement = path.node.openingElement;
          const tagNameExpression = openingElement.name;
          if (t.isJSXNamespacedName(tagNameExpression)) return;
          if (openingElement.attributes.some((attr) => t.isJSXSpreadAttribute(attr))) return;
          const attrs = /** @type {t.JSXAttribute[]} */ (openingElement.attributes);
          const children = path.node.children;
          if (children.length) collectedProps.add("children");
          const isCustomElement = t.isJSXIdentifier(tagNameExpression) && (
            (tagNameExpression.name.startsWith("$") && !tagNameExpression.name.startsWith("$$") && tagNameExpression.name.length > 1) ||
            tagNameExpression.name[0] === tagNameExpression.name[0].toUpperCase() ||
            tagNameExpression.name === "lazy" ||
            tagNameExpression.name === "children"
          );
          if (isCustomElement) {
            for (const attr of attrs) {
              if (t.isJSXNamespacedName(attr.name)) {
                const directiveName = attr.name.namespace.name;
                const propName = attr.name.name.name;
                if (directiveName === "bind") {
                  if (propName === "this") {
                    collectedProps.add(propName);
                  }
                }
              } else {
                const propName = attr.name.name;
                collectedProps.add(propName);
              }
            }
          }
        },
        Function(path) {
          if (path.node.extra?.isJSXComponentWithProps) {
            return;
          }
          const functionParams = path.node.params;
          const componentName =
            t.isFunctionDeclaration(path.node) && t.isIdentifier(path.node.id) && path.node.id.name[0] === path.node.id.name[0].toUpperCase()
            ? path.node.id.name
            : t.isVariableDeclarator(path.parent) && t.isIdentifier(path.parent.id) && path.parent.id.name[0] === path.parent.id.name[0].toUpperCase()
            ? path.parent.id.name
            : t.isAssignmentExpression(path.parent) && t.isIdentifier(path.parent.left) && path.parent.left.name[0] === path.parent.left.name[0].toUpperCase()
            ? path.parent.left.name
            : null;
          const hasComponentProps = functionParams.length > 0 && (
            componentName || (functionParams[0].leadingComments?.[0]?.type === "CommentBlock" && functionParams[0].leadingComments[0].value.trim() === "@ComponentProps")
          );
          if (hasComponentProps) {
            const propsParam = functionParams[0];
            if (!t.isObjectPattern(propsParam)) return;
            for (const prop of propsParam.properties) {
              if (t.isRestElement(prop)) return;
              const propName = prop.key;
              if (!t.isIdentifier(propName)) return;
              collectedProps.add(propName.name);
            }
          }
          path.node.extra = { isJSXComponentWithProps: true };
        }
      }
      path.traverse(initialVisitor);
    },
  },
});
