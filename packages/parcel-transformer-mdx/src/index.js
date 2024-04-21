/**
 * Copyright (c) GeeekyBoy
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Transformer } from "@parcel/plugin";
import { transformAsync } from "@babel/core";

export default new Transformer({
  async transform({ asset }) {
    const mdx = await import("@mdx-js/mdx");
    const code = await asset.getCode();
    const compiled = await mdx.compile(code, {
      format: asset.filePath.endsWith(".mdx") ? "mdx" : "md",
      jsx: true,
      jsxRuntime: "automatic",
    });
    const { ast } = await transformAsync(compiled, {
      code: false,
      ast: true,
      filename: asset.filePath,
      sourceMaps: false,
      sourceFileName: asset.relativeName,
      comments: true,
      plugins: [await import.meta.resolve("./processor.js")],
    });
    asset.type = "jsx";
    asset.setAST({
      type: 'babel',
      version: '^7.0.0',
      program: ast,
    })
    return [asset];
  },
});
