/**
 * Copyright (c) GeeekyBoy
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Optimizer } from "@parcel/plugin";
import { transform } from "esbuild";

export default new Optimizer({
  async optimize({ contents, bundle }) {
    const { code: newContents } = await transform(contents, {
      loader: "js",
      format: "esm",
      target: "node18",
      minify: bundle.env.shouldOptimize,
    });
    return {
      contents: newContents,
    };
  },
});
