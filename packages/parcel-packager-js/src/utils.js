/**
 * Copyright (c) GeeekyBoy
 * Some parts are derived from @parcel/packager-js
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/** @typedef {import("@parcel/types").Dependency} Dependency */

/**
 * @param {Dependency} dep
 * @returns {string}
 */
export function getSpecifier(dep) {
  if (typeof dep.meta.placeholder === "string") {
    return dep.meta.placeholder;
  }

  return dep.specifier;
}
