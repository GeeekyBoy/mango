/**
 * Copyright (c) GeeekyBoy
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { parse } from "@babel/core";
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
      /** @type {{ asset: import("@parcel/types").MutableAsset, dynamic: { type: "ssg" | "ssr" | "remote", path: string, hash: string?, exports: string[] }[], env: NodeJS.ProcessEnv }} */
      // @ts-ignore
      const { asset, dynamic } = state.opts;
      const usagesIdentifier = path.scope.generateUidIdentifier("usages");
      const isDevelopment = !asset.env.shouldOptimize;
      /** @type {t.Function[]} */
      const jsxComponents = [];
      /** @type {string[]} */
      const componentsNames = [];
      /** @type {Set<string>} */
      const exportedNames = new Set();
      /** @type {boolean} */
      let hmrToBeInjected = false;
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
          visitors.importDeclaration(path, asset, dynamic);
        },
        ExportNamedDeclaration(path) {
          visitors.exportNamedDeclaration(path, exportedNames);
        },
        ExportDefaultDeclaration(path) {
          visitors.exportDefaultDeclaration(path, exportedNames);
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
            }
            const isTopLevel = t.isProgram(path.parent) || t.isExportDefaultDeclaration(path.parent);
            const isParentTopLevel = t.isProgram(path.parentPath?.parentPath?.parentPath?.node) || t.isExportDefaultDeclaration(path.parentPath?.parentPath?.parentPath?.node);
            const componentIdentifier =
              t.isFunctionDeclaration(path.node) && isTopLevel ?
              path.node.id :
              t.isVariableDeclarator(path.parent) && t.isIdentifier(path.parent.id) && isParentTopLevel ?
              path.parent.id :
              t.isAssignmentExpression(path.parent) && t.isIdentifier(path.parent.left) && isParentTopLevel ?
              path.parent.left :
              null;
            if (componentIdentifier && !componentsNames.includes(componentIdentifier.name)) {
              jsxComponents.push(path.node);
              componentsNames.push(componentIdentifier.name);
            }
            path.node.extra = { isJSXComponent: true };
            path.scope.crawl();
          }
        }
      }
      path.traverse(initialVisitor);
      if (isDevelopment) {
        for (let i = 0; i < componentsNames.length; i++) {
          const componentName = componentsNames[i];
          if (!exportedNames.has(componentName)) {
            componentsNames.splice(i, 1);
            jsxComponents.splice(i, 1);
            i--;
          }
        }
        if (componentsNames.length) hmrToBeInjected = true;
        for (const exportedName of exportedNames) {
          if (!componentsNames.includes(exportedName)) {
            hmrToBeInjected = false;
            break;
          }
        }
        if (hmrToBeInjected) {
          for (let i = 0; i < jsxComponents.length; i++) {
            const jsxComponent = jsxComponents[i];
            const functionBodyContents = t.isBlockStatement(jsxComponent.body)
              ? jsxComponent.body.body
              : [t.returnStatement(jsxComponent.body)];
            const functionParams = jsxComponent.params;
            const elementCreatorParams = functionParams.length ? [t.identifier("props")] : [];
            const elementCreatorIdentifier = path.scope.generateUidIdentifier();
            const componentIdentifierName = t.stringLiteral(componentsNames[i]);
            const elementCreator = t.functionExpression(elementCreatorIdentifier, elementCreatorParams, t.blockStatement(functionBodyContents));
            elementCreator.extra = { isJSXComponent: true };
            const elementIdentifier = path.scope.generateUidIdentifier();
            const elementCreatorCall = t.callExpression(elementCreator, elementCreatorParams);
            const elementVariable = t.variableDeclarator(elementIdentifier, elementCreatorCall);
            const elementVariableDeclaration = t.variableDeclaration("var", [elementVariable]);
            const elementPusher = t.memberExpression(usagesIdentifier, t.identifier("push"));
            const elementPusherCall = t.callExpression(elementPusher, [t.arrayExpression([elementIdentifier, componentIdentifierName, ...elementCreatorParams])]);
            const elementPusherStatement = t.expressionStatement(elementPusherCall);
            const elementReturnStatement = t.returnStatement(elementIdentifier);
            jsxComponent.body = t.blockStatement([elementVariableDeclaration, elementPusherStatement, elementReturnStatement]);
          }
          const hmrCode = `
          if (module.hot) {
            module.hot.dispose(function (data) {
              data.usages = ${usagesIdentifier.name};
            });
            module.hot.accept(function (getParents) {
              let components = {
                ${componentsNames.map(x => `${x}: ${x}`).join(",")}
              };
              for (const usage of module.hot.data.usages) {
                if (usage[0].parentNode) {
                  const element = components[usage[1]](...usage.slice(2));
                  usage[0].parentNode.replaceChild(element, usage[0]);
                }
              }
            });
          }`;
          const hmrNode = parse(hmrCode, { sourceType: "module" })?.program.body;
          if (hmrNode) {
            const lastImportIndex = path.node.body.findIndex(x => t.isImportDeclaration(x));
            const usagesDeclarator = t.variableDeclarator(usagesIdentifier, t.arrayExpression([]));
            const usagesDeclaration = t.variableDeclaration("var", [usagesDeclarator]);
            path.node.body.splice(lastImportIndex + 1, 0, usagesDeclaration);
            path.node.body.push(...hmrNode);
            path.scope.crawl();
          }
        }
      }
    },
  },
});
