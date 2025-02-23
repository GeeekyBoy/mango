/**
 * Copyright (c) GeeekyBoy
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import sysPath from "path";
import { builtinModules as builtin } from 'module';
import { types as t } from "@babel/core";

/** @returns {import('@babel/core').PluginObj} */
export default () => ({
  name: "babel-plugin-transform-function",
  visitor: {
    Program(path, state) {
      /** @type {{ asset: import("@parcel/types").MutableAsset, nodeDeps: string[], bareImports: string[], projectRoot: string, tildePath: string }} */
      const pluginOpts = state.opts;
      const { asset, nodeDeps, bareImports, projectRoot, tildePath } = pluginOpts;
      /** @type {{ [key: string]: string }} */
      const inlineContent = {};
      const isRemoteFunction = sysPath.basename(asset.filePath).endsWith(".remote.js");
      /** @type {import('@babel/traverse').Visitor} */
      const visitor = {
        ImportDeclaration(path) {
          const importSource = path.node.source.value;
          if (builtin.includes(importSource)) {
            path.node.source.value = "node:" + importSource;
          } else if (!importSource.startsWith("node:")) {
            if (importSource.startsWith("url:") || importSource.startsWith("data-url:") || importSource.startsWith("bundle-text:")) {
              const specifiers = path.node.specifiers;
              if (specifiers.length !== 1 || !t.isImportDefaultSpecifier(specifiers[0])) {
                throw path.buildCodeFrameError("Only default imports are supported for assets.");
              }
              const name = specifiers[0].local.name;
              const isDevelopment = !asset.env.shouldOptimize;
              const isUrl = importSource.startsWith("url:");
              inlineContent[name] = asset.addURLDependency(importSource + "?functionAsset");
              if (isDevelopment && isUrl) {
                const relUrl = importSource.split(":")[1].split("?")[0];
                if (relUrl.startsWith(".")) {
                  inlineContent[name] = sysPath.posix.join(sysPath.dirname(asset.filePath).split(sysPath.sep).join(sysPath.posix.sep), relUrl);
                } else if (relUrl.startsWith("~/")) {
                  inlineContent[name] = sysPath.posix.join(tildePath.split(sysPath.sep).join(sysPath.posix.sep), relUrl.slice(2));
                } else if (relUrl.startsWith("/")) {
                  inlineContent[name] = sysPath.posix.join(projectRoot.split(sysPath.sep).join(sysPath.posix.sep), relUrl.slice(1));
                } else {
                  inlineContent[name] = sysPath.posix.join(tildePath.split(sysPath.sep).join(sysPath.posix.sep), relUrl);
                }
              }
              path.remove();
            } else if (importSource.startsWith(".") || importSource.startsWith("~/") || importSource.startsWith("/")) {
              path.node.source.value = asset.addURLDependency("function-util:" + importSource, {});
            } else if (importSource.startsWith("@")) {
              nodeDeps.push(importSource.split("/").slice(0, 2).join("/"));
              bareImports.push(importSource);
            } else {
              nodeDeps.push(importSource.split("/")[0]);
              bareImports.push(importSource);
            }
          }
        },
        ExportNamedDeclaration(path) {
          if (asset.pipeline === "function" && !isRemoteFunction) {
            if (t.isVariableDeclaration(path.node.declaration)) {
              path.replaceWith(path.node.declaration);
            }
          }
        },
        ExportDefaultDeclaration(path) {
          if (asset.pipeline === "function" && !isRemoteFunction) {
            if (!t.isArrowFunctionExpression(path.node.declaration) && !t.isFunctionDeclaration(path.node.declaration)) {
              throw path.buildCodeFrameError("Only arrow functions and function declarations can be exported as default in server functions.");
            }
          }
        },
      };
      path.traverse(visitor);
      let lastImportIndex = -1;
      for (let i = 0; i < path.node.body.length; i++) {
        if (t.isImportDeclaration(path.node.body[i])) {
          lastImportIndex = i;
        }
      }
      for (const [name, hash] of Object.entries(inlineContent)) {
        const nameIdentifier = t.identifier(name);
        const hashStringLiteral = t.stringLiteral(hash);
        const declaration = t.variableDeclaration("var", [t.variableDeclarator(nameIdentifier, hashStringLiteral)]);
        path.node.body.splice(lastImportIndex + 1, 0, declaration);
      }
    },
  },
});
