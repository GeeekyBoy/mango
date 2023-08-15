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
          if (path.node.extra && path.node.extra.isJSXComponent) {
            return;
          }
          const functionPath = path;
          const functionParams = path.node.params;
          const functionBodyContents = t.isBlockStatement(path.node.body)
            ? path.node.body.body
            : [t.returnStatement(path.node.body)];
          const lastStatement = functionBodyContents[functionBodyContents.length - 1];
          /** @type {t.ReturnStatement[]} */
          const returnStatements = [];
          /** @type {import('@babel/traverse').Visitor} */
          const visitor = {
            ReturnStatement(path) {
              if (path.getFunctionParent() === functionPath) {
                returnStatements.push(path.node);
              }
            }
          }
          path.traverse(visitor);
          const doesReturnJSX = returnStatements.some(x => t.isJSXElement(x.argument));
          if (doesReturnJSX) {
            const doesReturnOthers = returnStatements.some(x => !t.isJSXElement(x.argument));
            if (doesReturnOthers) return;
            if (returnStatements.length > 1 || returnStatements[0] !== lastStatement) return;
            if (functionParams.length) {
              if (functionParams.length > 1) return;
              const propsParam = functionParams[0];
              if (!t.isObjectPattern(propsParam)) return;
              for (const prop of propsParam.properties) {
                if (t.isRestElement(prop)) return;
                const propName = prop.key;
                if (!t.isIdentifier(propName)) return;
                collectedProps.add(propName.name);
              }
            }
            path.node.extra = { isJSXComponent: true };
          }
        }
      }
      path.traverse(initialVisitor);
    },
  },
});
