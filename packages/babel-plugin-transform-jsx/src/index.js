/**
 * Copyright (c) GeeekyBoy
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import t from "@babel/types";
import * as visitors from "./visitors/index.js";

/** @returns {import('@babel/core').PluginObj} */
export default () => ({
  name: "babel-plugin-transform-jsx",
  manipulateOptions (_, parserOpts) {
    if (parserOpts.plugins.indexOf("jsx") === -1) {
      parserOpts.plugins.push("jsx");
      parserOpts.plugins.push("typescript");
    }
  },
  visitor: {
    Program(path, state) {
      /** @type {{ asset: import("@parcel/types").MutableAsset, env: NodeJS.ProcessEnv }} */
      // @ts-ignore
      const pluginOpts = state.opts;
      const { asset } = pluginOpts;
      /** @type {import('@babel/traverse').Visitor} */
      const initialVisitor = {
        CallExpression(path) {
          visitors.callExpression(path);
        },
        VariableDeclaration(path) {
          visitors.variableDeclaration(path)
        },
        UpdateExpression(path) {
          visitors.updateExpression(path, {});
        },
        AssignmentExpression(path) {
          visitors.assignmentExpression(path, {});
        },
        Identifier(path) {
          visitors.identifier(path);
        }, 
        JSXElement(path) {
          visitors.jsxElement(path, asset);
        },
        JSXFragment(path) {
          visitors.jsxFragment(path, {});
        },
        ImportDeclaration(path) {
          visitors.importDeclaration(path, asset);
        },
        ExportNamedDeclaration(path) {
          visitors.exportNamedDeclaration(path);
        },
        Function(path) {
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
            if (doesReturnOthers) {
              throw path.buildCodeFrameError("Components can not return anything other than one proper JSX root.")
            }
            if (returnStatements.length > 1 || returnStatements[0] !== lastStatement) {
              throw path.buildCodeFrameError("JSX return statement must be the last one in the component.")
            }
            if (functionParams.length) {
              if (functionParams.length > 1) {
                throw path.buildCodeFrameError("Components only takes a destructured props object as a parameter.")
              }
              const propsParam = functionParams[0];
              if (!t.isObjectPattern(propsParam)) {
                throw path.buildCodeFrameError("Components only takes a destructured props object as a parameter.")
              }
              const propsDeclarations = [];
              for (const prop of propsParam.properties) {
                if (t.isRestElement(prop)) {
                  throw path.buildCodeFrameError("Rest element is not allowed when destructuring props object.")
                }
                const propName = prop.key;
                const localPropName = t.isAssignmentPattern(prop.value) ? prop.value.left
                  : t.isIdentifier(prop.value) ? prop.value
                  : prop.key;
                if (!t.isIdentifier(propName)) {
                  throw path.buildCodeFrameError("Only identifiers are allowed as props.")
                }
                if (!t.isIdentifier(localPropName)) {
                  throw path.buildCodeFrameError("Only identifiers are allowed when destructuring props object.")
                }
                const propDefaultValue = t.isAssignmentPattern(prop.value) ? prop.value.right : null;
                const propAccessor = t.memberExpression(t.identifier("props"), t.identifier(propName.name));
                const declaredValue = propDefaultValue ? t.logicalExpression("||", propAccessor, propDefaultValue) : propAccessor;
                const propDeclarator = t.variableDeclarator(localPropName, declaredValue);
                const propDeclaration = t.variableDeclaration("var" , [propDeclarator]);
                propsDeclarations.push(propDeclaration);
                if (propDefaultValue) {
                  const isPropUsedIdentifier = path.scope.generateUidIdentifier();
                  const isPropUsedStatement = t.binaryExpression("!==", propAccessor, t.identifier("undefined"));
                  const isPropUsedDeclarator = t.variableDeclarator(isPropUsedIdentifier, isPropUsedStatement);
                  const isPropUsedDeclaration = t.variableDeclaration("var", [isPropUsedDeclarator]);
                  propsDeclarations.push(isPropUsedDeclaration);
                  propDeclarator.extra = { isPropUsedIdentifierName: isPropUsedIdentifier.name };
                }
                if (propName.name !== "children") {
                  propDeclarator.extra = { ...propDeclarator.extra, isPropDeclarator: true };
                }
              }
              functionBodyContents.unshift(...propsDeclarations);
              functionParams[0] = t.identifier("props");
              path.scope.crawl();
            }
            path.node.extra = { isJSXComponent: true };
          }
        }
      }
      path.traverse(initialVisitor);
    },
  },
});
