/**
 * Copyright (c) GeeekyBoy
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Transformer } from "@parcel/plugin";

export default new Transformer({
  async transform({ asset, options }) {
    if (options.mode === "production" && asset.pipeline !== "htmlStyleSheet") {
      asset.bundleBehavior = 'inline';
      asset.meta.inlineType = 'string';
    }
    return [asset];
  },
});
