/**
 * Copyright (c) GeeekyBoy
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

// @mango

/**
 * @typedef {Window & typeof globalThis & { $cp: (string|string[]|RegExp)[] }} WindowWithRouteData
 */

/**
 * Route parameters determined by the route pattern.
 *
 * @type {Object<string, string>}
 * @example
 * // Assuming the current URL is "/foo/bar/baz"
 * // And the route pattern is "/foo/:bar/:baz"
 * $routeParams.bar // "bar"
 * $routeParams.baz // "baz"
 * $routeParams.qux // undefined
 * $routeParams["*"] // undefined
 * @example
 * // Assuming the current URL is "/foo/bar/baz/qux/quux"
 * // And the route pattern is "/foo/:bar/:baz/*"
 * $routeParams.bar // "bar"
 * $routeParams.baz // "baz"
 * $routeParams["*"] // "/qux/quux"
 */
var $routeParams = {};

/**
 * Query parameters determined by the query string after the "?".
 *
 * @type {Object<string, string>}
 * @example
 * // Assuming the current URL is "/?foo=bar&baz=qux"
 * $routeQuery.foo // "bar"
 * $routeQuery.baz // "qux"
 */
var $routeQuery = {};

/**
 * Hash of the current URL determined by the string after the "#".
 *
 * @type {string}
 * @example
 * // Assuming the current URL is "/?foo=bar#baz"
 * $routeHash // "baz"
 */
var $routeHash = "";

/**
 * Pathname of the current URL determined by the string before the "?" and "#".
 *
 * @type {string}
 * @example
 * // Assuming the current URL is "/foo/bar?baz=qux#quux"
 * $routePath // "/foo/bar"
 */
var $routePath = "";

/**
 * Route pattern that matched the current URL.
 *
 * @type {string}
 * @example
 * // Assuming the current URL is "/foo/bar/baz"
 * // And the route pattern is "/foo/:bar/:baz"
 * $routePattern // "/foo/[bar]/[baz]"
 */
var $routePattern = "";

/**
 * Refreshes the route data based on the current URL.
 */
function refreshRouteData() {
  var path = window.location.pathname;
  if (path.indexOf("?") !== -1) path = path.split("?")[0];
  if (path.indexOf("#") !== -1) path = path.split("#")[0];
  /** @type {Object<string, string>} */
  var params = {};
  /** @type {Object<string, string>} */
  var query = {};
  var pattern = "";
  if (window.location.search.length > 1) {
    var tokenizedQuery = window.location.search.slice(1).split("&");
    for (var i = 0; i < tokenizedQuery.length; i++) {
      const keyValue = tokenizedQuery[i].split("=");
      query[decodeURIComponent(keyValue[0])] = decodeURIComponent(keyValue[1] || "");
    }
  }
  for (var k = 0; k < /** @type {WindowWithRouteData} **/ (window).$cp.length; k += 3) {
    var match = /** @type {RegExp} **/ (/** @type {WindowWithRouteData} **/ (window).$cp[k + 2]).exec(path);
    if (match) {
      for (var j = 1; j < match.length; j++) {
        params[/** @type {WindowWithRouteData} **/ (window).$cp[k + 1][j - 1]] = match[j];
      }
      pattern = /** @type {string} **/ (/** @type {WindowWithRouteData} **/ (window).$cp[k]);
      break;
    }
  }
  $routeParams = params;
  $routeQuery = query;
  $routeHash = window.location.hash.slice(1);
  $routePath = path;
  $routePattern = pattern;
}

if (window["onpopstate"] !== undefined) {
  window.onpopstate = refreshRouteData;
}

refreshRouteData();

/**
 * Navigates to a new path.
 *
 * @param {string | number} nextPath - Path to navigate to or a number to go back/forward in history.
 * @param {boolean} shouldReplace - Whether to replace the current history entry or not.
 */
function navigate(nextPath, shouldReplace) {
  if (!isNaN(/** @type {number} */ (nextPath))) {
    window.history.go(/** @type {number} */ (nextPath));
  } else {
    if (window.history["pushState"] !== undefined) {
      window.history[shouldReplace ? "replaceState" : "pushState"]({}, document.title, /** @type {string} */ (nextPath));
      refreshRouteData();
    } else {
      window.location.href = /** @type {string} */ (nextPath);
    }
  }
}

export {
  navigate,
  $routePath,
  $routeParams,
  $routeQuery,
  $routeHash,
  $routePattern
}
