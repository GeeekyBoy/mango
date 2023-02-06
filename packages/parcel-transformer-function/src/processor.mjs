/**
 * Copyright (c) GeeekyBoy
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import t from "@babel/types";

/** @returns {import('@babel/core').PluginObj} */
export default () => ({
  name: "babel-plugin-transform-function",
  visitor: {
    Program(path, state) {
      /** @type {{ asset: import("@parcel/types").MutableAsset }} */
      // @ts-ignore
      const pluginOpts = state.opts;
      const { asset } = pluginOpts;
      /** @type {t.VariableDeclaration[]} */
      const exportedDeclarations = [];
      /** @type {import('@babel/traverse').Visitor} */
      const visitor = {
        ImportDeclaration(path) {
          const importSource = path.node.source.value;
          if (importSource.startsWith(".")) {
            path.node.source.value = asset.addURLDependency("function-util:" + importSource, {});
          }
        },
        ExportNamedDeclaration(path) {
          if (asset.pipeline === "function") {
            if (t.isVariableDeclaration(path.node.declaration)) {
              exportedDeclarations.push(path.node.declaration);
              path.remove();
            }
          }
        },
        ExportDefaultDeclaration(path) {
          if (asset.pipeline === "function") {
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
