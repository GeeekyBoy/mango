/**
 * Copyright (c) GeeekyBoy
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/** @returns {import('@babel/core').PluginObj} */
export default () => ({
  name: "babel-plugin-transform-function-resolutions",
  visitor: {
    Program(path, state) {
      /** @type {{ bareImportsResolutions: { [key: string]: string } }} */
      const pluginOpts = state.opts;
      const { bareImportsResolutions } = pluginOpts;
      /** @type {import('@babel/traverse').Visitor} */
      const visitor = {
        ImportDeclaration(path) {
          const importSource = path.node.source.value;
          if (bareImportsResolutions[importSource]) {
            path.node.source.value = bareImportsResolutions[importSource];
          }
        },
      };
      path.traverse(visitor);
    },
  },
});
