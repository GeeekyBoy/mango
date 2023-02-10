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
      const source = await asset.getCode();
      if (/^.*\.(js|ts|mjs)$/.test(asset.filePath)) {
        let lines = source.split(/\r?\n*^\s*/gm);
        const isMango = lines
          .slice(0, lines.findIndex(line => line[0] && line[0] !== "/" && line[0] !== "*"))
          .some(line => line === "// @mango" || line === "/* @mango */");
        if (!isMango) return [asset];
      }
      const importStatement = "import * as Mango from '@mango-js/runtime';\n";
      const sourceWithImport = importStatement + source;
      const { ast } = await babel.transformAsync(sourceWithImport, {
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
