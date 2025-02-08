/**
 * Copyright (c) GeeekyBoy
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import path from "path";
import { Resolver } from "@parcel/plugin";
import ParcelNodeResolver from '@parcel/node-resolver-core';

const NodeResolver = typeof ParcelNodeResolver === "object" ? ParcelNodeResolver.default : ParcelNodeResolver;

export default new Resolver({
  async loadConfig({ options, logger }) {
    return new NodeResolver({
      fs: options.inputFS,
      projectRoot: options.projectRoot,
      packageManager: options.packageManager,
      shouldAutoInstall: options.shouldAutoInstall,
      mode: options.mode,
      logger,
      packageExports: false,
    });
  },
  async resolve({ dependency, specifier, options, config: resolver }) {
    if (dependency.specifier.startsWith("function:") || dependency.specifier.startsWith("function-util:")) {
      return await resolver.resolve({
        filename: specifier,
        specifierType: "esm",
        range: dependency.range,
        parent: dependency.resolveFrom,
        env: dependency.env,
        sourcePath: dependency.sourcePath,
        loc: dependency.loc,
        packageConditions: dependency.packageConditions,
      });
    } else if (specifier.startsWith("ignore:")) {
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
