/**
 * Copyright (c) GeeekyBoy
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import path from "path";
import { Namer } from "@parcel/plugin";

export default new Namer({
  name({ bundle, options }) {
    const SRC_PATH = options.env.SRC_PATH;
    const bundleMainEntry = bundle.getMainEntry();
    const bundleType = bundle.type;
    const isStyleSheet = bundleType === "css";
    if (!bundleMainEntry) {
      if (isStyleSheet) {
        return `styles/styles.${bundle.hashReference}.css`;
      } else {
        return null;
      }
    }
    const isJavaScript = bundleType === "js";
    const isIsolated = bundleMainEntry.env.isIsolated();
    const isScript = bundleMainEntry.env.sourceType === "script";
    const isClassicScript = isScript && !isIsolated && isJavaScript;
    const query = bundleMainEntry.query;
    const isFunction = bundleMainEntry.pipeline === "function";
    const isFunctionUtil = bundleMainEntry.pipeline === "function-util";
    const isPage = query.has("page");
    const isComponent = query.has("component");
    const isNoHash = query.has("nohash");
    const publicDir = query.get("publicDir") || "";
    const filePath = bundleMainEntry.filePath;
    const relFilePath = path.relative(SRC_PATH, filePath);
    const isInAssets = relFilePath.startsWith("assets" + path.sep);
    const dirname = isInAssets ? path.dirname(relFilePath)
      : isFunction ? "__mango__/functions"
      : isFunctionUtil ? "__mango__/functions/utils"
      : isPage ? "pages"
      : isComponent ? path.join("components", path.dirname(relFilePath))
      : isStyleSheet ? "styles"
      : isClassicScript ? "scripts"
      : publicDir;
    let name = isPage ? "page"
      : isStyleSheet ? "styles"
      : isFunction ? "function"
      : isFunctionUtil ? "function-util"
      : path.basename(relFilePath, path.extname(relFilePath));
    if (!bundle.needsStableName && !isNoHash) {
      name += "." + bundle.hashReference;
    }
    name += "." + bundleType;
    return path.join(dirname, name);
  },
});
