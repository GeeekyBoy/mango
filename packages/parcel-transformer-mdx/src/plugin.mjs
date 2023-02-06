/**
 * Copyright (c) GeeekyBoy
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Transformer } from "@parcel/plugin";
import babel from "@babel/core";

export default new Transformer({
  async transform({ asset }) {
    const mdx = await import("@mdx-js/mdx");
    const code = await asset.getCode();
    const compiled = await mdx.compile(code, {
      format: asset.filePath.endsWith(".mdx") ? "mdx" : "md",
      jsx: true,
      jsxRuntime: "classic",
    });
    const { code: finalCompiled } = await babel.transformAsync(compiled, {
      code: true,
      ast: false,
      filename: asset.filePath,
      sourceMaps: false,
      sourceFileName: asset.relativeName,
      comments: false,
      plugins: [await import.meta.resolve("./processor.mjs")],
    });
    asset.type = "js";
    asset.setCode(finalCompiled);
    return [asset];
  },
});
