/**
 * Copyright (c) GeeekyBoy
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import path from "path";
import { Resolver } from "@parcel/plugin";

export default new Resolver({
  async resolve({ specifier, options }) {
    if (specifier.startsWith("ignore:")) {
      return {
        isExcluded: true,
      };
    } else if (specifier === '@mango-js/runtime') {
      return {
        filePath: path.join(options.projectRoot, `mango.js`),
        code: `module.exports=mango;`,
      };
    }
    return null;
  },
});
