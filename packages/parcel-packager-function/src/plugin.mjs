/**
 * Copyright (c) GeeekyBoy
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Packager } from "@parcel/plugin";
import parcelUtils from "@parcel/utils";

const { replaceURLReferences } = parcelUtils;

export default new Packager({
  async package({ bundle, bundleGraph }) {
    const bundleMainEntry = bundle.getMainEntry();
    const contents = await bundleMainEntry.getCode();
    const map = await bundleMainEntry.getMap();
    const { contents: newContents, map: newMap } = replaceURLReferences({
      bundle,
      bundleGraph,
      contents,
      map,
      relative: true,
    });
    return { contents: newContents, map: newMap };
  },
});
