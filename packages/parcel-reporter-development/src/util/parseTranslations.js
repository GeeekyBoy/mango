/**
 * Copyright (c) GeeekyBoy
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import icuParser from "@formatjs/icu-messageformat-parser";

/**
 * @param {{ [key: string]: any }} obj
 * @param {string} prefix
 * @returns {{ [key: string]: string }}
 */
const flattenTranslations = (obj, prefix = "") => {
  return Object.keys(obj).reduce((acc, k) => {
    const pre = prefix.length ? prefix + "." : "";
    if (typeof obj[k] === "object") {
      Object.assign(acc, flattenTranslations(obj[k], pre + k));
    } else {
      acc[pre + k] = obj[k];
    }
    return acc;
  }, {});
}

/**
 * @param {{ [key: string]: any }} translations
 * @returns {{ [key: string]: icuParser.MessageFormatElement[] }}
 */
export default function parseTranslations(translations) {
  const flatTranslations = flattenTranslations(translations);
  for (const key in flatTranslations) {
    flatTranslations[key] = icuParser.parse(flatTranslations[key]);
  }
  return flatTranslations;
}
