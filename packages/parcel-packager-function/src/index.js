/**
 * Copyright (c) GeeekyBoy
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Packager } from "@parcel/plugin";
import parcelUtils from "@parcel/utils";

const { replaceURLReferences, replaceInlineReferences } = parcelUtils;

export default new Packager({
  async package({ bundle, bundleGraph, getInlineBundleContents }) {
    const bundleMainEntry = bundle.getMainEntry();
    let contents = await bundleMainEntry.getCode();
    let map = await bundleMainEntry.getMap();

    ({contents, map} = replaceURLReferences({
      bundle,
      bundleGraph,
      contents,
      map,
      relative: true,
    }));

    return replaceInlineReferences({
      bundle,
      bundleGraph,
      contents,
      getInlineReplacement: (dependency, inlineType, content) => ({
        from: `"${dependency.id}"`,
        to: inlineType === "string"
          ? JSON.stringify(content)
          : content,
      }),
      getInlineBundleContents,
      map,
    });
  },
});
