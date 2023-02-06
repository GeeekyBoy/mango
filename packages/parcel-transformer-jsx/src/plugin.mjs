/**
 * Copyright (c) GeeekyBoy
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Transformer } from "@parcel/plugin";
import babel from "@babel/core";

export default new Transformer({
  async transform({ asset, options: { env } }) {
    if (/^.*\.(jsx|tsx|js|ts|mdx|mjs|svg)$/.test(asset.filePath)) {
      if (asset.filePath.includes("@parcel")) return [asset];
      const importStatement = "import * as Mango from '@mango-js/runtime';\n";
      const source = importStatement + await asset.getCode();
      const { ast } = await babel.transformAsync(source, {
        code: false,
        ast: true,
        filename: asset.filePath,
        sourceMaps: false,
        sourceFileName: asset.relativeName,
        plugins: [
          [await import.meta.resolve("@mango-js/babel-plugin-transform-jsx"), { asset, env }],
        ],
      });
      asset.setAST({
        type: 'babel',
        version: '7.0.0',
        program: ast,
      })
      asset.type = /^.*\.(tsx|ts)$/.test(asset.filePath) ? "ts" : "js";
    }
    return [asset];
  }
});
