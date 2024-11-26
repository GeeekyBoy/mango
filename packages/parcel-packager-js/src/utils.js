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

// https://262.ecma-international.org/6.0/#sec-names-and-keywords
const IDENTIFIER_RE = /^[$_\p{ID_Start}][$_\u200C\u200D\p{ID_Continue}]*$/u;
const ID_START_RE = /^[$_\p{ID_Start}]/u;
const NON_ID_CONTINUE_RE = /[^$_\u200C\u200D\p{ID_Continue}]/gu;

/**
 * @param {string} id
 * @returns {boolean}
 */
export function isValidIdentifier(id) {
  return IDENTIFIER_RE.test(id);
}

/**
 * @param {string} name
 * @returns {string}
 */
export function makeValidIdentifier(name) {
  name = name.replace(NON_ID_CONTINUE_RE, "");
  if (!ID_START_RE.test(name)) {
    name = "_" + name;
  }
  return name;
}
