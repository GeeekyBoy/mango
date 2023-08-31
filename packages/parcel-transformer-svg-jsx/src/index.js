/**
 * Copyright (c) GeeekyBoy
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Transformer } from "@parcel/plugin";
import { transform } from "@svgr/core";
import svgoPlugin from "@svgr/plugin-svgo";
import jsxPlugin from "@svgr/plugin-jsx";

export default new Transformer({
  async transform({ asset }) {
    const code = await asset.getCode();
    const compiled = await transform(
      code,
      {
        runtimeConfig: false,
        jsxRuntime: "automatic",
        expandProps: false,
        svgoConfig: {
          plugins: [
            {
              name: 'removeViewBox',
              active: false,
            },
          ],
        },
        template: (variables, { tpl }) => tpl`
        function ${variables.componentName} (${variables.props}) {
          return (${variables.jsx});
        }
        ${variables.exports};
      `,
      },
      {
        caller: {
          name: "@mango-js/parcel-transformer-svg-jsx",
          defaultPlugins: [svgoPlugin, jsxPlugin],
        },
        filePath: asset.filePath,
      },
    );
    asset.type = "js";
    asset.bundleBehavior = null;
    asset.setCode(compiled);
    return [asset];
  },
});
