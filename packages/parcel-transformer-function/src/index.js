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
    const code = await asset.getCode();
    const nodeDeps = [];
    const { code: finalCompiled } = await babel.transformAsync(code, {
      code: true,
      ast: false,
      filename: asset.filePath,
      sourceMaps: false,
      sourceFileName: asset.relativeName,
      comments: false,
      plugins: [
        [await import.meta.resolve("./processor.js"), { asset, nodeDeps }],
      ]
    });
    asset.bundleBehavior = "isolated";
    asset.meta.nodeDeps = nodeDeps;
    asset.setCode(finalCompiled);
    return [asset];
  },
});
