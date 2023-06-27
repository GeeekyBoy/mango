/**
 * Copyright (c) GeeekyBoy
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import sysPath from "path";
import { builtinModules as builtin } from 'module';
import t from "@babel/types";

/** @returns {import('@babel/core').PluginObj} */
export default () => ({
  name: "babel-plugin-transform-function",
  visitor: {
    Program(path, state) {
      /** @type {{ asset: import("@parcel/types").MutableAsset, nodeDeps: string[] }} */
      // @ts-ignore
      const pluginOpts = state.opts;
      const { asset, nodeDeps } = pluginOpts;
      const isRemoteFunction = sysPath.basename(asset.filePath).endsWith(".remote.js");
      /** @type {t.VariableDeclaration[]} */
      const exportedDeclarations = [];
      /** @type {import('@babel/traverse').Visitor} */
      const visitor = {
        ImportDeclaration(path) {
          const importSource = path.node.source.value;
          if (!builtin.includes(importSource) && !importSource.startsWith("node:")) {
            if (importSource.startsWith(".")) {
              asset.invalidateOnFileChange(sysPath.join(sysPath.dirname(asset.filePath), importSource));
              path.node.source.value = asset.addURLDependency("function-util:" + importSource, {});
            } else if (importSource.startsWith("@")) {
              nodeDeps.push(importSource.split("/").slice(0, 2).join("/"));
            } else {
              nodeDeps.push(importSource.split("/")[0]);
            }
          }
        },
        ExportNamedDeclaration(path) {
          if (asset.pipeline === "function" && !isRemoteFunction) {
            if (t.isVariableDeclaration(path.node.declaration)) {
              exportedDeclarations.push(path.node.declaration);
              path.remove();
            }
          }
        },
        ExportDefaultDeclaration(path) {
          if (asset.pipeline === "function" && !isRemoteFunction) {
            if (t.isArrowFunctionExpression(path.node.declaration)) {
              if (t.isBlockStatement(path.node.declaration.body)) {
                path.node.declaration.body.body.unshift(...exportedDeclarations);
              } else {
                path.node.declaration.body = t.blockStatement([...exportedDeclarations, t.returnStatement(path.node.declaration.body)]);
              }
            } else if (t.isFunctionDeclaration(path.node.declaration)) {
              path.node.declaration.body.body.unshift(...exportedDeclarations);
            } else {
              throw path.buildCodeFrameError("Only arrow functions and function declarations can be exported as default in server functions.");
            }
            path.scope.crawl();
          }
        },
      };
      path.traverse(visitor);
    },
  },
});