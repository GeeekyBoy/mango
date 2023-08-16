/**
 * Copyright (c) GeeekyBoy
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { types as t } from "@babel/core";

/** @returns {import('@babel/core').PluginObj} */
export default () => ({
  name: "babel-plugin-transform-mdx",
  manipulateOptions(_, parserOpts) {
    if (parserOpts.plugins.indexOf("jsx") === -1) {
      parserOpts.plugins.push("jsx");
    }
  },
  visitor: {
    ImportDeclaration(path) {
      if (path.node.source.value === "react") {
        path.remove();
      }
    },
    ExportDefaultDeclaration(path) {
      if (t.isIdentifier(path.node.declaration)) {
        path.node.declaration.name = "MarkdownComponent";
      }
    },
    Function(path) {
      const functionName = path.node.id?.name;
      if (functionName === "_createMdxContent") {
        const componentsNames = [];
        const functionBodyContents = t.isBlockStatement(path.node.body)
          ? path.node.body.body
          : [t.returnStatement(path.node.body)];
        const firstStatement = functionBodyContents[0];
        if (t.isVariableDeclaration(firstStatement)) {
          const firstVariable = firstStatement.declarations[0];
          if (t.isIdentifier(firstVariable.id, { name: "_components" })) {
            const components = firstVariable.init.arguments[0];
            if (t.isObjectExpression(components)) {
              for (const property of components.properties) {
                if (t.isObjectProperty(property) && t.isIdentifier(property.key)) {
                  componentsNames.push(property.key.name);
                }
              }
            }
          }
        }
        const newArgument = t.objectPattern(
          componentsNames.map((componentName) =>
            t.objectProperty(
              t.identifier(componentName),
              t.assignmentPattern(
                t.identifier("MD_" + componentName),
                t.functionExpression(
                  null,
                  [t.objectPattern([
                    t.objectProperty(t.identifier("children"), t.identifier("children")),
                    ...(componentName === "code" ? [
                      t.objectProperty(t.identifier("language"), t.identifier("language"))
                    ] : componentName === "a" ? [
                      t.objectProperty(t.identifier("href"), t.identifier("href")),
                      t.objectProperty(t.identifier("target"), t.assignmentPattern(t.identifier("target"), t.stringLiteral("_blank"))),
                    ] : []),
                  ])],
                  t.blockStatement([
                    t.returnStatement(
                      t.jsxElement(
                        t.jsxOpeningElement(t.jsxIdentifier(componentName), [
                          ...(componentName === "code" ? [
                            t.jsxAttribute(t.jsxIdentifier("className"), t.jsxExpressionContainer(
                              t.binaryExpression("+", t.stringLiteral("language-"), t.identifier("language"))
                            ))
                          ] : componentName === "a" ? [
                            t.jsxAttribute(t.jsxIdentifier("href"), t.jsxExpressionContainer(t.identifier("href"))),
                            t.jsxAttribute(t.jsxIdentifier("target"), t.jsxExpressionContainer(t.identifier("target"))),
                          ] : []),
                        ]),
                        t.jsxClosingElement(t.jsxIdentifier(componentName)),
                        [t.jsxExpressionContainer(t.identifier("children"))],
                        true
                      )
                    ),
                  ])
                )
              )
            )
          )
        );
        const lastStatement = functionBodyContents[functionBodyContents.length - 1];
        path.node.body = t.blockStatement([lastStatement]);
        path.node.id.name = "MarkdownComponent";
        path.node.params = [newArgument];
      } else {
        path.remove();
      }
    },
    ObjectPattern(path) {
      path.skip();
    },
    JSXElement(path) {
      const openingElement = path.node.openingElement;
      const closingElement = path.node.closingElement;
      const name = openingElement.name;
      if (t.isJSXMemberExpression(name)) {
        const object = name.object;
        const property = name.property;
        if (t.isJSXIdentifier(object) && object.name === "_components") {
          openingElement.name = t.jsxIdentifier("MD_" + property.name);
          closingElement.name = t.jsxIdentifier("MD_" + property.name);
          if (property.name === "code") {
            const attributes = openingElement.attributes;
            for (const attribute of attributes) {
              if (t.isJSXAttribute(attribute) && t.isJSXIdentifier(attribute.name)) {
                if (attribute.name.name === "className") {
                  if (t.isStringLiteral(attribute.value)) {
                    const className = attribute.value.value;
                    const language = className.replace(/^language-/, "");
                    attribute.name.name = "language";
                    attribute.value.value = language;
                    path.scope.crawl();
                    break;
                  }
                }
              }
            }
          }
        }
      }
    },
    JSXFragment(path) {
      const elementExpression = t.jsxElement(
        t.jsxOpeningElement(t.jsxIdentifier("div"), [], false),
        t.jsxClosingElement(t.jsxIdentifier("div")),
        path.node.children,
        false
      );
      path.replaceWith(elementExpression);
    },
  },
});
