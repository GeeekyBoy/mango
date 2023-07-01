/**
 * Copyright (c) GeeekyBoy
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import t from "@babel/types";

/** @returns {import('@babel/core').PluginObj} */
export default () => ({
  name: "babel-plugin-transform-dynamic",
  manipulateOptions (_, parserOpts) {
    if (parserOpts.plugins.indexOf("typescript") === -1) {
      parserOpts.plugins.push("typescript");
    }
  },
  visitor: {
    // We need to inject code directly after the last import statement
    Program(path, state) {
      /** @type {{ dynamicContent: { [key: string]: any } }} */
      // @ts-ignore
      const pluginOpts = state.opts;
      const { dynamicContent } = pluginOpts;
      let lastImportIndex = -1;
      for (let i = 0; i < path.node.body.length; i++) {
        if (t.isImportDeclaration(path.node.body[i])) {
          lastImportIndex = i;
        }
      }
      for (const [name, value] of Object.entries(dynamicContent)) {
        const nameIdentifier = t.identifier(name);
        const declaration = t.variableDeclaration("var", [t.variableDeclarator(nameIdentifier, value)]);
        path.node.body.splice(lastImportIndex + 1, 0, declaration);
      }
    }
  },
});
